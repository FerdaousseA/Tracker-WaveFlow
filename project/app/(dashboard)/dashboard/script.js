const fs = require('fs');
const file = 'c:/Users/DELL/Desktop/waveflow/project/app/(dashboard)/dashboard/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const formatters = `const STATUS_LABELS: Record<string, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  done: 'Terminées',
};

const fmt_hms = (raw: number) => {
  const t = Math.round(raw);
  if (t <= 0) return '0s';
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  if (h === 0 && m === 0) return \`\${s}s\`;
  if (h === 0) return \`\${m}min \${String(s).padStart(2, '0')}s\`;
  return \`\${h}h \${String(m).padStart(2, '0')}min \${String(s).padStart(2, '0')}s\`;
};

const fmt_short = (raw: number) => {
  const t = Math.round(raw);
  if (t <= 0) return '0s';
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60);
  return h === 0 ? \`\${m}min\` : \`\${h}h \${String(m).padStart(2, '0')}min\`;
};`;

content = content.replace(
    "const STATUS_LABELS: Record<string, string> = {\n  todo: '\u00C0 faire',\n  in_progress: 'En cours',\n  done: 'Termin\u00E9es',\n};",
    formatters
);

content = content.replace(
    "hoursToday: number;\n  hoursThisWeek: number;",
    "hoursToday: string;\n  hoursThisWeek: string;\n  hoursThisWeekPct: number;"
);

content = content.replace(
    "      const todayEntries = entries.filter(e => e.start_time >= todayStart && e.start_time <= todayEnd);\n      const hoursToday = todayEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0) / 60;\n      const hoursThisWeek = entries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0) / 60;",
    "      const todayEntries = entries.filter(e => e.start_time >= todayStart && e.start_time <= todayEnd);\n      const secondsToday = todayEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);\n      const secondsThisWeek = entries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);"
);

content = content.replace(
    "          const pHours = entries.filter(e => e.project_id === pm.project_id).reduce((sum, e) => sum + (e.duration_minutes || 0), 0) / 60;\n          return {\n            id: pm.project?.id,\n            name: pm.project?.name,\n            color: pm.project?.color || '#3b82f6',\n            role: pm.role,\n            progress,\n            hoursThisWeek: Number(pHours.toFixed(1)),",
    "          const pSeconds = entries.filter(e => e.project_id === pm.project_id).reduce((sum, e) => sum + (e.duration_minutes || 0), 0);\n          return {\n            id: pm.project?.id,\n            name: pm.project?.name,\n            color: pm.project?.color || '#3b82f6',\n            role: pm.role,\n            progress,\n            hoursThisWeek: fmt_short(pSeconds),"
);

content = content.replace(
    "      const weeklyHours = days.map(day => {\n        const dStart = startOfDay(day).toISOString();\n        const dEnd = endOfDay(day).toISOString();\n        const dayHours = entries.filter(e => e.start_time >= dStart && e.start_time <= dEnd).reduce((sum, e) => sum + (e.duration_minutes || 0), 0) / 60;\n        return { day: format(day, 'EEE', { locale: fr }), hours: Number(dayHours.toFixed(1)), isToday: isSameDay(day, today) };\n      });",
    "      const weeklyHours = days.map(day => {\n        const dStart = startOfDay(day).toISOString();\n        const dEnd = endOfDay(day).toISOString();\n        const daySeconds = entries.filter(e => e.start_time >= dStart && e.start_time <= dEnd).reduce((sum, e) => sum + (e.duration_minutes || 0), 0);\n        return { day: format(day, 'EEE', { locale: fr }), hours: Number((daySeconds / 3600).toFixed(2)), exactTime: fmt_short(daySeconds), isToday: isSameDay(day, today) };\n      });"
);

content = content.replace(
    "      entries.slice(0, 5).forEach(e => {\n        timeline.push({ id: `te-${e.id}`, type: 'time', date: new Date(e.start_time), text: `Travail sur ${e.project?.name || 'Projet'}`, details: `${Math.round(e.duration_minutes || 0)} min` });\n      });",
    "      entries.slice(0, 5).forEach(e => {\n        timeline.push({ id: `te-${e.id}`, type: 'time', date: new Date(e.start_time), text: `Travail sur ${e.project?.name || 'Projet'}`, details: fmt_hms(e.duration_minutes || 0) });\n      });"
);

content = content.replace(
    "      setData({\n        hoursToday: Number(hoursToday.toFixed(1)),\n        hoursThisWeek: Number(hoursThisWeek.toFixed(1)),",
    "      setData({\n        hoursToday: fmt_short(secondsToday),\n        hoursThisWeek: fmt_short(secondsThisWeek),\n        hoursThisWeekPct: Math.min(100, (secondsThisWeek / (40 * 3600)) * 100),"
);

content = content.replace(
    "{data?.hoursThisWeek === 0 ? (",
    "{data?.hoursThisWeek === '0s' ? ("
);

content = content.replace(
    '<span className="text-4xl font-black text-slate-800 dark:text-white">{data?.hoursThisWeek}h</span>',
    '<span className="text-4xl font-black text-slate-800 dark:text-white">{data?.hoursThisWeek}</span>'
);

content = content.replace(
    '<div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(100, (data?.hoursThisWeek || 0) / 40 * 100)}%` }} />',
    '<div className="h-full bg-amber-400 rounded-full" style={{ width: `${data?.hoursThisWeekPct || 0}%` }} />'
);

content = content.replace(
    '<span className="font-bold text-slate-600 dark:text-slate-300">{data?.hoursToday}h</span>',
    '<span className="font-bold text-slate-600 dark:text-slate-300">{data?.hoursToday}</span>'
);

content = content.replace(
    "value: `${data?.hoursThisWeek}h`,",
    "value: data?.hoursThisWeek || '0s',"
);

content = content.replace(
    "value: data?.activeProjects?.[0] ? `${data.activeProjects[0].hoursThisWeek}h` : '-',",
    "value: data?.activeProjects?.[0] ? data.activeProjects[0].hoursThisWeek : '-',"
);

content = content.replace(
    "                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontSize: '12px' }}\n                    />",
    "                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontSize: '12px' }}\n                      formatter={(value: any, name: any, props: any) => [props.payload.exactTime, 'Temps']}\n                    />"
);

content = content.replace(
    '<div className="relative pl-5 space-y-4 before:absolute before:left-2 before:top-0 before:h-full before:w-px before:bg-gradient-to-b before:from-slate-200 before:to-transparent dark:before:from-slate-700">',
    '<div className="relative pl-5 space-y-6 before:absolute before:left-2 before:top-0 before:h-full before:w-px before:bg-gradient-to-b before:from-slate-200 before:to-transparent dark:before:from-slate-700">'
);

fs.writeFileSync(file, content);
console.log('Script done!');
