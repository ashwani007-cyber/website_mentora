-- Supabase Database Schema for Mentora Platform
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS TABLE (Authentication + Profiles)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'expert', 'client')),
    phone VARCHAR(50),
    avatar_url TEXT,
    bio TEXT,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- EXPERTS TABLE (Expert Profiles)
-- ============================================================
CREATE TABLE IF NOT EXISTS experts (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    field VARCHAR(255) NOT NULL,
    years_of_experience INTEGER,
    base_rate DECIMAL(10, 2),
    admin_markup DECIMAL(10, 2) DEFAULT 0,
    rate DECIMAL(10, 2),
    project_rate DECIMAL(10, 2),
    rating DECIMAL(3, 2) DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    verified BOOLEAN DEFAULT false,
    initials VARCHAR(10),
    title VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    bio TEXT,
    skills TEXT[],
    documents JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- EXPERT AVAILABILITY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS expert_availability (
    id VARCHAR(255) PRIMARY KEY,
    expert_id VARCHAR(255) REFERENCES experts(id) ON DELETE CASCADE,
    availability_date DATE NOT NULL,
    start_time VARCHAR(100) NOT NULL,
    end_time VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'BOOKED', 'DISABLED')),
    booking_id VARCHAR(255),
    client_id VARCHAR(255),
    client_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- PROJECT REVIEWS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS project_reviews (
    project_review_id VARCHAR(255) PRIMARY KEY,
    client_id VARCHAR(255) NOT NULL,
    client_name VARCHAR(255) DEFAULT 'Client',
    client_email VARCHAR(255) NOT NULL,
    expert_id VARCHAR(255) NOT NULL,
    expert_name VARCHAR(255) DEFAULT 'Expert',
    expert_email VARCHAR(255) NOT NULL,
    package_id VARCHAR(255) DEFAULT 'project_review',
    package_name VARCHAR(255) DEFAULT 'Dedicated Project Review',
    price DECIMAL(10, 2) NOT NULL,
    expert_earning DECIMAL(10, 2) NOT NULL,
    platform_fee DECIMAL(10, 2) DEFAULT 0,
    platform_charge_type VARCHAR(20),
    status VARCHAR(50) DEFAULT 'PendingExpertAcceptance',
    payment_status VARCHAR(50) DEFAULT 'PaymentPending',
    expert_earning_status VARCHAR(50) DEFAULT 'EarningPending',
    request_notes TEXT,
    expected_scope TEXT,
    review_type VARCHAR(100),
    submission JSONB,
    chat JSONB DEFAULT '[]',
    proposed_times JSONB DEFAULT '[]',
    meetings JSONB DEFAULT '[]',
    completed_meeting_count INTEGER DEFAULT 0,
    review_feedback JSONB,
    client_wallet_tx_id VARCHAR(255),
    expert_wallet_tx_id VARCHAR(255),
    client_archived BOOLEAN DEFAULT false,
    expert_archived BOOLEAN DEFAULT false,
    activity_timeline JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- BOOKINGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS bookings (
    id VARCHAR(255) PRIMARY KEY,
    client_id VARCHAR(255) NOT NULL,
    client_name VARCHAR(255),
    client_email VARCHAR(255) NOT NULL,
    expert_id VARCHAR(255) NOT NULL,
    expert_name VARCHAR(255),
    expert_email VARCHAR(255) NOT NULL,
    availability_id VARCHAR(255) REFERENCES expert_availability(id) ON DELETE CASCADE,
    booking_date DATE NOT NULL,
    start_time VARCHAR(100) NOT NULL,
    end_time VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
    price DECIMAL(10, 2) NOT NULL,
    platform_fee DECIMAL(10, 2) DEFAULT 0,
    payment_status VARCHAR(20) DEFAULT 'PAID',
    meeting_link TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    user_role VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    link TEXT,
    is_read BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- WALLET TRANSACTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    user_role VARCHAR(50) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('CREDIT', 'DEBIT')),
    status VARCHAR(20) DEFAULT 'SUCCESS',
    description TEXT,
    related_booking_id VARCHAR(255),
    related_project_review_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- BLOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS blogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    excerpt TEXT,
    content TEXT NOT NULL,
    author_name VARCHAR(255),
    author_email VARCHAR(255),
    cover_image_url TEXT,
    category VARCHAR(100),
    tags TEXT[],
    is_published BOOLEAN DEFAULT false,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- PLATFORM SETTINGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS platform_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default platform settings
INSERT INTO platform_settings (key, value, description) VALUES
('platform_charge', '{"feeType": "fixed", "feeValue": 200, "currency": "INR"}', 'Platform fee configuration'),
('expert_default_rate', '{"minRate": 500, "maxRate": 5000, "currency": "INR"}', 'Default expert rate limits'),
('project_review_limits', '{"minPrice": 0, "maxPrice": 2000, "currency": "INR"}', 'Project review price limits')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- INDEXES (for performance)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_experts_email ON experts(email);
CREATE INDEX IF NOT EXISTS idx_experts_field ON experts(field);
CREATE INDEX IF NOT EXISTS idx_expert_availability_expert_id ON expert_availability(expert_id);
CREATE INDEX IF NOT EXISTS idx_expert_availability_date ON expert_availability(availability_date);
CREATE INDEX IF NOT EXISTS idx_project_reviews_client_id ON project_reviews(client_id);
CREATE INDEX IF NOT EXISTS idx_project_reviews_expert_id ON project_reviews(expert_id);
CREATE INDEX IF NOT EXISTS idx_project_reviews_status ON project_reviews(status);
CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_expert_id ON bookings(expert_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE experts ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Allow public read access for experts (needed for directory)
CREATE POLICY "Allow public read access to experts" ON experts
    FOR SELECT USING (true);

-- Allow authenticated users to read their own data
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid()::text = id::text);

-- Allow service role to do everything (for backend)
CREATE POLICY "Service role full access" ON users
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access experts" ON experts
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access availability" ON expert_availability
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access project_reviews" ON project_reviews
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access bookings" ON bookings
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access notifications" ON notifications
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access wallet" ON wallet_transactions
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- FUNCTIONS (Updated timestamp trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_experts_updated_at BEFORE UPDATE ON experts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expert_availability_updated_at BEFORE UPDATE ON expert_availability
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_reviews_updated_at BEFORE UPDATE ON project_reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_platform_settings_updated_at BEFORE UPDATE ON platform_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
