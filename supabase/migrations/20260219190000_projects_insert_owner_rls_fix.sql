/*
  Fix 403 on project creation: Add INSERT policy for chef_de_projet and auto-create project_members owner row.
  
  Requirements:
  1) Only profiles.role='chef_de_projet' can INSERT into projects
  2) On project insert, automatically create project_members row with role_in_project='owner'
  3) Members and admin cannot create projects (admin is read-only)
  4) SELECT policies: members see their projects, admin sees all, chef_de_projet sees their projects
*/

-- 1) Create function to auto-insert project_members owner row
CREATE OR REPLACE FUNCTION public.handle_new_project_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert owner row in project_members
  INSERT INTO public.project_members (project_id, user_id, role_in_project)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT (project_id, user_id) DO UPDATE SET
    role_in_project = 'owner';
  RETURN NEW;
END;
$$;

-- 2) Create trigger on projects insert
DROP TRIGGER IF EXISTS on_project_created_add_owner ON public.projects;
CREATE TRIGGER on_project_created_add_owner
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_project_owner();

-- 3) Ensure RLS is enabled
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- 4) INSERT policy for projects: only chef_de_projet can create
DO $$
BEGIN
  IF to_regclass('public.projects') IS NOT NULL THEN
    DROP POLICY IF EXISTS "projects_insert_chef_de_projet" ON public.projects;
    CREATE POLICY "projects_insert_chef_de_projet" ON public.projects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        created_by = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.profiles pr
          WHERE pr.id = auth.uid()
            AND pr.role = 'chef_de_projet'
        )
      );
  END IF;
END;
$$;

-- 5) UPDATE policy for projects: only chef_de_projet owners can update
DO $$
BEGIN
  IF to_regclass('public.projects') IS NOT NULL THEN
    DROP POLICY IF EXISTS "projects_update_owner" ON public.projects;
    CREATE POLICY "projects_update_owner" ON public.projects
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.project_members pm
          JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE pm.project_id = projects.id
            AND pm.user_id = auth.uid()
            AND pm.role_in_project = 'owner'
            AND pr.role = 'chef_de_projet'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.project_members pm
          JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE pm.project_id = projects.id
            AND pm.user_id = auth.uid()
            AND pm.role_in_project = 'owner'
            AND pr.role = 'chef_de_projet'
        )
      );
  END IF;
END;
$$;

-- 6) DELETE policy for projects: only chef_de_projet owners can delete
DO $$
BEGIN
  IF to_regclass('public.projects') IS NOT NULL THEN
    DROP POLICY IF EXISTS "projects_delete_owner" ON public.projects;
    CREATE POLICY "projects_delete_owner" ON public.projects
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.project_members pm
          JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE pm.project_id = projects.id
            AND pm.user_id = auth.uid()
            AND pm.role_in_project = 'owner'
            AND pr.role = 'chef_de_projet'
        )
      );
  END IF;
END;
$$;

-- 7) SELECT policy for projects: members see their projects, admin sees all
DO $$
BEGIN
  IF to_regclass('public.projects') IS NOT NULL THEN
    -- Drop existing SELECT policies if they exist
    DROP POLICY IF EXISTS "projects_select_members" ON public.projects;
    DROP POLICY IF EXISTS "projects_select_owner" ON public.projects;
    
    -- Members and owners see projects where they are members
    CREATE POLICY "projects_select_members" ON public.projects
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = projects.id
            AND pm.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.profiles pr
          WHERE pr.id = auth.uid()
            AND pr.role = 'admin'
        )
      );
  END IF;
END;
$$;

-- 8) INSERT policy for project_members: allow trigger function + owners adding members
DO $$
BEGIN
  IF to_regclass('public.project_members') IS NOT NULL THEN
    DROP POLICY IF EXISTS "project_members_insert_owner_trigger" ON public.project_members;
    -- Allow trigger function (SECURITY DEFINER) to insert
    CREATE POLICY "project_members_insert_owner_trigger" ON public.project_members
      FOR INSERT
      TO authenticated
      WITH CHECK (
        -- Allow if user is adding themselves as owner (for trigger)
        (user_id = auth.uid() AND role_in_project = 'owner')
        OR
        -- Allow if current user is project owner adding a member
        EXISTS (
          SELECT 1 FROM public.project_members pm
          JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE pm.project_id = project_members.project_id
            AND pm.user_id = auth.uid()
            AND pm.role_in_project = 'owner'
            AND pr.role = 'chef_de_projet'
        )
      );
  END IF;
END;
$$;

-- 9) SELECT policy for project_members: members see their project memberships, admin sees all
DO $$
BEGIN
  IF to_regclass('public.project_members') IS NOT NULL THEN
    DROP POLICY IF EXISTS "project_members_select_members" ON public.project_members;
    CREATE POLICY "project_members_select_members" ON public.project_members
      FOR SELECT
      TO authenticated
      USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = project_members.project_id
            AND pm.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.profiles pr
          WHERE pr.id = auth.uid()
            AND pr.role = 'admin'
        )
      );
  END IF;
END;
$$;

-- 10) UPDATE/DELETE policy for project_members: only owners can modify
DO $$
BEGIN
  IF to_regclass('public.project_members') IS NOT NULL THEN
    DROP POLICY IF EXISTS "project_members_update_owner" ON public.project_members;
    CREATE POLICY "project_members_update_owner" ON public.project_members
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.project_members pm
          JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE pm.project_id = project_members.project_id
            AND pm.user_id = auth.uid()
            AND pm.role_in_project = 'owner'
            AND pr.role = 'chef_de_projet'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.project_members pm
          JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE pm.project_id = project_members.project_id
            AND pm.user_id = auth.uid()
            AND pm.role_in_project = 'owner'
            AND pr.role = 'chef_de_projet'
        )
      );
    
    DROP POLICY IF EXISTS "project_members_delete_owner" ON public.project_members;
    CREATE POLICY "project_members_delete_owner" ON public.project_members
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.project_members pm
          JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE pm.project_id = project_members.project_id
            AND pm.user_id = auth.uid()
            AND pm.role_in_project = 'owner'
            AND pr.role = 'chef_de_projet'
        )
      );
  END IF;
END;
$$;

-- Grant execute on function to authenticated users (needed for trigger)
GRANT EXECUTE ON FUNCTION public.handle_new_project_owner() TO authenticated;
