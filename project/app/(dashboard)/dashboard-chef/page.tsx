'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import {
  format, startOfDay, endOfDay,
  eachDayOfInterval, isSameDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  subMonths, addMonths
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Play, Activity, CheckCircle2,
  Trophy, Target, Bell, StickyNote,
  CalendarDays, ChevronRight, Briefcase,
  ListTodo, Timer, ArrowUpRight, Users, ChevronLeft
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
  AreaChart, Area
} from 'recharts';

interface DashboardData {
  hoursToday: string;
  hoursThisWeek: string;
  hoursThisWeekPct: number;
  secondsToday: number;
  secondsThisWeek: number;
  activeSession: any | null;
  activeSessionStartTime: string | null;
  tasksTodo: number;
  tasksInProgress: number;
  tasksCompleted: number;
  currentTasks: any[];
  activeProjects: any[];
  projectBarData: any[];
  recentActivity: any[];
  weeklyHours: any[];
  notifications: any[];
  points: number;
  rank: number;
  notes: any[];
  totalTasks: number;
  totalProjectsCreated: number;
  totalPlanningSheets: number;
  totalTeamMembers: number;
  projectsStatusData: any[];
}

const STATUS_LABELS: Record<string, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  done: 'Terminées',
};

const fmt_hms = (raw: number) => {
  const t = Math.round(raw);
  if (t <= 0) return '0h 0min 0s';
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return `${h}h ${m}min ${s}s`;
};

const fmt_full = (raw: number) => {
  const t = Math.round(raw);
  if (t <= 0) return '0h 0min 0s';
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return `${h}h ${m}min ${s}s`;
};

const fmt_short = (raw: number) => {
  const t = Math.round(raw);
  if (t <= 0) return '0h 0min 0s';
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return `${h}h ${m}min ${s}s`;
};

const ProjectBarTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 px-3 py-2 text-xs">
        <p className="font-bold text-slate-700 dark:text-white mb-1">{d.fullName}</p>
        <p className="font-black" style={{ color: d.color }}>{d.exactTime}</p>
      </div>
    );
  }
  return null;
};

export default function ChefProjetDashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<'day' | 'week' | 'month'>('day');
  const [customMonth, setCustomMonth] = useState<Date | null>(null);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const today = new Date();

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (data?.activeSessionStartTime) {
      const tick = () => {
        const elapsed = Math.floor((Date.now() - new Date(data.activeSessionStartTime!).getTime()) / 1000);
        setLiveSeconds(Math.max(0, elapsed));
      };
      tick();
      timerRef.current = setInterval(tick, 1000);
    } else {
      setLiveSeconds(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [data?.activeSessionStartTime]);

  const loadData = useCallback(async () => {
    if (!profile?.id) return;
    const todayStart = startOfDay(today).toISOString();
    const todayEnd = endOfDay(today).toISOString();

    let periodStart = startOfDay(today).toISOString();
    let periodEnd = endOfDay(today).toISOString();

    if (customMonth) {
      periodStart = startOfMonth(customMonth).toISOString();
      periodEnd = endOfMonth(customMonth).toISOString();
    } else if (dateFilter === 'week') {
      periodStart = startOfWeek(today, { weekStartsOn: 1 }).toISOString();
      periodEnd = endOfWeek(today, { weekStartsOn: 1 }).toISOString();
    } else if (dateFilter === 'month') {
      periodStart = startOfMonth(today).toISOString();
      periodEnd = endOfMonth(today).toISOString();
    }

    try {
      const { data: myProjects } = await supabase
        .from('projects')
        .select('id, name, color, status, created_at')
        .eq('created_by', profile.id);

      const createdProjects = myProjects || [];
      const createdProjectIds = createdProjects.map(p => p.id);
      const totalProjectsCreated = createdProjects.length;

      const projectsStatusDataMap = { active: 0, paused: 0, archived: 0 };
      createdProjects.forEach(p => {
        if (p.status === 'active') projectsStatusDataMap.active++;
        else if (p.status === 'paused') projectsStatusDataMap.paused++;
        else if (p.status === 'archived') projectsStatusDataMap.archived++;
      });

      const projectsStatusData = [
        { name: 'Actifs', value: projectsStatusDataMap.active, color: '#3b82f6' },
        { name: 'En pause', value: projectsStatusDataMap.paused, color: '#f59e0b' },
        { name: 'Archivés', value: projectsStatusDataMap.archived, color: '#94a3b8' },
      ].filter(d => d.value > 0);

      const { data: tasks } = await supabase
        .from('lot_tasks')
        .select('*, project:projects(id, name, color)')
        .eq('created_by', profile.id)
        .order('created_at', { ascending: false });

      const myTasks = tasks || [];
      const tasksTodo = myTasks.filter(t => t.status === 'todo').length;
      const tasksInProgress = myTasks.filter(t => t.status === 'in_progress').length;
      const tasksCompleted = myTasks.filter(t => t.status === 'done').length;
      const currentTasks = myTasks.filter(t => t.status !== 'done');

      const { data: activeSess } = await supabase
        .from('active_sessions')
        .select('*, time_entry:time_entries(id, start_time, project_id, lot_task_id, project:projects(id, name), lot_task:lot_tasks(id, name))')
        .eq('user_id', profile.id)
        .single();

      const activeSessionStartTime: string | null = activeSess?.time_entry?.start_time || null;
      const activeTaskId: string | null = activeSess?.time_entry?.lot_task_id || null;

      const { data: timeEntries } = await supabase
        .from('time_entries')
        .select('*, project:projects(id, name, color), lot_task:lot_tasks(id, name, status, estimated_minutes)')
        .eq('user_id', profile.id)
        .gte('start_time', periodStart)
        .lte('start_time', periodEnd)
        .order('start_time', { ascending: false });

      const entries = timeEntries || [];
      const todayEntries = entries.filter(e => e.start_time >= todayStart && e.start_time <= todayEnd);
      const secondsToday = todayEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
      const secondsThisWeek = entries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);

      const { data: allTimeEntriesData } = await supabase
        .from('time_entries')
        .select('project_id, lot_task_id, duration_minutes')
        .eq('user_id', profile.id);

      const allEntries = allTimeEntriesData || [];

      const timeMap = new Map<string, number>();
      allEntries.forEach(e => {
        if (e.lot_task_id) timeMap.set(e.lot_task_id, (timeMap.get(e.lot_task_id) || 0) + (e.duration_minutes || 0));
      });

      currentTasks.forEach(t => {
        t.spent_minutes = timeMap.get(t.id) || 0;
        t.is_active = t.id === activeTaskId;
      });

      const projectTimeMap = new Map<string, { name: string; color: string; seconds: number }>();
      entries.forEach(e => {
        if (!e.project_id || !e.project) return;
        if (!projectTimeMap.has(e.project_id)) {
          projectTimeMap.set(e.project_id, { name: e.project.name, color: e.project.color || '#3b82f6', seconds: 0 });
        }
        projectTimeMap.get(e.project_id)!.seconds += e.duration_minutes || 0;
      });
      const projectBarData = Array.from(projectTimeMap.values())
        .filter(p => p.seconds > 0)
        .sort((a, b) => b.seconds - a.seconds)
        .slice(0, 6)
        .map(p => ({
          name: p.name.length > 13 ? p.name.slice(0, 13) + '…' : p.name,
          fullName: p.name,
          hours: Number((p.seconds / 3600).toFixed(2)),
          color: p.color,
          exactTime: fmt_short(p.seconds),
          seconds: p.seconds,
        }));

      const activeCreatedProjects = createdProjects.filter(p => p.status === 'active');
      let activeProjectsData: any[] = [];
      if (activeCreatedProjects.length > 0) {
        const { data: allProjectTasks } = await supabase
          .from('lot_tasks')
          .select('id, project_id, status, created_at, updated_at')
          .in('project_id', activeCreatedProjects.map(p => p.id));

        activeProjectsData = activeCreatedProjects.map(p => {
          const pTasks = (allProjectTasks || []).filter(t => t.project_id === p.id);
          const periodTasks = pTasks.filter(t => {
            const d = new Date(t.created_at || new Date()).toISOString();
            const u = t.updated_at ? new Date(t.updated_at).toISOString() : d;
            return (d >= periodStart && d <= periodEnd) || (u >= periodStart && u <= periodEnd);
          });
          const pDone = periodTasks.filter(t => t.status === 'done').length;
          const progress = periodTasks.length > 0 ? Math.round((pDone / periodTasks.length) * 100) : 0;
          const pSecondsTotal = allEntries.filter(e => e.project_id === p.id).reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
          return {
            id: p.id, name: p.name, color: p.color || '#3b82f6',
            progress, hoursThisWeek: fmt_short(pSecondsTotal),
            totalTasks: periodTasks.length, doneTasks: pDone, pSecondsTotal,
          };
        }).sort((a, b) => b.pSecondsTotal - a.pSecondsTotal);
      }

      let days: Date[] = [];
      let formatStr = 'EEE';
      const refDate = customMonth || today;
      if (customMonth) {
        days = eachDayOfInterval({ start: startOfMonth(refDate), end: endOfMonth(refDate) });
        formatStr = 'dd';
      } else if (dateFilter === 'day') {
        days = [today]; formatStr = 'dd MMM';
      } else if (dateFilter === 'month') {
        days = eachDayOfInterval({ start: startOfMonth(today), end: endOfMonth(today) }); formatStr = 'dd';
      } else {
        days = eachDayOfInterval({ start: new Date(periodStart), end: new Date(periodEnd) }); formatStr = 'EEE';
      }

      const weeklyHours = days.map(day => {
        const dStart = startOfDay(day).toISOString();
        const dEnd = endOfDay(day).toISOString();
        const daySeconds = entries.filter(e => e.start_time >= dStart && e.start_time <= dEnd).reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
        return {
          day: format(day, formatStr, { locale: fr }),
          hours: Number((daySeconds / 3600).toFixed(2)),
          exactTime: fmt_short(daySeconds),
          isToday: isSameDay(day, today),
        };
      });

      let timeline: any[] = [];
      entries.slice(0, 8).forEach(e => {
        timeline.push({ id: `te-${e.id}`, type: 'time', date: new Date(e.start_time), text: `Temps tracké sur ${e.project?.name || 'Projet'}`, details: fmt_hms(e.duration_minutes || 0) });
      });
      const periodTasks = myTasks.filter(t => {
        const created = t.created_at >= periodStart && t.created_at <= periodEnd;
        const updated = t.updated_at && t.updated_at >= periodStart && t.updated_at <= periodEnd;
        return created || updated;
      });
      periodTasks.slice(0, 5).forEach(t => {
        if (t.created_at >= periodStart && t.created_at <= periodEnd) {
          timeline.push({ id: `tc-${t.id}`, type: 'task_created', date: new Date(t.created_at), text: 'Tâche créée', details: t.name });
        }
        if (t.status === 'done' && t.updated_at && t.updated_at >= periodStart && t.updated_at <= periodEnd) {
          timeline.push({ id: `td-${t.id}`, type: 'task_done', date: new Date(t.updated_at), text: 'Tâche terminée ✓', details: t.name });
        }
      });

      const { data: recentNotes } = await supabase.from('work_notes').select('id, content, created_at').eq('user_id', profile.id).gte('created_at', periodStart).lte('created_at', periodEnd).order('created_at', { ascending: false }).limit(5);
      (recentNotes || []).forEach(n => { timeline.push({ id: `note-${n.id}`, type: 'note', date: new Date(n.created_at), text: 'Note créée 📝', details: n.content?.slice(0, 60) + (n.content?.length > 60 ? '…' : '') }); });

      const { data: recentPlannings } = await supabase.from('planning_sheets').select('id, name, created_at').eq('created_by', profile.id).gte('created_at', periodStart).lte('created_at', periodEnd).order('created_at', { ascending: false }).limit(5);
      (recentPlannings || []).forEach(p => { timeline.push({ id: `plan-${p.id}`, type: 'planning', date: new Date(p.created_at), text: 'Planning créé 📅', details: p.name || 'Nouveau planning' }); });

      createdProjects.filter(p => p.created_at >= periodStart && p.created_at <= periodEnd).forEach(p => {
        timeline.push({ id: `proj-${p.id}`, type: 'project', date: new Date(p.created_at), text: 'Projet créé 🚀', details: p.name });
      });
      timeline.sort((a, b) => b.date.getTime() - a.date.getTime());

      const { count: planningSheetsCount } = await supabase.from('planning_sheets').select('*', { count: 'exact', head: true }).eq('created_by', profile.id);

      let totalTeamMembers = 0;
      if (createdProjectIds.length > 0) {
        const { data: members } = await supabase.from('project_members').select('user_id').in('project_id', createdProjectIds);
        const uniqueMembers = new Set((members || []).map(m => m.user_id).filter(id => id !== profile.id));
        totalTeamMembers = uniqueMembers.size;
      }

      const { data: allProfiles } = await supabase.from('profiles').select('id, points').order('points', { ascending: false });
      const rankIndex = (allProfiles || []).findIndex(p => p.id === profile.id);

      const { data: notifications } = await supabase.from('notifications').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(3);
      const { data: notes } = await supabase.from('work_notes').select('*').eq('user_id', profile.id).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(3);

      setData({
        hoursToday: fmt_short(secondsToday),
        hoursThisWeek: fmt_short(secondsThisWeek),
        hoursThisWeekPct: Math.min(100, (secondsThisWeek / (40 * 3600)) * 100),
        secondsToday, secondsThisWeek,
        activeSession: activeSess || null,
        activeSessionStartTime,
        tasksTodo, tasksInProgress, tasksCompleted,
        currentTasks, activeProjects: activeProjectsData,
        projectBarData, recentActivity: timeline.slice(0, 6),
        weeklyHours, notifications: notifications || [],
        points: profile.points || 0,
        rank: rankIndex >= 0 ? rankIndex + 1 : 0,
        notes: notes || [],
        totalTasks: myTasks.length,
        totalProjectsCreated,
        totalPlanningSheets: planningSheetsCount || 0,
        totalTeamMembers, projectsStatusData,
      });

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [profile, dateFilter, customMonth]);

  useEffect(() => {
    if (profile) {
      loadData();
      const channel = supabase.channel('chef_dashboard_sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries' }, loadData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lot_tasks' }, loadData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, loadData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'work_notes' }, loadData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'active_sessions' }, loadData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, loadData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'planning_sheets' }, loadData)
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [profile, loadData]);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="animate-spin rounded-xl h-10 w-10 border-b-2 border-primary shadow-lg shadow-primary/20" />
      </div>
    );
  }

  const liveSecondsToday = (data?.secondsToday || 0) + (data?.activeSessionStartTime ? liveSeconds : 0);
  const liveSecondsWeek = (data?.secondsThisWeek || 0) + (data?.activeSessionStartTime ? liveSeconds : 0);
  const liveHoursToday = fmt_short(liveSecondsToday);
  const liveHoursWeek = fmt_short(liveSecondsWeek);
  const liveWeekPct = Math.min(100, (liveSecondsWeek / (40 * 3600)) * 100);

  const displayMonth = customMonth || today;
  const periodLabel = customMonth
    ? format(customMonth, 'MMMM yyyy', { locale: fr })
    : dateFilter === 'day'
      ? format(today, 'dd MMM yyyy', { locale: fr })
      : dateFilter === 'week'
        ? `${format(startOfWeek(today, { weekStartsOn: 1 }), 'dd MMM', { locale: fr })} - ${format(endOfWeek(today, { weekStartsOn: 1 }), 'dd MMM yyyy', { locale: fr })}`
        : format(today, 'MMMM yyyy', { locale: fr });

  const handlePrevMonth = () => {
    const base = customMonth || today;
    setCustomMonth(subMonths(base, 1));
    setDateFilter('month');
  };

  const handleNextMonth = () => {
    const base = customMonth || today;
    const next = addMonths(base, 1);
    if (next > today) return;
    setCustomMonth(addMonths(base, 1));
    setDateFilter('month');
  };

  const handleFilterChange = (f: 'day' | 'week' | 'month') => {
    setDateFilter(f);
    setCustomMonth(null);
  };

  const isCurrentMonth = !customMonth || (
    customMonth.getMonth() === today.getMonth() &&
    customMonth.getFullYear() === today.getFullYear()
  );

  return (
    <div className="min-h-screen bg-[#f4f5f7] dark:bg-slate-950">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-white">Dashboard</h1>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Bienvenue <span className="text-blue-500 font-bold">{profile?.full_name?.split(' ')[0]}</span>, suivez vos projets, votre temps et votre équipe en temps réel.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-full border border-slate-200 dark:border-slate-700">
              <button onClick={() => handleFilterChange('day')} className={cn("px-3 py-1 text-[10px] sm:text-xs font-bold rounded-full transition-colors", !customMonth && dateFilter === 'day' ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>Jour</button>
              <button onClick={() => handleFilterChange('week')} className={cn("px-3 py-1 text-[10px] sm:text-xs font-bold rounded-full transition-colors", !customMonth && dateFilter === 'week' ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>Semaine</button>
              <button onClick={() => handleFilterChange('month')} className={cn("px-3 py-1 text-[10px] sm:text-xs font-bold rounded-full transition-colors", !customMonth && dateFilter === 'month' ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>Mois</button>
            </div>

            {/* ── Navigateur de mois ── */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-2 py-1 shadow-sm">
              <button
                onClick={handlePrevMonth}
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-slate-500" />
              </button>
              <div className="flex items-center gap-1.5 px-1">
                <CalendarDays className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 min-w-[110px] text-center">{periodLabel}</span>
              </div>
              <button
                onClick={handleNextMonth}
                disabled={isCurrentMonth}
                className={cn("w-6 h-6 flex items-center justify-center rounded-full transition-colors", isCurrentMonth ? "opacity-30 cursor-not-allowed" : "hover:bg-slate-100 dark:hover:bg-slate-700")}
              >
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>

            {data?.activeSession && (
              <button
                onClick={() => router.push('/tracker')}
                className="flex items-center gap-2 bg-blue-500 text-white rounded-full px-4 py-2 shadow-md text-xs font-bold hover:bg-blue-600 transition-colors"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                </span>
                Timer · {fmt_hms(liveSeconds)}
                <Play className="w-3 h-3 fill-current" />
              </button>
            )}
          </div>
        </div>

        {/* ── Row 1: Top 3 cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          <Card className="bg-white dark:bg-slate-800 border-0 shadow-sm rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-center justify-center">
                <Trophy className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700 dark:text-white">Temps Loggé</p>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                  {customMonth ? format(customMonth, 'MMMM yyyy', { locale: fr }) : dateFilter === 'day' ? "Aujourd'hui" : dateFilter === 'week' ? 'Cette semaine' : 'Ce mois'}
                </p>
              </div>
              {data?.activeSessionStartTime && (
                <span className="ml-auto flex items-center gap-1 text-[9px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            {liveSecondsWeek === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-slate-300 dark:text-slate-600">
                <Timer className="w-10 h-10 mb-2" />
                <p className="text-xs font-medium">Aucune donnée</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-end justify-between">
                  <span className="text-3xl font-black text-slate-800 dark:text-white tabular-nums">{liveHoursWeek}</span>
                  <span className="text-xs font-semibold text-blue-500 flex items-center gap-0.5">
                    <ArrowUpRight className="w-3 h-3" /> {customMonth ? format(customMonth, 'MMM', { locale: fr }) : dateFilter === 'day' ? 'Au total' : dateFilter === 'week' ? 'Cette sem.' : 'Ce mois'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full transition-all duration-1000" style={{ width: `${liveWeekPct}%` }} />
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold">/ 40h</span>
                </div>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  <span className="font-bold text-slate-600 dark:text-slate-300 tabular-nums">{liveHoursToday}</span> aujourd'hui
                </p>
              </div>
            )}
          </Card>

          <Card className="bg-white dark:bg-slate-800 border-0 shadow-sm rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <Activity className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700 dark:text-white">Activité Tâches</p>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Mes projets</p>
              </div>
            </div>
            {data?.totalTasks === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-slate-300 dark:text-slate-600">
                <ListTodo className="w-10 h-10 mb-2" />
                <p className="text-xs font-medium">Aucune donnée</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-end justify-between">
                  <span className="text-4xl font-black text-slate-800 dark:text-white">{data?.tasksCompleted}</span>
                  <span className="text-xs font-semibold text-blue-500">terminées</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {[
                    { label: 'À faire', count: data?.tasksTodo, color: 'bg-slate-400' },
                    { label: 'En cours', count: data?.tasksInProgress, color: 'bg-blue-500' },
                    { label: 'Finies', count: data?.tasksCompleted, color: 'bg-emerald-500' },
                  ].map(s => (
                    <div key={s.label} className="flex flex-col items-center p-2 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                      <div className={cn('w-2 h-2 rounded-full mb-1', s.color)} />
                      <span className="text-sm font-black text-slate-700 dark:text-white">{s.count}</span>
                      <span className="text-[9px] text-slate-400 font-medium text-center leading-tight">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card className="bg-white dark:bg-slate-800 border-0 shadow-sm rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-purple-50 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 text-purple-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700 dark:text-white">Mon Équipe</p>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Membres sur mes projets</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Total Membres</span>
                </div>
                <span className="text-xs font-bold text-purple-500">{data?.totalTeamMembers}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Projets Créés</span>
                </div>
                <span className="text-xs font-bold text-blue-500">{data?.totalProjectsCreated}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Row 2: Rapport d'Activité + Heures par Projet ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="bg-white dark:bg-slate-800 border-0 shadow-sm rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-bold text-slate-700 dark:text-white">Rapport d'Activité</h3>
                <p className="text-[10px] text-slate-400 font-medium">Mes projets · Heures / jour</p>
              </div>
            </div>
            {data?.weeklyHours.every(d => d.hours === 0) ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-300 dark:text-slate-600">
                <Activity className="w-12 h-12 mb-3" />
                <p className="text-xs font-medium">Aucune donnée trouvée.</p>
              </div>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data?.weeklyHours} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="hoursGradChef" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-700" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                    <Tooltip
                      cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontSize: '12px' }}
                      formatter={(_value: any, _name: any, props: any) => [props.payload.exactTime, 'Temps']}
                    />
                    <Area type="monotone" dataKey="hours" stroke="#3b82f6" strokeWidth={2.5} fill="url(#hoursGradChef)" dot={{ fill: '#3b82f6', r: 4, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card className="bg-white dark:bg-slate-800 border-0 shadow-sm rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-bold text-slate-700 dark:text-white">Heures par Projet</h3>
                <p className="text-[10px] text-slate-400 font-medium">Temps tracké sur mes projets</p>
              </div>
            </div>
            {!data?.projectBarData || data.projectBarData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-300 dark:text-slate-600">
                <Activity className="w-12 h-12 mb-3" />
                <p className="text-xs font-medium">Aucune donnée trouvée.</p>
              </div>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.projectBarData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-700" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                    <Tooltip content={<ProjectBarTooltip />} cursor={{ fill: 'rgba(241,245,249,0.6)' }} />
                    <Bar dataKey="hours" radius={[6, 6, 0, 0]}>
                      {data.projectBarData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>

        {/* ── Row 2b: Projets donut + Points & Rang ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="bg-white dark:bg-slate-800 border-0 shadow-sm rounded-2xl p-5 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-700 dark:text-white">Mes Projets Créés</h3>
                <p className="text-[10px] text-slate-400 font-medium">Répartition par statut</p>
              </div>
              <button onClick={() => router.push('/projets')} className="text-[10px] font-bold text-blue-500 hover:text-blue-600 flex items-center gap-0.5">
                Voir tout <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            {!data?.projectsStatusData || data.projectsStatusData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-300 dark:text-slate-600">
                <Briefcase className="w-10 h-10 mb-2" />
                <p className="text-xs font-medium">Aucun projet créé.</p>
              </div>
            ) : (
              <div className="flex items-center gap-5">
                <div className="relative w-[110px] h-[110px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.projectsStatusData} cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" paddingAngle={4} dataKey="value" stroke="none">
                        {data.projectsStatusData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: 'bold' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-slate-800 dark:text-white leading-none">{data.totalProjectsCreated}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Projets</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  {data.projectsStatusData.map(d => (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-xs font-semibold text-slate-500">{d.name}</span>
                      </div>
                      <span className="text-xs font-black text-slate-700 dark:text-white">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card className="bg-white dark:bg-slate-800 border-0 shadow-sm rounded-2xl p-5 flex flex-col gap-3 justify-center">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-white">Points & Rang</span>
              </div>
              <span className="text-lg font-black text-amber-500">{data?.points} pts</span>
            </div>
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Position équipe</span>
              <span className="text-xl font-black text-slate-700 dark:text-white">#{data?.rank || '—'}</span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-1000" style={{ width: `${Math.max(10, 100 - (data?.rank || 0) * 10)}%` }} />
            </div>
          </Card>
        </div>

        {/* ── Row 3: Tâches en cours + Activité Récente ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="bg-white dark:bg-slate-800 border-0 shadow-sm rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-white">Tâches en Cours — Mes Projets</h3>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                  {data?.currentTasks.length || 0}
                </span>
              </div>
              <button onClick={() => router.push('/taches')} className="text-[10px] font-bold text-blue-500 hover:text-blue-600 flex items-center gap-0.5">
                Voir tout <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {data?.currentTasks.map(t => (
                <div key={t.id} className={cn("flex items-center gap-4 p-3.5 rounded-xl border transition-colors group", t.is_active ? "border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10" : "border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800")}>
                  <div className={cn('w-2 h-2 rounded-full shrink-0', t.is_active ? 'bg-blue-500 animate-pulse' : t.status === 'in_progress' ? 'bg-blue-400' : 'bg-slate-300')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 dark:text-white truncate">{t.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{t.project?.name || 'Projet'}</span>
                      <span className="text-[9px]">·</span>
                      <span className={cn('text-[9px] font-bold uppercase', t.status === 'in_progress' ? 'text-blue-500' : 'text-slate-400')}>{STATUS_LABELS[t.status] || t.status}</span>
                      {t.is_active && (
                        <span className="text-[9px] font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                          {fmt_hms((t.spent_minutes || 0) + liveSeconds)}
                        </span>
                      )}
                    </div>
                  </div>
                  {!t.is_active && (
                    <div className="w-24 shrink-0">
                      <div className="flex justify-between text-[9px] font-bold text-slate-400 mb-1">
                        <span>Avancement</span>
                        <span className="tabular-nums">{fmt_full(t.spent_minutes || 0)}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, ((t.spent_minutes || 0) / Math.max(1, t.estimated_minutes || 60)) * 100)}%` }} />
                      </div>
                    </div>
                  )}
                  <Button size="sm" onClick={() => router.push('/tracker')} className="h-8 w-8 p-0 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-500 hover:text-white border-0 shadow-none transition-all opacity-0 group-hover:opacity-100">
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </Button>
                </div>
              ))}
              {data?.currentTasks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-slate-300 dark:text-slate-600">
                  <CheckCircle2 className="w-10 h-10 mb-2" />
                  <p className="text-xs font-medium">Toutes les tâches sont terminées !</p>
                </div>
              )}
            </div>
          </Card>

          <Card className="bg-white dark:bg-slate-800 border-0 shadow-sm rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-purple-500" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-white">Activité Récente</h3>
            </div>
            <div className="relative pl-5 space-y-4 before:absolute before:left-2 before:top-0 before:h-full before:w-px before:bg-gradient-to-b before:from-slate-200 before:to-transparent dark:before:from-slate-700">
              {data?.recentActivity.map((act, i) => (
                <div key={act.id + i} className="relative flex gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate">{act.text}</p>
                      <span className="text-[9px] text-slate-400 shrink-0 ml-2 tabular-nums">{format(act.date, 'HH:mm')}</span>
                    </div>
                    <p className="text-[9px] text-slate-400 truncate mt-0.5">{act.details}</p>
                  </div>
                </div>
              ))}
              {data?.recentActivity.length === 0 && (
                <div className="flex flex-col items-center py-6 text-slate-300 dark:text-slate-600">
                  <p className="text-[10px] font-medium">Aucune activité récente.</p>
                </div>
              )}
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}