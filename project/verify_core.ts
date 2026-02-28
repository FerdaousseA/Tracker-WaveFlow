
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCoreSchema() {
    console.log('--- Starting Core Schema Verification ---');

    // 1. Verify Core Tables Existence
    const tables = [
        'profiles', 'projects', 'lot_templates', 'project_lots',
        'tasks', 'simple_categories', 'time_entries',
        'active_sessions', 'achievements', 'user_achievements'
    ];

    console.log('Checking table accessibility...');
    let allTablesExist = true;
    for (const table of tables) {
        // We expect 0 or more rows, but the query should not error with "relation does not exist"
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });

        if (error) {
            if (error.code === '42P01') { // undefined_table
                console.error(`❌ Table '${table}' does NOT exist.`);
                allTablesExist = false;
            } else {
                console.warn(`⚠️ Issue accessing '${table}': ${error.message} (might be RLS, but table exists)`);
            }
        } else {
            console.log(`✅ Table '${table}' exists.`);
        }
    }

    if (!allTablesExist) {
        console.error('Stopping verification due to missing tables.');
        return;
    }

    // 2. Test Signup & RLS (Simulate)
    // We can't easily script a full auth flow without email confirmation turned off, 
    // but we can check if `profiles` allows us to read/write if we were authenticated.
    // Since we are using anon key, we are limited.
    // However, we can check basic public access or if RLS denies us (which is good).

    console.log('\nVerifying RLS matches expectations...');
    const { data: publicProfiles, error: rlsError } = await supabase.from('profiles').select('*').limit(1);
    if (rlsError) {
        console.log(`i  RLS is active on profiles (Expected error for anon: ${rlsError.message})`);
    } else {
        console.log('i  Public access to profiles might be open (Check policies if this is intended).');
    }

    console.log('\n--- Verification Complete ---');
}

testCoreSchema().catch(console.error);
