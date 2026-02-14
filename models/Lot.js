const mongoose = require('mongoose');

const lotSchema = new mongoose.Schema({
  auction: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  lotNumber: { type: Number, required: true },
  title: { type: String, required: [true, 'Lot title is required'], trim: true },
  description: { type: String, required: [true, 'Description is required'] },

  // Images & media
  images: [{ url: String, caption: String, order: Number }],
  videos: [{ url: String, caption: String }],

  // Condition
  conditionReport: { type: String },
  conditionRating: { type: String, enum: ['mint', 'excellent', 'very_good', 'good', 'fair', 'poor'] },
  provenance: { type: String },
  authenticity: { type: String },
  certificateOfAuthenticity: { type: String },

  // Pricing
  startingBid: { type: Number, required: [true, 'Starting bid is required'], min: 0 },
  reservePrice: { type: Number, default: 0 },
  estimateLow: { type: Number },
  estimateHigh: { type: Number },
  bidIncrement: { type: Number, default: 10 },

  // Current bid state
  currentBid: { type: Number, default: 0 },
  currentBidder: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  totalBids: { type: Number, default: 0 },
  bidHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Bid' }],

  // Auto-bid
  autoBidEnabled: { type: Boolean, default: true },

  // Status
  status: {
    type: String,
    enum: ['pending', 'active', 'sold', 'unsold', 'withdrawn', 'passed'],
    default: 'pending',
  },
  isReserveMet: { type: Boolean, default: false },

  // Category & details
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  dimensions: { type: String },
  weight: { type: String },
  materials: { type: String },
  yearCreated: { type: String },
  artist: { type: String },
  origin: { type: String },

  // Shipping
  shippingOptions: [{
    method: String,
    cost: Number,
    estimatedDays: String,
    description: String,
  }],
  isShippingAvailable: { type: Boolean, default: true },

  // Display order
  displayOrder: { type: Number, default: 0 },

  // Winner info
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  winningBid: { type: Number },
  hammerPrice: { type: Number },

  // Questions
  questions: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    question: String,
    answer: String,
    askedAt: { type: Date, default: Date.now },
    answeredAt: Date,
    isPublic: { type: Boolean, default: true },
  }],

  viewCount: { type: Number, default: 0 },
  watchCount: { type: Number, default: 0 },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes
lotSchema.index({ auction: 1, lotNumber: 1 });
lotSchema.index({ status: 1 });
lotSchema.index({ client: 1 });
lotSchema.index({ category: 1 });
lotSchema.index({ title: 'text', description: 'text', artist: 'text' });

module.exports = mongoose.model('Lot', lotSchema);
