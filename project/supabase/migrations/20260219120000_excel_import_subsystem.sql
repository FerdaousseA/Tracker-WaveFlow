/*
  Excel Imported Planning subsystem
  - Separate from native planning tables
  - Stores arbitrary Excel imports per user/project
*/

-- Ensure uuid generator
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. excel_imports: top-level imports
CREATE TABLE IF NOT EXISTS public.excel_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  project_id UUID,
  file_name TEXT NOT NULL,
  sheet_name TEXT NOT NULL,
  row_count INTEGER NOT NULL,
  col_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. excel_import_cells: individual cell values
CREATE TABLE IF NOT EXISTS public.excel_import_cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES public.excel_imports(id) ON DELETE CASCADE,
  r INTEGER NOT NULL,
  c INTEGER NOT NULL,
  value_text TEXT,
  value_type TEXT,
  style_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Unique per (import, r, c) for upsert support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'excel_import_cells_import_r_c_key'
      AND conrelid = 'public.excel_import_cells'::regclass
  ) THEN
    ALTER TABLE public.excel_import_cells
      ADD CONSTRAINT excel_import_cells_import_r_c_key
      UNIQUE (import_id, r, c);
  END IF;
END;
$$;

-- 3. excel_import_merges: merged regions
CREATE TABLE IF NOT EXISTS public.excel_import_merges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID NOT NULL REFERENCES public.excel_imports(id) ON DELETE CASCADE,
  start_r INTEGER NOT NULL,
  start_c INTEGER NOT NULL,
  row_span INTEGER NOT NULL,
  col_span INTEGER NOT NULL
);

-- Optional uniqueness on top-left merge within an import
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'excel_import_merges_import_start_key'
      AND conrelid = 'public.excel_import_merges'::regclass
  ) THEN
    ALTER TABLE public.excel_import_merges
      ADD CONSTRAINT excel_import_merges_import_start_key
      UNIQUE (import_id, start_r, start_c);
  END IF;
END;
$$;

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_excel_import_cells_import_r_c
  ON public.excel_import_cells (import_id, r, c);

CREATE INDEX IF NOT EXISTS idx_excel_import_merges_import
  ON public.excel_import_merges (import_id);


-- 5. RLS: owner-only access
ALTER TABLE public.excel_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excel_import_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excel_import_merges ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'excel_imports' AND policyname = 'excel_imports_owner_all') THEN
    EXECUTE 'DROP POLICY "excel_imports_owner_all" ON public.excel_imports';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'excel_import_cells' AND policyname = 'excel_import_cells_owner_all') THEN
    EXECUTE 'DROP POLICY "excel_import_cells_owner_all" ON public.excel_import_cells';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'excel_import_merges' AND policyname = 'excel_import_merges_owner_all') THEN
    EXECUTE 'DROP POLICY "excel_import_merges_owner_all" ON public.excel_import_merges';
  END IF;
END;
$$;

-- Owner can CRUD their imports
CREATE POLICY "excel_imports_owner_all" ON public.excel_imports
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Cells: owner determined via parent import
CREATE POLICY "excel_import_cells_owner_all" ON public.excel_import_cells
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

-- Merges: same owner logic
CREATE POLICY "excel_import_merges_owner_all" ON public.excel_import_merges
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


-- 6. RPC: create_excel_import
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'create_excel_import'
      AND pg_get_function_identity_arguments(oid) = 'uuid, text, text, integer, integer'
  ) THEN
    DROP FUNCTION public.create_excel_import(uuid, text, text, integer, integer);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_excel_import(
  p_project_id UUID,
  p_file_name TEXT,
  p_sheet_name TEXT,
  p_row_count INTEGER,
  p_col_count INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.excel_imports (owner_id, project_id, file_name, sheet_name, row_count, col_count)
  VALUES (auth.uid(), p_project_id, p_file_name, p_sheet_name, p_row_count, p_col_count)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_excel_import(UUID, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;

