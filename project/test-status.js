const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    const { data: projects, error: getErr } = await supabase.from('projects').select('id, name, status').limit(2);
    console.log('Projects:', projects);
    if (projects && projects.length > 0) {
        const p = projects[0];
        const { error: updErr, data } = await supabase.from('projects').update({ status: 'completed' }).eq('id', p.id).select();
        console.log('Update error:', updErr);
        console.log('Update data:', data);
    }
}
check();
