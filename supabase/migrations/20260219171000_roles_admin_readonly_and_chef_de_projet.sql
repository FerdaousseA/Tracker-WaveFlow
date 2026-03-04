/*
  Global roles migration for WaveFlow
  - profiles.role supports: 'chef_de_projet', 'admin', 'member'
  - Migrate legacy values:
      * 'admin'          -> 'chef_de_projet'
      * 'po', 'dev', ''  -> 'member'
  - Admin is global read-only: update SELECT policies (add OR role = 'admin')
    but never grant INSERT/UPDATE/DELETE based on admin.
*/

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Ensure profiles.role column exists and values are normalized
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'role'
    ) THEN
      ALTER TABLE public.profiles
        ADD COLUMN role text;
    END IF;

    -- Always drop any existing role constraint before normalizing values
    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'profiles_role_check'
        AND conrelid = 'public.profiles'::regclass
    ) THEN
      ALTER TABLE public.profiles
        DROP CONSTRAINT profiles_role_check;
    END IF;

    -- Normalize legacy roles
    UPDATE public.profiles
    SET role = 'member'
    WHERE role IN ('po', 'dev') OR role IS NULL OR role = '';

    UPDATE public.profiles
    SET role = 'chef_de_projet'
    WHERE role = 'admin';

    -- Constrain to the new set of roles
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('chef_de_projet', 'admin', 'member'));
  END IF;
END;
$$;

-- 2) Admin read-only SELECT for core tables (projects, project_members, project_lots, lot_tasks)
DO $$
BEGIN
  IF to_regclass('public.projects') IS NOT NULL THEN
    DROP POLICY IF EXISTS "projects_admin_select_all" ON public.projects;
    CREATE POLICY "projects_admin_select_all" ON public.projects
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles pr
          WHERE pr.id = auth.uid()
            AND pr.role = 'admin'
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.project_members') IS NOT NULL THEN
    DROP POLICY IF EXISTS "project_members_admin_select_all" ON public.project_members;
    CREATE POLICY "project_members_admin_select_all" ON public.project_members
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles pr
          WHERE pr.id = auth.uid()
            AND pr.role = 'admin'
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.project_lots') IS NOT NULL THEN
    DROP POLICY IF EXISTS "project_lots_admin_select_all" ON public.project_lots;
    CREATE POLICY "project_lots_admin_select_all" ON public.project_lots
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles pr
          WHERE pr.id = auth.uid()
            AND pr.role = 'admin'
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.lot_tasks') IS NOT NULL THEN
    DROP POLICY IF EXISTS "lot_tasks_admin_select_all" ON public.lot_tasks;
    CREATE POLICY "lot_tasks_admin_select_all" ON public.lot_tasks
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles pr
          WHERE pr.id = auth.uid()
            AND pr.role = 'admin'
        )
      );
  END IF;
END;
$$;

-- 3) Adjust planning_* policies: admin can SELECT but not write
DO $$
BEGIN
  IF to_regclass('public.planning_sheets') IS NOT NULL THEN
    ALTER TABLE public.planning_sheets ENABLE ROW LEVEL SECURITY;

    -- SELECT: members + admin (read-only global)
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

    -- WRITE: owners only (no admin)
    DROP POLICY IF EXISTS "planning_sheets_owner_write" ON public.planning_sheets;
    CREATE POLICY "planning_sheets_owner_write" ON public.planning_sheets
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.project_members pm
          WHERE pm.project_id = planning_sheets.project_id
            AND pm.user_id = auth.uid()
            AND pm.role_in_project = 'owner'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.project_members pm
          WHERE pm.project_id = planning_sheets.project_id
            AND pm.user_id = auth.uid()
            AND pm.role_in_project = 'owner'
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.planning_rows') IS NOT NULL THEN
    ALTER TABLE public.planning_rows ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "planning_rows_select_members" ON public.planning_rows;
    CREATE POLICY "planning_rows_select_members" ON public.planning_rows
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.planning_sheets s
          JOIN public.projects p ON p.id = s.project_id
          JOIN public.project_members pm ON pm.project_id = p.id
          LEFT JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE s.id = planning_rows.sheet_id
            AND (
              pm.user_id = auth.uid()
              OR pr.role = 'admin'
            )
        )
      );

    DROP POLICY IF EXISTS "planning_rows_owner_write" ON public.planning_rows;
    CREATE POLICY "planning_rows_owner_write" ON public.planning_rows
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.planning_sheets s
          JOIN public.project_members pm ON pm.project_id = s.project_id
          WHERE s.id = planning_rows.sheet_id
            AND pm.user_id = auth.uid()
            AND pm.role_in_project = 'owner'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.planning_sheets s
          JOIN public.project_members pm ON pm.project_id = s.project_id
          WHERE s.id = planning_rows.sheet_id
            AND pm.user_id = auth.uid()
            AND pm.role_in_project = 'owner'
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.planning_columns') IS NOT NULL THEN
    ALTER TABLE public.planning_columns ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "planning_columns_select_members" ON public.planning_columns;
    CREATE POLICY "planning_columns_select_members" ON public.planning_columns
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.planning_sheets s
          JOIN public.projects p ON p.id = s.project_id
          JOIN public.project_members pm ON pm.project_id = p.id
          LEFT JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE s.id = planning_columns.sheet_id
            AND (
              pm.user_id = auth.uid()
              OR pr.role = 'admin'
            )
        )
      );

    DROP POLICY IF EXISTS "planning_columns_owner_write" ON public.planning_columns;
    CREATE POLICY "planning_columns_owner_write" ON public.planning_columns
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.planning_sheets s
          JOIN public.project_members pm ON pm.project_id = s.project_id
          WHERE s.id = planning_columns.sheet_id
            AND pm.user_id = auth.uid()
            AND pm.role_in_project = 'owner'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.planning_sheets s
          JOIN public.project_members pm ON pm.project_id = s.project_id
          WHERE s.id = planning_columns.sheet_id
            AND pm.user_id = auth.uid()
            AND pm.role_in_project = 'owner'
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.planning_cells') IS NOT NULL THEN
    ALTER TABLE public.planning_cells ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "planning_cells_select_members" ON public.planning_cells;
    CREATE POLICY "planning_cells_select_members" ON public.planning_cells
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.planning_rows r
          JOIN public.planning_sheets s ON s.id = r.sheet_id
          JOIN public.projects p ON p.id = s.project_id
          JOIN public.project_members pm ON pm.project_id = p.id
          LEFT JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE r.id = planning_cells.row_id
            AND (
              pm.user_id = auth.uid()
              OR pr.role = 'admin'
            )
        )
      );

    DROP POLICY IF EXISTS "planning_cells_owner_write" ON public.planning_cells;
    CREATE POLICY "planning_cells_owner_write" ON public.planning_cells
      FOR ALL
      TO authenticated
      USING (

        EXISTS (
          SELECT 1
          FROM public.planning_rows r
          JOIN public.planning_sheets s ON s.id = r.sheet_id
          JOIN public.project_members pm ON pm.project_id = s.project_id
          WHERE r.id = planning_cells.row_id
            AND pm.user_id = auth.uid()
            AND pm.role_in_project = 'owner'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.planning_rows r
          JOIN public.planning_sheets s ON s.id = r.sheet_id
          JOIN public.project_members pm ON pm.project_id = s.project_id
          WHERE r.id = planning_cells.row_id
            AND pm.user_id = auth.uid()
            AND pm.role_in_project = 'owner'
        )
      );
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.planning_merges') IS NOT NULL THEN
    ALTER TABLE public.planning_merges ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "planning_merges_select_members" ON public.planning_merges;
    CREATE POLICY "planning_merges_select_members" ON public.planning_merges
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.planning_sheets s
          JOIN public.projects p ON p.id = s.project_id
          JOIN public.project_members pm ON pm.project_id = p.id
          LEFT JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE s.id = planning_merges.sheet_id
            AND (
              pm.user_id = auth.uid()
              OR pr.role = 'admin'
            )
        )
      );

    DROP POLICY IF EXISTS "planning_merges_owner_write" ON public.planning_merges;
    CREATE POLICY "planning_merges_owner_write" ON public.planning_merges
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.planning_sheets s
          JOIN public.project_members pm ON pm.project_id = s.project_id
          WHERE s.id = planning_merges.sheet_id
            AND pm.user_id = auth.uid()
            AND pm.role_in_project = 'owner'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.planning_sheets s
          JOIN public.project_members pm ON pm.project_id = s.project_id
          WHERE s.id = planning_merges.sheet_id
            AND pm.user_id = auth.uid()
            AND pm.role_in_project = 'owner'
        )
      );
  END IF;
END;
$$;

-- 4) Time entries: admin SELECT all, but no extra write capabilities
DO $$
BEGIN
  IF to_regclass('public.time_entries') IS NOT NULL THEN
    ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

    -- Self-write: any non-admin user can manage their own rows
    DROP POLICY IF EXISTS "time_entries_self_write" ON public.time_entries;
    CREATE POLICY "time_entries_self_write" ON public.time_entries
      FOR ALL
      TO authenticated
      USING (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.profiles pr
          WHERE pr.id = auth.uid()
            AND pr.role <> 'admin'
        )
      )
      WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.profiles pr
          WHERE pr.id = auth.uid()
            AND pr.role <> 'admin'
        )
      );

    -- Member SELECT own (kept; admin also handled below)
    DROP POLICY IF EXISTS "time_entries_member_select_own" ON public.time_entries;
    CREATE POLICY "time_entries_member_select_own" ON public.time_entries
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());

    -- Project owners see all entries for their projects (unchanged)
    DROP POLICY IF EXISTS "time_entries_owner_select_project" ON public.time_entries;
    CREATE POLICY "time_entries_owner_select_project" ON public.time_entries
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.project_members pm
          WHERE pm.project_id = time_entries.project_id
            AND pm.user_id = auth.uid()
            AND pm.role_in_project = 'owner'
        )
      );

    -- Admins can see everything (SELECT only)
    DROP POLICY IF EXISTS "time_entries_admin_select_all" ON public.time_entries;
    CREATE POLICY "time_entries_admin_select_all" ON public.time_entries
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles pr
          WHERE pr.id = auth.uid()
            AND pr.role = 'admin'
        )
      );
  END IF;
END;
$$;

