import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Checking if points column exists or attempting to add it...");

    // Try directly adding points via a rpc or sql if available, otherwise we will just update it directly
    // Supabase postgREST doesn't allow direct DDL. Let's try to query points to see if it exists.
    const { data, error } = await supabase.from('profiles').select('points').limit(1);
    if (error) {
        if (error.code === '42703') {
            console.error("Points column DOES NOT exist. You MUST add it manually via Supabase Dashboard SQL editor: ALTER TABLE profiles ADD COLUMN points INT NOT NULL DEFAULT 0;");
        } else {
            console.error("Error querying profiles:", error);
        }
    } else {
        console.log("Points column already exists!", data);
    }
}

run();
