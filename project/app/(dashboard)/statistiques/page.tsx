'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import {
    Calendar,
    Layers,
    Clock,
    Users,
    CheckSquare,
    Medal,
    Trophy,
    TrendingUp,
    ChevronLeft,
    ChevronRight,
    CalendarDays
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    Cell,
    PieChart,
    Pie,
    Label
} from 'recharts';
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, startOfDay, endOfDay, eachDayOfInterval, isSameDay, isWithinInterval, subMonths, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// ── Utilitaire temps réel identique aux dashboards ──
const fmt_short = (raw: number) => {
    const t = Math.round(raw);
    if (t <= 0) return '0h 0min 0s';
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    return `${h}h ${m}min ${s}s`;
};

// ── Tooltip personnalisé pour le bar chart projets ──
const ProjectBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const d = payload[0].payload;
        return (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 px-3 py-2 text-xs">
                <p className="font-bold text-slate-700 dark:text-white mb-1">{d.fullName || d.name}</p>
                <p className="font-black" style={{ color: d.fill }}>{fmt_short(d.seconds)}</p>
            </div>
        );
    }
    return null;
};

// ── Tooltip personnalisé pour le area chart heures ──
const HoursTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 px-3 py-2 text-xs">
                <p className="font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                <p className="font-black text-emerald-500">{fmt_short(payload[0].payload.seconds)}</p>
            </div>
        );
    }
    return null;
};

type FilterKey = 'today' | 'week' | 'month' | 'prev_month' | 'next_month';

const getDateRange = (filter: FilterKey): { start: Date; end: Date } => {
    const now = new Date();
    if (filter === 'today') return { start: startOfDay(now), end: endOfDay(now) };
    if (filter === 'week') return { start: startOfWeek(now, { weekStartsOn: 1 }), end: now };
    if (filter === 'prev_month') {
        const startOfPrev = startOfMonth(subMonths(now, 1));
        const endOfPrev = endOfMonth(subMonths(now, 1));
        return { start: startOfPrev, end: endOfPrev };
    }
    if (filter === 'next_month') {
        const startOfNext = startOfMonth(addMonths(now, 1));
        const endOfNext = endOfMonth(addMonths(now, 1));
        return { start: startOfNext, end: endOfNext };
    }
    // month
    return { start: startOfMonth(now), end: endOfMonth(now) }; // Use endOfMonth to be consistent for a full month's view
};

export default function StatistiquesPage() {
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<FilterKey>('month');
    const [dateFilter, setDateFilter] = useState<{ start: Date; end: Date }>(getDateRange('month'));

    // Données globales
    const [kpiTotals, setKpiTotals] = useState({ projects: 0, members: 0, tasks: 0, totalSeconds: 0 });

    // Section Projets
    const [projectsByStatus, setProjectsByStatus] = useState<{ name: string; value: number; fill: string }[]>([]);
    const [topProjectsByHours, setTopProjectsByHours] = useState<{ name: string; fullName: string; hours: number; seconds: number; fill: string }[]>([]);

    // Section Tâches
    const [tasksByStatus, setTasksByStatus] = useState<{ name: string; value: number; fill: string }[]>([]);
    const [tasksCreatedPerDay, setTasksCreatedPerDay] = useState<{ date: string; count: number }[]>([]);

    // Section Temps Tracké
    const [hoursPerDay, setHoursPerDay] = useState<{ date: string; hours: number; seconds: number }[]>([]);

    // Section Membres
    const [topMembersByPoints, setTopMembersByPoints] = useState<any[]>([]);
    const [topMembersByHours, setTopMembersByHours] = useState<any[]>([]);

    // Section Tableau
    const [projectTableData, setProjectTableData] = useState<any[]>([]);

    const handleFilterChange = (filter: FilterKey) => {
        setActiveFilter(filter);
        setDateFilter(getDateRange(filter));
    };

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const { start, end } = dateFilter;

            const [
                { data: allProjects },
                { data: allProfiles },
                { data: allTasks },
                { data: allTimeEntries },
                { data: allProjectMembers }
            ] = await Promise.all([
                supabase.from('projects').select('*'),
                supabase.from('profiles').select('*'),
                supabase.from('lot_tasks').select('*'),
                supabase.from('time_entries').select('*'),
                supabase.from('project_members').select('*')
            ]);

            const projects = allProjects || [];
            const profiles = allProfiles || [];
            const tasks = allTasks || [];
            const timeEntries = allTimeEntries || [];
            const projectMembers = allProjectMembers || [];

            // Filtrage strict des time entries sur la période sélectionnée
            const filteredEntries = timeEntries.filter(te =>
                te.start_time && isWithinInterval(new Date(te.start_time), { start, end })
            );

            // 1. KPI Globaux — on filtre les time entries sur la période
            const totalSeconds = filteredEntries.reduce((acc, te) => acc + (te.duration_minutes || 0), 0);

            // Tâches créées sur la période
            const filteredTasks = tasks.filter(t =>
                t.created_at && isWithinInterval(new Date(t.created_at), { start, end })
            );

            setKpiTotals({
                projects: projects.length,        // toujours global (nb total de projets)
                members: profiles.length,          // toujours global (nb total de membres)
                tasks: filteredTasks.length,       // tâches créées sur la période
                totalSeconds,                      // temps tracké sur la période
            });

            // 2. Projets par statut (toujours global)
            const pStatusCounts = { active: 0, paused: 0, archived: 0 };
            projects.forEach(p => {
                if (p.status === 'active') pStatusCounts.active++;
                else if (p.status === 'paused') pStatusCounts.paused++;
                else if (p.status === 'archived') pStatusCounts.archived++;
                else pStatusCounts.active++;
            });
            setProjectsByStatus([
                { name: 'Actifs', value: pStatusCounts.active, fill: '#3b82f6' },
                { name: 'En pause', value: pStatusCounts.paused, fill: '#f59e0b' },
                { name: 'Archivés', value: pStatusCounts.archived, fill: '#64748b' }
            ].filter(s => s.value > 0));

            // Secondes par projet — filtrées sur la période
            const pSeconds: Record<string, number> = {};
            filteredEntries.forEach(te => {
                if (te.project_id) {
                    pSeconds[te.project_id] = (pSeconds[te.project_id] || 0) + (te.duration_minutes || 0);
                }
            });
            const topP = projects
                .map(p => ({
                    name: p.name.length > 13 ? p.name.slice(0, 13) + '…' : p.name,
                    fullName: p.name,
                    seconds: pSeconds[p.id] || 0,
                    hours: Number(((pSeconds[p.id] || 0) / 3600).toFixed(2)),
                    fill: p.color || '#3b82f6'
                }))
                .filter(p => p.seconds > 0)
                .sort((a, b) => b.seconds - a.seconds)
                .slice(0, 10);
            setTopProjectsByHours(topP);

            // 3. Tâches par statut — filtrées sur la période
            const tStatusCounts = { todo: 0, in_progress: 0, done: 0 };
            filteredTasks.forEach(t => {
                const s = t.status || 'todo';
                if (s === 'done') tStatusCounts.done++;
                else if (s === 'in_progress') tStatusCounts.in_progress++;
                else tStatusCounts.todo++;
            });
            setTasksByStatus([
                { name: 'À faire', value: tStatusCounts.todo, fill: '#94a3b8' },
                { name: 'En cours', value: tStatusCounts.in_progress, fill: '#3b82f6' },
                { name: 'Terminées', value: tStatusCounts.done, fill: '#10b981' }
            ].filter(s => s.value > 0));

            // Tâches créées par jour
            const days = eachDayOfInterval({ start, end });
            const tasksArea = days.map(day => ({
                date: format(day, 'dd/MM'),
                count: filteredTasks.filter(t => isSameDay(new Date(t.created_at), day)).length
            }));
            setTasksCreatedPerDay(tasksArea);

            // 4. Temps tracké par jour
            const hoursArea = days.map(day => {
                const secs = filteredEntries
                    .filter(te => isSameDay(new Date(te.start_time), day))
                    .reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);
                return {
                    date: format(day, 'dd/MM'),
                    hours: Number((secs / 3600).toFixed(2)),
                    seconds: secs,
                };
            });
            setHoursPerDay(hoursArea);

            // 5. Membres — top par points (toujours global)
            const topPoints = [...profiles]
                .sort((a, b) => (b.points || 0) - (a.points || 0))
                .slice(0, 5);
            setTopMembersByPoints(topPoints);

            // Secondes par membre — filtrées sur la période
            const mSeconds: Record<string, number> = {};
            filteredEntries.forEach(te => {
                if (te.user_id) mSeconds[te.user_id] = (mSeconds[te.user_id] || 0) + (te.duration_minutes || 0);
            });
            const topMH = profiles
                .map(m => ({ ...m, seconds: mSeconds[m.id] || 0 }))
                .filter(m => m.seconds > 0)
                .sort((a, b) => b.seconds - a.seconds)
                .slice(0, 5);
            setTopMembersByHours(topMH);

            // 6. Tableau récapitulatif — temps filtrés sur la période
            const tableData = projects.map(p => {
                const pTasks = tasks.filter(t => t.project_id === p.id);
                const pMembers = projectMembers.filter(pm => pm.project_id === p.id);
                let td = 0, ip = 0, to = 0;
                pTasks.forEach(t => {
                    if (t.status === 'done') td++;
                    else if (t.status === 'in_progress') ip++;
                    else to++;
                });
                return {
                    id: p.id,
                    name: p.name,
                    color: p.color || '#3b82f6',
                    status: p.status || 'active',
                    membersCount: pMembers.length,
                    tasksTotal: pTasks.length,
                    tasksTodo: to,
                    tasksInProgress: ip,
                    tasksDone: td,
                    totalSeconds: pSeconds[p.id] || 0,
                };
            }).sort((a, b) => b.totalSeconds - a.totalSeconds);
            setProjectTableData(tableData);

        } catch (error) {
            console.error('Data fetch error:', error);
        } finally {
            setLoading(false);
        }
    }, [dateFilter]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (loading && kpiTotals.projects === 0) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="animate-spin rounded-xl h-10 w-10 border-b-2 border-primary shadow-lg shadow-primary/20"></div>
            </div>
        );
    }

    const filterLabels: Record<FilterKey, string> = {
        prev_month: 'Mois précédent',
        today: "Aujourd'hui",
        week: 'Cette semaine',
        month: 'Ce mois',
        next_month: 'Mois suivant'
    };

    return (
        <div className="space-y-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

            {/* Header & Date Filter */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
                <div className="space-y-2">
                    <h1 className="section-title">Intelligence Opérationnelle</h1>
                    <p className="section-subtitle">Analyses approfondies globales de toute l'application.</p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-full border border-slate-200 dark:border-slate-700">
                        <button onClick={() => handleFilterChange('today')} className={cn("px-3 py-1 text-[10px] sm:text-xs font-bold rounded-full transition-colors", activeFilter === 'today' ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>Jour</button>
                        <button onClick={() => handleFilterChange('week')} className={cn("px-3 py-1 text-[10px] sm:text-xs font-bold rounded-full transition-colors", activeFilter === 'week' ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>Semaine</button>
                        <button onClick={() => handleFilterChange('month')} className={cn("px-3 py-1 text-[10px] sm:text-xs font-bold rounded-full transition-colors", activeFilter === 'month' ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}>Mois</button>
                    </div>

                    <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-2 py-1 shadow-sm">
                        <button
                            onClick={() => handleFilterChange('prev_month')}
                            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            <ChevronLeft className="w-3.5 h-3.5 text-slate-500" />
                        </button>
                        <div className="flex items-center gap-1.5 px-1">
                            <CalendarDays className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 min-w-[110px] text-center">
                                {activeFilter === 'prev_month' || activeFilter === 'next_month'
                                    ? format(dateFilter.start, 'MMMM yyyy', { locale: fr })
                                    : activeFilter === 'today'
                                        ? format(dateFilter.start, 'dd MMM yyyy', { locale: fr })
                                        : activeFilter === 'week'
                                            ? `${format(dateFilter.start, 'dd MMM', { locale: fr })} - ${format(dateFilter.end, 'dd MMM yyyy', { locale: fr })}`
                                            : format(dateFilter.start, 'MMMM yyyy', { locale: fr })}
                            </span>
                        </div>
                        <button
                            onClick={() => handleFilterChange('next_month')}
                            disabled={isSameDay(startOfMonth(new Date()), startOfMonth(dateFilter.start))}
                            className={cn("w-6 h-6 flex items-center justify-center rounded-full transition-colors", isSameDay(startOfMonth(new Date()), startOfMonth(dateFilter.start)) ? "opacity-30 cursor-not-allowed" : "hover:bg-slate-100 dark:hover:bg-slate-700")}
                        >
                            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Section 1: KPI Globaux */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="premium-card p-6 border-none shadow-sm flex flex-col justify-between h-32 group">
                    <div className="flex items-center justify-between">
                        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500"><Layers size={18} /></div>
                        <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800 border-none font-black text-[10px] tracking-widest text-slate-400">TOTAL PROJETS</Badge>
                    </div>
                    <div className="flex items-end justify-between">
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">{kpiTotals.projects}</h3>
                    </div>
                </Card>

                <Card className="premium-card p-6 border-none shadow-sm flex flex-col justify-between h-32 group">
                    <div className="flex items-center justify-between">
                        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500"><Users size={18} /></div>
                        <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800 border-none font-black text-[10px] tracking-widest text-slate-400">TOTAL MEMBRES</Badge>
                    </div>
                    <div className="flex items-end justify-between">
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">{kpiTotals.members}</h3>
                    </div>
                </Card>

                <Card className="premium-card p-6 border-none shadow-sm flex flex-col justify-between h-32 group">
                    <div className="flex items-center justify-between">
                        <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500"><CheckSquare size={18} /></div>
                        <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800 border-none font-black text-[10px] tracking-widest text-slate-400">TÂCHES ({filterLabels[activeFilter].toUpperCase()})</Badge>
                    </div>
                    <div className="flex items-end justify-between">
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">{kpiTotals.tasks}</h3>
                    </div>
                </Card>

                <Card className="premium-card p-6 border-none shadow-sm flex flex-col justify-between h-32 group">
                    <div className="flex items-center justify-between">
                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500"><Clock size={18} /></div>
                        <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800 border-none font-black text-[10px] tracking-widest text-slate-400">HEURES ({filterLabels[activeFilter].toUpperCase()})</Badge>
                    </div>
                    <div className="flex items-end justify-between">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tighter tabular-nums">
                            {fmt_short(kpiTotals.totalSeconds)}
                        </h3>
                    </div>
                </Card>
            </div>

            {/* Section 2: Projets */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="premium-card p-8 border-none shadow-sm flex flex-col h-full">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">Statut des Projets</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Répartition de l'ensemble des projets</p>
                    <div className="flex-1 min-h-[250px] relative">
                        {projectsByStatus.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={projectsByStatus} cx="50%" cy="50%" innerRadius={65} outerRadius={85} stroke="none" paddingAngle={4} dataKey="value">
                                        {projectsByStatus.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                                        <Label value={kpiTotals.projects} position="center" className="fill-slate-900 dark:fill-white text-3xl font-black" />
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Aucune donnée</p>
                            </div>
                        )}
                    </div>
                </Card>

                <Card className="lg:col-span-2 premium-card p-8 border-none shadow-sm flex flex-col h-full">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">Top Projets par Heures</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Heures trackées — {filterLabels[activeFilter]}</p>
                    <div className="flex-1 min-h-[250px]">
                        {topProjectsByHours.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topProjectsByHours} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#64748b' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#64748b' }} />
                                    <Tooltip content={<ProjectBarTooltip />} cursor={{ fill: 'rgba(241,245,249,0.6)' }} />
                                    <Bar dataKey="hours" radius={[4, 4, 0, 0]} barSize={32}>
                                        {topProjectsByHours.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Aucune donnée sur cette période</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* Section 3: Tâches */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="premium-card p-8 border-none shadow-sm flex flex-col h-full">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">Statut des Tâches</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Créées — {filterLabels[activeFilter]}</p>
                    <div className="flex-1 min-h-[250px] relative">
                        {tasksByStatus.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={tasksByStatus} cx="50%" cy="50%" innerRadius={65} outerRadius={85} stroke="none" paddingAngle={4} dataKey="value">
                                        {tasksByStatus.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                                        <Label value={kpiTotals.tasks} position="center" className="fill-slate-900 dark:fill-white text-3xl font-black" />
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Aucune donnée</p>
                            </div>
                        )}
                    </div>
                </Card>

                <Card className="lg:col-span-2 premium-card p-8 border-none shadow-sm flex flex-col h-full">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">Tâches Créées par Jour</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Sur la période sélectionnée</p>
                    <div className="flex-1 min-h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={tasksCreatedPerDay}>
                                <defs>
                                    <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
                                    labelStyle={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}
                                />
                                <Area type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorTasks)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            {/* Section 4: Temps Tracké global */}
            <Card className="premium-card p-8 border-none shadow-sm">
                <div className="flex items-center justify-between mb-8">
                    <div className="space-y-1">
                        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                            <TrendingUp size={16} className="text-emerald-500" />
                            Heures globales loggées par jour
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Temps tracké par TOUTE L'ÉQUIPE — {filterLabels[activeFilter]}</p>
                    </div>
                </div>
                <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={hoursPerDay}>
                            <defs>
                                <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }} />
                            <Tooltip content={<HoursTooltip />} />
                            <Area type="monotone" dataKey="hours" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorHours)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* Section 5: Membres */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="premium-card p-8 border-none shadow-sm flex flex-col h-full">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2 flex items-center gap-2">
                        <Trophy size={16} className="text-amber-500" /> Top 5 Membres (Points)
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Basé sur le total de points</p>
                    <div className="space-y-4">
                        {topMembersByPoints.map((m, i) => (
                            <div key={m.id} className="flex items-center gap-4">
                                <span className={cn("text-lg font-black w-6 text-center",
                                    i === 0 ? "text-amber-500" :
                                        i === 1 ? "text-slate-400" :
                                            i === 2 ? "text-amber-700" : "text-slate-300"
                                )}>#{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-white truncate">{m.full_name}</h4>
                                    <div className="h-1.5 mt-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-amber-500 rounded-full"
                                            style={{ width: `${Math.min((m.points / (topMembersByPoints[0]?.points || 1)) * 100, 100)}%` }}
                                        />
                                    </div>
                                </div>
                                <div className="px-3 py-1 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-amber-600 font-black text-xs shrink-0">
                                    {m.points} pts
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card className="premium-card p-8 border-none shadow-sm flex flex-col h-full">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2 flex items-center gap-2">
                        <Medal size={16} className="text-blue-500" /> Top 5 Membres (Heures)
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">{filterLabels[activeFilter]} — heures loggées</p>
                    <div className="space-y-4">
                        {topMembersByHours.length > 0 ? topMembersByHours.map((m, i) => (
                            <div key={m.id} className="flex items-center gap-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                                <span className="text-sm font-black text-slate-400 w-4">#{i + 1}</span>
                                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black uppercase shrink-0">
                                    {m.full_name?.charAt(0)}
                                </div>
                                <h4 className="text-sm font-bold text-slate-800 dark:text-white min-w-0 truncate flex-1">{m.full_name}</h4>
                                <div className="text-xs font-black text-slate-900 dark:text-white shrink-0 tabular-nums">
                                    {fmt_short(m.seconds)}
                                </div>
                            </div>
                        )) : (
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center py-8">Aucune donnée sur cette période</p>
                        )}
                    </div>
                </Card>
            </div>

            {/* Section 6: Tableau des Projets */}
            <Card className="premium-card border-none shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Récapitulatif des Projets</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Temps tracké — {filterLabels[activeFilter]}</p>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/50 dark:bg-slate-800/50 border-none">
                            <TableHead className="py-5 pl-8 font-black text-[10px] tracking-widest text-slate-400">Projet</TableHead>
                            <TableHead className="py-5 font-black text-[10px] tracking-widest text-slate-400">Statut</TableHead>
                            <TableHead className="py-5 font-black text-[10px] tracking-widest text-slate-400 text-center">Équipe</TableHead>
                            <TableHead className="py-5 font-black text-[10px] tracking-widest text-slate-400 text-center">Tâches (À faire / En cours / Terminé)</TableHead>
                            <TableHead className="py-5 pr-8 font-black text-[10px] tracking-widest text-slate-400 text-right">Temps Loggé</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {projectTableData.map((project) => (
                            <TableRow key={project.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors border-slate-100/50 dark:border-slate-800/50">
                                <TableCell className="py-6 pl-8">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2.5 h-2.5 rounded-full shadow-lg" style={{ backgroundColor: project.color }} />
                                        <span className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-tight">{project.name}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="py-6">
                                    <Badge className={cn(
                                        "font-black text-[8px] uppercase tracking-widest border-none px-2 py-1",
                                        project.status === 'active' ? "bg-emerald-500/10 text-emerald-500" :
                                            project.status === 'paused' ? "bg-amber-500/10 text-amber-500" :
                                                "bg-slate-100 text-slate-400"
                                    )}>
                                        {project.status === 'active' ? 'Actif' : project.status === 'paused' ? 'En pause' : 'Archivé'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="py-6 text-center font-bold text-slate-600 dark:text-slate-400 text-sm">
                                    {project.membersCount}
                                </TableCell>
                                <TableCell className="py-6 text-center">
                                    <div className="flex items-center justify-center gap-2 text-xs font-black">
                                        <span className="text-slate-400">{project.tasksTodo}</span>
                                        <span className="text-slate-300">/</span>
                                        <span className="text-blue-500">{project.tasksInProgress}</span>
                                        <span className="text-slate-300">/</span>
                                        <span className="text-emerald-500">{project.tasksDone}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="py-6 pr-8 text-right font-black text-slate-900 dark:text-white text-sm tabular-nums">
                                    {fmt_short(project.totalSeconds)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>

        </div>
    );
}