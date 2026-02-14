const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Order = require('../models/Order');

// Get user's orders
router.get('/', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { buyer: req.user._id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;

    const total = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .populate({ path: 'lot', select: 'title lotNumber images' })
      .populate({ path: 'auction', select: 'title slug' })
      .populate({ path: 'client', select: 'companyName' });

    res.json({
      success: true,
      data: orders,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get order by ID
router.get('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate({ path: 'lot', select: 'title lotNumber images description' })
      .populate({ path: 'auction', select: 'title slug buyersPremium' })
      .populate({ path: 'client', select: 'companyName email phone' })
      .populate({ path: 'bid', select: 'amount timestamp' });

    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    if (order.buyer.toString() !== req.user._id.toString() &&
        req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get invoice
router.get('/:id/invoice', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('lot', 'title lotNumber')
      .populate('auction', 'title')
      .populate('buyer', 'firstName lastName email')
      .populate('client', 'companyName');

    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    if (order.buyer._id.toString() !== req.user._id.toString() &&
        req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update shipping address on order
router.put('/:id/shipping-address', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    if (order.buyer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    if (order.shippingStatus !== 'pending') {
      return res.status(400).json({ success: false, error: 'Cannot update shipping address after processing' });
    }

    order.shippingAddress = req.body;
    order.shippingMethod = req.body.shippingMethod;
    await order.save();

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
