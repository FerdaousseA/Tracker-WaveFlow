const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function listProfiles() {
    const { data, error } = await supabase.from('profiles').select('id, full_name, role');
    if (error) console.error(error);
    else console.log(JSON.stringify(data, null, 2));
}

listProfiles();
