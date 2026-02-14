const mongoose = require('mongoose');
const slugify = require('slugify');

const auctionSchema = new mongoose.Schema({
  title: { type: String, required: [true, 'Auction title is required'], trim: true, maxlength: 200 },
  slug: { type: String, unique: true },
  description: { type: String, required: [true, 'Description is required'] },
  shortDescription: { type: String, maxlength: 500 },

  // Client / auction house
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Category
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  tags: [{ type: String }],

  // Images
  coverImage: { type: String },
  bannerImage: { type: String },
  images: [{ type: String }],

  // Timing
  startTime: { type: Date, required: [true, 'Start time is required'] },
  endTime: { type: Date, required: [true, 'End time is required'] },
  timezone: { type: String, default: 'UTC' },

  // Status
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'live', 'ended', 'cancelled', 'paused', 'suspended'],
    default: 'draft',
  },
  isPublished: { type: Boolean, default: false },
  isFeatured: { type: Boolean, default: false },

  // Auction settings
  auctionType: { type: String, enum: ['timed', 'live'], default: 'timed' },
  buyersPremium: { type: Number, default: 15 },
  currency: { type: String, default: 'USD' },
  requiresApproval: { type: Boolean, default: false },

  // Location
  location: {
    address: String,
    city: String,
    state: String,
    country: String,
  },

  // Terms
  termsAndConditions: { type: String },
  shippingTerms: { type: String },
  paymentTerms: { type: String },

  // Stats
  totalLots: { type: Number, default: 0 },
  totalBids: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  viewCount: { type: Number, default: 0 },
  watchCount: { type: Number, default: 0 },

  // SEO
  seoTitle: { type: String },
  seoDescription: { type: String },
  seoKeywords: [{ type: String }],

  // Admin override
  adminNotes: { type: String },
  suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  suspensionReason: { type: String },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Virtual for lots
auctionSchema.virtual('lots', {
  ref: 'Lot',
  localField: '_id',
  foreignField: 'auction',
  justOne: false,
});

// Generate slug
auctionSchema.pre('save', function (next) {
  if (this.isModified('title')) {
    this.slug = slugify(this.title, { lower: true, strict: true }) + '-' + Date.now();
  }
  next();
});

// Indexes
auctionSchema.index({ slug: 1 });
auctionSchema.index({ status: 1, startTime: 1 });
auctionSchema.index({ client: 1 });
auctionSchema.index({ category: 1 });
auctionSchema.index({ isFeatured: 1, status: 1 });
auctionSchema.index({ title: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('Auction', auctionSchema);
