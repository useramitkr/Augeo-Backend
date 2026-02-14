const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Bid = require('../models/Bid');
const Lot = require('../models/Lot');
const Auction = require('../models/Auction');
const NotificationService = require('../services/notificationService');

// Track connected users
const connectedUsers = new Map();

const setupSocketHandlers = (io) => {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        if (user) {
          socket.user = user;
        }
      }
      next();
    } catch (error) {
      next();
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // User room join
    socket.on('user:join', (userId) => {
      if (socket.user && socket.user._id.toString() === userId) {
        socket.join(`user:${userId}`);
        connectedUsers.set(userId, socket.id);
        console.log(`User ${userId} joined personal room`);
      }
    });

    // Join auction room
    socket.on('auction:join', (auctionId) => {
      socket.join(`auction:${auctionId}`);
      console.log(`Socket ${socket.id} joined auction:${auctionId}`);

      // Send current viewer count
      const room = io.sockets.adapter.rooms.get(`auction:${auctionId}`);
      const viewerCount = room ? room.size : 0;
      io.to(`auction:${auctionId}`).emit('auction:viewers', { auctionId, count: viewerCount });
    });

    // Leave auction room
    socket.on('auction:leave', (auctionId) => {
      socket.leave(`auction:${auctionId}`);

      const room = io.sockets.adapter.rooms.get(`auction:${auctionId}`);
      const viewerCount = room ? room.size : 0;
      io.to(`auction:${auctionId}`).emit('auction:viewers', { auctionId, count: viewerCount });
    });

    // Place bid via socket
    socket.on('bid:place', async (data) => {
      if (!socket.user) {
        socket.emit('bid:error', { message: 'Authentication required' });
        return;
      }

      try {
        const { lotId, amount, maxAutoBid } = data;

        const lot = await Lot.findById(lotId);
        if (!lot) {
          socket.emit('bid:error', { message: 'Lot not found' });
          return;
        }

        const auction = await Auction.findById(lot.auction);
        if (!auction || auction.status !== 'live') {
          socket.emit('bid:error', { message: 'Auction is not live' });
          return;
        }

        if (lot.status !== 'active') {
          socket.emit('bid:error', { message: 'Lot is not active for bidding' });
          return;
        }

        // Calculate minimum bid
        const minimumBid = lot.currentBid > 0
          ? lot.currentBid + lot.bidIncrement
          : lot.startingBid;

        if (amount < minimumBid) {
          socket.emit('bid:error', { message: `Minimum bid is $${minimumBid}` });
          return;
        }

        // Check if user is already highest bidder
        if (lot.currentBidder && lot.currentBidder.toString() === socket.user._id.toString()) {
          socket.emit('bid:error', { message: 'You are already the highest bidder' });
          return;
        }

        const previousBidder = lot.currentBidder;

        // Create bid
        const bid = await Bid.create({
          lot: lotId,
          auction: auction._id,
          bidder: socket.user._id,
          amount,
          maxAutoBid: maxAutoBid || null,
          bidType: 'manual',
          status: 'active',
          isWinning: true,
          ipAddress: socket.handshake.address,
          userAgent: socket.handshake.headers['user-agent'],
        });

        // Update previous winning bid
        if (lot.currentBidder) {
          await Bid.updateMany(
            { lot: lotId, isWinning: true, bidder: { $ne: socket.user._id } },
            { isWinning: false, status: 'outbid' }
          );
        }

        // Update lot
        lot.currentBid = amount;
        lot.currentBidder = socket.user._id;
        lot.totalBids += 1;
        lot.isReserveMet = amount >= lot.reservePrice;
        lot.bidHistory.push(bid._id);
        await lot.save();

        // Update auction stats
        auction.totalBids += 1;
        await auction.save();

        // Broadcast to auction room
        io.to(`auction:${auction._id}`).emit('bid:new', {
          lotId: lot._id,
          bidId: bid._id,
          amount: bid.amount,
          bidderId: socket.user._id,
          bidderName: `${socket.user.firstName} ${socket.user.lastName.charAt(0)}.`,
          totalBids: lot.totalBids,
          isReserveMet: lot.isReserveMet,
          timestamp: bid.timestamp,
        });

        // Confirm to bidder
        socket.emit('bid:confirmed', {
          bidId: bid._id,
          amount: bid.amount,
          lotId: lot._id,
        });

        // Notify previous bidder they've been outbid
        if (previousBidder && previousBidder.toString() !== socket.user._id.toString()) {
          await NotificationService.notifyOutbid(io, previousBidder, bid, lot, auction);
        }

        // Notify watchers
        await NotificationService.notifyBidPlaced(io, bid, lot, auction);

        // Process auto-bids
        await processAutoBids(io, lot, auction, socket.user._id);

      } catch (error) {
        console.error('Bid placement error:', error);
        socket.emit('bid:error', { message: 'Failed to place bid' });
      }
    });

    // Get lot bid history
    socket.on('lot:getBids', async (lotId) => {
      try {
        const bids = await Bid.find({ lot: lotId })
          .sort({ timestamp: -1 })
          .limit(50)
          .populate('bidder', 'firstName lastName');

        socket.emit('lot:bids', {
          lotId,
          bids: bids.map(b => ({
            _id: b._id,
            amount: b.amount,
            bidderName: `${b.bidder.firstName} ${b.bidder.lastName.charAt(0)}.`,
            bidType: b.bidType,
            timestamp: b.timestamp,
            isWinning: b.isWinning,
          })),
        });
      } catch (error) {
        socket.emit('bid:error', { message: 'Failed to fetch bids' });
      }
    });

    socket.on('disconnect', () => {
      if (socket.user) {
        connectedUsers.delete(socket.user._id.toString());
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};

// Process auto-bids for a lot
async function processAutoBids(io, lot, auction, excludeBidderId) {
  try {
    // Find active auto-bids for this lot (excluding current bidder)
    const autoBids = await Bid.find({
      lot: lot._id,
      bidder: { $ne: excludeBidderId },
      maxAutoBid: { $exists: true, $ne: null },
      maxAutoBid: { $gt: lot.currentBid },
    }).sort({ maxAutoBid: -1 });

    if (autoBids.length === 0) return;

    const topAutoBid = autoBids[0];
    const newBidAmount = Math.min(
      lot.currentBid + lot.bidIncrement,
      topAutoBid.maxAutoBid
    );

    if (newBidAmount <= lot.currentBid) return;

    // Place auto-bid
    const autoBidEntry = await Bid.create({
      lot: lot._id,
      auction: auction._id,
      bidder: topAutoBid.bidder,
      amount: newBidAmount,
      maxAutoBid: topAutoBid.maxAutoBid,
      bidType: 'auto',
      status: 'active',
      isWinning: true,
    });

    // Update previous winning bid
    await Bid.updateMany(
      { lot: lot._id, isWinning: true, _id: { $ne: autoBidEntry._id } },
      { isWinning: false, status: 'outbid' }
    );

    const previousBidder = lot.currentBidder;

    // Update lot
    lot.currentBid = newBidAmount;
    lot.currentBidder = topAutoBid.bidder;
    lot.totalBids += 1;
    lot.isReserveMet = newBidAmount >= lot.reservePrice;
    lot.bidHistory.push(autoBidEntry._id);
    await lot.save();

    // Broadcast
    const bidder = await User.findById(topAutoBid.bidder).select('firstName lastName');
    io.to(`auction:${auction._id}`).emit('bid:new', {
      lotId: lot._id,
      bidId: autoBidEntry._id,
      amount: newBidAmount,
      bidderId: topAutoBid.bidder,
      bidderName: bidder ? `${bidder.firstName} ${bidder.lastName.charAt(0)}.` : 'Auto-Bidder',
      totalBids: lot.totalBids,
      isReserveMet: lot.isReserveMet,
      timestamp: autoBidEntry.timestamp,
      isAutoBid: true,
    });

    // Notify outbid user
    if (previousBidder && previousBidder.toString() !== topAutoBid.bidder.toString()) {
      await NotificationService.notifyOutbid(io, previousBidder, autoBidEntry, lot, auction);
    }

  } catch (error) {
    console.error('Auto-bid processing error:', error);
  }
}

module.exports = { setupSocketHandlers };
