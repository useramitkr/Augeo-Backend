const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const Bid = require('../models/Bid');
const Lot = require('../models/Lot');
const Auction = require('../models/Auction');
const NotificationService = require('../services/notificationService');

// Place bid
router.post('/', protect, [
  body('lotId').notEmpty().withMessage('Lot ID is required'),
  body('amount').isFloat({ min: 0 }).withMessage('Valid bid amount is required'),
], validate, async (req, res) => {
  try {
    const { lotId, amount, maxAutoBid } = req.body;
    const io = req.app.get('io');

    const lot = await Lot.findById(lotId);
    if (!lot) return res.status(404).json({ success: false, error: 'Lot not found' });

    const auction = await Auction.findById(lot.auction);
    if (!auction || auction.status !== 'live') {
      return res.status(400).json({ success: false, error: 'Auction is not live' });
    }

    if (lot.status !== 'active') {
      return res.status(400).json({ success: false, error: 'Lot is not active' });
    }

    const minimumBid = lot.currentBid > 0 ? lot.currentBid + lot.bidIncrement : lot.startingBid;
    if (amount < minimumBid) {
      return res.status(400).json({ success: false, error: `Minimum bid is $${minimumBid}` });
    }

    if (lot.currentBidder && lot.currentBidder.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, error: 'You are already the highest bidder' });
    }

    const previousBidder = lot.currentBidder;

    // Create bid
    const bid = await Bid.create({
      lot: lotId,
      auction: auction._id,
      bidder: req.user._id,
      amount,
      maxAutoBid: maxAutoBid || null,
      bidType: maxAutoBid ? 'proxy' : 'manual',
      status: 'active',
      isWinning: true,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    // Update previous winning bids
    await Bid.updateMany(
      { lot: lotId, isWinning: true, _id: { $ne: bid._id } },
      { isWinning: false, status: 'outbid' }
    );

    // Update lot
    lot.currentBid = amount;
    lot.currentBidder = req.user._id;
    lot.totalBids += 1;
    lot.isReserveMet = amount >= lot.reservePrice;
    lot.bidHistory.push(bid._id);
    await lot.save();

    // Update auction
    auction.totalBids += 1;
    await auction.save();

    // Broadcast via socket
    if (io) {
      io.to(`auction:${auction._id}`).emit('bid:new', {
        lotId: lot._id,
        bidId: bid._id,
        amount: bid.amount,
        bidderId: req.user._id,
        bidderName: `${req.user.firstName} ${req.user.lastName.charAt(0)}.`,
        totalBids: lot.totalBids,
        isReserveMet: lot.isReserveMet,
        timestamp: bid.timestamp,
      });
    }

    // Notify previous bidder
    if (previousBidder && previousBidder.toString() !== req.user._id.toString() && io) {
      await NotificationService.notifyOutbid(io, previousBidder, bid, lot, auction);
    }

    res.status(201).json({ success: true, data: bid });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user's bids
router.get('/my-bids', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { bidder: req.user._id };
    if (req.query.status) filter.status = req.query.status;

    const total = await Bid.countDocuments(filter);
    const bids = await Bid.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: 'lot', select: 'title lotNumber images currentBid startingBid status' })
      .populate({ path: 'auction', select: 'title slug status endTime' });

    res.json({
      success: true,
      data: bids,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get active bids
router.get('/active', protect, async (req, res) => {
  try {
    const bids = await Bid.find({ bidder: req.user._id, status: { $in: ['active', 'winning'] } })
      .sort({ timestamp: -1 })
      .populate({ path: 'lot', select: 'title lotNumber images currentBid status' })
      .populate({ path: 'auction', select: 'title slug status endTime' });

    res.json({ success: true, data: bids });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Setup auto-bid
router.post('/auto-bid', protect, [
  body('lotId').notEmpty(),
  body('maxAmount').isFloat({ min: 0 }),
], validate, async (req, res) => {
  try {
    const { lotId, maxAmount } = req.body;
    const lot = await Lot.findById(lotId);
    if (!lot) return res.status(404).json({ success: false, error: 'Lot not found' });

    // Update or create auto-bid
    let bid = await Bid.findOne({ lot: lotId, bidder: req.user._id, maxAutoBid: { $exists: true } });
    if (bid) {
      bid.maxAutoBid = maxAmount;
      await bid.save();
    }

    res.json({ success: true, message: 'Auto-bid configured', data: { lotId, maxAmount } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
