const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  resource: { type: String, required: true },
  resourceId: { type: mongoose.Schema.Types.ObjectId },
  details: { type: mongoose.Schema.Types.Mixed },
  ipAddress: { type: String },
  userAgent: { type: String },
}, {
  timestamps: true,
});

activityLogSchema.index({ user: 1, createdAt: -1 });
activityLogSchema.index({ resource: 1, action: 1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
