const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const Auction = require('../models/Auction');
const Lot = require('../models/Lot');
const APIFeatures = require('../utils/apiFeatures');

// Get all public auctions
router.get('/', async (req, res) => {
  try {
    let query = Auction.find({ isPublished: true })
      .populate('category', 'name slug')
      .populate('client', 'firstName lastName companyName companyLogo');

    if (req.query.status) query = query.where('status').equals(req.query.status);
    if (req.query.category) query = query.where('category').equals(req.query.category);
    if (req.query.featured === 'true') query = query.where('isFeatured').equals(true);

    // Search
    if (req.query.search) {
      const regex = new RegExp(req.query.search, 'i');
      query = query.find({ $or: [{ title: regex }, { description: regex }, { tags: regex }] });
    }

    // Sort
    const sortMap = {
      'newest': '-createdAt',
      'ending-soon': 'endTime',
      'starting-soon': 'startTime',
      'most-bids': '-totalBids',
      'most-lots': '-totalLots',
    };
    const sortBy = sortMap[req.query.sort] || '-createdAt';
    query = query.sort(sortBy);

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;
    const total = await Auction.countDocuments(query.getFilter());

    query = query.skip(skip).limit(limit);
    const auctions = await query;

    res.json({
      success: true,
      data: auctions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get featured auctions
router.get('/featured', async (req, res) => {
  try {
    const auctions = await Auction.find({
      isPublished: true,
      isFeatured: true,
      status: { $in: ['live', 'scheduled'] },
    })
      .populate('category', 'name slug')
      .populate('client', 'firstName lastName companyName companyLogo')
      .sort('-createdAt')
      .limit(6);

    res.json({ success: true, data: auctions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get auction by slug
router.get('/:slug', optionalAuth, async (req, res) => {
  try {
    const auction = await Auction.findOne({ slug: req.params.slug })
      .populate('category', 'name slug')
      .populate('client', 'firstName lastName companyName companyLogo companyDescription companyWebsite');

    if (!auction) return res.status(404).json({ success: false, error: 'Auction not found' });

    // Increment view
    auction.viewCount += 1;
    await auction.save();

    // Get lots
    const lots = await Lot.find({ auction: auction._id })
      .sort('displayOrder lotNumber')
      .populate('currentBidder', 'firstName lastName')
      .populate('category', 'name slug');

    res.json({ success: true, data: { ...auction.toObject(), lots } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get auctions by category
router.get('/category/:categorySlug', async (req, res) => {
  try {
    const Category = require('../models/Category');
    const category = await Category.findOne({ slug: req.params.categorySlug });
    if (!category) return res.status(404).json({ success: false, error: 'Category not found' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const filter = { isPublished: true, category: category._id };
    const total = await Auction.countDocuments(filter);
    const auctions = await Auction.find(filter)
      .populate('category', 'name slug')
      .populate('client', 'companyName')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      data: auctions,
      category,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
