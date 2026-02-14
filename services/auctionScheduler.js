const Auction = require('../models/Auction');
const Lot = require('../models/Lot');
const Bid = require('../models/Bid');
const Order = require('../models/Order');
const NotificationService = require('./notificationService');

const checkAuctionStatus = async (io) => {
  const now = new Date();

  try {
    // Start scheduled auctions
    const auctionsToStart = await Auction.find({
      status: 'scheduled',
      isPublished: true,
      startTime: { $lte: now },
    });

    for (const auction of auctionsToStart) {
      auction.status = 'live';
      await auction.save();

      // Activate all pending lots
      await Lot.updateMany(
        { auction: auction._id, status: 'pending' },
        { status: 'active' }
      );

      io.to(`auction:${auction._id}`).emit('auction:started', {
        auctionId: auction._id,
        status: 'live',
      });

      await NotificationService.notifyAuctionStarting(io, auction);
      console.log(`Auction started: ${auction.title}`);
    }

    // End live auctions
    const auctionsToEnd = await Auction.find({
      status: 'live',
      endTime: { $lte: now },
    });

    for (const auction of auctionsToEnd) {
      auction.status = 'ended';

      const lots = await Lot.find({ auction: auction._id, status: 'active' });
      let totalRevenue = 0;

      for (const lot of lots) {
        if (lot.currentBid > 0 && lot.currentBidder) {
          const isReserveMet = lot.currentBid >= lot.reservePrice;

          if (isReserveMet) {
            lot.status = 'sold';
            lot.winner = lot.currentBidder;
            lot.winningBid = lot.currentBid;
            lot.hammerPrice = lot.currentBid;

            // Update winning bid
            await Bid.findOneAndUpdate(
              { lot: lot._id, bidder: lot.currentBidder, amount: lot.currentBid },
              { status: 'won', isWinning: true }
            );

            // Mark all other bids as lost
            await Bid.updateMany(
              { lot: lot._id, bidder: { $ne: lot.currentBidder } },
              { status: 'lost', isWinning: false }
            );

            // Create order
            const buyersPremium = lot.currentBid * (auction.buyersPremium / 100);
            const totalAmount = lot.currentBid + buyersPremium;

            const order = await Order.create({
              orderNumber: 'AUG-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase(),
              buyer: lot.currentBidder,
              client: auction.client,
              auction: auction._id,
              lot: lot._id,
              bid: (await Bid.findOne({ lot: lot._id, bidder: lot.currentBidder, amount: lot.currentBid }))._id,
              hammerPrice: lot.currentBid,
              buyersPremium,
              buyersPremiumRate: auction.buyersPremium,
              totalAmount,
              commissionRate: 10,
              commissionAmount: lot.currentBid * 0.1,
              clientPayoutAmount: lot.currentBid - (lot.currentBid * 0.1),
            });

            totalRevenue += lot.currentBid;

            // Notify winner
            await NotificationService.notifyAuctionWon(io, lot.currentBidder, lot, auction, order);

            // Notify losers
            const loserBids = await Bid.find({
              lot: lot._id,
              bidder: { $ne: lot.currentBidder },
            }).distinct('bidder');
            await NotificationService.notifyAuctionLost(io, loserBids, lot, auction);

          } else {
            lot.status = 'unsold';
            await Bid.updateMany({ lot: lot._id }, { status: 'lost' });
          }
        } else {
          lot.status = 'unsold';
        }

        await lot.save();
      }

      auction.totalRevenue = totalRevenue;
      await auction.save();

      io.to(`auction:${auction._id}`).emit('auction:ended', {
        auctionId: auction._id,
        status: 'ended',
      });

      console.log(`Auction ended: ${auction.title} - Revenue: $${totalRevenue}`);
    }

    // Send "ending soon" notifications (5 minutes before end)
    const endingSoonThreshold = new Date(now.getTime() + 5 * 60 * 1000);
    const endingSoon = await Auction.find({
      status: 'live',
      endTime: { $gt: now, $lte: endingSoonThreshold },
    });

    for (const auction of endingSoon) {
      io.to(`auction:${auction._id}`).emit('auction:endingSoon', {
        auctionId: auction._id,
        endTime: auction.endTime,
        minutesLeft: Math.ceil((auction.endTime - now) / 60000),
      });
    }

  } catch (error) {
    console.error('Auction scheduler error:', error);
  }
};

module.exports = { checkAuctionStatus };
