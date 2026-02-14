const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  type: {
    type: String,
    enum: [
      'auction_starting', 'auction_ending', 'auction_ended',
      'bid_placed', 'outbid', 'auction_won', 'auction_lost',
      'payment_pending', 'payment_confirmed', 'payment_failed',
      'shipment_dispatched', 'delivery_completed',
      'account_verification', 'kyc_approved', 'kyc_rejected',
      'order_confirmed', 'order_shipped', 'order_delivered',
      'watchlist_reminder', 'price_drop',
      'client_approved', 'client_suspended',
      'system_alert', 'admin_message',
      'question_answered', 'bid_approved', 'bid_rejected',
      'payout_processed',
    ],
    required: true,
  },

  title: { type: String, required: true },
  message: { type: String, required: true },

  // Related entities
  auction: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction' },
  lot: { type: mongoose.Schema.Types.ObjectId, ref: 'Lot' },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  bid: { type: mongoose.Schema.Types.ObjectId, ref: 'Bid' },

  // Link to navigate
  actionUrl: { type: String },

  // Delivery channels
  channels: {
    onSite: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
    sms: { type: Boolean, default: false },
  },
  emailSent: { type: Boolean, default: false },
  smsSent: { type: Boolean, default: false },

  isRead: { type: Boolean, default: false },
  readAt: { type: Date },

  // Priority
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
}, {
  timestamps: true,
});

// Indexes
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
