const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const User = require('../models/User');
const SupportTicket = require('../models/SupportTicket');

// Update profile
router.put('/profile', protect, [
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
  body('phone').optional().trim(),
], validate, async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { firstName, lastName, phone },
      { new: true, runValidators: true }
    );
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update avatar
router.put('/avatar', protect, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: `/uploads/images/${req.file.filename}` },
      { new: true }
    );
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add address
router.post('/addresses', protect, [
  body('street').notEmpty(), body('city').notEmpty(),
  body('state').notEmpty(), body('zipCode').notEmpty(), body('country').notEmpty(),
], validate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (req.body.isDefault) {
      user.addresses.forEach(a => { a.isDefault = false; });
    }
    user.addresses.push(req.body);
    await user.save();
    res.json({ success: true, data: user.addresses });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update address
router.put('/addresses/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const address = user.addresses.id(req.params.id);
    if (!address) return res.status(404).json({ success: false, error: 'Address not found' });

    if (req.body.isDefault) {
      user.addresses.forEach(a => { a.isDefault = false; });
    }
    Object.assign(address, req.body);
    await user.save();
    res.json({ success: true, data: user.addresses });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete address
router.delete('/addresses/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.addresses.pull(req.params.id);
    await user.save();
    res.json({ success: true, data: user.addresses });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload KYC documents
router.post('/kyc', protect, upload.array('kycDocuments', 3), async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const documents = req.files.map(f => ({
      type: req.body.documentType || 'id',
      url: `/uploads/documents/${f.filename}`,
    }));
    user.kycDocuments.push(...documents);
    user.kycStatus = 'pending';
    await user.save();
    res.json({ success: true, data: { kycStatus: user.kycStatus, documents: user.kycDocuments } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Submit support ticket
router.post('/support', protect, [
  body('subject').notEmpty(), body('description').notEmpty(),
], validate, async (req, res) => {
  try {
    const ticket = await SupportTicket.create({
      user: req.user._id,
      subject: req.body.subject,
      description: req.body.description,
      category: req.body.category || 'other',
      priority: req.body.priority || 'normal',
      order: req.body.orderId,
      messages: [{ sender: req.user._id, message: req.body.description }],
    });
    res.status(201).json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Change password
router.put('/change-password', protect, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }),
], validate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.matchPassword(req.body.currentPassword);
    if (!isMatch) return res.status(400).json({ success: false, error: 'Current password is incorrect' });

    user.password = req.body.newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save search
router.post('/saved-searches', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.savedSearches.push({ name: req.body.name, filters: req.body.filters });
    await user.save();
    res.json({ success: true, data: user.savedSearches });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete saved search
router.delete('/saved-searches/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.savedSearches.pull(req.params.id);
    await user.save();
    res.json({ success: true, data: user.savedSearches });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
