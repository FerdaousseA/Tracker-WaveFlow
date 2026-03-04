-- Table des tests
create table if not exists project_tests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  description text,
  status text default 'pending', -- pending | passed | failed
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- Table des remarques
create table if not exists test_remarks (
  id uuid primary key default gen_random_uuid(),
  test_id uuid references project_tests(id) on delete cascade,
  content text not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- RLS
alter table project_tests enable row level security;
alter table test_remarks enable row level security;

-- Policies for project_tests
create policy "Les membres du projet peuvent voir les tests"
  on project_tests for select
  using (
    exists (
      select 1 from project_members pm
      where pm.project_id = project_tests.project_id
      and pm.user_id = auth.uid()
    )
    or
    exists (
      select 1 from projects p
      where p.id = project_tests.project_id
      and p.owner_id = auth.uid()
    )
  );

create policy "Les chefs de projet peuvent modifier les tests"
  on project_tests for all
  using (
    exists (
      select 1 from project_members pm
      where pm.project_id = project_tests.project_id
      and pm.user_id = auth.uid()
      and pm.role = 'chef_de_projet'
    )
    or
    exists (
      select 1 from projects p
      where p.id = project_tests.project_id
      and p.owner_id = auth.uid()
    )
  );

-- Policies for test_remarks
create policy "Les membres peuvent voir les remarques"
  on test_remarks for select
  using (
    exists (
      select 1 from project_tests pt
      join project_members pm on pm.project_id = pt.project_id
      where pt.id = test_remarks.test_id
      and pm.user_id = auth.uid()
    )
    or
    exists (
      select 1 from project_tests pt
      join projects p on p.id = pt.project_id
      where pt.id = test_remarks.test_id
      and p.owner_id = auth.uid()
    )
  );

create policy "Les chefs de projet peuvent modifier les remarques"
  on test_remarks for all
  using (
    exists (
      select 1 from project_tests pt
      join project_members pm on pm.project_id = pt.project_id
      where pt.id = test_remarks.test_id
      and pm.user_id = auth.uid()
      and pm.role = 'chef_de_projet'
    )
    or
    exists (
      select 1 from project_tests pt
      join projects p on p.id = pt.project_id
      where pt.id = test_remarks.test_id
      and p.owner_id = auth.uid()
    )
  );

-- Function to handle gamification points (if applicable) can be added later if needed.
