-- =====================================================
-- Notifications system: table + automated triggers
-- =====================================================

-- 1. Create the notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error')) DEFAULT 'info',
    title text NOT NULL,
    message text,
    sender_name text,
    link text,
    is_read boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can view own notifications'
    ) THEN
        CREATE POLICY "Users can view own notifications"
            ON notifications FOR SELECT
            USING (auth.uid() = user_id);
    END IF;
END $$;

-- Users can update (mark as read) their own notifications
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can update own notifications'
    ) THEN
        CREATE POLICY "Users can update own notifications"
            ON notifications FOR UPDATE
            USING (auth.uid() = user_id);
    END IF;
END $$;

-- Users can delete their own notifications
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can delete own notifications'
    ) THEN
        CREATE POLICY "Users can delete own notifications"
            ON notifications FOR DELETE
            USING (auth.uid() = user_id);
    END IF;
END $$;

-- Admins and the system can insert notifications for any user
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Service role can insert notifications'
    ) THEN
        CREATE POLICY "Service role can insert notifications"
            ON notifications FOR INSERT
            WITH CHECK (true);
    END IF;
END $$;


-- =====================================================
-- 2. Trigger: Notify project members when they are added
-- =====================================================
CREATE OR REPLACE FUNCTION notify_on_project_member_add()
RETURNS TRIGGER AS $$
DECLARE
    v_project_name text;
BEGIN
    -- Get project name
    SELECT name INTO v_project_name
    FROM projects
    WHERE id = NEW.project_id;

    -- Insert notification for the new member
    INSERT INTO notifications (user_id, type, title, message, link, sender_name)
    VALUES (
        NEW.user_id,
        'info',
        'Vous avez été ajouté à un projet',
        'Vous êtes maintenant membre du projet "' || COALESCE(v_project_name, 'Inconnu') || '".',
        '/projets/' || NEW.project_id,
        'Système'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_project_member_add ON project_members;
CREATE TRIGGER trg_notify_project_member_add
    AFTER INSERT ON project_members
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_project_member_add();


-- =====================================================
-- 3. Trigger: Notify all project members when a task changes status to 'done'
-- =====================================================
CREATE OR REPLACE FUNCTION notify_on_task_done()
RETURNS TRIGGER AS $$
DECLARE
    v_project_name text;
    v_project_id uuid;
    v_member record;
BEGIN
    -- Only fire when status changes TO 'done'
    IF (NEW.status = 'done' AND OLD.status <> 'done') THEN
        -- Get project info through the lot
        SELECT p.id, p.name INTO v_project_id, v_project_name
        FROM projects p
        JOIN project_lots l ON l.project_id = p.id
        WHERE l.id = NEW.lot_id
        LIMIT 1;

        -- Notify all project members
        FOR v_member IN
            SELECT user_id FROM project_members WHERE project_id = v_project_id
        LOOP
            INSERT INTO notifications (user_id, type, title, message, link, sender_name)
            VALUES (
                v_member.user_id,
                'success',
                'Tâche terminée',
                'La tâche "' || NEW.name || '" dans "' || COALESCE(v_project_name, 'Inconnu') || '" est terminée.',
                '/projets/' || v_project_id,
                'Système'
            );
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_task_done ON tasks;
CREATE TRIGGER trg_notify_task_done
    AFTER UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_task_done();


-- =====================================================
-- 4. Trigger: Notify all project members when project status changes
-- =====================================================
CREATE OR REPLACE FUNCTION notify_on_project_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_member record;
    v_type text;
    v_title text;
    v_msg text;
BEGIN
    IF NEW.status <> OLD.status THEN
        -- Determine message
        IF NEW.status = 'archived' THEN
            v_type := 'warning';
            v_title := 'Projet archivé';
            v_msg := 'Le projet "' || NEW.name || '" a été archivé.';
        ELSIF NEW.status = 'paused' THEN
            v_type := 'warning';
            v_title := 'Projet mis en pause';
            v_msg := 'Le projet "' || NEW.name || '" est maintenant en pause.';
        ELSIF NEW.status = 'active' THEN
            v_type := 'success';
            v_title := 'Projet réactivé';
            v_msg := 'Le projet "' || NEW.name || '" est maintenant actif.';
        ELSE
            RETURN NEW;
        END IF;

        -- Notify all project members
        FOR v_member IN
            SELECT user_id FROM project_members WHERE project_id = NEW.id
        LOOP
            INSERT INTO notifications (user_id, type, title, message, link, sender_name)
            VALUES (
                v_member.user_id,
                v_type,
                v_title,
                v_msg,
                '/projets/' || NEW.id,
                'Système'
            );
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_project_status_change ON projects;
CREATE TRIGGER trg_notify_project_status_change
    AFTER UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_project_status_change();


-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
