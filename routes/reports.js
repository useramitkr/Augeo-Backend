const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Auction = require('../models/Auction');
const Lot = require('../models/Lot');
const Order = require('../models/Order');
const Bid = require('../models/Bid');
const User = require('../models/User');

// Get reports (admin/client)
router.get('/', protect, authorize('admin', 'superadmin', 'client', 'client_manager'), async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;
    const isAdmin = ['admin', 'superadmin'].includes(req.user.role);

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    let report = {};

    switch (type) {
      case 'revenue': {
        const orderFilter = {};
        if (!isAdmin) orderFilter.client = req.user._id;
        if (hasDateFilter) orderFilter.createdAt = dateFilter;

        const orders = await Order.find({ ...orderFilter, paymentStatus: 'paid' });
        report = {
          totalRevenue: orders.reduce((sum, o) => sum + o.hammerPrice, 0),
          totalBuyersPremium: orders.reduce((sum, o) => sum + o.buyersPremium, 0),
          totalOrders: orders.length,
          totalCommission: orders.reduce((sum, o) => sum + (o.commissionAmount || 0), 0),
          averageOrderValue: orders.length > 0 ? orders.reduce((sum, o) => sum + o.totalAmount, 0) / orders.length : 0,
        };
        break;
      }
      case 'auctions': {
        const auctionFilter = {};
        if (!isAdmin) auctionFilter.client = req.user._id;
        if (hasDateFilter) auctionFilter.createdAt = dateFilter;

        const auctions = await Auction.find(auctionFilter);
        report = {
          total: auctions.length,
          live: auctions.filter(a => a.status === 'live').length,
          ended: auctions.filter(a => a.status === 'ended').length,
          scheduled: auctions.filter(a => a.status === 'scheduled').length,
          totalLots: auctions.reduce((sum, a) => sum + a.totalLots, 0),
          totalBids: auctions.reduce((sum, a) => sum + a.totalBids, 0),
          totalRevenue: auctions.reduce((sum, a) => sum + a.totalRevenue, 0),
        };
        break;
      }
      case 'users': {
        if (!isAdmin) return res.status(403).json({ success: false, error: 'Admin only' });
        const userFilter = {};
        if (hasDateFilter) userFilter.createdAt = dateFilter;

        const users = await User.find(userFilter);
        report = {
          total: users.length,
          buyers: users.filter(u => u.role === 'user').length,
          clients: users.filter(u => u.role.startsWith('client')).length,
          admins: users.filter(u => ['admin', 'superadmin'].includes(u.role)).length,
          verified: users.filter(u => u.isEmailVerified).length,
          suspended: users.filter(u => u.isSuspended).length,
        };
        break;
      }
      default: {
        // Summary
        const orderFilter = {};
        if (!isAdmin) orderFilter.client = req.user._id;

        const totalOrders = await Order.countDocuments({ ...orderFilter, paymentStatus: 'paid' });
        const totalAuctions = await Auction.countDocuments(isAdmin ? {} : { client: req.user._id });
        const totalBidsCount = await Bid.countDocuments(isAdmin ? {} : { auction: { $in: await Auction.find(isAdmin ? {} : { client: req.user._id }).distinct('_id') } });

        report = { totalOrders, totalAuctions, totalBids: totalBidsCount };
      }
    }

    res.json({ success: true, data: report, type: type || 'summary' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;