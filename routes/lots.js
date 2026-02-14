const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/auth');
const Lot = require('../models/Lot');
const Bid = require('../models/Bid');
const Auction = require('../models/Auction');

// Get lots by auction
router.get('/auction/:auctionId', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const filter = { auction: req.params.auctionId };
    if (req.query.status) filter.status = req.query.status;

    const total = await Lot.countDocuments(filter);
    const lots = await Lot.find(filter)
      .sort('displayOrder lotNumber')
      .skip(skip)
      .limit(limit)
      .populate('category', 'name slug')
      .populate('currentBidder', 'firstName lastName');

    res.json({
      success: true,
      data: lots,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get lot by ID
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const lot = await Lot.findById(req.params.id)
      .populate('auction', 'title slug status endTime buyersPremium client')
      .populate('category', 'name slug')
      .populate('currentBidder', 'firstName lastName')
      .populate('winner', 'firstName lastName')
      .populate('questions.user', 'firstName lastName');

    if (!lot) return res.status(404).json({ success: false, error: 'Lot not found' });

    lot.viewCount += 1;
    await lot.save();

    res.json({ success: true, data: lot });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get bid history for a lot
router.get('/:id/bids', async (req, res) => {
  try {
    const bids = await Bid.find({ lot: req.params.id })
      .sort({ timestamp: -1 })
      .limit(100)
      .populate('bidder', 'firstName lastName');

    const sanitizedBids = bids.map(b => ({
      _id: b._id,
      amount: b.amount,
      bidderName: `${b.bidder.firstName} ${b.bidder.lastName.charAt(0)}.`,
      bidType: b.bidType,
      timestamp: b.timestamp,
      isWinning: b.isWinning,
    }));

    res.json({ success: true, data: sanitizedBids });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ask question on a lot
router.post('/:id/questions', protect, async (req, res) => {
  try {
    const lot = await Lot.findById(req.params.id);
    if (!lot) return res.status(404).json({ success: false, error: 'Lot not found' });

    lot.questions.push({
      user: req.user._id,
      question: req.body.question,
    });
    await lot.save();

    res.status(201).json({ success: true, data: lot.questions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
