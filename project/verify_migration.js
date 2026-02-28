
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyTable() {
    console.log('Verifying lot_tasks table...');
    const { data, error } = await supabase
        .from('lot_tasks')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error selecting from lot_tasks:', error.message);
    } else {
        console.log('Successfully selected from lot_tasks. Table exists.');
        console.log('Data sample:', data);
    }
}

verifyTable();
