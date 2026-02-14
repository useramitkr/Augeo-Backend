const Notification = require('../models/Notification');
const sendEmail = require('../utils/sendEmail');

class NotificationService {
  static async create({ recipient, type, title, message, auction, lot, order, bid, actionUrl, channels, priority }) {
    const notification = await Notification.create({
      recipient,
      type,
      title,
      message,
      auction,
      lot,
      order,
      bid,
      actionUrl,
      channels: channels || { onSite: true, email: true },
      priority: priority || 'normal',
    });

    // Send email if channel enabled
    if (notification.channels.email) {
      try {
        const User = require('../models/User');
        const user = await User.findById(recipient);
        if (user && user.email) {
          await sendEmail({
            email: user.email,
            subject: title,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #1a1a2e; padding: 20px; text-align: center;">
                  <h1 style="color: #c9a84c; margin: 0;">AUGEO</h1>
                </div>
                <div style="padding: 30px; background: #fff;">
                  <h2 style="color: #333;">${title}</h2>
                  <p style="color: #666; line-height: 1.6;">${message}</p>
                  ${actionUrl ? `<a href="${process.env.CLIENT_URL}${actionUrl}" style="display: inline-block; padding: 12px 24px; background: #c9a84c; color: #fff; text-decoration: none; border-radius: 4px; margin-top: 15px;">View Details</a>` : ''}
                </div>
                <div style="background: #f5f5f5; padding: 15px; text-align: center; color: #999; font-size: 12px;">
                  Augeo Auction Platform
                </div>
              </div>
            `,
          });
          notification.emailSent = true;
          await notification.save();
        }
      } catch (error) {
        console.error('Email notification failed:', error.message);
      }
    }

    return notification;
  }

  static async notifyBidPlaced(io, bid, lot, auction) {
    // Notify lot watchers
    const Watchlist = require('../models/Watchlist');
    const watchers = await Watchlist.find({ lot: lot._id }).select('user');

    for (const watcher of watchers) {
      if (watcher.user.toString() !== bid.bidder.toString()) {
        const notif = await this.create({
          recipient: watcher.user,
          type: 'bid_placed',
          title: 'New Bid Placed',
          message: `A new bid of $${bid.amount.toLocaleString()} has been placed on "${lot.title}"`,
          auction: auction._id,
          lot: lot._id,
          bid: bid._id,
          actionUrl: `/auctions/${auction.slug}/lots/${lot._id}`,
        });
        io.to(`user:${watcher.user}`).emit('notification', notif);
      }
    }
  }

  static async notifyOutbid(io, previousBidder, bid, lot, auction) {
    const notif = await this.create({
      recipient: previousBidder,
      type: 'outbid',
      title: 'You\'ve Been Outbid!',
      message: `Someone placed a higher bid of $${bid.amount.toLocaleString()} on "${lot.title}". Place a new bid to stay in the game!`,
      auction: auction._id,
      lot: lot._id,
      bid: bid._id,
      actionUrl: `/auctions/${auction.slug}/lots/${lot._id}`,
      priority: 'high',
    });
    io.to(`user:${previousBidder}`).emit('notification', notif);
  }

  static async notifyAuctionWon(io, winner, lot, auction, order) {
    const notif = await this.create({
      recipient: winner,
      type: 'auction_won',
      title: 'Congratulations! You Won!',
      message: `You won "${lot.title}" with a bid of $${lot.winningBid.toLocaleString()}. Complete your payment to finalize the purchase.`,
      auction: auction._id,
      lot: lot._id,
      order: order._id,
      actionUrl: `/dashboard/orders/${order._id}`,
      priority: 'high',
    });
    io.to(`user:${winner}`).emit('notification', notif);
  }

  static async notifyAuctionLost(io, losers, lot, auction) {
    for (const loserId of losers) {
      const notif = await this.create({
        recipient: loserId,
        type: 'auction_lost',
        title: 'Auction Ended',
        message: `The auction for "${lot.title}" has ended. Unfortunately, your bid was not the winning bid.`,
        auction: auction._id,
        lot: lot._id,
        actionUrl: `/auctions/${auction.slug}`,
      });
      io.to(`user:${loserId}`).emit('notification', notif);
    }
  }

  static async notifyAuctionStarting(io, auction) {
    const Watchlist = require('../models/Watchlist');
    const watchers = await Watchlist.find({ auction: auction._id }).select('user');

    for (const watcher of watchers) {
      const notif = await this.create({
        recipient: watcher.user,
        type: 'auction_starting',
        title: 'Auction Starting Soon!',
        message: `"${auction.title}" is starting soon. Don't miss your chance to bid!`,
        auction: auction._id,
        actionUrl: `/auctions/${auction.slug}`,
        priority: 'high',
      });
      io.to(`user:${watcher.user}`).emit('notification', notif);
    }
  }
}

module.exports = NotificationService;
