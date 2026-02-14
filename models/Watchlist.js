const mongoose = require('mongoose');

const watchlistSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  auction: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction' },
  lot: { type: mongoose.Schema.Types.ObjectId, ref: 'Lot' },
  reminderSent: { type: Boolean, default: false },
  notifyBefore: { type: Number, default: 30 }, // minutes before auction ends
}, {
  timestamps: true,
});

watchlistSchema.index({ user: 1, auction: 1 }, { unique: true, sparse: true });
watchlistSchema.index({ user: 1, lot: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Watchlist', watchlistSchema);
