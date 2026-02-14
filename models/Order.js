const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true, required: true },

  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  auction: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true },
  lot: { type: mongoose.Schema.Types.ObjectId, ref: 'Lot', required: true },
  bid: { type: mongoose.Schema.Types.ObjectId, ref: 'Bid', required: true },

  // Pricing
  hammerPrice: { type: Number, required: true },
  buyersPremium: { type: Number, required: true },
  buyersPremiumRate: { type: Number, required: true },
  tax: { type: Number, default: 0 },
  taxRate: { type: Number, default: 0 },
  shippingCost: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },

  // Payment
  paymentStatus: {
    type: String,
    enum: ['pending', 'processing', 'paid', 'failed', 'refunded', 'partially_refunded'],
    default: 'pending',
  },
  paymentMethod: { type: String },
  stripePaymentIntentId: { type: String },
  stripeChargeId: { type: String },
  paidAt: { type: Date },

  // Shipping
  shippingMethod: { type: String },
  shippingAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
  },
  shippingStatus: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'in_transit', 'delivered', 'returned'],
    default: 'pending',
  },
  trackingNumber: { type: String },
  trackingUrl: { type: String },
  shippedAt: { type: Date },
  deliveredAt: { type: Date },

  // Status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'disputed', 'refunded'],
    default: 'pending',
  },

  // Commission / payout to client
  commissionRate: { type: Number },
  commissionAmount: { type: Number },
  clientPayoutAmount: { type: Number },
  payoutStatus: {
    type: String,
    enum: ['pending', 'approved', 'processing', 'completed'],
    default: 'pending',
  },
  payoutDate: { type: Date },

  // Invoice
  invoiceNumber: { type: String },
  invoiceUrl: { type: String },

  // Notes
  buyerNotes: { type: String },
  clientNotes: { type: String },
  adminNotes: { type: String },

  // Support
  supportTickets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SupportTicket' }],
}, {
  timestamps: true,
});

// Generate order number
orderSchema.pre('save', function (next) {
  if (!this.orderNumber) {
    this.orderNumber = 'AUG-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
  }
  next();
});

// Indexes
orderSchema.index({ buyer: 1 });
orderSchema.index({ client: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ orderNumber: 1 });

module.exports = mongoose.model('Order', orderSchema);
