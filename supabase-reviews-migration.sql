-- ============================================================
-- Mentora Platform: Reviews & Dynamic Rating Migration
-- ============================================================

-- 1. Create reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
    id VARCHAR(255) PRIMARY KEY,
    expert_id VARCHAR(255) NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    client_name VARCHAR(255),
    client_email VARCHAR(255),
    expert_name VARCHAR(255),
    expert_email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_client_session_review UNIQUE (client_id, session_id)
);

-- 2. Indexes for fast aggregation
CREATE INDEX IF NOT EXISTS idx_reviews_expert_id ON public.reviews(expert_id);
CREATE INDEX IF NOT EXISTS idx_reviews_expert_email ON public.reviews(expert_email);
CREATE INDEX IF NOT EXISTS idx_reviews_session_id ON public.reviews(session_id);

-- 3. Function to calculate aggregate rating and review count for an expert
CREATE OR REPLACE FUNCTION get_expert_review_stats(p_expert_id VARCHAR)
RETURNS TABLE (
    avg_rating NUMERIC,
    review_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(ROUND(AVG(rating)::numeric, 1), 0.0) AS avg_rating,
        COUNT(*)::bigint AS review_count
    FROM public.reviews
    WHERE expert_id = p_expert_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Reset legacy mock ratings and mock consultation counts to 0
-- for any experts without real client reviews
UPDATE public.experts
SET rating = 0.0, total_sessions = 0
WHERE id NOT IN (SELECT DISTINCT expert_id FROM public.reviews);
