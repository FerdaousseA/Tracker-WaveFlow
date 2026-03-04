'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    CheckSquare,
    Search,
    CheckCircle2,
    Circle,
    LayoutGrid,
    List as ListIcon,
    Timer,
    AlertCircle,
    ChevronDown,
    Award
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked';

interface LotTaskWithContext {
    id: string;
    name: string;
    status?: TaskStatus;
    estimated_minutes?: number;
    real_time_minutes?: number;
    created_by?: string;
    lot_id: string;
    project_id: string;
    created_at: string;
    lot?: { custom_name?: string };
    project?: { id: string; name: string; color: string };
    creator?: { full_name: string; avatar_url: string; };
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string; border: string; dot: string; icon: React.ReactNode }> = {
    todo: {
        label: 'À faire',
        color: 'text-slate-500',
        bg: 'bg-slate-50',
        border: 'border-slate-200',
        dot: 'bg-slate-300',
        icon: <Circle className="w-3.5 h-3.5" />,
    },
    in_progress: {
        label: 'En cours',
        color: 'text-blue-500',
        bg: 'bg-blue-50',
        border: 'border-blue-100',
        dot: 'bg-blue-400',
        icon: <Timer className="w-3.5 h-3.5" />,
    },
    done: {
        label: 'Terminé',
        color: 'text-green-500',
        bg: 'bg-green-50',
        border: 'border-green-100',
        dot: 'bg-green-400',
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    blocked: {
        label: 'Bloqué',
        color: 'text-red-400',
        bg: 'bg-red-50',
        border: 'border-red-100',
        dot: 'bg-red-400',
        icon: <AlertCircle className="w-3.5 h-3.5" />,
    },
};

export default function TachesPage() {
    const { profile } = useAuth();
    const { toast } = useToast();
    const [tasks, setTasks] = useState<LotTaskWithContext[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

    useEffect(() => {
        if (profile) fetchTasks();
    }, [profile]);

    const fetchTasks = async () => {
        try {
            setLoading(true);
            let query = supabase
                .from('lot_tasks')
                .select(`*, lot:project_lots(custom_name), project:projects(id, name, color), creator:profiles!created_by(full_name, avatar_url)`)
                .order('created_at', { ascending: false });

            if (profile?.role === 'member') {
                query = query.eq('created_by', profile.id);
            }

            const { data, error } = await query;
            if (error) throw error;
            setTasks(data || []);
        } catch (error) {
            console.error('Erreur chargement tâches:', error);
            toast({ title: "Erreur", description: "Impossible de charger les tâches.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (taskId: string, newStatus: TaskStatus) => {
        if (profile?.role === 'admin') return;
        try {
            const { error } = await supabase.from('lot_tasks').update({ status: newStatus }).eq('id', taskId);
            if (error) throw error;
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

            if (newStatus === 'done' && profile?.id) {
                // Award 5 points
                const { data: profileData } = await supabase.from('profiles').select('points').eq('id', profile.id).single();
                const currentPoints = profileData?.points || 0;

                await supabase.from('profiles').update({ points: currentPoints + 5 }).eq('id', profile.id);

                toast({
                    title: "Statut mis à jour",
                    description: `Tâche marquée : ${STATUS_CONFIG[newStatus].label}. Vous avez gagné +5 pts ! ⭐`
                });

                // Add notification
                await supabase.from('notifications').insert({
                    user_id: profile.id,
                    type: 'success',
                    title: '🎉 +5 Points gagnés !',
                    message: `Félicitations, vous avez gagné 5 points pour avoir terminé la tâche.`,
                    link: '/classement'
                });
            } else {
                toast({ title: "Statut mis à jour", description: `Tâche marquée : ${STATUS_CONFIG[newStatus].label}` });
            }

        } catch (error: any) {
            toast({ title: "Erreur", description: error.message, variant: "destructive" });
        }
    };

    const handleToggleDone = async (task: LotTaskWithContext) => {
        if (profile?.role === 'admin') return;
        const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';
        await handleUpdateStatus(task.id, newStatus);
    };

    const getStatus = (task: LotTaskWithContext): TaskStatus => (task.status as TaskStatus) || 'todo';

    const filteredTasks = tasks.filter(task => {
        const matchesSearch =
            task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (task.project?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const statusCounts = {
        all: tasks.length,
        todo: tasks.filter(t => getStatus(t) === 'todo').length,
        in_progress: tasks.filter(t => getStatus(t) === 'in_progress').length,
        done: tasks.filter(t => getStatus(t) === 'done').length,
        blocked: tasks.filter(t => getStatus(t) === 'blocked').length,
    };

    const completionRate = tasks.length > 0 ? Math.round((statusCounts.done / tasks.length) * 100) : 0;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {profile?.role === 'member' ? 'Mes Tâches' : 'Toutes les Tâches'}
                    </h1>
                    <p className="text-sm text-gray-400 mt-0.5">
                        {filteredTasks.length} tâche{filteredTasks.length !== 1 ? 's' : ''} affichée{filteredTasks.length !== 1 ? 's' : ''}
                    </p>
                </div>

                {/* Progress pill */}
                {tasks.length > 0 && (
                    <div className="flex items-center gap-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl px-4 py-2.5 shadow-sm">
                        <div className="relative w-8 h-8">
                            <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                                <circle cx="16" cy="16" r="12" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
                                <circle
                                    cx="16" cy="16" r="12" fill="none"
                                    stroke="#22c55e" strokeWidth="3.5"
                                    strokeDasharray={`${2 * Math.PI * 12}`}
                                    strokeDashoffset={`${2 * Math.PI * 12 * (1 - completionRate / 100)}`}
                                    strokeLinecap="round"
                                    className="transition-all duration-700"
                                />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-gray-600">{completionRate}%</span>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{statusCounts.done} / {tasks.length}</p>
                            <p className="text-[10px] text-gray-400">terminées</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Status filters */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                {(['all', 'todo', 'in_progress', 'done', 'blocked'] as const).map((s) => {
                    const isActive = statusFilter === s;
                    const cfg = s === 'all' ? null : STATUS_CONFIG[s];
                    return (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap border",
                                isActive
                                    ? "bg-blue-500 text-white border-blue-500 shadow-sm shadow-blue-100"
                                    : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-500 hover:border-blue-200 hover:text-blue-500"
                            )}
                        >
                            {cfg && (
                                <span className={isActive ? 'text-white' : cfg.color}>
                                    {cfg.icon}
                                </span>
                            )}
                            {s === 'all' ? 'Toutes' : cfg!.label}
                            <span className={cn(
                                "text-xs px-1.5 py-0.5 rounded-md font-bold",
                                isActive ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                            )}>
                                {statusCounts[s]}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Search + view */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        placeholder="Rechercher une tâche ou un projet..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-sm focus-visible:ring-blue-200"
                    />
                </div>
                <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl shrink-0">
                    <button
                        onClick={() => setViewMode('list')}
                        className={cn("h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all",
                            viewMode === 'list' ? "bg-white shadow-sm text-blue-500" : "text-gray-400 hover:text-gray-600")}
                    >
                        <ListIcon className="w-3.5 h-3.5" /> Liste
                    </button>
                    <button
                        onClick={() => setViewMode('grid')}
                        className={cn("h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all",
                            viewMode === 'grid' ? "bg-white shadow-sm text-blue-500" : "text-gray-400 hover:text-gray-600")}
                    >
                        <LayoutGrid className="w-3.5 h-3.5" /> Grille
                    </button>
                </div>
            </div>

            {/* Tasks */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
                    ))}
                </div>
            ) : filteredTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                        <CheckSquare className="w-8 h-8 text-gray-300" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-700 mb-1">Aucune tâche trouvée</h3>
                    <p className="text-sm text-gray-400 max-w-xs">Modifiez vos filtres ou votre recherche pour voir d'autres résultats.</p>
                </div>
            ) : (
                <div className={cn(
                    viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 gap-3" : "space-y-2.5"
                )}>
                    {filteredTasks.map((task) => {
                        const status = getStatus(task);
                        const cfg = STATUS_CONFIG[status];
                        const canEdit = profile?.role !== 'admin';

                        return (
                            <div
                                key={task.id}
                                className={cn(
                                    "group relative bg-white dark:bg-gray-900 rounded-2xl border transition-all duration-200 hover:shadow-md overflow-hidden",
                                    status === 'done'
                                        ? "border-gray-100 opacity-70"
                                        : "border-gray-100 dark:border-gray-800 hover:border-blue-100"
                                )}
                            >
                                {/* Top accent bar based on project color */}
                                <div
                                    className="absolute top-0 left-5 right-5 h-0.5 rounded-b-full opacity-60 group-hover:opacity-100 transition-opacity"
                                    style={{ backgroundColor: task.project?.color || '#94a3b8' }}
                                />

                                <div className="flex items-center gap-4 px-5 py-4">
                                    {/* Toggle button */}
                                    {canEdit ? (
                                        <button
                                            onClick={() => handleToggleDone(task)}
                                            className={cn(
                                                "shrink-0 transition-all duration-200",
                                                "hover:scale-110 active:scale-90 cursor-pointer",
                                                status === 'done' ? "text-green-400" : "text-gray-200 hover:text-blue-400"
                                            )}
                                        >
                                            {status === 'done'
                                                ? <CheckCircle2 className="w-5 h-5" />
                                                : <Circle className="w-5 h-5" />
                                            }
                                        </button>
                                    ) : (
                                        <div className="shrink-0 w-5 h-5" />
                                    )}

                                    {/* Task info */}
                                    <div className="flex-1 min-w-0">
                                        <p className={cn(
                                            "text-sm font-semibold truncate",
                                            status === 'done'
                                                ? "line-through text-gray-300"
                                                : "text-gray-800 dark:text-white"
                                        )}>
                                            {task.name}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            {task.project && (
                                                <span className="flex items-center gap-1">
                                                    <span
                                                        className="w-2 h-2 rounded-full shrink-0"
                                                        style={{ backgroundColor: task.project.color || '#94a3b8' }}
                                                    />
                                                    <span className="text-xs text-gray-400 font-medium">{task.project.name}</span>
                                                </span>
                                            )}
                                            {task.lot?.custom_name && (
                                                <>
                                                    <span className="text-gray-200 dark:text-gray-700 text-xs">·</span>
                                                    <span className="text-xs text-gray-300 font-medium">{task.lot.custom_name}</span>
                                                </>
                                            )}
                                            {task.creator?.full_name && (
                                                <span className="flex items-center gap-1.5 ml-1">
                                                    <span className="text-gray-200 dark:text-gray-700 text-xs">·</span>
                                                    <Avatar className="w-4 h-4 rounded-full">
                                                        <AvatarImage src={task.creator.avatar_url || ''} alt={task.creator.full_name} className="object-cover" />
                                                        <AvatarFallback className="bg-primary/10 text-primary text-[8px] font-black uppercase">
                                                            {task.creator.full_name.charAt(0)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-xs text-gray-400 font-medium">{task.creator.full_name}</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Status badge / dropdown */}
                                    {canEdit ? (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button className={cn(
                                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shrink-0",
                                                    cfg.bg, cfg.border, cfg.color
                                                )}>
                                                    {cfg.icon}
                                                    <span className="hidden sm:inline">{cfg.label}</span>
                                                    <ChevronDown className="w-3 h-3 opacity-60" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="rounded-xl border-gray-100 dark:border-gray-800 p-1.5 min-w-[160px] shadow-xl">
                                                {(Object.entries(STATUS_CONFIG) as [TaskStatus, typeof STATUS_CONFIG[TaskStatus]][]).map(([key, val]) => (
                                                    <DropdownMenuItem
                                                        key={key}
                                                        onClick={() => handleUpdateStatus(task.id, key)}
                                                        className={cn(
                                                            "rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer py-2",
                                                            val.color
                                                        )}
                                                    >
                                                        {val.icon}
                                                        {val.label}
                                                        {status === key && <CheckCircle2 className="w-3 h-3 ml-auto" />}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    ) : (
                                        <div className={cn(
                                            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold shrink-0",
                                            cfg.bg, cfg.border, cfg.color
                                        )}>
                                            {cfg.icon}
                                            <span className="hidden sm:inline">{cfg.label}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}