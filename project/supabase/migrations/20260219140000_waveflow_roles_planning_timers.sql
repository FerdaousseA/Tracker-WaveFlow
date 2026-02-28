/*
  WaveFlow roles, planning visibility, and timer aggregation
  - Make planning (native + imported) visible to project members (read-only)
  - Keep editing restricted to owners/admins
  - Ensure real_time_minutes fields exist on lots and lot_tasks
  - Relax excel_import* RLS so project members can SELECT
  - Time entries RLS: members see their own, owners see project timers, admins see all
*/

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Ensure profiles.role column exists (text)
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
  END IF;
END;
$$;

-- 2) Ensure real_time_minutes on project_lots and lot_tasks
DO $$
BEGIN
  IF to_regclass('public.project_lots') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'project_lots'
        AND column_name = 'real_time_minutes'
    ) THEN
      ALTER TABLE public.project_lots
        ADD COLUMN real_time_minutes integer NOT NULL DEFAULT 0;
    END IF;
  END IF;

  IF to_regclass('public.lot_tasks') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'lot_tasks'
        AND column_name = 'real_time_minutes'
    ) THEN
      ALTER TABLE public.lot_tasks
        ADD COLUMN real_time_minutes integer NOT NULL DEFAULT 0;
    END IF;
  END IF;
END;
$$;

-- 3) Imported planning RLS: allow project members SELECT, keep writes for owners
DO $$
BEGIN
  IF to_regclass('public.excel_imports') IS NOT NULL THEN
    ALTER TABLE public.excel_imports ENABLE ROW LEVEL SECURITY;

    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'excel_imports'
        AND policyname = 'excel_imports_owner_all'
    ) THEN
      DROP POLICY "excel_imports_owner_all" ON public.excel_imports;
    END IF;

    -- SELECT: owner, project members, or admin
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'excel_imports'
        AND policyname = 'excel_imports_select_members'
    ) THEN
      CREATE POLICY "excel_imports_select_members" ON public.excel_imports
        FOR SELECT
        TO authenticated
        USING (
          owner_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.projects p
            JOIN public.project_members pm ON pm.project_id = p.id
            WHERE p.id = excel_imports.project_id
              AND pm.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.profiles pr
            WHERE pr.id = auth.uid()
              AND pr.role = 'admin'
          )
        );
    END IF;

    -- INSERT/UPDATE/DELETE: only owner
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'excel_imports'
        AND policyname = 'excel_imports_owner_write'
    ) THEN
      CREATE POLICY "excel_imports_owner_write" ON public.excel_imports
        FOR ALL
        TO authenticated
        USING (owner_id = auth.uid())
        WITH CHECK (owner_id = auth.uid());
    END IF;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.excel_import_cells') IS NOT NULL THEN
    ALTER TABLE public.excel_import_cells ENABLE ROW LEVEL SECURITY;

    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'excel_import_cells'
        AND policyname = 'excel_import_cells_owner_all'
    ) THEN
      DROP POLICY "excel_import_cells_owner_all" ON public.excel_import_cells;
    END IF;

    -- SELECT: same visibility as parent import
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'excel_import_cells'
        AND policyname = 'excel_import_cells_select_members'
    ) THEN
      CREATE POLICY "excel_import_cells_select_members" ON public.excel_import_cells
        FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM public.excel_imports e
            LEFT JOIN public.projects p ON p.id = e.project_id
            LEFT JOIN public.project_members pm ON pm.project_id = p.id
            LEFT JOIN public.profiles pr ON pr.id = auth.uid()
            WHERE e.id = excel_import_cells.import_id
              AND (
                e.owner_id = auth.uid()
                OR (pm.user_id = auth.uid())
                OR (pr.role = 'admin')
              )
          )
        );
    END IF;

    -- Writes: only owner via parent import
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'excel_import_cells'
        AND policyname = 'excel_import_cells_owner_write'
    ) THEN
      CREATE POLICY "excel_import_cells_owner_write" ON public.excel_import_cells
        FOR ALL
        TO authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM public.excel_imports e
            WHERE e.id = excel_import_cells.import_id
              AND e.owner_id = auth.uid()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1
            FROM public.excel_imports e
            WHERE e.id = excel_import_cells.import_id
              AND e.owner_id = auth.uid()
          )
        );
    END IF;
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.excel_import_merges') IS NOT NULL THEN
    ALTER TABLE public.excel_import_merges ENABLE ROW LEVEL SECURITY;

    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'excel_import_merges'
        AND policyname = 'excel_import_merges_owner_all'
    ) THEN
      DROP POLICY "excel_import_merges_owner_all" ON public.excel_import_merges;
    END IF;

    -- SELECT: same visibility as parent import
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'excel_import_merges'
        AND policyname = 'excel_import_merges_select_members'
    ) THEN
      CREATE POLICY "excel_import_merges_select_members" ON public.excel_import_merges
        FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM public.excel_imports e
            LEFT JOIN public.projects p ON p.id = e.project_id
            LEFT JOIN public.project_members pm ON pm.project_id = p.id
            LEFT JOIN public.profiles pr ON pr.id = auth.uid()
            WHERE e.id = excel_import_merges.import_id
              AND (
                e.owner_id = auth.uid()
                OR (pm.user_id = auth.uid())
                OR (pr.role = 'admin')
              )
          )
        );
    END IF;

    -- Writes: only owner
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'excel_import_merges'
        AND policyname = 'excel_import_merges_owner_write'
    ) THEN
      CREATE POLICY "excel_import_merges_owner_write" ON public.excel_import_merges
        FOR ALL
        TO authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM public.excel_imports e
            WHERE e.id = excel_import_merges.import_id
              AND e.owner_id = auth.uid()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1
            FROM public.excel_imports e
            WHERE e.id = excel_import_merges.import_id
              AND e.owner_id = auth.uid()
          )
        );
    END IF;
  END IF;
END;
$$;

-- 4) Planning policies moved to 20260219173000_planning_policies_owner_admin_split.sql
-- (Removed here to avoid duplicates/conflicts and allow clean owner/admin write split.)

-- 5) Time entries RLS: members see own, owners see project entries, admins see all
DO $$
BEGIN
  IF to_regclass('public.time_entries') IS NOT NULL THEN
    ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

    -- Base: everyone can insert/update/delete their own row (user_id = auth.uid())
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'time_entries'
        AND policyname = 'time_entries_self_write'
    ) THEN
      CREATE POLICY "time_entries_self_write" ON public.time_entries
        FOR ALL
        TO authenticated
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid());
    END IF;

    -- SELECT: member sees own entries
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'time_entries'
        AND policyname = 'time_entries_member_select_own'
    ) THEN
      CREATE POLICY "time_entries_member_select_own" ON public.time_entries
        FOR SELECT
        TO authenticated
        USING (user_id = auth.uid());
    END IF;

    -- SELECT: project owners see all entries for their projects
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'time_entries'
        AND policyname = 'time_entries_owner_select_project'
    ) THEN
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
    END IF;

    -- SELECT: admins can see everything
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'time_entries'
        AND policyname = 'time_entries_admin_select_all'
    ) THEN
      CREATE POLICY "time_entries_admin_select_all" ON public.time_entries
        FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM public.profiles pr
            WHERE pr.id = auth.uid()
              AND pr.role = 'admin'
          )
        );
    END IF;
  END IF;
END;
$$;
