-- SQL script to verify RLS recursion fix
-- This should be run in a transaction to avoid permanent changes if needed, 
-- but here we just want to see if the query fails.

DO $$
DECLARE
    test_user_id UUID := gen_random_uuid();
    test_project_id UUID;
BEGIN
    -- 1. Create a dummy profile
    INSERT INTO profiles (id, full_name, role)
    VALUES (test_user_id, 'Test User Recursion', 'dev');

    -- 2. Simulate authenticated session
    SET LOCAL ROLE authenticated;
    EXECUTE format('SET LOCAL "request.jwt.claims" = ''{"sub": "%s"}''', test_user_id);

    -- 3. Attempt to create a project (trigger should run and insert into project_members)
    INSERT INTO projects (name, status, created_by)
    VALUES ('Project Recursion Test', 'active', test_user_id)
    RETURNING id INTO test_project_id;

    -- 4. Verify project_members insertion
    IF EXISTS (SELECT 1 FROM project_members WHERE project_id = test_project_id AND user_id = test_user_id) THEN
        RAISE NOTICE 'SUCCESS: Project created and owner assigned without recursion error.';
    ELSE
        RAISE EXCEPTION 'FAILURE: Owner not found in project_members.';
    END IF;

    -- Cleanup
    RESET ROLE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'TEST FAILED: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END $$;
