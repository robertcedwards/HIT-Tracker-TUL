-- Enable RLS on all supplement-related tables
ALTER TABLE public.supplements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_supplements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplement_usages ENABLE ROW LEVEL SECURITY;

-- Supplements table policies
-- Allow anyone to read supplements (they're shared across users)
CREATE POLICY "Anyone can read supplements" ON public.supplements
    FOR SELECT USING (true);

-- Allow authenticated users to insert supplements
CREATE POLICY "Authenticated users can insert supplements" ON public.supplements
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow users to update supplements they created
CREATE POLICY "Users can update their own supplements" ON public.supplements
    FOR UPDATE USING (created_by = auth.uid());

-- User supplements table policies
-- Users can only see their own supplements
CREATE POLICY "Users can read their own user supplements" ON public.user_supplements
    FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own supplement relationships
CREATE POLICY "Users can insert their own user supplements" ON public.user_supplements
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own supplement relationships
CREATE POLICY "Users can update their own user supplements" ON public.user_supplements
    FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own supplement relationships
CREATE POLICY "Users can delete their own user supplements" ON public.user_supplements
    FOR DELETE USING (user_id = auth.uid());

-- Supplement usages table policies
-- Users can only see their own usage logs
CREATE POLICY "Users can read their own supplement usages" ON public.supplement_usages
    FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own usage logs
CREATE POLICY "Users can insert their own supplement usages" ON public.supplement_usages
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own usage logs
CREATE POLICY "Users can update their own supplement usages" ON public.supplement_usages
    FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own usage logs
CREATE POLICY "Users can delete their own supplement usages" ON public.supplement_usages
    FOR DELETE USING (user_id = auth.uid()); 