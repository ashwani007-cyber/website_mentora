/**
 * ==============================================================================
 * RAZORPAY FRONTEND CHECKOUT INTEGRATION SERVICE (React / Next.js)
 * Loads Checkout.js dynamically and opens Indian Payment Modal (UPI/Card/Netbanking)
 * ==============================================================================
 */

declare global {
  interface Window {
    Razorpay: any;
  }
}

// Dynamically load Razorpay Checkout SDK Script
export const loadRazorpaySDK = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export interface PaymentPayload {
  amountInRupees: number;
  userId: string;
  userEmail: string;
  userName: string;
  userPhone?: string;
  serviceCategory?: string;
}

export const processRazorpayPayment = async ({
  amountInRupees,
  userId,
  userEmail,
  userName,
  userPhone = "+91 98765 43210",
  serviceCategory = "Consultation"
}: PaymentPayload): Promise<{ success: boolean; paymentId?: string; message: string }> => {
  try {
    // 1. Load Razorpay Checkout.js Script
    const isSDKLoaded = await loadRazorpaySDK();
    if (!isSDKLoaded) {
      alert("❌ Failed to load Razorpay Payment Gateway SDK. Please check your internet connection.");
      return { success: false, message: "SDK Load Failed" };
    }

    // 2. Call Backend API to create Razorpay Order (POST /api/create-order)
    const response = await fetch("http://localhost:5000/api/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, amountInRupees, serviceCategory })
    });

    const orderData = await response.json();
    if (!orderData.success) {
      alert(`❌ Order Creation Error: ${orderData.message}`);
      return { success: false, message: orderData.message };
    }

    // 3. Configure Razorpay Checkout Modal Options
    return new Promise((resolve) => {
      const options = {
        key: orderData.key, // Razorpay Key ID
        amount: orderData.amount, // in paise
        currency: orderData.currency,
        name: "Mentora",
        description: `Payment for ${serviceCategory}`,
        image: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
        order_id: orderData.order_id, // Razorpay Order ID from backend
        prefill: {
          name: userName,
          email: userEmail,
          contact: userPhone
        },
        theme: {
          color: "#A6743A" // Custom Theme Color
        },
        config: {
          display: {
            blocks: {
              upi: {
                name: "Pay via UPI (GPay, PhonePe, Paytm, BHIM)",
                instruments: [{ method: "upi" }]
              }
            },
            sequence: ["block.upi", "block.banks"],
            preferences: { show_default_blocks: true }
          }
        },
        // 4. Payment Success Handler -> Send credentials to Backend for HMAC Signature Verification
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch("http://localhost:5000/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              resolve({
                success: true,
                paymentId: response.razorpay_payment_id,
                message: "Payment captured & HMAC signature verified successfully."
              });
            } else {
              resolve({ success: false, message: verifyData.message });
            }
          } catch (err: any) {
            resolve({ success: false, message: err.message || "Verification network error" });
          }
        },
        modal: {
          ondismiss: () => {
            console.log("⚠️ Payment modal dismissed by user.");
            resolve({ success: false, message: "Payment cancelled by user." });
          }
        }
      };

      const paymentObject = new window.Razorpay(options);

      // Handle payment failure event
      paymentObject.on("payment.failed", (response: any) => {
        console.error("❌ Payment Failed:", response.error);
        resolve({
          success: false,
          message: response.error.description || "Payment Failed"
        });
      });

      // Open Razorpay Checkout Modal
      paymentObject.open();
    });

  } catch (error: any) {
    console.error("❌ Razorpay Frontend Error:", error);
    return { success: false, message: error.message || "Unexpected Payment Error" };
  }
};
