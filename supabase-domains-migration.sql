-- ==============================================================================
-- MENTORA ADVISORY DOMAIN TAXONOMY MIGRATION
-- STEP 1: Single Source of Truth for Expertise Domains in Supabase
-- ==============================================================================

-- 1. Create table `domains`
CREATE TABLE IF NOT EXISTS public.domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT UNIQUE,
    color TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure slug is generated or unique if not provided
CREATE OR REPLACE FUNCTION public.generate_domain_slug() 
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_domain_slug ON public.domains;
CREATE TRIGGER trg_domain_slug
    BEFORE INSERT OR UPDATE ON public.domains
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_domain_slug();

-- 2. Add domain_id FK column to experts (and expert_profiles if present)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'experts'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'experts' AND column_name = 'domain_id'
        ) THEN
            ALTER TABLE public.experts ADD COLUMN domain_id UUID REFERENCES public.domains(id) ON DELETE RESTRICT;
        END IF;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'expert_profiles'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'expert_profiles' AND column_name = 'domain_id'
        ) THEN
            ALTER TABLE public.expert_profiles ADD COLUMN domain_id UUID REFERENCES public.domains(id) ON DELETE RESTRICT;
        END IF;
    END IF;
END $$;

-- 3. Seed the 8 canonical default domains
INSERT INTO public.domains (name, slug, color, sort_order, is_active)
VALUES
    ('Finance & Taxation', 'finance-taxation', '#10B981', 1, true),
    ('HR & Talent', 'hr-talent', '#8B5CF6', 2, true),
    ('Tech & Digital', 'tech-digital', '#0EA5E9', 3, true),
    ('Legal & Compliance', 'legal-compliance', '#F59E0B', 4, true),
    ('Marketing Strategy', 'marketing-strategy', '#F43F5E', 5, true),
    ('Operations & Logistics', 'operations-logistics', '#14B8A6', 6, true),
    ('School Mathematics', 'school-mathematics', '#6366F1', 7, true),
    ('Teaching & Academia', 'teaching-academia', '#3B82F6', 8, true)
ON CONFLICT (name) DO UPDATE 
SET 
    slug = EXCLUDED.slug,
    color = EXCLUDED.color,
    sort_order = EXCLUDED.sort_order,
    is_active = true;

-- Also seed any existing extra domains from current experts so no expert is stranded
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'experts'
    ) THEN
        INSERT INTO public.domains (name, slug, color, sort_order, is_active)
        SELECT DISTINCT 
            trim(field) AS name,
            lower(regexp_replace(trim(field), '[^a-zA-Z0-9]+', '-', 'g')) AS slug,
            '#F59E0B' AS color,
            99 AS sort_order,
            true AS is_active
        FROM public.experts 
        WHERE field IS NOT NULL AND trim(field) != ''
        ON CONFLICT (name) DO NOTHING;
    END IF;
END $$;

-- 4. Map existing text values in `field` to `domain_id`
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'experts'
    ) THEN
        UPDATE public.experts e
        SET domain_id = d.id
        FROM public.domains d
        WHERE (
            lower(trim(e.field)) = lower(trim(d.name))
            OR lower(trim(e.field)) = lower(trim(d.slug))
        )
        AND e.domain_id IS NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'expert_profiles'
    ) THEN
        UPDATE public.expert_profiles ep
        SET domain_id = d.id
        FROM public.domains d
        WHERE (
            lower(trim(ep.field)) = lower(trim(d.name))
            OR lower(trim(ep.field)) = lower(trim(d.slug))
        )
        AND ep.domain_id IS NULL;
    END IF;
END $$;

-- 5. Row Level Security (RLS)
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on domains" ON public.domains;
DROP POLICY IF EXISTS "Only admin can insert domains" ON public.domains;
DROP POLICY IF EXISTS "Only admin can update domains" ON public.domains;
DROP POLICY IF EXISTS "Only admin can delete domains" ON public.domains;

-- Anyone (anon and authenticated) can read active domains
CREATE POLICY "Allow public read access on domains" 
ON public.domains 
FOR SELECT 
USING (true);

-- Only admin (or service role) can insert
CREATE POLICY "Only admin can insert domains" 
ON public.domains 
FOR INSERT 
WITH CHECK (
    auth.role() = 'service_role' 
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE (id::text = auth.uid()::text OR id = auth.uid()) 
        AND role = 'admin'
    )
    OR (current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role' = 'admin')
    OR (current_setting('request.jwt.claims', true)::jsonb->'user_metadata'->>'role' = 'admin')
);

-- Only admin (or service role) can update
CREATE POLICY "Only admin can update domains" 
ON public.domains 
FOR UPDATE 
USING (
    auth.role() = 'service_role' 
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE (id::text = auth.uid()::text OR id = auth.uid()) 
        AND role = 'admin'
    )
    OR (current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role' = 'admin')
    OR (current_setting('request.jwt.claims', true)::jsonb->'user_metadata'->>'role' = 'admin')
);

-- Only admin (or service role) can delete
CREATE POLICY "Only admin can delete domains" 
ON public.domains 
FOR DELETE 
USING (
    auth.role() = 'service_role' 
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE (id::text = auth.uid()::text OR id = auth.uid()) 
        AND role = 'admin'
    )
    OR (current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role' = 'admin')
    OR (current_setting('request.jwt.claims', true)::jsonb->'user_metadata'->>'role' = 'admin')
);

-- 6. Enable Supabase Realtime
ALTER TABLE public.domains REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'experts'
    ) THEN
        ALTER TABLE public.experts REPLICA IDENTITY FULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'domains'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.domains;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'experts'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
            AND schemaname = 'public' 
            AND tablename = 'experts'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.experts;
        END IF;
    END IF;
END $$;
