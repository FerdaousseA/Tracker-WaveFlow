const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyRLS() {
    console.log('--- Verifying RLS on Planning Tables (Anon Access) ---');

    const tables = ['planning_sheets', 'planning_columns', 'planning_rows', 'planning_cells'];

    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.log(`Table ${table}: Correctly returned error or empty (Error: ${error.message})`);
        } else if (data && data.length > 0) {
            console.error(`ERROR: Table ${table} is accessible to anonymous users!`);
        } else {
            console.log(`Table ${table}: No data visible to anonymous users (Correct).`);
        }
    }
}

verifyRLS();
