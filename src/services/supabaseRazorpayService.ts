// Supabase-based Razorpay Payment Service
import { supabase } from '../supabaseClient';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export interface PaymentOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
  created_at: number;
}

export interface PaymentOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id?: string;
  handler: (response: any) => void;
  prefill: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme: {
    color: string;
  };
}

export const razorpayService = {
  // Create payment order
  async createOrder(amount: number, receipt: string, notes?: any): Promise<PaymentOrder | null> {
    try {
      // Call backend to create Razorpay order
      const response = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, receipt, notes })
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      return data.order;
    } catch (err) {
      console.error('Error creating order:', err);
      return null;
    }
  },

  // Process payment
  async processPayment(options: PaymentOptions): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!window.Razorpay) {
        reject(new Error('Razorpay SDK not loaded'));
        return;
      }

      const rzp = new window.Razorpay({
        ...options,
        handler: (response: any) => {
          // Verify payment on backend
          this.verifyPayment(response.razorpay_payment_id, response.razorpay_order_id, response.razorpay_signature)
            .then(verified => {
              if (verified) {
                options.handler(response);
                resolve(response);
              } else {
                reject(new Error('Payment verification failed'));
              }
            })
            .catch(reject);
        },
        modal: {
          ondismiss: () => {
            reject(new Error('Payment cancelled by user'));
          }
        }
      });

      rzp.open();
    });
  },

  // Verify payment
  async verifyPayment(paymentId: string, orderId: string, signature: string): Promise<boolean> {
    try {
      const response = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, orderId, signature })
      });

      const data = await response.json();
      return data.success;
    } catch (err) {
      console.error('Error verifying payment:', err);
      return false;
    }
  },

  // Load Razorpay SDK
  loadRazorpayScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.Razorpay) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
      document.body.appendChild(script);
    });
  },

  // Get payment status
  async getPaymentStatus(orderId: string): Promise<any> {
    try {
      const response = await fetch(`/api/payment/status/${orderId}`);
      const data = await response.json();
      return data;
    } catch (err) {
      console.error('Error getting payment status:', err);
      return null;
    }
  }
};
