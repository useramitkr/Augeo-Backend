const express = require('express');
const router = express.Router();
const Auction = require('../models/Auction');
const Lot = require('../models/Lot');

// Global search
router.get('/', async (req, res) => {
  try {
    const { q, type, category, minPrice, maxPrice, status, sort } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Search query must be at least 2 characters' });
    }

    const regex = new RegExp(q, 'i');
    let results = [];
    let total = 0;

    if (!type || type === 'auctions') {
      const auctionFilter = {
        isPublished: true,
        $or: [{ title: regex }, { description: regex }, { tags: regex }],
      };
      if (status) auctionFilter.status = status;
      if (category) auctionFilter.category = category;

      const auctionTotal = await Auction.countDocuments(auctionFilter);
      const auctions = await Auction.find(auctionFilter)
        .populate('category', 'name slug')
        .populate('client', 'companyName companyLogo')
        .sort(sort === 'ending-soon' ? 'endTime' : '-createdAt')
        .skip(skip)
        .limit(limit);

      if (!type) {
        results = auctions.map(a => ({ ...a.toObject(), resultType: 'auction' }));
        total = auctionTotal;
      } else {
        results = auctions;
        total = auctionTotal;
      }
    }

    if (type === 'lots') {
      const lotFilter = {
        $or: [{ title: regex }, { description: regex }, { artist: regex }],
      };
      if (category) lotFilter.category = category;
      if (minPrice) lotFilter.currentBid = { ...lotFilter.currentBid, $gte: parseInt(minPrice) };
      if (maxPrice) lotFilter.currentBid = { ...lotFilter.currentBid, $lte: parseInt(maxPrice) };

      total = await Lot.countDocuments(lotFilter);
      results = await Lot.find(lotFilter)
        .populate('auction', 'title slug status endTime')
        .populate('category', 'name slug')
        .sort(sort === 'price-low' ? 'currentBid' : sort === 'price-high' ? '-currentBid' : '-createdAt')
        .skip(skip)
        .limit(limit);
    }

    res.json({
      success: true,
      data: results,
      query: q,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;