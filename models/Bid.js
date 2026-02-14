const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
  lot: { type: mongoose.Schema.Types.ObjectId, ref: 'Lot', required: true },
  auction: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true },
  bidder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  amount: { type: Number, required: [true, 'Bid amount is required'], min: 0 },
  maxAutoBid: { type: Number },

  bidType: { type: String, enum: ['manual', 'auto', 'proxy'], default: 'manual' },

  status: {
    type: String,
    enum: ['active', 'outbid', 'winning', 'won', 'lost', 'cancelled', 'rejected'],
    default: 'active',
  },

  isWinning: { type: Boolean, default: false },

  // Audit
  ipAddress: { type: String },
  userAgent: { type: String },
  timestamp: { type: Date, default: Date.now },

  // Approval (if manual approval required)
  requiresApproval: { type: Boolean, default: false },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },

  // Legal
  termsAccepted: { type: Boolean, default: true },
  bindingAcknowledged: { type: Boolean, default: true },
}, {
  timestamps: true,
});

// Indexes
bidSchema.index({ lot: 1, amount: -1 });
bidSchema.index({ auction: 1 });
bidSchema.index({ bidder: 1 });
bidSchema.index({ status: 1 });
bidSchema.index({ lot: 1, bidder: 1 });
bidSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Bid', bidSchema);
