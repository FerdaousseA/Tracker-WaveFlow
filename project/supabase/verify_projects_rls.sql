-- Run this in Supabase SQL Editor to verify projects RLS
-- Expected: 4 policies, RLS enabled

-- 1. Policies on projects
SELECT tablename, policyname, cmd, 
       LEFT(qual::text, 80) AS using_expr,
       LEFT(with_check::text, 80) AS with_check_expr
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'projects'
ORDER BY policyname;

-- 2. RLS enabled on projects
SELECT relname, relrowsecurity, relforcerowsecurity 
FROM pg_class c 
JOIN pg_namespace n ON n.oid = c.relnamespace 
WHERE n.nspname = 'public' AND c.relname = 'projects';

-- 3. Trigger on projects
SELECT tgname, tgrelid::regclass 
FROM pg_trigger 
WHERE tgrelid = 'public.projects'::regclass AND NOT tgisinternal;
