/**
 * ==============================================================================
 * RAZORPAY FULL-STACK PAYMENT GATEWAY BACKEND SERVER
 * Stack: Node.js, Express, Razorpay Node SDK, Crypto (HMAC SHA256), Mongoose (MongoDB)
 * ==============================================================================
 */

import express from 'express';
import crypto from 'crypto';
import cors from 'cors';
import dotenv from 'dotenv';
import Razorpay from 'razorpay';
import mongoose from 'mongoose';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware for normal JSON parsing
app.use(cors());

// IMPORTANT: Webhook requires raw body for HMAC signature verification!
// Apply raw body parser BEFORE express.json() for webhook route
app.use('/api/webhook/razorpay', express.raw({ type: 'application/json' }));
app.use(express.json());

/* ------------------------------------------------------------------------------
   1. RAZORPAY INSTANCE INITIALIZATION
------------------------------------------------------------------------------ */
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_YourKeyIDHere',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'YourKeySecretHere'
});

/* ------------------------------------------------------------------------------
   2. MONGOOSE DATABASE SCHEMAS & MODELS
------------------------------------------------------------------------------ */
const OrderSchema = new mongoose.Schema({
  order_id: { type: String, required: true, unique: true }, // Custom internal order ID
  user_id: { type: String, required: true },
  amount: { type: Number, required: true }, // in paise (e.g. 50000 paise = ₹500)
  currency: { type: String, default: 'INR' },
  status: { 
    type: String, 
    enum: ['created', 'paid', 'failed', 'refunded', 'partially_refunded'], 
    default: 'created' 
  },
  razorpay_order_id: { type: String, required: true, unique: true },
  receipt: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

const TransactionSchema = new mongoose.Schema({
  payment_id: { type: String, required: true, unique: true },
  razorpay_order_id: { type: String, required: true },
  order_id: { type: String, required: true },
  amount: { type: Number, required: true }, // in paise
  method: { type: String }, // 'upi', 'card', 'netbanking', 'wallet'
  vpa: { type: String }, // UPI VPA (e.g. user@gpay)
  card_id: { type: String },
  bank: { type: String },
  wallet: { type: String },
  status: { type: String, enum: ['captured', 'failed', 'refunded'], required: true },
  error_code: { type: String },
  error_description: { type: String },
  created_at: { type: Date, default: Date.now }
});

export const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
export const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);

/* ------------------------------------------------------------------------------
   3. API ENDPOINT: CREATE ORDER (POST /api/create-order)
------------------------------------------------------------------------------ */
app.post('/api/create-order', async (req, res) => {
  try {
    const { userId, amountInRupees, serviceCategory } = req.body;

    // SECURITY CHECK: Always calculate/verify amount on backend!
    if (!amountInRupees || amountInRupees <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid payment amount.' });
    }

    // Convert INR Rupees to Paise (Razorpay expects smallest currency unit: 1 INR = 100 Paise)
    const amountInPaise = Math.round(amountInRupees * 100);
    const receiptId = `receipt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: receiptId,
      notes: {
        userId: userId || 'guest_user',
        serviceCategory: serviceCategory || 'Advisory Consultation'
      }
    };

    // Create Order with Razorpay SDK
    const rzpOrder = await razorpay.orders.create(options);

    // Save Order into Database with status 'created'
    const dbOrder = new Order({
      order_id: `ORD_${Date.now()}`,
      user_id: userId || 'guest_user',
      amount: amountInPaise,
      currency: 'INR',
      status: 'created',
      razorpay_order_id: rzpOrder.id,
      receipt: receiptId
    });

    await dbOrder.save();

    return res.status(200).json({
      success: true,
      message: 'Razorpay order created successfully.',
      key: process.env.RAZORPAY_KEY_ID, // Only Key ID is passed to client (NEVER Secret!)
      order_id: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      receipt: rzpOrder.receipt
    });

  } catch (error) {
    console.error('❌ Error creating Razorpay Order:', error);
    return res.status(500).json({ success: false, message: 'Failed to create payment order', error: error.message });
  }
});

/* ------------------------------------------------------------------------------
   4. API ENDPOINT: VERIFY PAYMENT SIGNATURE (POST /api/verify-payment)
   SECURITY CRITICAL: Uses HMAC SHA256 to prevent tampered or forged payments
------------------------------------------------------------------------------ */
app.post('/api/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, internal_order_id } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing mandatory payment verification fields.' });
    }

    // Step 1: Construct verification payload string: "order_id|payment_id"
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'YourKeySecretHere')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    // Step 2: Compare signatures in constant time (prevents timing attacks)
    const isSignatureValid = crypto.timingSafeEqual(
      Buffer.from(generated_signature),
      Buffer.from(razorpay_signature)
    );

    if (!isSignatureValid) {
      console.error('❌ PAYMENT SECURITY ALERT: HMAC Signature Mismatch!');
      return res.status(400).json({ success: false, message: 'Payment verification failed. Invalid signature mismatch.' });
    }

    // Step 3: Fetch payment details from Razorpay API to verify status & payment method
    const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);

    // Step 4: Update Database Order & Transaction status
    await Order.findOneAndUpdate(
      { razorpay_order_id: razorpay_order_id },
      { status: 'paid' }
    );

    const transaction = new Transaction({
      payment_id: razorpay_payment_id,
      razorpay_order_id: razorpay_order_id,
      order_id: internal_order_id || `ORD_${Date.now()}`,
      amount: paymentDetails.amount,
      method: paymentDetails.method, // 'upi', 'card', 'netbanking', 'wallet'
      vpa: paymentDetails.vpa || null,
      card_id: paymentDetails.card_id || null,
      bank: paymentDetails.bank || null,
      wallet: paymentDetails.wallet || null,
      status: 'captured'
    });

    await transaction.save();

    console.log(`✅ Payment Verified & Captured Successfully: ${razorpay_payment_id} (${paymentDetails.method.toUpperCase()})`);

    return res.status(200).json({
      success: true,
      message: 'Payment verified and captured successfully.',
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
      method: paymentDetails.method
    });

  } catch (error) {
    console.error('❌ Error verifying payment:', error);
    return res.status(500).json({ success: false, message: 'Server error during payment verification', error: error.message });
  }
});

/* ------------------------------------------------------------------------------
   5. WEBHOOK ENDPOINT: POST /api/webhook/razorpay
   SECURITY: Mandatory webhook secret verification using HMAC SHA256
------------------------------------------------------------------------------ */
app.post('/api/webhook/razorpay', async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'YourWebhookSecretHere';
    const razorpaySignature = req.headers['x-razorpay-signature'];

    if (!razorpaySignature) {
      return res.status(400).send('Missing X-Razorpay-Signature header');
    }

    // Verify Webhook Signature against Raw Body
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(req.body) // req.body must be raw Buffer
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      console.error('❌ WEBHOOK SECURITY ALERT: Webhook Signature Invalid!');
      return res.status(400).send('Invalid webhook signature');
    }

    // Parse JSON payload after signature check passes
    const eventPayload = JSON.parse(req.body.toString());
    const event = eventPayload.event;
    const paymentEntity = eventPayload.payload.payment?.entity;

    console.log(`🔔 Razorpay Webhook Event Received: ${event}`);

    switch (event) {
      case 'payment.captured':
        console.log(`✅ Webhook: Payment captured for ${paymentEntity.id}`);
        await Order.findOneAndUpdate(
          { razorpay_order_id: paymentEntity.order_id },
          { status: 'paid' }
        );
        break;

      case 'payment.failed':
        console.log(`❌ Webhook: Payment failed for ${paymentEntity.id}`);
        await Order.findOneAndUpdate(
          { razorpay_order_id: paymentEntity.order_id },
          { status: 'failed' }
        );
        break;

      case 'refund.processed':
        console.log(`🔄 Webhook: Refund processed for ${eventPayload.payload.refund.entity.id}`);
        await Order.findOneAndUpdate(
          { razorpay_order_id: paymentEntity.order_id },
          { status: 'refunded' }
        );
        break;

      default:
        console.log(`ℹ️ Unhandled Webhook Event: ${event}`);
    }

    return res.status(200).json({ status: 'ok' });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    return res.status(500).send('Webhook processing error');
  }
});

/* ------------------------------------------------------------------------------
   6. REFUND API: POST /api/refund-payment (Partial or Full Refund)
------------------------------------------------------------------------------ */
app.post('/api/refund-payment', async (req, res) => {
  try {
    const { paymentId, amountInRupees } = req.body;

    if (!paymentId) {
      return res.status(400).json({ success: false, message: 'Payment ID is required for refund.' });
    }

    const refundOptions = amountInRupees ? { amount: Math.round(amountInRupees * 100) } : {}; // Full if amount not specified
    const refund = await razorpay.payments.refund(paymentId, refundOptions);

    console.log(`🔄 Refund Issued Successfully for Payment ID: ${paymentId}`);

    return res.status(200).json({
      success: true,
      message: 'Refund processed successfully.',
      refund_id: refund.id,
      amount: refund.amount / 100,
      status: refund.status
    });

  } catch (error) {
    console.error('❌ Error processing refund:', error);
    return res.status(500).json({ success: false, message: 'Refund processing failed', error: error.message });
  }
});

// Start Server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Razorpay Payment Server running on http://localhost:${PORT}`);
  });
}
