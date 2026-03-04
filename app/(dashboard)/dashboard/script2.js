const fs = require('fs');
const file = 'c:/Users/DELL/Desktop/waveflow/project/app/(dashboard)/dashboard/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. imports
content = content.replace(
    "import {\n  format, startOfDay, endOfDay, subDays,\n  eachDayOfInterval, isSameDay\n} from 'date-fns';",
    "import {\n  format, startOfDay, endOfDay, subDays,\n  eachDayOfInterval, isSameDay, startOfWeek, endOfWeek\n} from 'date-fns';"
);

// 2. weekRange
content = content.replace(
    "const weekRange = `${format(subDays(today, 6), 'dd MMM', { locale: fr })} - ${format(today, 'dd MMM yyyy', { locale: fr })}`;",
    "const weekRange = `${format(startOfWeek(today, { weekStartsOn: 1 }), 'dd MMM', { locale: fr })} - ${format(endOfWeek(today, { weekStartsOn: 1 }), 'dd MMM yyyy', { locale: fr })}`;"
);

// 3. Bouton Voir tout
content = content.replace(
    "onClick={() => router.push('/projects')}",
    "onClick={() => router.push('/projets')}"
);

// 4. Activité Récente icons
content = content.replace(
    "{act.type === 'time' && <Clock className=\"w-2.5 h-2.5 text-blue-500\" />}\n                    {act.type === 'task_created' && <Circle className=\"w-2.5 h-2.5 text-slate-400\" />}\n                    {act.type === 'task_done' && <CheckCircle2 className=\"w-2.5 h-2.5 text-blue-500\" />}",
    ""
);

// 5. Active Projects, Work Streak, Most Active Project and correct total hours
// We need to replace a large chunk of loadData
const loadDataRegex = /\/\/ Projects[\s\S]*?\/\/ Weekly Chart/;

const loadDataReplacement = `// All Time Entries for total project times
      const { data: allTimeEntries } = await supabase
        .from('time_entries')
        .select('project_id, duration_minutes, start_time')
        .eq('user_id', profile.id)
        .order('start_time', { ascending: false });

      // Projects
      const { data: projectMembers } = await supabase
        .from('project_members')
        .select(\`project_id, role, project:projects(id, name, color, status)\`)
        .eq('user_id', profile.id);

      const activeProjectMembers = (projectMembers || []).filter(pm => pm.project && pm.project.status === 'active');
      const myProjectIds = activeProjectMembers.map(pm => pm.project_id);
      let activeProjectsData: any[] = [];
      if (myProjectIds.length > 0) {
        const { data: allProjectTasks } = await supabase
          .from('lot_tasks')
          .select('id, project_id, status')
          .in('project_id', myProjectIds);

        activeProjectsData = activeProjectMembers.map(pm => {
          const pTasks = (allProjectTasks || []).filter(t => t.project_id === pm.project_id);
          const pDone = pTasks.filter(t => t.status === 'done').length;
          const progress = pTasks.length > 0 ? Math.round((pDone / pTasks.length) * 100) : 0;
          const pSecondsTotal = (allTimeEntries || []).filter(e => e.project_id === pm.project_id).reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
          return {
            id: pm.project?.id,
            name: pm.project?.name,
            color: pm.project?.color || '#3b82f6',
            role: pm.role,
            progress,
            hoursThisWeek: fmt_short(pSecondsTotal),
            totalTasks: pTasks.length,
            doneTasks: pDone,
            pSecondsTotal
          };
        }).sort((a, b) => b.pSecondsTotal - a.pSecondsTotal).slice(0, 4);
      }

      // Work Streak
      let streak = 0;
      if (allTimeEntries && allTimeEntries.length > 0) {
        const uniqueDates = Array.from(new Set(allTimeEntries.map(e => format(new Date(e.start_time), 'yyyy-MM-dd')))).sort((a, b) => b.localeCompare(a));
        const todayStr = format(today, 'yyyy-MM-dd');
        const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd');
        
        let currentDateToCheck = todayStr;
        if (!uniqueDates.includes(todayStr) && uniqueDates.includes(yesterdayStr)) {
           currentDateToCheck = yesterdayStr;
        }

        if (uniqueDates.includes(currentDateToCheck)) {
          let checkDate = new Date(currentDateToCheck);
          while (uniqueDates.includes(format(checkDate, 'yyyy-MM-dd'))) {
            streak++;
            checkDate = subDays(checkDate, 1);
          }
        }
      }

      // Weekly Chart`;

content = content.replace(loadDataRegex, loadDataReplacement);

fs.writeFileSync(file, content);
console.log('Done replaces!');
