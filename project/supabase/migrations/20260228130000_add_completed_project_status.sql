ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
        -- Safely add value to enum if it exists
        BEGIN
            ALTER TYPE project_status ADD VALUE 'completed';
        EXCEPTION
            WHEN duplicate_object THEN null;
        END;
    END IF;
END$$;
