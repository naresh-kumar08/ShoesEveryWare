import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import nodemailer from 'nodemailer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
const MONGO_URI = process.env.DATABASE;
const JWT_SECRET = process.env.SECURITY_KEY;
const OTP_EXPIRES_MINUTES = 10;

if (!MONGO_URI) {
  // eslint-disable-next-line no-console
  console.warn('Missing DATABASE env var. Server will not be able to connect to MongoDB.');
}
if (!JWT_SECRET) {
  // eslint-disable-next-line no-console
  console.warn('Missing SECURITY_KEY env var. JWT auth will not work.');
}

// Ensure uploads folder exists for product images.
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// Serve frontend files + uploaded images.
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(__dirname));


// Models (MongoDB)

const { Schema } = mongoose;

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    mobileNumber: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    otpCode: { type: String, default: null },
    otpExpiresAt: { type: Date, default: null },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    active: { type: Boolean, default: false }
  },
  { timestamps: true }
);

const ProductSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    imageUrl: { type: String, required: true },
    imageUrls: [{ type: String }]
  },
  { timestamps: true }
);

const CartSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, unique: true, index: true },
    items: [
      {
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, required: true, min: 0 }
      }
    ]
  },
  { timestamps: true }
);

const OrderSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    items: [
      {
        productId: { type: Schema.Types.ObjectId, required: true },
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true, min: 0 }
      }
    ],
    totalPrice: { type: Number, required: true, min: 0 },
    deliveryAddress: { type: String, required: true, trim: true },
    paymentMethod: { type: String, required: true },
    status: { type: String, default: 'Placed' }
  },
  { timestamps: true }
);

const User = mongoose.model('User', UserSchema);
const Product = mongoose.model('Product', ProductSchema);
const Cart = mongoose.model('Cart', CartSchema);
const Order = mongoose.model('Order', OrderSchema);


// Auth helpers

function getBearerToken(req) {
  const h = req.headers.authorization || '';
  if (typeof h !== 'string') return null;
  if (!h.startsWith('Bearer ')) return null;
  return h.slice('Bearer '.length);
}

async function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    if (!JWT_SECRET) return res.status(500).json({ message: 'Auth misconfigured' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user || !user.active) return res.status(401).json({ message: 'Unauthorized' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
}

// Multer (product image uploads)

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    const safe = Math.random().toString(16).slice(2);
    cb(null, `prod-${Date.now()}-${safe}${ext}`);
  }
});

function fileFilter(req, file, cb) {
  const ok = file.mimetype && file.mimetype.startsWith('image/');
  cb(ok ? null : new Error('Only image files are allowed'), ok);
}

const upload = multer({ storage, fileFilter });

function normalizeProductImages(productDoc) {
  const urls = Array.isArray(productDoc.imageUrls) && productDoc.imageUrls.length > 0
    ? productDoc.imageUrls
    : [productDoc.imageUrl].filter(Boolean);
  return {
    imageUrl: urls[0] || '',
    imageUrls: urls
  };
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const mailTransport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || 'false') === 'true',
  auth: process.env.SMTP_USER && process.env.SMTP_PASS
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    : undefined
});

async function sendOtpEmail(email, otpCode) { 
  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!fromEmail) {
    // eslint-disable-next-line no-console
    console.log(`[OTP DEV] Email: ${email} OTP: ${otpCode}`);
    return;
  }
  await mailTransport.sendMail({
    from: fromEmail,
    to: email,
    subject: 'Your OTP for ShoesEveryWhere',
    text: `Your verification OTP is ${otpCode}. It is valid for ${OTP_EXPIRES_MINUTES} minutes.`
  });
}

// API Routes

const api = express.Router();

// Auth
api.post('/auth/register', async (req, res) => {
  const { name, mobileNumber, email, password } = req.body || {};
  const safeEmail = String(email || '').trim().toLowerCase();
  const safeName = String(name || '').trim();
  const safeMobile = String(mobileNumber || '').trim();
  const safePassword = String(password || '');

  if (!safeEmail || !safeName || !safeMobile || !safePassword) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const existing = await User.findOne({ email: safeEmail });
  if (existing && existing.active) return res.status(409).json({ message: 'Email already registered' });

  const passwordHash = await bcrypt.hash(safePassword, 10);
  const otpCode = generateOtpCode();
  const otpExpiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

  if (!existing) {
    await User.create({
      name: safeName,
      mobileNumber: safeMobile,
      email: safeEmail,
      passwordHash,
      otpCode,
      otpExpiresAt,
      role: 'user',
      active: false
    });
  } else {
    existing.name = safeName;
    existing.mobileNumber = safeMobile;
    existing.passwordHash = passwordHash;
    existing.otpCode = otpCode;
    existing.otpExpiresAt = otpExpiresAt;
    existing.active = false;
    await existing.save();
  }

  // await sendOtpEmail(safeEmail, otpCode);
  try {
      await sendOtpEmail(safeEmail, otpCode);
      console.log("OTP sent successfully");
    } catch(err){
      console.log("Email error:", err.message);
    }

  res.status(201).json({ message: 'OTP sent to your email' });
});

api.post('/auth/verify-otp', async (req, res) => {
  const safeEmail = String(req.body?.email || '').trim().toLowerCase();
  const otp = String(req.body?.otp || '').trim();
  if (!safeEmail || !otp) return res.status(400).json({ message: 'Email and OTP are required' });

  const user = await User.findOne({ email: safeEmail });
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (!user.otpCode || !user.otpExpiresAt) return res.status(400).json({ message: 'OTP not generated' });
  if (new Date() > new Date(user.otpExpiresAt)) return res.status(400).json({ message: 'OTP expired' });
  if (user.otpCode !== otp) return res.status(400).json({ message: 'Invalid OTP' });

  user.active = true;
  user.otpCode = null;
  user.otpExpiresAt = null;
  await user.save();

  res.json({ ok: true, message: 'Account verified successfully' });
});

api.post('/auth/forgot-password', async (req, res) => {
  const safeEmail = String(req.body?.email || '').trim().toLowerCase();
  if (!safeEmail) return res.status(400).json({ message: 'Email is required' });

  const user = await User.findOne({ email: safeEmail });
  // Do not reveal whether account exists.
  if (!user) return res.json({ ok: true, message: 'If account exists, OTP sent to email' });
  if (!user.active) return res.status(400).json({ message: 'Please verify account first' });

  const otpCode = generateOtpCode();
  user.otpCode = otpCode;
  user.otpExpiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);
  await user.save();

  await sendOtpEmail(safeEmail, otpCode);
  res.json({ ok: true, message: 'OTP sent to your email' });
});

api.post('/auth/reset-password', async (req, res) => {
  const safeEmail = String(req.body?.email || '').trim().toLowerCase();
  const otp = String(req.body?.otp || '').trim();
  const newPassword = String(req.body?.newPassword || '');

  if (!safeEmail || !otp || !newPassword) {
    return res.status(400).json({ message: 'Email, OTP and new password are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  const user = await User.findOne({ email: safeEmail });
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (!user.otpCode || !user.otpExpiresAt) return res.status(400).json({ message: 'OTP not generated' });
  if (new Date() > new Date(user.otpExpiresAt)) return res.status(400).json({ message: 'OTP expired' });
  if (user.otpCode !== otp) return res.status(400).json({ message: 'Invalid OTP' });

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.otpCode = null;
  user.otpExpiresAt = null;
  await user.save();

  res.json({ ok: true, message: 'Password reset successful' });
});

api.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const safeEmail = String(email || '').trim().toLowerCase();
  const safePassword = String(password || '');

  if (!safeEmail || !safePassword) return res.status(400).json({ message: 'Email and password are required' });
  const user = await User.findOne({ email: safeEmail });
  if (!user || !user.active) return res.status(401).json({ message: 'Invalid credentials' });

  const ok = await bcrypt.compare(safePassword, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  if (!JWT_SECRET) return res.status(500).json({ message: 'Auth misconfigured' });
  const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

api.get('/auth/me', requireAuth, async (req, res) => {
  const u = req.user;
  res.json({
    user: {
      _id: u._id.toString(),
      name: u.name,
      mobileNumber: u.mobileNumber,
      email: u.email,
      role: u.role,
      active: u.active
    }
  });
});

// Products
api.get('/products/brands', async (_req, res) => {
  const brands = await Product.distinct('brand');
  res.json({ brands: (brands || []).filter(Boolean) });
});

api.get('/products', async (req, res) => {
  const { brand = '', search = '' } = req.query || {};

  const filter = {};
  if (String(brand).trim()) filter.brand = String(brand).trim();

  const s = String(search).trim();
  if (s) {
    filter.$or = [{ name: { $regex: s, $options: 'i' } }, { brand: { $regex: s, $options: 'i' } }];
  }

  const products = await Product.find(filter).sort({ createdAt: -1 }).limit(200);
  res.json({
    products: products.map((p) => ({
      _id: p._id.toString(),
      name: p.name,
      brand: p.brand,
      price: p.price,
      ...normalizeProductImages(p)
    }))
  });
});

api.get('/products/:id', async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json({
    product: {
      _id: product._id.toString(),
      name: product.name,
      brand: product.brand,
      price: product.price,
      ...normalizeProductImages(product)
    }
  });
});

// Cart
api.post('/cart/add', requireAuth, async (req, res) => {
  const { productId, quantity } = req.body || {};
  const q = Number(quantity);
  if (!productId || !Number.isFinite(q) || q <= 0) return res.status(400).json({ message: 'Invalid quantity' });

  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ message: 'Product not found' });

  let cart = await Cart.findOne({ userId: req.user._id });
  if (!cart) cart = await Cart.create({ userId: req.user._id, items: [] });

  const prodId = product._id;
  const existing = cart.items.find((it) => it.productId.toString() === prodId.toString());
  if (existing) existing.quantity += q;
  else cart.items.push({ productId: prodId, quantity: q });

  await cart.save();
  res.json({ ok: true });
});

api.post('/cart/update', requireAuth, async (req, res) => {
  const { productId, quantity } = req.body || {};
  const q = Number(quantity);
  if (!productId || !Number.isFinite(q)) return res.status(400).json({ message: 'Invalid input' });

  let cart = await Cart.findOne({ userId: req.user._id });
  if (!cart) cart = await Cart.create({ userId: req.user._id, items: [] });

  cart.items = cart.items.filter((it) => it.productId.toString() !== String(productId));
  if (q > 0) cart.items.push({ productId, quantity: q });

  await cart.save();
  res.json({ ok: true });
});

api.get('/cart', requireAuth, async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user._id }).populate('items.productId');
  if (!cart || !cart.items || cart.items.length === 0) {
    return res.json({ items: [], cartTotal: 0 });
  }

  const items = cart.items
    .filter((it) => it.productId && it.quantity > 0)
    .map((it) => {
      const p = it.productId;
      const lineTotal = it.quantity * Number(p.price);
      return {
        productId: p._id.toString(),
        quantity: it.quantity,
        lineTotal,
        product: {
          id: p._id.toString(),
          name: p.name,
          brand: p.brand,
          price: p.price,
          imageUrl: p.imageUrl
        }
      };
    });

  const cartTotal = items.reduce((sum, it) => sum + Number(it.lineTotal || 0), 0);
  res.json({ items, cartTotal });
});

// Orders
api.post('/orders/checkout', requireAuth, async (req, res) => {
  const { deliveryAddress, paymentMethod, items } = req.body || {};
  const address = String(deliveryAddress || '').trim();
  const pay = String(paymentMethod || '').trim() || 'COD';

  if (!address) return res.status(400).json({ message: 'Delivery address is required' });

  let orderItems = [];

  if (Array.isArray(items) && items.length > 0) {
    // Buy Now modal flow: items are provided directly.
    const expanded = await Promise.all(
      items.map(async (it) => {
        const product = await Product.findById(it.productId);
        if (!product) throw new Error('Product not found');
        const qty = Number(it.quantity) || 0;
        if (qty <= 0) throw new Error('Invalid quantity');
        return { product, qty };
      })
    );

    orderItems = expanded.map(({ product, qty }) => ({
      productId: product._id,
      name: product.name,
      quantity: qty,
      price: Number(product.price)
    }));
  } else {
    // Cart checkout flow: items come from user's cart.
    const cart = await Cart.findOne({ userId: req.user._id }).populate('items.productId');
    const cartItems = cart?.items?.filter((it) => it.productId && it.quantity > 0) || [];
    if (cartItems.length === 0) return res.status(400).json({ message: 'Cart is empty' });

    orderItems = cartItems.map((it) => ({
      productId: it.productId._id,
      name: it.productId.name,
      quantity: it.quantity,
      price: Number(it.productId.price)
    }));
  }

  const totalPrice = orderItems.reduce((sum, it) => sum + it.quantity * Number(it.price), 0);

  const order = await Order.create({
    userId: req.user._id,
    items: orderItems,
    totalPrice,
    deliveryAddress: address,
    paymentMethod: pay,
    status: 'Placed'
  });

  // Clear cart only for cart-based checkout (when items were not passed).
  if (!Array.isArray(items) || items.length === 0) {
    await Cart.updateOne({ userId: req.user._id }, { $set: { items: [] } });
  }

  res.status(201).json({ orderId: order._id.toString() });
});

api.get('/orders/me', requireAuth, async (req, res) => {
  const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50);
  res.json({
    orders: orders.map((o) => ({
      _id: o._id.toString(),
      userId: o.userId.toString(),
      items: o.items.map((it) => ({
        name: it.name,
        quantity: it.quantity,
        price: it.price
      })),
      totalPrice: o.totalPrice,
      deliveryAddress: o.deliveryAddress,
      paymentMethod: o.paymentMethod,
      status: o.status,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt
    }))
  });
});

// Admin
api.get('/admin/users', requireAuth, requireAdmin, async (req, res) => {
  const users = await User.find({}, { passwordHash: 0 }).sort({ createdAt: -1 }).limit(200);
  res.json({
    users: users.map((u) => ({
      _id: u._id.toString(),
      name: u.name,
      email: u.email,
      mobileNumber: u.mobileNumber,
      role: u.role,
      active: u.active
    }))
  });
});

api.patch('/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const nextActive = Boolean(req.body?.active);
  const user = await User.findByIdAndUpdate(id, { active: nextActive }, { new: true, projection: { passwordHash: 0 } });
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ ok: true });
});

api.get('/admin/orders', requireAuth, requireAdmin, async (_req, res) => {
  const orders = await Order.find({}).sort({ createdAt: -1 }).limit(100).lean();
  const userIds = [...new Set(orders.map((o) => String(o.userId)))];
  const users = await User.find({ _id: { $in: userIds } }).lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));

  const enriched = orders.map((order) => ({
    order: {
      _id: order._id.toString(),
      userId: String(order.userId),
      items: order.items.map((it) => ({ name: it.name, quantity: it.quantity, price: it.price })),
      totalPrice: order.totalPrice,
      deliveryAddress: order.deliveryAddress,
      paymentMethod: order.paymentMethod,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    },
    user: order.userId ? byId.get(String(order.userId)) || null : null
  }));

  res.json({ orders: enriched });
});

api.post('/admin/products', requireAuth, requireAdmin, upload.array('images', 6), async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const brand = String(req.body?.brand || '').trim();
  const price = Number(req.body?.price);
  const files = Array.isArray(req.files) ? req.files : [];

  if (!name || !brand || !Number.isFinite(price) || price < 0) {
    return res.status(400).json({ message: 'Invalid product data' });
  }
  if (files.length === 0) return res.status(400).json({ message: 'At least one image is required' });

  const imageUrls = files.map((f) => `/uploads/${f.filename}`);
  const product = await Product.create({ name, brand, price, imageUrl: imageUrls[0], imageUrls });
  res.status(201).json({ productId: product._id.toString() });
});

app.use('/api', api);

// Seed admin + sample products

async function seedInitialData() {
  if (!JWT_SECRET || !MONGO_URI) return;

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || 'Admin';

  if (adminEmail && adminPassword) {
    const existingAdmin = await User.findOne({ email: String(adminEmail).trim().toLowerCase() });
    if (!existingAdmin) {
      await User.create({
        name: adminName,
        mobileNumber: '0000000000',
        email: String(adminEmail).trim().toLowerCase(),
        passwordHash: await bcrypt.hash(String(adminPassword), 10),
        role: 'admin',
        active: true
      });
    }
  }

  const count = await Product.countDocuments();
  if (count === 0) {
    const sampleBrands = ['Nike', 'Adidas', 'Puma', 'Reebok', 'Skechers','Red-tape','Campus','Liberty','Wood-land','Air-Jordan','Bata','Relaxo Footwears','Paragon','Red Chief','Khadim'];
    const sampleProducts = [
      { name: 'Air Runner', brand: sampleBrands[0], price: 2999, imageUrl: 'https://placehold.co/600x600/png?text=Nike' },
      { name: 'Street Runner', brand: sampleBrands[1], price: 3499, imageUrl: 'https://placehold.co/600x600/png?text=Adidas' },
      { name: 'Comfort Walk', brand: sampleBrands[2], price: 2599, imageUrl: 'https://placehold.co/600x600/png?text=Puma' },
      { name: 'Classic Step', brand: sampleBrands[3], price: 2199, imageUrl: 'https://placehold.co/600x600/png?text=Reebok' },
      { name: 'Soft Motion', brand: sampleBrands[4], price: 2799, imageUrl: 'https://placehold.co/600x600/png?text=Skechers' }
    ];
    await Product.insertMany(sampleProducts);
  }
}


// Start

async function start() {
  if (!MONGO_URI) throw new Error('Missing DATABASE env var');
  if (!JWT_SECRET) throw new Error('Missing SECURITY_KEY env var');

  await mongoose.connect(MONGO_URI);
  await seedInitialData();

  app.get('/', (_req, res) => {
    res.redirect('/index.html');
  });

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Server failed to start:', err?.message || err);
  process.exit(1);
});







api.patch('/admin/orders/:id/status', requireAuth, async (req, res) => {
  try {
    // ❗ Admin check
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { status } = req.body;

    const validStatus = ['Placed', 'Shipped', 'Delivered', 'Cancelled'];

    if (!validStatus.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({ ok: true, order });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});









// UPDATE PRODUCT
api.patch('/admin/products/:id', requireAuth, requireAdmin, upload.array('images', 6), async (req, res) => {
  try {
    const { id } = req.params;

    const updateData = {
      name: String(req.body.name || '').trim(),
      brand: String(req.body.brand || '').trim(),
      price: Number(req.body.price)
    };

    if (!updateData.name || !updateData.brand || !Number.isFinite(updateData.price)) {
      return res.status(400).json({ message: 'Invalid data' });
    }

    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length > 0) {
      updateData.imageUrls = files.map((f) => `/uploads/${f.filename}`);
      updateData.imageUrl = updateData.imageUrls[0];
    }

    const product = await Product.findByIdAndUpdate(id, updateData, { new: true });

    if (!product) return res.status(404).json({ message: 'Product not found' });

    res.json({ ok: true });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// DELETE PRODUCT
api.delete('/admin/products/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByIdAndDelete(id);

    if (!product) return res.status(404).json({ message: 'Product not found' });

    res.json({ ok: true });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});





// const otpStore = {};

