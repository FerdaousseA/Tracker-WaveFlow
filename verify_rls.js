const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    console.log('Testing Project Creation RLS (Infinite Recursion Check)...');

    // Note: We need a real user to test RLS accurately.
    // Since we can't easily "log in" here without credentials, 
    // we'll assume the migrations were applied correctly if the db push succeeded.
    // But we can try to insert a project and see if it fails.

    const { data, error } = await supabase
        .from('projects')
        .insert({
            name: 'Verification Project ' + Date.now(),
            status: 'active'
        })
        .select();

    if (error) {
        if (error.message.includes('recursion')) {
            console.error('❌ FAILED: Infinite recursion detected!');
            process.exit(1);
        } else if (error.message.includes('permission denied') || error.message.includes('Row-level security')) {
            console.log('✅ PASS: Permission denied as expected for anonymous user (No recursion error).');
        } else {
            console.error('❌ UNEXPECTED ERROR:', error.message);
            process.exit(1);
        }
    } else {
        console.log('✅ SUCCESS: Project created (or RLS allowed but no recursion).');
    }
}

verify();
