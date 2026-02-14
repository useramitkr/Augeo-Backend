const express = require('express');
const router = express.Router();
const Page = require('../models/Page');

// Get page by slug
router.get('/:slug', async (req, res) => {
  try {
    const page = await Page.findOne({ slug: req.params.slug, isPublished: true });
    if (!page) return res.status(404).json({ success: false, error: 'Page not found' });
    res.json({ success: true, data: page });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
