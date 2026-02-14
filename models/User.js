const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: [true, 'First name is required'], trim: true },
  lastName: { type: String, required: [true, 'Last name is required'], trim: true },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
  },
  password: { type: String, required: [true, 'Password is required'], minlength: 8, select: false },
  phone: { type: String },
  avatar: { type: String, default: '' },
  role: {
    type: String,
    enum: ['user', 'client', 'client_staff', 'client_editor', 'client_manager', 'admin', 'superadmin'],
    default: 'user',
  },
  isEmailVerified: { type: Boolean, default: false },
  isPhoneVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  isSuspended: { type: Boolean, default: false },
  suspensionReason: { type: String },

  // KYC
  kycStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
  kycDocuments: [{
    type: { type: String },
    url: String,
    uploadedAt: { type: Date, default: Date.now },
  }],

  // Addresses
  addresses: [{
    label: { type: String, default: 'Home' },
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
    isDefault: { type: Boolean, default: false },
  }],

  // Payment methods (tokenized references)
  savedPaymentMethods: [{
    stripePaymentMethodId: String,
    last4: String,
    brand: String,
    expiryMonth: Number,
    expiryYear: Number,
    isDefault: { type: Boolean, default: false },
  }],

  // Client-specific fields
  companyName: { type: String },
  companyDescription: { type: String },
  companyLogo: { type: String },
  companyWebsite: { type: String },
  bankDetails: {
    bankName: String,
    accountNumber: String,
    routingNumber: String,
    accountHolderName: String,
  },
  clientApproved: { type: Boolean, default: false },
  commissionRate: { type: Number, default: 10 },

  // Saved searches
  savedSearches: [{
    name: String,
    filters: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now },
  }],

  // Verification tokens
  emailVerificationToken: String,
  emailVerificationExpire: Date,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  phoneVerificationCode: String,
  phoneVerificationExpire: Date,

  stripeCustomerId: { type: String },

  lastLogin: { type: Date },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Virtual for full name
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate JWT
userSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// Generate email verification token
userSchema.methods.getEmailVerificationToken = function () {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = crypto.createHash('sha256').update(token).digest('hex');
  this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000;
  return token;
};

// Generate password reset token
userSchema.methods.getResetPasswordToken = function () {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
  this.resetPasswordExpire = Date.now() + 60 * 60 * 1000;
  return token;
};

// Index for search
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

module.exports = mongoose.model('User', userSchema);
