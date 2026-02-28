/*
  Planning policies idempotent patch
  - Fix syntax error in previous DO $$ block (missing END IF)
  - Ensure planning_sheets_* policies are created in a clean, idempotent way
  - Does NOT change business logic, only structure/robustness
*/

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Make sure RLS is enabled on planning_sheets
DO $$
BEGIN
  IF to_regclass('public.planning_sheets') IS NOT NULL THEN
    ALTER TABLE public.planning_sheets ENABLE ROW LEVEL SECURITY;
  END IF;
END;
$$;

-- DROP + CREATE policies in an idempotent, explicit way
DO $$
BEGIN
  IF to_regclass('public.planning_sheets') IS NOT NULL THEN
    -- SELECT policy for members/admins
    DROP POLICY IF EXISTS "planning_sheets_select_members" ON public.planning_sheets;

    CREATE POLICY "planning_sheets_select_members" ON public.planning_sheets
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.projects p
          JOIN public.project_members pm ON pm.project_id = p.id
          LEFT JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE p.id = planning_sheets.project_id
            AND (
              pm.user_id = auth.uid()
              OR pr.role = 'admin'
            )
        )
      );

    -- WRITE policy for owners/admins
    DROP POLICY IF EXISTS "planning_sheets_owner_write" ON public.planning_sheets;

    CREATE POLICY "planning_sheets_owner_write" ON public.planning_sheets
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.project_members pm
          LEFT JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE pm.project_id = planning_sheets.project_id
            AND (
              (pm.user_id = auth.uid() AND pm.role_in_project = 'owner')
              OR pr.role = 'admin'
            )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.project_members pm
          LEFT JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE pm.project_id = planning_sheets.project_id
            AND (
              (pm.user_id = auth.uid() AND pm.role_in_project = 'owner')
              OR pr.role = 'admin'
            )
        )
      );
  END IF;
END;
$$;

