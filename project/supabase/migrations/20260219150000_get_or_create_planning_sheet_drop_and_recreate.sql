/*
  Fix get_or_create_planning_sheet return type issues
  - Drop existing function if present
  - Recreate with the expected RETURNS TABLE signature
  - Idempotent thanks to DROP FUNCTION IF EXISTS
*/

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'get_or_create_planning_sheet'
  ) THEN
    DROP FUNCTION IF EXISTS public.get_or_create_planning_sheet(uuid, uuid);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_planning_sheet(
  p_project_id UUID,
  p_created_by UUID DEFAULT auth.uid()
)
RETURNS TABLE (
  id UUID,
  project_id UUID,
  created_by UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.planning_sheets AS ps (project_id, created_by, updated_at)
  VALUES (p_project_id, COALESCE(p_created_by, auth.uid()), NOW())
  ON CONFLICT (project_id, created_by)
  DO UPDATE SET updated_at = NOW()
  RETURNING
    ps.id,
    ps.project_id,
    ps.created_by;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_planning_sheet(UUID, UUID) TO authenticated;

