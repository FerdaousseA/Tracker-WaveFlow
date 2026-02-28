/*
  Planning policies: split READ/WRITE, support admin read-only and chef_de_projet owners
  - Keep project-level owner model (project_members.role_in_project = 'owner')
  - Global roles (profiles.role):
      * 'chef_de_projet': can être owner et modifier planning de ses projets
      * 'admin'        : lecture globale uniquement (aucun write)
      * 'member'       : inchangé
*/

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Helper: make sure profiles.role exists so policies can join on it
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

-- A) planning_sheets
DO $$
BEGIN
  IF to_regclass('public.planning_sheets') IS NOT NULL THEN
    ALTER TABLE public.planning_sheets ENABLE ROW LEVEL SECURITY;

    -- Drop any legacy ALL policies for sheets
    DROP POLICY IF EXISTS "Planning sheets owner only" ON public.planning_sheets;
    DROP POLICY IF EXISTS "planning_sheets_owner_write" ON public.planning_sheets;
    DROP POLICY IF EXISTS "planning_sheets_select_members" ON public.planning_sheets;
    DROP POLICY IF EXISTS "planning_sheets_read" ON public.planning_sheets;
    DROP POLICY IF EXISTS "planning_sheets_write_owner" ON public.planning_sheets;

    -- READ: members, owners, or admin
    CREATE POLICY "planning_sheets_read" ON public.planning_sheets
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
              pm.user_id = auth.uid()           -- membre ou owner
              OR pr.role = 'admin'              -- admin global
            )
        )
      );

    -- WRITE: uniquement chef_de_projet + owner du projet
    CREATE POLICY "planning_sheets_write_owner" ON public.planning_sheets
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.project_members pm
          JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE pm.project_id = planning_sheets.project_id
            AND pm.user_id = auth.uid()
            AND pm.role_in_project = 'owner'
            AND pr.role = 'chef_de_projet'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.project_members pm
          JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE pm.project_id = planning_sheets.project_id
            AND pm.user_id = auth.uid()
            AND pm.role_in_project = 'owner'
            AND pr.role = 'chef_de_projet'
        )
      );
  END IF;
END;
$$;

-- B) planning_rows
DO $$
BEGIN
  IF to_regclass('public.planning_rows') IS NOT NULL THEN
    ALTER TABLE public.planning_rows ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "planning_rows_select_members" ON public.planning_rows;
    DROP POLICY IF EXISTS "planning_rows_owner_write" ON public.planning_rows;
    DROP POLICY IF EXISTS "planning_rows_read" ON public.planning_rows;
    DROP POLICY IF EXISTS "planning_rows_write_owner" ON public.planning_rows;

    -- READ
    CREATE POLICY "planning_rows_read" ON public.planning_rows
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

    -- WRITE
    CREATE POLICY "planning_rows_write_owner" ON public.planning_rows
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.planning_sheets s
          JOIN public.project_members pm ON pm.project_id = s.project_id
          JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE s.id = planning_rows.sheet_id
            AND pm.user_id = auth.uid()
            AND pm.role_in_project = 'owner'
            AND pr.role = 'chef_de_projet'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.planning_sheets s
          JOIN public.project_members pm ON pm.project_id = s.project_id
          JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE s.id = planning_rows.sheet_id
            AND pm.user_id = auth.uid()
            AND pm.role_in_project = 'owner'
            AND pr.role = 'chef_de_projet'
        )
      );
  END IF;
END;
$$;

-- C) planning_columns
DO $$
BEGIN
  IF to_regclass('public.planning_columns') IS NOT NULL THEN
    ALTER TABLE public.planning_columns ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "planning_columns_select_members" ON public.planning_columns;
    DROP POLICY IF EXISTS "planning_columns_owner_write" ON public.planning_columns;
    DROP POLICY IF EXISTS "planning_columns_read" ON public.planning_columns;
    DROP POLICY IF EXISTS "planning_columns_write_owner" ON public.planning_columns;

    -- READ
    CREATE POLICY "planning_columns_read" ON public.planning_columns
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

    -- WRITE
    CREATE POLICY "planning_columns_write_owner" ON public.planning_columns
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.planning_sheets s
          JOIN public.project_members pm ON pm.project_id = s.project_id
          JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE s.id = planning_columns.sheet_id
            AND pm.user_id = auth.uid()
            AND pm.role_in_project = 'owner'
            AND pr.role = 'chef_de_projet'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.planning_sheets s
          JOIN public.project_members pm ON pm.project_id = s.project_id
          JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE s.id = planning_columns.sheet_id
            AND pm.user_id = auth.uid()
            AND pm.role_in_project = 'owner'
            AND pr.role = 'chef_de_projet'
        )
      );
  END IF;
END;
$$;

-- D) planning_cells
DO $$
BEGIN
  IF to_regclass('public.planning_cells') IS NOT NULL THEN
    ALTER TABLE public.planning_cells ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "planning_cells_select_members" ON public.planning_cells;
    DROP POLICY IF EXISTS "planning_cells_owner_write" ON public.planning_cells;
    DROP POLICY IF EXISTS "planning_cells_read" ON public.planning_cells;
    DROP POLICY IF EXISTS "planning_cells_write_owner" ON public.planning_cells;

    -- READ
    CREATE POLICY "planning_cells_read" ON public.planning_cells
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

    -- WRITE
    CREATE POLICY "planning_cells_write_owner" ON public.planning_cells
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.planning_rows r
          JOIN public.planning_sheets s ON s.id = r.sheet_id
          JOIN public.project_members pm ON pm.project_id = s.project_id
          JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE r.id = planning_cells.row_id
            AND pm.user_id = auth.uid()
            AND pm.role_in_project = 'owner'
            AND pr.role = 'chef_de_projet'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.planning_rows r
          JOIN public.planning_sheets s ON s.id = r.sheet_id
          JOIN public.project_members pm ON pm.project_id = s.project_id
          JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE r.id = planning_cells.row_id
            AND pm.user_id = auth.uid()
            AND pm.role_in_project = 'owner'
            AND pr.role = 'chef_de_projet'
        )
      );
  END IF;
END;
$$;

-- E) planning_merges
DO $$
BEGIN
  IF to_regclass('public.planning_merges') IS NOT NULL THEN
    ALTER TABLE public.planning_merges ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "planning_merges_select_members" ON public.planning_merges;
    DROP POLICY IF EXISTS "planning_merges_owner_write" ON public.planning_merges;
    DROP POLICY IF EXISTS "planning_merges_read" ON public.planning_merges;
    DROP POLICY IF EXISTS "planning_merges_write_owner" ON public.planning_merges;

    -- READ
    CREATE POLICY "planning_merges_read" ON public.planning_merges
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

    -- WRITE
    CREATE POLICY "planning_merges_write_owner" ON public.planning_merges
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.planning_sheets s
          JOIN public.project_members pm ON pm.project_id = s.project_id
          JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE s.id = planning_merges.sheet_id
            AND pm.user_id = auth.uid()
            AND pm.role_in_project = 'owner'
            AND pr.role = 'chef_de_projet'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.planning_sheets s
          JOIN public.project_members pm ON pm.project_id = s.project_id
          JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE s.id = planning_merges.sheet_id
            AND pm.user_id = auth.uid()
            AND pm.role_in_project = 'owner'
            AND pr.role = 'chef_de_projet'
        )
      );
  END IF;
END;
$$;

-- F) Imported planning (Excel) – admin READ, writes unchanged (owner only)
DO $$
BEGIN
  IF to_regclass('public.excel_imports') IS NOT NULL THEN
    ALTER TABLE public.excel_imports ENABLE ROW LEVEL SECURITY;

    -- READ adjustment only: owner, project members, OR admin
    DROP POLICY IF EXISTS "excel_imports_select_members" ON public.excel_imports;
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
    -- Write policies on excel_imports_* restent inchangées (basées sur owner_id), donc admin ne gagne aucun write.
  END IF;
END;
$$;

