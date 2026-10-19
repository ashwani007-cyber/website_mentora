# Supabase Setup Guide for Mentora Platform

## ✅ Completed Steps

1. ✅ Git repository initialized and connected to GitHub
2. ✅ Supabase client installed (@supabase/supabase-js)
3. ✅ Environment variables configured (.env file)
4. ✅ New Supabase-based server created (server-supabase.js)
5. ✅ Frontend Supabase client created (src/supabaseClient.ts)
6. ✅ Database schema SQL file created (supabase-schema.sql)

## 📋 Remaining Steps (Manual)

### Step 1: Run Database Schema in Supabase

1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/oitxwcspkelduxbuczux
2. Click **SQL Editor** in the left sidebar
3. Click **"New Query"**
4. Copy the entire content of `supabase-schema.sql` file from this project
5. Paste it into the SQL Editor
6. Click **"Run"** or press `Ctrl+Enter`
7. Wait for the schema to be created (should take a few seconds)
8. You should see "Success" message

### Step 2: Update package.json Scripts

The following scripts have been added to package.json:
- `npm run server` - Run the Supabase backend server
- `npm run server:dev` - Run server with auto-reload (for development)

### Step 3: Test the Server

1. Open a terminal in the project directory
2. Run: `npm run server`
3. You should see:
   ```
   🚀 Starting Mentora Server with Supabase...
   ✅ Supabase client initialized
   ✅ Server running on http://localhost:3000
   ✅ Supabase connected
   ✅ API endpoints ready
   ```

4. Test health endpoint: Open http://localhost:3000/api/health in browser
5. You should see: `{"success":true,"message":"Server is healthy","database":"connected"}`

### Step 4: Run Frontend

1. Open a new terminal (keep server running)
2. Run: `npm run dev`
3. Open http://localhost:5173 in browser

## 🔄 Migration Notes

### What Changed:
- **MongoDB → Supabase**: Database backend migrated
- **server.js → server-supabase.js**: New server file using Supabase
- **MongoDB schemas → Supabase tables**: Database structure converted
- **mongoose → @supabase/supabase-js**: ORM replaced with Supabase client

### What Remains:
- Frontend React code still uses old MongoDB service (needs migration)
- Authentication logic in server/mongoHandler.js (needs migration)
- Some endpoints may need adjustment

### Next Steps (Optional):
1. Update frontend services to use Supabase instead of MongoDB
2. Migrate authentication from mongoHandler.js to Supabase Auth
3. Test all features end-to-end
4. Update UI to use new API endpoints

## 📁 New Files Created

1. `.env` - Environment variables (gitignored)
2. `server-supabase.js` - New Express server with Supabase
3. `server/supabaseClient.js` - Supabase client for backend
4. `src/supabaseClient.ts` - Supabase client for frontend
5. `supabase-schema.sql` - Database schema SQL
6. `SETUP_GUIDE.md` - This file

## 🔐 Security Notes

- `.env` file is in `.gitignore` and will NOT be committed to GitHub
- Service role key is only used on backend server
- Anon key is used on frontend (limited permissions)
- Never commit secrets to public repositories

## 🚀 Quick Start Commands

```bash
# Install dependencies (if needed)
npm install

# Run backend server
npm run server

# Run frontend dev server (in separate terminal)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📞 Support

If you encounter issues:
1. Check Supabase dashboard for database errors
2. Verify .env file has correct credentials
3. Check browser console for frontend errors
4. Check terminal for server errors
