/*
  Fix signup: handle_new_user trigger must insert into profiles with valid role.
  - profiles.role: chef_de_projet, admin, member only
  - full_name from raw_user_meta_data
  - role from raw_user_meta_data, validated; default 'member' if missing/invalid
  - SECURITY DEFINER, schema-qualified
*/

-- Ensure profiles.role column exists (idempotent)
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
    ) THEN
      ALTER TABLE public.profiles ADD COLUMN role text;
    END IF;
  END IF;
END;
$$;

-- Drop existing constraint if present (so trigger can insert before migration normalizes)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add constraint only if we can (after ensuring valid data)
-- We add it at the end of this migration, after the trigger is fixed.

-- Create or replace handle_new_user: insert profile with validated role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_full_name text;
BEGIN
  v_full_name := COALESCE(TRIM(new.raw_user_meta_data ->> 'full_name'), '');
  v_role := new.raw_user_meta_data ->> 'role';
  -- Validate role: only chef_de_projet, admin, member allowed
  IF v_role IS NULL OR v_role = '' OR v_role NOT IN ('chef_de_projet', 'admin', 'member') THEN
    v_role := 'member';
  END IF;

  INSERT INTO public.profiles (id, full_name, role, points, level, streak_days, badges, is_active, created_at)
  VALUES (
    new.id,
    v_full_name,
    v_role,
    0,
    1,
    0,
    '[]'::jsonb,
    true,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;
  RETURN new;
END;
$$;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Re-add role constraint (idempotent: drop first in case it was added by earlier migration)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
-- Only add if we have no invalid rows (migration 171000 may have run and normalized)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_role_check' AND conrelid = 'public.profiles'::regclass
  ) THEN
    -- Normalize any invalid roles before adding constraint
    UPDATE public.profiles SET role = 'member'
    WHERE role IS NULL OR role = '' OR role NOT IN ('chef_de_projet', 'admin', 'member');
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('chef_de_projet', 'admin', 'member'));
  END IF;
END;
$$;
