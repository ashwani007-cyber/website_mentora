# Mentora Platform - Project Summary

## 🎯 Project Overview

**Mentora** is a modern expert consulting platform that connects enterprises with senior executives, board leaders, and industry experts for project reviews, consultations, and advisory services.

---

## 📊 Project Statistics

- **Total Files**: 868+ files
- **Lines of Code**: 320,000+ lines
- **Dependencies**: 183 packages
- **Components**: 35+ React components
- **API Endpoints**: 20+ endpoints
- **Database Tables**: 8+ Supabase tables

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: React 19.2.8
- **Language**: TypeScript 6.0.2
- **Build Tool**: Vite 8.2.0
- **Styling**: Tailwind CSS 4.3.3
- **Animations**: Framer Motion 13.1.1
- **Charts**: Recharts 3.10.1
- **3D Graphics**: Three.js 0.185.1
- **Icons**: Lucide React 1.33.0
- **Confetti**: canvas-confetti 1.9.4

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js 4.18.2
- **Database**: Supabase (PostgreSQL)
- **Authentication**: bcryptjs 3.0.3
- **Environment**: dotenv 18.0.5
- **CORS**: cors 2.8.5

### Payment
- **Provider**: Razorpay
- **Integration**: Order creation, verification, status tracking

### Deployment
- **Platform**: Vercel
- **Configuration**: Serverless functions + Static site

---

## 🎨 Design System

### Color Palette
- **Primary Background**: #05080E (Deep Space)
- **Surface**: #0B111A, #111A27
- **Accent Gold**: #F59E0B, #FCD34D
- **Accent Cyan**: #06B6D4
- **Accent Emerald**: #10B981
- **Accent Rose**: #EF4444

### Typography
- **Display Font**: Plus Jakarta Sans
- **Body Font**: Inter
- **Google Fonts**: Integrated via CDN

---

## 📦 Core Features

### 1. User Management
- ✅ User registration (Admin, Expert, Client)
- ✅ Login/logout with bcrypt password hashing
- ✅ Role-based access control
- ✅ Profile management
- ✅ Phone verification

### 2. Expert Directory
- ✅ Expert profiles with ratings
- ✅ Search and filter by field, expertise
- ✅ Expert availability calendar
- ✅ Skill tags and documents
- ✅ Rate management (base rate + markup)
- ✅ Project review pricing

### 3. Booking System
- ✅ Expert availability slots
- ✅ Time slot booking
- ✅ Booking confirmation
- ✅ Meeting link generation
- ✅ Booking history
- ✅ Status tracking (Confirmed, Completed, Cancelled)

### 4. Project Reviews
- ✅ Project review requests
- ✅ Expert acceptance/rejection
- ✅ Chat system
- ✅ Activity timeline
- ✅ Document submission
- ✅ Feedback collection
- ✅ Escrow payment system

### 5. Payment System
- ✅ Razorpay integration
- ✅ Order creation
- ✅ Payment verification
- ✅ Wallet transactions
- ✅ Platform fee calculation
- ✅ Expert earnings tracking

### 6. Notifications
- ✅ Real-time notifications
- ✅ Notification center
- ✅ Read/unread status
- ✅ Notification types (booking, payment, review)
- ✅ Activity timeline

### 7. Admin Portal
- ✅ Admin dashboard
- ✅ Expert management
- ✅ Platform settings
- ✅ Fee configuration (fixed/percentage)
- ✅ Blog management
- ✅ Notification management
- ✅ Metrics and analytics

### 8. Dashboards
- ✅ Client dashboard
- ✅ Expert dashboard
- ✅ Senior Pro dashboard
- ✅ Booking management
- ✅ Project review workspace
- ✅ Wallet view

### 9. Additional Features
- ✅ AI Matchmaker (expert recommendations)
- ✅ Google Meet integration
- ✅ Document viewer
- ✅ Accessibility toolbar
- ✅ Subscription views
- ✅ Referral community
- ✅ Story hub
- ✅ Training upsell
- ✅ Premium navigation dock
- ✅ Global button magnification
- ✅ Background videos (expert + landing)
- ✅ Flow wallpaper
- ✅ Footer with newsletter

---

## 🗄️ Database Schema (Supabase)

### Tables
1. **users** - User accounts and profiles
2. **experts** - Expert profiles and details
3. **expert_availability** - Expert time slots
4. **project_reviews** - Project review requests
5. **bookings** - Session bookings
6. **notifications** - Notification system
7. **wallet_transactions** - Payment transactions
8. **blogs** - Blog posts
9. **platform_settings** - Platform configuration

### Key Features
- Row Level Security (RLS) enabled
- Auto-updated timestamps
- Indexes for performance
- Foreign key relationships
- JSONB for flexible data

---

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login user

### Experts
- `GET /api/experts` - Get all experts
- `GET /api/experts/:id` - Get single expert
- `POST /api/experts` - Create expert
- `POST /api/experts/markup` - Update markup

### Availability
- `GET /api/availability` - Get availability
- `POST /api/availability` - Create slot
- `POST /api/availability/book` - Book slot

### Project Reviews
- `GET /api/project-reviews` - Get reviews
- `POST /api/project-reviews/request` - Create request
- `POST /api/project-reviews/:id/respond` - Respond to request
- `GET /api/project-reviews/pricing` - Get pricing
- `POST /api/project-reviews/pricing` - Update pricing

### Payments
- `POST /api/payment/create-order` - Create Razorpay order
- `POST /api/payment/verify` - Verify payment
- `GET /api/payment/status/:orderId` - Get status

### Notifications
- `GET /api/notifications` - Get notifications
- `POST /api/notifications` - Create notification
- `PUT /api/notifications/:id/read` - Mark as read

### Platform
- `GET /api/platform-settings` - Get settings
- `POST /api/platform-settings` - Update settings

### Bookings
- `GET /api/bookings` - Get bookings
- `POST /api/bookings` - Create booking

---

## 📁 Project Structure

```
MY Best Project ( Latest(11) Updated Version )/
├── api/                          # Vercel serverless functions
│   ├── index.js                  # API entry point
│   └── server.js                 # Serverless API
├── public/                       # Static assets
│   ├── uploaded_docs/           # User documents
│   ├── icons.svg                # SVG icons
│   └── favicon files            # Favicons
├── server/                       # Backend server files
│   ├── supabaseClient.js        # Supabase client
│   ├── razorpayServer.js        # Razorpay integration
│   └── password-reset/          # Password reset
├── src/
│   ├── components/              # React components (35+)
│   │   ├── AdminDashboard.tsx
│   │   ├── ClientDashboard.tsx
│   │   ├── ExpertDirectory.tsx
│   │   ├── ProjectReviewWorkspace.tsx
│   │   └── ... (30+ more)
│   ├── services/                # API services
│   │   ├── supabaseExpertiseService.ts
│   │   ├── supabaseNotificationService.ts
│   │   ├── supabaseRazorpayService.ts
│   │   ├── expertiseService.ts
│   │   ├── notificationService.ts
│   │   └── razorpayService.ts
│   ├── types/                   # TypeScript types
│   │   └── index.ts
│   ├── utils/                   # Utility functions
│   │   └── pdfGenerator.ts
│   ├── data/                    # Mock data
│   │   ├── blogArticles.ts
│   │   ├── expertVideoConfig.ts
│   │   ├── landingVideoConfig.ts
│   │   ├── mockData.ts
│   │   └── seedBlogs.json
│   ├── assets/                  # Images and logos
│   ├── App.tsx                  # Main app (525KB)
│   ├── main.tsx                 # Entry point
│   ├── index.css                # Global styles
│   └── supabaseClient.ts        # Frontend Supabase client
├── server.js                    # Express server (Supabase)
├── supabase-schema.sql          # Database schema
├── vercel.json                  # Vercel config
├── package.json                 # Dependencies
├── vite.config.ts               # Vite config
├── tsconfig.json                # TypeScript config
├── .env.example                 # Environment template
├── .gitignore                   # Git ignore rules
├── README.md                    # Project documentation
├── DEPLOYMENT_GUIDE.md          # Deployment guide
└── PROJECT_SUMMARY.md           # This file
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Supabase account
- Razorpay account (for payments)

### Installation
```bash
cd "MY Best Project ( Latest(11) Updated Version )"
npm install
```

### Environment Setup
```bash
cp .env.example .env
# Edit .env with your credentials
```

### Database Setup
1. Go to Supabase SQL Editor
2. Run `supabase-schema.sql`
3. Verify tables created

### Run Locally
```bash
# Backend
npm run server

# Frontend (new terminal)
npm run dev
```

---

## 🌐 Deployment

### Vercel Deployment
1. Push to GitHub
2. Import in Vercel
3. Set environment variables
4. Deploy

### Environment Variables Required
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

---

## 🔒 Security

- ✅ Environment variables for secrets
- ✅ bcryptjs for password hashing
- ✅ Supabase RLS policies
- ✅ CORS enabled
- ✅ Service role key only on backend
- ✅ .env in .gitignore

---

## 📈 Performance

- ✅ Vite for fast builds
- ✅ Lazy loading with React
- ✅ Database indexes
- ✅ Optimized images
- ✅ Code splitting

---

## 🎯 Roadmap

### Completed
- ✅ MongoDB to Supabase migration
- ✅ Razorpay payment integration
- ✅ Vercel deployment config
- ✅ Full authentication system
- ✅ Expert directory
- ✅ Booking system
- ✅ Project reviews
- ✅ Notifications

### Future Enhancements
- ⏳ Real-time chat with WebSockets
- ⏳ Video call integration
- ⏳ Advanced analytics
- ⏳ Mobile app (React Native)
- ⏳ AI-powered matching
- ⏳ Multi-language support

---

## 📞 Support

For issues or questions:
- Check DEPLOYMENT_GUIDE.md
- Review README.md
- Check Supabase logs
- Check Vercel logs

---

## 📄 License

Private project - All rights reserved.

---

**Generated**: October 19, 2026
**Version**: 1.0.0
**Status**: Production Ready
