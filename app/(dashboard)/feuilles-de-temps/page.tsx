'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Download,
    Filter,
    Clock,
    Briefcase,
    User as UserIcon,
    Timer,
    Users,
    CalendarDays,
} from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { TimeEntryWithDetails, Project, Profile } from '@/types';

type ViewType = 'daily' | 'weekly' | 'monthly';

export default function TimesheetsPage() {
    const { profile, loading: authLoading } = useAuth();
    const router = useRouter();
    const [view, setView] = useState<ViewType>('weekly');

    useEffect(() => {
        if (!authLoading && profile?.role === 'member') {
            router.replace('/dashboard');
        }
    }, [profile, authLoading, router]);

    const [date, setDate] = useState<Date>(new Date());
    const [entries, setEntries] = useState<TimeEntryWithDetails[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [filterProject, setFilterProject] = useState<string>('all');
    const [filterUser, setFilterUser] = useState<string>('all');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (profile) {
            fetchProjects();
            fetchProfiles();
            fetchEntries();
        }
    }, [profile, view, date, filterProject, filterUser]);

    const fetchProjects = async () => {
        const { data } = await supabase.from('projects').select('*').order('name');
        setProjects(data || []);
    };

    const fetchProfiles = async () => {
        const { data } = await supabase.from('profiles').select('*').order('full_name');
        setProfiles(data || []);
    };

    const fetchEntries = async () => {
        setLoading(true);
        try {
            let start, end;
            if (view === 'daily') {
                start = startOfDay(date);
                end = endOfDay(date);
            } else if (view === 'weekly') {
                start = startOfWeek(date, { weekStartsOn: 1 });
                end = endOfWeek(date, { weekStartsOn: 1 });
            } else {
                start = startOfMonth(date);
                end = endOfMonth(date);
            }

            let query = supabase
                .from('time_entries')
                .select(`
          *,
          project:projects(*),
          lot:project_lots(*),
          task:tasks(*),
          category:simple_categories(*),
          profile:profiles(*)
        `)
                .gte('start_time', start.toISOString())
                .lte('start_time', end.toISOString())
                .order('start_time', { ascending: false });

            if (filterProject !== 'all') query = query.eq('project_id', filterProject);
            if (filterUser !== 'all') {
                query = query.eq('user_id', filterUser);
            } else if (profile?.role === 'member') {
                query = query.eq('user_id', profile.id);
            }

            const { data, error } = await query;
            if (error) throw error;
            setEntries(data || []);
        } catch (error) {
            console.error('Erreur chargement feuilles de temps:', error);
        } finally {
            setLoading(false);
        }
    };

    const moveDate = (direction: 'prev' | 'next') => {
        if (view === 'daily') {
            setDate(prev => direction === 'prev' ? subDays(prev, 1) : addDays(prev, 1));
        } else if (view === 'weekly') {
            setDate(prev => direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1));
        } else {
            setDate(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
        }
    };

    const handleExportCSV = () => {
        if (entries.length === 0) return;

        const headers = ['Date', 'Heure', 'Collaborateur', 'Projet', 'Tâche', 'Notes', 'Durée formatée'];

        const escapeCell = (val: any): string => {
            const str = val == null ? '' : String(val);
            // Always wrap in quotes to avoid Excel misinterpretation
            return `"${str.replace(/"/g, '""')}"`;
        };

        const rows = entries.map(entry => [
            escapeCell(format(new Date(entry.start_time), 'dd/MM/yyyy')),
            escapeCell(format(new Date(entry.start_time), 'HH:mm')),
            escapeCell(entry.profile?.full_name || '—'),
            escapeCell(entry.project?.name || entry.category?.name || '—'),
            escapeCell(entry.task?.name || entry.lot?.custom_name || 'Général'),
            escapeCell(entry.notes || '—'),
            escapeCell(formatDuration(entry.duration_minutes || 0)),
        ]);

        const csvContent = [
            headers.map(h => `"${h}"`).join(','),
            ...rows.map(row => row.join(','))
        ].join('\r\n'); // \r\n for Windows Excel compatibility

        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `feuilles-de-temps_${format(date, 'yyyy-MM-dd')}_${view}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const formatDuration = (rawSeconds: number) => {
        const t = Math.round(rawSeconds);
        if (t <= 0) return '0h 0min 0s';
        const h = Math.floor(t / 3600);
        const m = Math.floor((t % 3600) / 60);
        const s = t % 60;
        return `${h}h ${m}min ${s}s`;
    };

    const totalMinutes = entries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
    const uniqueUsers = new Set(entries.map(e => e.user_id)).size;
    const uniqueProjects = new Set(entries.map(e => e.project_id).filter(Boolean)).size;

    const periodLabel = view === 'daily'
        ? format(date, 'EEEE d MMMM yyyy', { locale: fr })
        : view === 'weekly'
            ? `${format(startOfWeek(date, { weekStartsOn: 1 }), 'd MMM', { locale: fr })} – ${format(endOfWeek(date, { weekStartsOn: 1 }), 'd MMM yyyy', { locale: fr })}`
            : format(date, 'MMMM yyyy', { locale: fr });

    return (
        <div className="min-h-screen bg-[#f4f5f7] dark:bg-slate-950">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center">
                            <Clock className="w-4 h-4 text-blue-500" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800 dark:text-white">Feuilles de temps</h1>
                            <p className="text-[11px] text-slate-400 font-medium">Rapports de temps détaillés de toute l'équipe</p>
                        </div>
                    </div>

                    <button
                        onClick={handleExportCSV}
                        disabled={entries.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-full transition-all shadow-sm hover:border-blue-300 hover:text-blue-500 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Export CSV
                    </button>
                </div>

                {/* ── KPI Strip ── */}
                <div className="grid grid-cols-3 gap-4">
                    {[
                        {
                            label: 'Temps Total',
                            value: formatDuration(totalMinutes),
                            icon: <Timer className="w-4 h-4 text-blue-500" />,
                            bg: 'bg-blue-50 dark:bg-blue-900/20',
                        },
                        {
                            label: 'Collaborateurs',
                            value: uniqueUsers,
                            icon: <Users className="w-4 h-4 text-indigo-500" />,
                            bg: 'bg-indigo-50 dark:bg-indigo-900/20',
                        },
                        {
                            label: 'Projets',
                            value: uniqueProjects,
                            icon: <Briefcase className="w-4 h-4 text-cyan-500" />,
                            bg: 'bg-cyan-50 dark:bg-cyan-900/20',
                        },
                    ].map((kpi, i) => (
                        <div key={i} className="bg-white dark:bg-slate-800 border-0 shadow-sm rounded-2xl p-5 flex items-center gap-4">
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", kpi.bg)}>
                                {kpi.icon}
                            </div>
                            <div>
                                <p className="text-2xl font-black text-slate-800 dark:text-white leading-none">{kpi.value}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{kpi.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex flex-col lg:flex-row gap-5">

                    {/* ── Sidebar filters ── */}
                    <aside className="w-full lg:w-64 shrink-0 space-y-4">
                        <div className="bg-white dark:bg-slate-800 border-0 shadow-sm rounded-2xl p-5">
                            <div className="flex items-center gap-2 mb-5">
                                <Filter className="w-3.5 h-3.5 text-blue-500" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filtres</span>
                            </div>

                            <div className="space-y-5">
                                {/* Period */}
                                <div className="space-y-2">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Période</p>
                                    <div className="flex flex-col gap-1.5">
                                        {(['daily', 'weekly', 'monthly'] as ViewType[]).map((v) => (
                                            <button
                                                key={v}
                                                onClick={() => setView(v)}
                                                className={cn(
                                                    "flex items-center h-9 px-3 rounded-xl text-xs font-bold transition-all text-left",
                                                    view === v
                                                        ? "bg-blue-500 text-white shadow-md shadow-blue-200 dark:shadow-blue-900/30"
                                                        : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                                                )}
                                            >
                                                {v === 'daily' ? 'Journalier' : v === 'weekly' ? 'Hebdomadaire' : 'Mensuel'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Project filter */}
                                <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-700">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Projet</p>
                                    <Select value={filterProject} onValueChange={setFilterProject}>
                                        <SelectTrigger className="h-9 bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 rounded-xl text-xs font-bold focus:ring-blue-300">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-slate-100 dark:border-slate-700 shadow-lg">
                                            <SelectItem value="all" className="text-xs font-medium">Tous les projets</SelectItem>
                                            {projects.map(p => (
                                                <SelectItem key={p.id} value={p.id} className="text-xs font-medium">{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* User filter */}
                                {(profile?.role === 'admin' || profile?.role === 'chef_de_projet') && (
                                    <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-700">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Équipe</p>
                                        <Select value={filterUser} onValueChange={setFilterUser}>
                                            <SelectTrigger className="h-9 bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 rounded-xl text-xs font-bold focus:ring-blue-300">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl border-slate-100 dark:border-slate-700 shadow-lg">
                                                <SelectItem value="all" className="text-xs font-medium">Toute l'équipe</SelectItem>
                                                {profiles.map(p => (
                                                    <SelectItem key={p.id} value={p.id} className="text-xs font-medium">{p.full_name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                        </div>
                    </aside>

                    {/* ── Main table card ── */}
                    <section className="flex-1 min-w-0">
                        <div className="bg-white dark:bg-slate-800 border-0 shadow-sm rounded-2xl overflow-hidden">

                            {/* Period navigator */}
                            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => moveDate('prev')}
                                        className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-500 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50 transition-all"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>

                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                                            <CalendarDays className="w-4 h-4 text-blue-500" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Période sélectionnée</p>
                                            <p className="text-xs font-black text-slate-800 dark:text-white capitalize">{periodLabel}</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => moveDate('next')}
                                        className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-500 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50 transition-all"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>

                                <button
                                    onClick={() => setDate(new Date())}
                                    className="flex items-center gap-1.5 h-8 px-3 rounded-full border border-dashed border-slate-300 dark:border-slate-600 text-[10px] font-bold text-slate-500 hover:border-blue-400 hover:text-blue-500 transition-all"
                                >
                                    Aujourd'hui
                                </button>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto">
                                {loading ? (
                                    <div className="flex flex-col items-center justify-center py-24 gap-3">
                                        <div className="animate-spin rounded-xl h-10 w-10 border-b-2 border-blue-500 shadow-lg shadow-blue-500/20" />
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chargement...</p>
                                    </div>
                                ) : entries.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                                            <Clock className="w-7 h-7 text-blue-300" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-bold text-slate-700 dark:text-white mb-1">Aucune entrée</p>
                                            <p className="text-xs text-slate-400">Rien n'a été tracké sur cette période.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="border-slate-100 dark:border-slate-700 hover:bg-transparent">
                                                <TableHead className="py-3.5 px-5 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/80 dark:bg-slate-900/50">Date</TableHead>
                                                <TableHead className="py-3.5 px-5 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/80 dark:bg-slate-900/50">Collaborateur</TableHead>
                                                <TableHead className="py-3.5 px-5 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/80 dark:bg-slate-900/50">Projet / Tâche</TableHead>
                                                <TableHead className="py-3.5 px-5 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/80 dark:bg-slate-900/50">Notes</TableHead>
                                                <TableHead className="py-3.5 px-5 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/80 dark:bg-slate-900/50 text-right">Durée</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {entries.map((entry) => (
                                                <TableRow
                                                    key={entry.id}
                                                    className="group border-slate-100 dark:border-slate-700/60 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors"
                                                >
                                                    {/* Date */}
                                                    <TableCell className="py-4 px-5">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-black text-slate-800 dark:text-white leading-none">
                                                                {format(new Date(entry.start_time), 'dd')}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                                                                {format(new Date(entry.start_time), 'MMM', { locale: fr })}
                                                            </span>
                                                        </div>
                                                    </TableCell>

                                                    {/* Collaborator */}
                                                    <TableCell className="py-4 px-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 flex items-center justify-center text-[10px] font-black text-blue-600 shrink-0 group-hover:bg-blue-500 group-hover:text-white group-hover:border-blue-500 transition-all">
                                                                {entry.profile?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                                            </div>
                                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                                                                {entry.profile?.full_name}
                                                            </span>
                                                        </div>
                                                    </TableCell>

                                                    {/* Project / Task */}
                                                    <TableCell className="py-4 px-5">
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="flex items-center gap-2">
                                                                {entry.project?.color && (
                                                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.project.color }} />
                                                                )}
                                                                <span className="text-xs font-bold text-slate-800 dark:text-white truncate max-w-[150px]">
                                                                    {entry.project?.name || entry.category?.name}
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] font-semibold text-slate-400 truncate max-w-[150px] pl-4">
                                                                {entry.task?.name || entry.lot?.custom_name || 'Général'}
                                                            </span>
                                                        </div>
                                                    </TableCell>

                                                    {/* Notes */}
                                                    <TableCell className="py-4 px-5">
                                                        <span className="text-[11px] text-slate-400 font-medium italic line-clamp-2 max-w-[200px]">
                                                            {entry.notes ? `"${entry.notes}"` : '—'}
                                                        </span>
                                                    </TableCell>

                                                    {/* Duration */}
                                                    <TableCell className="py-4 px-5 text-right">
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-black text-xs border border-blue-100 dark:border-blue-900/30">
                                                            <Clock className="w-3 h-3" />
                                                            {formatDuration(entry.duration_minutes)}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </div>

                            {/* Footer total */}
                            {entries.length > 0 && (
                                <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        {entries.length} entrée{entries.length !== 1 ? 's' : ''}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
                                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500 text-white font-black text-xs shadow-md shadow-blue-200 dark:shadow-blue-900/30">
                                            <Clock className="w-3 h-3" />
                                            {formatDuration(totalMinutes)}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
    return <label className={cn("text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block", className)}>{children}</label>;
}