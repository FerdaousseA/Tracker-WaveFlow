/*
  Fix get_or_create_planning_sheet ambiguity
  - Use prefixed parameters
  - Qualify planning_sheets columns
  - Ensure unique(project_id, created_by)
*/

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ensure unique constraint on (project_id, created_by)
DO $$
BEGIN
  IF to_regclass('public.planning_sheets') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'planning_sheets_project_created_by_key'
        AND conrelid = 'public.planning_sheets'::regclass
    ) THEN
      ALTER TABLE public.planning_sheets
        ADD CONSTRAINT planning_sheets_project_created_by_key
        UNIQUE (project_id, created_by);
    END IF;
  END IF;
END;
$$;

-- Replace RPC with unambiguous version
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

