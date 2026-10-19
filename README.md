# Mentora - Expert Consulting Platform

A modern expert consulting platform built with React, TypeScript, Supabase, and Razorpay.

## 🚀 Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS 4 + Framer Motion
- **Backend**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Custom Auth with bcryptjs
- **Payment**: Razorpay
- **Charts**: Recharts
- **3D Graphics**: Three.js

## 📦 Features

- Expert directory with search and filters
- Expert availability management
- Project review system
- Booking system
- Real-time notifications
- Admin governance portal
- Client and expert dashboards
- Payment integration with Razorpay
- Document management
- Video meeting integration

## 🛠️ Local Development

### Prerequisites

- Node.js 18+ installed
- Supabase account and project
- Razorpay account (for payments)

### Setup

1. **Clone the repository**
```bash
git clone https://github.com/AshwaniK8761/website.git
cd website
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
PORT=3000
```

4. **Set up Supabase database**
- Go to your Supabase project SQL Editor
- Copy and run the SQL from `supabase-schema.sql`
- This will create all required tables

5. **Run the development server**

**Backend:**
```bash
npm run server
```

**Frontend (in separate terminal):**
```bash
npm run dev
```

6. **Open your browser**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

## 🌐 Deployment on Vercel

### Prerequisites

1. Push your code to GitHub
2. Set up environment variables in Vercel dashboard

### Deploy to Vercel

1. **Install Vercel CLI**
```bash
npm install -g vercel
```

2. **Login to Vercel**
```bash
vercel login
```

3. **Deploy**
```bash
vercel
```

4. **Set environment variables in Vercel Dashboard**
Go to your project settings → Environment Variables and add:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

5. **Redeploy** after setting environment variables

### Manual Deployment via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Add environment variables
6. Click "Deploy"

## 📁 Project Structure

```
.
├── api/                    # Vercel serverless functions
├── public/                 # Static assets
├── server/                 # Backend server files
│   ├── supabaseClient.js   # Supabase client
│   └── password-reset/     # Password reset functionality
├── src/
│   ├── components/         # React components
│   ├── services/          # API services
│   ├── types/             # TypeScript types
│   ├── utils/             # Utility functions
│   ├── App.tsx            # Main app component
│   └── main.tsx           # Entry point
├── server.js              # Express server
├── supabase-schema.sql    # Database schema
├── vercel.json            # Vercel configuration
├── package.json           # Dependencies
└── vite.config.ts         # Vite configuration
```

## 🔐 Security Notes

- Never commit `.env` file to git
- Use environment variables for all secrets
- Service role key should only be used on backend
- Enable Row Level Security (RLS) in Supabase
- Use HTTPS in production

## 📝 Available Scripts

- `npm run dev` - Start frontend dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run server` - Start backend server
- `npm run server:dev` - Start backend with auto-reload
- `npm run lint` - Run linter

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is private and proprietary.

## 🆘 Support

For issues and questions, please contact the development team.
