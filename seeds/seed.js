require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');
const Page = require('../models/Page');
const Setting = require('../models/Setting');
const Auction = require('../models/Auction');
const Lot = require('../models/Lot');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB Connected for seeding');
};

const seed = async () => {
  try {
    await connectDB();

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Category.deleteMany({}),
      Page.deleteMany({}),
      Setting.deleteMany({}),
      Auction.deleteMany({}),
      Lot.deleteMany({}),
    ]);
    console.log('Cleared existing data');

    // Create Super Admin
    const superAdmin = await User.create({
      firstName: 'Super',
      lastName: 'Admin',
      email: 'admin@augeo.com',
      password: 'Admin@123456',
      role: 'superadmin',
      isEmailVerified: true,
      isActive: true,
    });
    console.log('Super Admin created: admin@augeo.com / Admin@123456');

    // Create Client (Auction House)
    const client = await User.create({
      firstName: 'Heritage',
      lastName: 'Auctions',
      email: 'client@augeo.com',
      password: 'Client@123456',
      role: 'client',
      isEmailVerified: true,
      isActive: true,
      clientApproved: true,
      companyName: 'Heritage Auction House',
      companyDescription: 'Premier auction house specializing in fine art, antiques, and rare collectibles since 1976.',
      companyWebsite: 'https://heritage.example.com',
      commissionRate: 10,
    });
    console.log('Client created: client@augeo.com / Client@123456');

    // Create Test User
    const user = await User.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'user@augeo.com',
      password: 'User@123456',
      role: 'user',
      isEmailVerified: true,
      isActive: true,
      addresses: [{
        label: 'Home',
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'US',
        isDefault: true,
      }],
    });
    console.log('User created: user@augeo.com / User@123456');

    // Create Categories
    const categories = await Category.insertMany([
      { name: 'Fine Art', description: 'Paintings, sculptures, and fine art pieces', displayOrder: 1, isActive: true },
      { name: 'Jewelry & Watches', description: 'Luxury jewelry, diamonds, and timepieces', displayOrder: 2, isActive: true },
      { name: 'Antiques', description: 'Rare and valuable antique items', displayOrder: 3, isActive: true },
      { name: 'Collectibles', description: 'Rare collectibles, memorabilia, and limited editions', displayOrder: 4, isActive: true },
      { name: 'Wine & Spirits', description: 'Fine wines, rare whiskeys, and premium spirits', displayOrder: 5, isActive: true },
      { name: 'Furniture', description: 'Antique and designer furniture pieces', displayOrder: 6, isActive: true },
      { name: 'Books & Manuscripts', description: 'Rare books, first editions, and historical manuscripts', displayOrder: 7, isActive: true },
      { name: 'Coins & Currency', description: 'Rare coins, banknotes, and numismatic items', displayOrder: 8, isActive: true },
    ]);
    console.log(`${categories.length} categories created`);

    // Create Static Pages
    await Page.insertMany([
      {
        title: 'About Augeo',
        slug: 'about',
        type: 'about',
        isPublished: true,
        content: `<h2>Welcome to Augeo</h2><p>Augeo is a premium auction marketplace that connects discerning buyers with world-class auction houses. Our platform offers a seamless, secure, and transparent bidding experience for extraordinary items spanning fine art, jewelry, antiques, and more.</p><h3>Our Mission</h3><p>To democratize access to premium auctions by providing a trusted digital platform where collectors, enthusiasts, and investors can discover and acquire exceptional items from anywhere in the world.</p><h3>Our Values</h3><ul><li><strong>Trust & Transparency:</strong> Every item is verified, and every bid is secured.</li><li><strong>Excellence:</strong> We partner only with reputable auction houses.</li><li><strong>Innovation:</strong> Real-time bidding, auto-bid technology, and seamless payments.</li><li><strong>Global Reach:</strong> Connect with auction houses worldwide.</li></ul>`,
        lastEditedBy: superAdmin._id,
      },
      {
        title: 'How Bidding Works',
        slug: 'how-it-works',
        type: 'how_it_works',
        isPublished: true,
        content: `<h2>How Bidding Works on Augeo</h2><h3>1. Create an Account</h3><p>Register for free and verify your email to start bidding. Some high-value auctions may require additional identity verification (KYC).</p><h3>2. Browse & Watch</h3><p>Explore auctions by category, search for specific items, and add interesting lots to your watchlist.</p><h3>3. Place Your Bid</h3><p>When an auction is live, enter your bid amount. Your bid must meet the minimum increment. You can also set up auto-bidding to bid automatically up to your maximum amount.</p><h3>4. Win & Pay</h3><p>If you are the highest bidder when the auction ends, you win! Complete your payment including the hammer price and buyer's premium.</p><h3>5. Receive Your Item</h3><p>The auction house will ship your item. Track your delivery through your dashboard.</p><h3>Important Rules</h3><ul><li>All bids are legally binding commitments to purchase.</li><li>A buyer's premium is added to the hammer price.</li><li>Reserve prices may apply - some lots won't sell if the reserve isn't met.</li></ul>`,
        lastEditedBy: superAdmin._id,
      },
      {
        title: "Buyer's Premium",
        slug: 'buyers-premium',
        type: 'buyers_premium',
        isPublished: true,
        content: `<h2>Buyer's Premium</h2><p>A buyer's premium is a fee charged to the winning bidder on top of the hammer price (the final bid amount). This fee helps cover the costs of running the auction, including cataloging, marketing, and platform services.</p><h3>How It Works</h3><p>The buyer's premium is expressed as a percentage of the hammer price. For example, if the hammer price is $1,000 and the buyer's premium is 15%, you would pay:</p><ul><li>Hammer Price: $1,000</li><li>Buyer's Premium (15%): $150</li><li>Total: $1,150</li></ul><p>The buyer's premium percentage varies by auction and is always clearly displayed on each auction page.</p>`,
        lastEditedBy: superAdmin._id,
      },
      {
        title: 'Terms & Conditions',
        slug: 'terms',
        type: 'terms',
        isPublished: true,
        content: `<h2>Terms & Conditions</h2><p>By using the Augeo platform, you agree to these terms. Please read them carefully.</p><h3>1. Account Registration</h3><p>You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials.</p><h3>2. Bidding</h3><p>All bids placed on Augeo are legally binding offers to purchase. By placing a bid, you agree to pay the full amount if you are the winning bidder.</p><h3>3. Payment</h3><p>Winning bidders must complete payment within 7 days of the auction ending. Failure to pay may result in account suspension.</p><h3>4. Shipping</h3><p>Shipping costs and arrangements vary by auction house and item. Details are provided on each listing.</p>`,
        lastEditedBy: superAdmin._id,
      },
      {
        title: 'Privacy Policy',
        slug: 'privacy',
        type: 'privacy',
        isPublished: true,
        content: `<h2>Privacy Policy</h2><p>Augeo is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your information.</p><h3>Information We Collect</h3><p>We collect information you provide directly (name, email, address) and information generated through your use of the platform (bid history, browsing activity).</p><h3>How We Use Your Information</h3><ul><li>To process bids and transactions</li><li>To communicate about auctions and orders</li><li>To improve our platform and services</li><li>To comply with legal obligations</li></ul><h3>Data Security</h3><p>We use industry-standard encryption and security measures to protect your data.</p>`,
        lastEditedBy: superAdmin._id,
      },
      {
        title: 'Authentication Process',
        slug: 'authentication-process',
        type: 'authentication',
        isPublished: true,
        content: `<h2>Authentication & Verification</h2><p>At Augeo, authenticity is paramount. Every item listed on our platform undergoes a rigorous verification process.</p><h3>Our Process</h3><ol><li><strong>Expert Review:</strong> Each item is reviewed by specialists in its category.</li><li><strong>Condition Reports:</strong> Detailed condition reports are provided for every lot.</li><li><strong>Provenance Documentation:</strong> We require documentation of ownership history.</li><li><strong>Certificate of Authenticity:</strong> Where applicable, items include certificates from recognized authorities.</li></ol>`,
        lastEditedBy: superAdmin._id,
      },
      {
        title: 'Shipping & Taxes',
        slug: 'shipping-taxes',
        type: 'shipping',
        isPublished: true,
        content: `<h2>Shipping & Taxes</h2><h3>Shipping</h3><p>Each auction house manages its own shipping. Options and costs are displayed on each lot listing. Typical shipping methods include:</p><ul><li>Standard Shipping (5-10 business days)</li><li>Express Shipping (2-3 business days)</li><li>White Glove Service (for high-value items)</li></ul><h3>Taxes</h3><p>Applicable taxes are calculated at checkout based on your shipping address and local tax regulations.</p>`,
        lastEditedBy: superAdmin._id,
      },
      {
        title: 'Contact Us',
        slug: 'contact',
        type: 'custom',
        isPublished: true,
        content: `<h2>Contact Us</h2><p>We are here to help. Reach out to us with any questions or concerns.</p><p><strong>Email:</strong> support@augeo.com</p><p><strong>Phone:</strong> +1 (555) 123-4567</p><p><strong>Hours:</strong> Monday - Friday, 9:00 AM - 6:00 PM EST</p><p><strong>Address:</strong> 123 Auction Lane, New York, NY 10001</p>`,
        lastEditedBy: superAdmin._id,
      },
    ]);
    console.log('Static pages created');

    // Create Settings
    await Setting.insertMany([
      { key: 'siteName', value: 'Augeo Auctions', category: 'general' },
      { key: 'siteDescription', value: 'Premium Auction Marketplace', category: 'general' },
      { key: 'defaultBuyersPremium', value: 15, category: 'auction' },
      { key: 'minBidIncrement', value: 10, category: 'auction' },
      { key: 'maxLoginAttempts', value: 5, category: 'security' },
      { key: 'sessionTimeout', value: 30, category: 'security' },
    ]);
    console.log('Settings created');

    // Create Sample Auctions with Lots
    const now = new Date();
    const liveAuction = await Auction.create({
      title: 'Impressionist & Modern Art Evening Sale',
      description: 'A spectacular evening sale featuring masterpieces from the Impressionist and Modern Art movements. This curated collection includes works by renowned artists spanning the late 19th to mid-20th century.',
      shortDescription: 'Featuring masterpieces from renowned Impressionist and Modern artists.',
      client: client._id,
      category: categories[0]._id,
      tags: ['impressionist', 'modern art', 'paintings', 'fine art'],
      startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() + 48 * 60 * 60 * 1000),
      status: 'live',
      isPublished: true,
      isFeatured: true,
      buyersPremium: 15,
      totalLots: 5,
      location: { city: 'New York', state: 'NY', country: 'United States' },
    });

    const lots1 = await Lot.insertMany([
      {
        auction: liveAuction._id, client: client._id, lotNumber: 1, title: 'Sunset Over the Seine - Oil on Canvas',
        description: 'A stunning oil painting capturing the golden light of sunset reflecting on the Seine river. This piece exemplifies the Impressionist mastery of light and color.',
        startingBid: 5000, reservePrice: 15000, estimateLow: 15000, estimateHigh: 25000, bidIncrement: 500,
        conditionReport: 'Excellent condition. Minor surface cleaning in 2020. Original frame.',
        conditionRating: 'excellent', artist: 'Claude Monet (attributed)', origin: 'France', yearCreated: '1885',
        status: 'active', displayOrder: 0, currentBid: 8500, totalBids: 5,
      },
      {
        auction: liveAuction._id, client: client._id, lotNumber: 2, title: 'Portrait of a Lady - Watercolor',
        description: 'An elegant portrait demonstrating exceptional watercolor technique. The subject is depicted in fine period attire.',
        startingBid: 2000, reservePrice: 5000, estimateLow: 5000, estimateHigh: 8000, bidIncrement: 200,
        conditionReport: 'Very good condition. Slight foxing in lower margin.', conditionRating: 'very_good',
        artist: 'John Singer Sargent (circle of)', origin: 'United States', yearCreated: '1890',
        status: 'active', displayOrder: 1, currentBid: 3200, totalBids: 3,
      },
      {
        auction: liveAuction._id, client: client._id, lotNumber: 3, title: 'Bronze Dancer Sculpture',
        description: 'A graceful bronze sculpture of a ballet dancer in arabesque pose. Exceptional patina and detail.',
        startingBid: 8000, reservePrice: 20000, estimateLow: 20000, estimateHigh: 35000, bidIncrement: 1000,
        conditionReport: 'Excellent condition throughout.', conditionRating: 'excellent',
        artist: 'Edgar Degas (after)', origin: 'France', yearCreated: '1920', materials: 'Bronze',
        status: 'active', displayOrder: 2,
      },
      {
        auction: liveAuction._id, client: client._id, lotNumber: 4, title: 'Abstract Composition No. 7',
        description: 'Bold abstract composition featuring vibrant primary colors and geometric forms. A powerful statement of modernist expression.',
        startingBid: 3000, reservePrice: 8000, estimateLow: 8000, estimateHigh: 12000, bidIncrement: 500,
        conditionRating: 'excellent', artist: 'Wassily Kandinsky (school of)', origin: 'Germany', yearCreated: '1935',
        status: 'active', displayOrder: 3,
      },
      {
        auction: liveAuction._id, client: client._id, lotNumber: 5, title: 'Still Life with Flowers - Oil',
        description: 'A vibrant still life painting showcasing an abundant floral arrangement in a decorative vase.',
        startingBid: 1500, reservePrice: 4000, estimateLow: 4000, estimateHigh: 6000, bidIncrement: 200,
        conditionRating: 'good', artist: 'Pierre-Auguste Renoir (manner of)', origin: 'France', yearCreated: '1895',
        status: 'active', displayOrder: 4, currentBid: 2100, totalBids: 2,
      },
    ]);

    // Create upcoming auction
    const upcomingAuction = await Auction.create({
      title: 'Rare Timepieces & Luxury Watches',
      description: 'An exceptional collection of rare and luxury timepieces including Patek Philippe, Rolex, Audemars Piguet, and more.',
      shortDescription: 'Exceptional collection of rare luxury timepieces.',
      client: client._id,
      category: categories[1]._id,
      tags: ['watches', 'luxury', 'timepieces', 'rolex', 'patek'],
      startTime: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() + 72 * 60 * 60 * 1000),
      status: 'scheduled',
      isPublished: true,
      isFeatured: true,
      buyersPremium: 12,
      totalLots: 3,
      location: { city: 'Geneva', country: 'Switzerland' },
    });

    await Lot.insertMany([
      {
        auction: upcomingAuction._id, client: client._id, lotNumber: 1, title: 'Patek Philippe Nautilus 5711 - Blue Dial',
        description: 'The iconic Patek Philippe Nautilus ref. 5711/1A with blue dial. Complete set with box and papers.',
        startingBid: 50000, reservePrice: 80000, estimateLow: 80000, estimateHigh: 120000, bidIncrement: 5000,
        conditionReport: 'Mint condition. Unworn with protective stickers.', conditionRating: 'mint',
        status: 'pending', displayOrder: 0,
      },
      {
        auction: upcomingAuction._id, client: client._id, lotNumber: 2, title: 'Rolex Daytona - Paul Newman Dial',
        description: 'Vintage Rolex Cosmograph Daytona with the coveted Paul Newman exotic dial. Ref. 6239.',
        startingBid: 100000, reservePrice: 200000, estimateLow: 200000, estimateHigh: 350000, bidIncrement: 10000,
        conditionReport: 'Very good vintage condition. Original dial and hands.', conditionRating: 'very_good',
        status: 'pending', displayOrder: 1,
      },
      {
        auction: upcomingAuction._id, client: client._id, lotNumber: 3, title: 'Audemars Piguet Royal Oak Offshore',
        description: 'AP Royal Oak Offshore Chronograph in titanium. Limited edition of 500 pieces.',
        startingBid: 25000, reservePrice: 40000, estimateLow: 40000, estimateHigh: 60000, bidIncrement: 2500,
        conditionReport: 'Excellent condition with minor desk diving marks.', conditionRating: 'excellent',
        status: 'pending', displayOrder: 2,
      },
    ]);

    // Create ended auction
    const endedAuction = await Auction.create({
      title: 'Antique Furniture & Decorative Arts',
      description: 'Collection of fine antique furniture and decorative arts from notable estates.',
      shortDescription: 'Fine antique furniture from notable estates.',
      client: client._id,
      category: categories[5]._id,
      tags: ['antiques', 'furniture', 'decorative arts'],
      startTime: new Date(now.getTime() - 72 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      status: 'ended',
      isPublished: true,
      buyersPremium: 15,
      totalLots: 2,
      totalBids: 15,
      totalRevenue: 18500,
    });

    await Lot.insertMany([
      {
        auction: endedAuction._id, client: client._id, lotNumber: 1, title: 'Louis XV Commode - 18th Century',
        description: 'An exceptional Louis XV period commode with original marble top and gilt bronze mounts.',
        startingBid: 5000, reservePrice: 10000, estimateLow: 10000, estimateHigh: 15000, bidIncrement: 500,
        currentBid: 12500, totalBids: 8, status: 'sold', winner: user._id, winningBid: 12500, hammerPrice: 12500,
        displayOrder: 0,
      },
      {
        auction: endedAuction._id, client: client._id, lotNumber: 2, title: 'Art Deco Silver Tea Set',
        description: 'Complete five-piece Art Deco sterling silver tea and coffee service, circa 1925.',
        startingBid: 2000, reservePrice: 4000, estimateLow: 4000, estimateHigh: 7000, bidIncrement: 250,
        currentBid: 6000, totalBids: 7, status: 'sold', winner: user._id, winningBid: 6000, hammerPrice: 6000,
        displayOrder: 1,
      },
    ]);

    console.log('Sample auctions and lots created');

    console.log('\n========================================');
    console.log('  SEEDING COMPLETE!');
    console.log('========================================');
    console.log('\nLogin Credentials:');
    console.log('  Super Admin:  admin@augeo.com  / Admin@123456');
    console.log('  Client:       client@augeo.com / Client@123456');
    console.log('  User:         user@augeo.com   / User@123456');
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seed();