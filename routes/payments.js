const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Order = require('../models/Order');
const NotificationService = require('../services/notificationService');

// Create payment intent
router.post('/create-intent', protect, async (req, res) => {
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const { orderId } = req.body;

    const order = await Order.findById(orderId).populate('lot', 'title');
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    if (order.buyer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, error: 'Order already paid' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.totalAmount * 100), // cents
      currency: 'usd',
      metadata: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
      },
      description: `Augeo Auction - ${order.orderNumber}`,
    });

    order.stripePaymentIntentId = paymentIntent.id;
    order.paymentStatus = 'processing';
    await order.save();

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Confirm payment
router.post('/confirm', protect, async (req, res) => {
  try {
    const { orderId, paymentIntentId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      order.paymentStatus = 'paid';
      order.status = 'confirmed';
      order.paidAt = new Date();
      order.stripeChargeId = paymentIntent.latest_charge;
      await order.save();

      // Send payment confirmation notification
      const io = req.app.get('io');
      if (io) {
        await NotificationService.create({
          recipient: order.buyer,
          type: 'payment_confirmed',
          title: 'Payment Confirmed',
          message: `Your payment of $${order.totalAmount.toLocaleString()} for order ${order.orderNumber} has been confirmed.`,
          order: order._id,
          actionUrl: `/dashboard/orders/${order._id}`,
          priority: 'high',
        });
      }

      res.json({ success: true, data: order });
    } else {
      order.paymentStatus = 'failed';
      await order.save();
      res.status(400).json({ success: false, error: 'Payment not successful', status: paymentIntent.status });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stripe webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const order = await Order.findOne({ stripePaymentIntentId: paymentIntent.id });
        if (order && order.paymentStatus !== 'paid') {
          order.paymentStatus = 'paid';
          order.status = 'confirmed';
          order.paidAt = new Date();
          order.stripeChargeId = paymentIntent.latest_charge;
          await order.save();
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        const order = await Order.findOne({ stripePaymentIntentId: paymentIntent.id });
        if (order) {
          order.paymentStatus = 'failed';
          await order.save();
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;