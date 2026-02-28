const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyMigration() {
    console.log('--- Verifying Database Migration ---');

    // 1. Check projects and assigned_users
    const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, name, assigned_users');

    if (projectsError) {
        console.error('Error fetching projects:', projectsError.message);
        return;
    }

    console.log(`Found ${projects.length} projects.`);

    // 2. Check project_members
    const { data: members, error: membersError } = await supabase
        .from('project_members')
        .select('*');

    if (membersError) {
        console.error('Error fetching members:', membersError.message);
        console.log('Note: This might be due to RLS if no session is active.');
    } else {
        console.log(`Found ${members.length} member entries in project_members.`);
    }

    // 3. Detailed check for a specific project migration
    for (const proj of projects) {
        const assignedCount = proj.assigned_users ? proj.assigned_users.length : 0;
        console.log(`Project "${proj.name}" had ${assignedCount} assigned users.`);
    }
}

verifyMigration();
