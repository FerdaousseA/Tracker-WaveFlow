
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpgradeSchema() {
    console.log('--- Starting Upgrade Schema Verification ---');

    const upgradeTables = [
        'clients', 'work_notes', 'notifications',
        'reports', 'daily_attendance', 'favorites'
    ];

    console.log('Checking new tables accessibility...');
    let allTablesExist = true;
    for (const table of upgradeTables) {
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });

        if (error) {
            if (error.code === '42P01') {
                console.error(`❌ Table '${table}' does NOT exist.`);
                allTablesExist = false;
            } else {
                console.warn(`⚠️ Issue accessing '${table}': ${error.message}`);
            }
        } else {
            console.log(`✅ Table '${table}' exists.`);
        }
    }

    if (allTablesExist) {
        console.log('✅ Upgrade Schema applied successfully.');
    }

    console.log('--- Verification Complete ---');
}

testUpgradeSchema().catch(console.error);
