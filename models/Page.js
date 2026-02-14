const mongoose = require('mongoose');
const slugify = require('slugify');

const pageSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, unique: true },
  content: { type: String, required: true },
  excerpt: { type: String },
  type: { type: String, enum: ['about', 'how_it_works', 'buyers_premium', 'terms', 'privacy', 'shipping', 'authentication', 'faq', 'custom'], default: 'custom' },
  isPublished: { type: Boolean, default: false },
  seoTitle: { type: String },
  seoDescription: { type: String },
  seoKeywords: [{ type: String }],
  lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: true,
});

pageSchema.pre('save', function (next) {
  if (this.isModified('title')) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
  next();
});

module.exports = mongoose.model('Page', pageSchema);
