# Deployment Guide - Mentora Platform

## ✅ Completed Setup

- ✅ MongoDB fully removed
- ✅ Supabase fully integrated
- ✅ Payment system (Razorpay) added
- ✅ Vercel configuration created
- ✅ All services migrated to Supabase

## 🚀 Quick Start for Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment Variables
Copy `.env.example` to `.env` and add your credentials:
```bash
cp .env.example .env
```

Required variables:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `RAZORPAY_KEY_ID` - Razorpay key ID (from Razorpay dashboard)
- `RAZORPAY_KEY_SECRET` - Razorpay key secret
- `PORT` - Server port (default: 3000)

### 3. Set Up Supabase Database

1. Go to your Supabase project: https://supabase.com/dashboard/project/oitxwcspkelduxbuczux
2. Click **SQL Editor** in the left sidebar
3. Click **"New Query"**
4. Copy the entire content of `supabase-schema.sql`
5. Paste it into the SQL Editor
6. Click **"Run"** (or press Ctrl+Enter)
7. Wait for success message

### 4. Run Locally

**Backend (Terminal 1):**
```bash
npm run server
```

**Frontend (Terminal 2):**
```bash
npm run dev
```

**Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Health Check: http://localhost:3000/api/health

## 🌐 Deploy to Vercel

### Option 1: Using Vercel CLI

1. **Install Vercel CLI**
```bash
npm install -g vercel
```

2. **Login**
```bash
vercel login
```

3. **Deploy**
```bash
vercel
```

4. **Set Environment Variables**
Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Add these:
- `VITE_SUPABASE_URL` = Your Supabase URL
- `VITE_SUPABASE_ANON_KEY` = Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` = Your Supabase service role key
- `RAZORPAY_KEY_ID` = Your Razorpay key ID
- `RAZORPAY_KEY_SECRET` = Your Razorpay key secret

5. **Redeploy**
```bash
vercel --prod
```

### Option 2: Using Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. Import your GitHub repository: `AshwaniK8761/website`
4. Configure:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. Click **"Deploy"**
6. After deployment, go to **Settings → Environment Variables**
7. Add all required environment variables
8. Click **"Redeploy"**

## 💳 Razorpay Setup

### 1. Create Razorpay Account
1. Go to [razorpay.com](https://razorpay.com)
2. Sign up and verify your email
3. Complete KYC (for production)

### 2. Get API Keys
1. Go to Settings → API Keys
2. Copy **Key ID** and **Key Secret**
3. Add to your `.env` file or Vercel environment variables

### 3. Test Mode
- Razorpay provides test mode for development
- Use test cards from Razorpay documentation
- Switch to live mode after KYC completion

## 🔒 Security Checklist

- [ ] `.env` file is in `.gitignore`
- [ ] Service role key only used on backend
- [ ] Razorpay secrets not exposed in frontend
- [ ] Supabase RLS policies enabled
- [ ] HTTPS enabled in production
- [ ] Environment variables set in Vercel

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Experts
- `GET /api/experts` - Get all experts
- `GET /api/experts/:id` - Get single expert
- `POST /api/experts` - Create expert
- `POST /api/experts/markup` - Update expert markup

### Availability
- `GET /api/availability` - Get availability slots
- `POST /api/availability` - Create availability slot
- `POST /api/availability/book` - Book a slot

### Project Reviews
- `GET /api/project-reviews` - Get project reviews
- `POST /api/project-reviews/request` - Create project review request
- `POST /api/project-reviews/:id/respond` - Respond to request

### Payments
- `POST /api/payment/create-order` - Create Razorpay order
- `POST /api/payment/verify` - Verify payment
- `GET /api/payment/status/:orderId` - Get payment status

### Notifications
- `GET /api/notifications` - Get user notifications
- `POST /api/notifications` - Create notification
- `PUT /api/notifications/:id/read` - Mark as read

### Platform Settings
- `GET /api/platform-settings` - Get platform settings
- `POST /api/platform-settings` - Update platform settings

## 🐛 Troubleshooting

### Database Connection Error
- Check Supabase credentials in `.env`
- Verify Supabase project is active
- Run the database schema SQL

### Payment Error
- Verify Razorpay keys are correct
- Check Razorpay account status
- Ensure test mode is enabled for development

### Build Error
- Run `npm install` to ensure all dependencies
- Check Node.js version (should be 18+)
- Clear cache: `rm -rf node_modules && npm install`

### Vercel Deployment Error
- Check environment variables are set
- Verify build command is correct
- Check Vercel logs for specific errors

## 📝 Post-Deployment Checklist

- [ ] Test all API endpoints
- [ ] Test user registration and login
- [ ] Test expert directory
- [ ] Test booking system
- [ ] Test payment flow (test mode)
- [ ] Test notifications
- [ ] Verify database operations
- [ ] Check mobile responsiveness
- [ ] Verify SSL/HTTPS
- [ ] Set up monitoring and analytics

## 🔄 Continuous Deployment

Vercel automatically deploys when you push to GitHub:
- Push to `main` branch → Production deployment
- Push to other branches → Preview deployment

## 📞 Support

For deployment issues:
1. Check Vercel deployment logs
2. Check Supabase logs
3. Check browser console for frontend errors
4. Review this guide
