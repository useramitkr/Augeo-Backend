const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const User = require('../models/User');
const Auction = require('../models/Auction');
const Lot = require('../models/Lot');
const Bid = require('../models/Bid');
const Order = require('../models/Order');

// All client routes require authentication + client role
router.use(protect, authorize('client', 'client_staff', 'client_editor', 'client_manager'));

// ---------- DASHBOARD ----------
router.get('/dashboard', async (req, res) => {
  try {
    const clientId = req.user._id;
    const [totalAuctions, activeLots, totalRevenue, pendingOrders] = await Promise.all([
      Auction.countDocuments({ client: clientId }),
      Lot.countDocuments({ client: clientId, status: 'active' }),
      Order.aggregate([{ $match: { client: clientId, paymentStatus: 'paid' } }, { $group: { _id: null, total: { $sum: '$hammerPrice' } } }]),
      Order.countDocuments({ client: clientId, status: 'pending' }),
    ]);

    const recentOrders = await Order.find({ client: clientId }).sort('-createdAt').limit(5)
      .populate('buyer', 'firstName lastName').populate('lot', 'title lotNumber');

    const recentAuctions = await Auction.find({ client: clientId }).sort('-createdAt').limit(5);

    res.json({
      success: true,
      data: {
        stats: { totalAuctions, activeLots, totalRevenue: totalRevenue[0]?.total || 0, pendingOrders },
        recentOrders,
        recentAuctions,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------- AUCTION MANAGEMENT ----------
router.get('/auctions', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { client: req.user._id };
    if (req.query.status) filter.status = req.query.status;

    const total = await Auction.countDocuments(filter);
    const auctions = await Auction.find(filter).populate('category', 'name slug').sort('-createdAt').skip(skip).limit(limit);

    res.json({ success: true, data: auctions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/auctions/:id', async (req, res) => {
  try {
    const auction = await Auction.findOne({ _id: req.params.id, client: req.user._id }).populate('category', 'name slug');
    if (!auction) return res.status(404).json({ success: false, error: 'Auction not found' });
    res.json({ success: true, data: auction });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/auctions', [
  body('title').notEmpty().withMessage('Title is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('startTime').notEmpty().withMessage('Start time is required'),
  body('endTime').notEmpty().withMessage('End time is required'),
], validate, async (req, res) => {
  try {
    const auction = await Auction.create({ ...req.body, client: req.user._id });
    res.status(201).json({ success: true, data: auction });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/auctions/:id', async (req, res) => {
  try {
    const auction = await Auction.findOneAndUpdate(
      { _id: req.params.id, client: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!auction) return res.status(404).json({ success: false, error: 'Auction not found' });
    res.json({ success: true, data: auction });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/auctions/:id/publish', async (req, res) => {
  try {
    const auction = await Auction.findOne({ _id: req.params.id, client: req.user._id });
    if (!auction) return res.status(404).json({ success: false, error: 'Auction not found' });

    const lotCount = await Lot.countDocuments({ auction: auction._id });
    if (lotCount === 0) return res.status(400).json({ success: false, error: 'Add at least one lot before publishing' });

    auction.isPublished = true;
    auction.status = new Date(auction.startTime) <= new Date() ? 'live' : 'scheduled';
    auction.totalLots = lotCount;
    await auction.save();

    res.json({ success: true, data: auction });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/auctions/:id/unpublish', async (req, res) => {
  try {
    const auction = await Auction.findOneAndUpdate(
      { _id: req.params.id, client: req.user._id },
      { isPublished: false, status: 'draft' },
      { new: true }
    );
    res.json({ success: true, data: auction });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------- LOT MANAGEMENT ----------
router.get('/auctions/:auctionId/lots', async (req, res) => {
  try {
    const auction = await Auction.findOne({ _id: req.params.auctionId, client: req.user._id });
    if (!auction) return res.status(404).json({ success: false, error: 'Auction not found' });

    const lots = await Lot.find({ auction: req.params.auctionId })
      .sort('displayOrder lotNumber')
      .populate('currentBidder', 'firstName lastName');

    res.json({ success: true, data: lots });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/auctions/:auctionId/lots', [
  body('title').notEmpty(),
  body('description').notEmpty(),
  body('startingBid').isFloat({ min: 0 }),
], validate, async (req, res) => {
  try {
    const auction = await Auction.findOne({ _id: req.params.auctionId, client: req.user._id });
    if (!auction) return res.status(404).json({ success: false, error: 'Auction not found' });

    const lotCount = await Lot.countDocuments({ auction: req.params.auctionId });

    const lot = await Lot.create({
      ...req.body,
      auction: req.params.auctionId,
      client: req.user._id,
      lotNumber: req.body.lotNumber || lotCount + 1,
      displayOrder: req.body.displayOrder || lotCount,
    });

    // Update auction lot count
    auction.totalLots = lotCount + 1;
    await auction.save();

    res.status(201).json({ success: true, data: lot });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/lots/:id', async (req, res) => {
  try {
    const lot = await Lot.findOneAndUpdate(
      { _id: req.params.id, client: req.user._id },
      req.body,
      { new: true }
    );
    if (!lot) return res.status(404).json({ success: false, error: 'Lot not found' });
    res.json({ success: true, data: lot });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/lots/:id', async (req, res) => {
  try {
    const lot = await Lot.findOne({ _id: req.params.id, client: req.user._id });
    if (!lot) return res.status(404).json({ success: false, error: 'Lot not found' });
    if (lot.totalBids > 0) return res.status(400).json({ success: false, error: 'Cannot delete lot with existing bids' });

    await Lot.findByIdAndDelete(req.params.id);

    // Update auction lot count
    const lotCount = await Lot.countDocuments({ auction: lot.auction });
    await Auction.findByIdAndUpdate(lot.auction, { totalLots: lotCount });

    res.json({ success: true, message: 'Lot deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload lot images
router.post('/lots/:id/images', upload.array('images', 10), async (req, res) => {
  try {
    const lot = await Lot.findOne({ _id: req.params.id, client: req.user._id });
    if (!lot) return res.status(404).json({ success: false, error: 'Lot not found' });

    const newImages = req.files.map((f, i) => ({
      url: `/uploads/images/${f.filename}`,
      caption: '',
      order: lot.images.length + i,
    }));

    lot.images.push(...newImages);
    await lot.save();

    res.json({ success: true, data: lot.images });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Answer question on lot
router.put('/lots/:lotId/questions/:questionId/answer', async (req, res) => {
  try {
    const lot = await Lot.findOne({ _id: req.params.lotId, client: req.user._id });
    if (!lot) return res.status(404).json({ success: false, error: 'Lot not found' });

    const question = lot.questions.id(req.params.questionId);
    if (!question) return res.status(404).json({ success: false, error: 'Question not found' });

    question.answer = req.body.answer;
    question.answeredAt = new Date();
    await lot.save();

    res.json({ success: true, data: lot.questions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------- ORDERS ----------
router.get('/orders', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { client: req.user._id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;

    const total = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .populate('buyer', 'firstName lastName email')
      .populate('lot', 'title lotNumber')
      .populate('auction', 'title')
      .sort('-createdAt').skip(skip).limit(limit);

    res.json({ success: true, data: orders, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/orders/:id', async (req, res) => {
  try {
    const { shippingStatus, trackingNumber, trackingUrl } = req.body;
    const update = {};
    if (shippingStatus) update.shippingStatus = shippingStatus;
    if (trackingNumber) update.trackingNumber = trackingNumber;
    if (trackingUrl) update.trackingUrl = trackingUrl;
    if (shippingStatus === 'shipped') update.shippedAt = new Date();
    if (shippingStatus === 'delivered') { update.deliveredAt = new Date(); update.status = 'delivered'; }

    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, client: req.user._id },
      update,
      { new: true }
    );
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    // Notify buyer
    if (shippingStatus === 'shipped') {
      const io = req.app.get('io');
      const NotificationService = require('../services/notificationService');
      await NotificationService.create({
        recipient: order.buyer,
        type: 'shipment_dispatched',
        title: 'Order Shipped',
        message: `Your order ${order.orderNumber} has been shipped.${trackingNumber ? ` Tracking: ${trackingNumber}` : ''}`,
        order: order._id,
        actionUrl: `/dashboard/orders/${order._id}`,
      });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------- REPORTS ----------
router.get('/reports', async (req, res) => {
  try {
    const clientId = req.user._id;

    const auctionPerformance = await Auction.find({ client: clientId, status: 'ended' })
      .select('title totalLots totalBids totalRevenue endTime')
      .sort('-endTime').limit(20);

    const revenueByAuction = await Order.aggregate([
      { $match: { client: clientId, paymentStatus: 'paid' } },
      { $group: { _id: '$auction', revenue: { $sum: '$hammerPrice' }, orders: { $sum: 1 } } },
      { $lookup: { from: 'auctions', localField: '_id', foreignField: '_id', as: 'auction' } },
      { $unwind: '$auction' },
      { $project: { auctionTitle: '$auction.title', revenue: 1, orders: 1 } },
      { $sort: { revenue: -1 } },
    ]);

    const totalStats = await Order.aggregate([
      { $match: { client: clientId, paymentStatus: 'paid' } },
      { $group: { _id: null, totalRevenue: { $sum: '$hammerPrice' }, totalOrders: { $sum: 1 }, avgOrderValue: { $avg: '$totalAmount' } } },
    ]);

    res.json({
      success: true,
      data: {
        auctionPerformance,
        revenueByAuction,
        totalStats: totalStats[0] || { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------- CLIENT PROFILE ----------
router.put('/profile', async (req, res) => {
  try {
    const { companyName, companyDescription, companyWebsite } = req.body;
    const user = await User.findByIdAndUpdate(req.user._id, { companyName, companyDescription, companyWebsite }, { new: true });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/bank-details', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.user._id, { bankDetails: req.body }, { new: true });
    res.json({ success: true, data: user.bankDetails });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;