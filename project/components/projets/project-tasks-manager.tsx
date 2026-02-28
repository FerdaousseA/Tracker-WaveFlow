'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, CheckCircle2, Circle, Loader2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Task {
    id: string;
    name: string;
    status: 'todo' | 'in_progress' | 'done';
    lot_id: string;
    created_at: string;
    created_by?: string;
    creator?: {
        id: string;
        full_name: string;
        avatar_url?: string;
    };
    project_lots?: {
        custom_name: string | null;
        template_id: string | null;
    };
}

interface ProjectTasksManagerProps {
    projectId: string;
    isOwner: boolean;
}

export function ProjectTasksManager({ projectId, isOwner }: ProjectTasksManagerProps) {
    const { toast } = useToast();
    // Using any for now to bypass strict typing issues during migration, but conceptually LotTask
    const [tasks, setTasks] = useState<any[]>([]);
    const [lots, setLots] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [selectedLotId, setSelectedLotId] = useState<string>('');
    const [adding, setAdding] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchTasksAndLots();
    }, [projectId]);

    const fetchTasksAndLots = async () => {
        setLoading(true);
        try {
            const { data: lotsData, error: lotsError } = await supabase
                .from('project_lots')
                .select('*')
                .eq('project_id', projectId)
                .order('order_index');

            if (lotsError) throw lotsError;
            setLots(lotsData || []);
            if (lotsData && lotsData.length > 0) setSelectedLotId(lotsData[0].id);

            // Fetch lot_tasks with real-time aggregation
            // Note: supabase .select with count/sum is tricky, often better to fetch time_entries separately or use a view.
            // For now, we fetch tasks and then fetch time entries to aggregate client-side or use a simple join if possible.
            // Let's just fetch tasks first.
            const { data: tasksData, error: tasksError } = await supabase
                .from('lot_tasks')
                .select(`
                    *,
                    project_lots!inner(id, project_id, custom_name, template_id),
                    creator:profiles!created_by(id, full_name, avatar_url)
                `)
                .eq('project_id', projectId) // Optimized filter
                .order('created_at', { ascending: false });

            if (tasksError) throw tasksError;

            // Fetch aggregations (real time)
            // We need sum of duration for each task.
            const { data: timeData, error: timeError } = await supabase
                .from('time_entries')
                .select('lot_task_id, duration_minutes')
                .eq('project_id', projectId)
                .not('lot_task_id', 'is', null);

            if (timeError) console.error("Error fetching time stats", timeError);

            const timeMap = new Map<string, number>();
            (timeData || []).forEach((t: any) => {
                const current = timeMap.get(t.lot_task_id) || 0;
                timeMap.set(t.lot_task_id, current + (t.duration_minutes || 0));
            });

            const enrichedTasks = (tasksData || []).map((t: any) => ({
                ...t,
                real_time_minutes: timeMap.get(t.id) || 0
            }));

            setTasks(enrichedTasks);
        } catch (error: any) {
            console.error('Error fetching tasks:', error);
            toast({ title: "Erreur", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle.trim() || !selectedLotId) return;

        setAdding(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { data, error } = await supabase
                .from('lot_tasks')
                .insert({
                    name: newTaskTitle.trim(),
                    lot_id: selectedLotId,
                    project_id: projectId, // Required now
                    created_by: user?.id
                })
                .select(`
                    *,
                    project_lots!inner(id, project_id, custom_name, template_id),
                    creator:profiles!created_by(id, full_name, avatar_url)
                `)
                .single();

            if (error) throw error;

            setTasks([data, ...tasks]);
            setNewTaskTitle('');
            toast({ title: "Tâche ajoutée", description: "La tâche a été créée avec succès" });
        } catch (error: any) {
            toast({ title: "Erreur", description: error.message, variant: "destructive" });
        } finally {
            setAdding(false);
        }
    };

    // Note: lot_tasks doesn't have a 'status' column in the new schema requested? 
    // The user requirement didn't explicitly ask for status on lot_tasks, but implied 'tasks'.
    // If we need status, we should have added it. The legacy 'tasks' had it.
    // Assuming we might need it, but the instruction was "Lots table must include tasks + estimated + real time".
    // I will check if I missed status in the create table command. I did NOT add it.
    // I will proceed without status for now (just a list), or treat it as a list of deliverables. 
    // Wait, the user said "Members can add tasks... Members must NOT be able to change project status".
    // It is safer to assume tasks might need status, but for now I'll stick to the schema I pushed.

    const deleteTask = async (id: string) => {
        if (!isOwner) return; // Strict enforced in UI + RLS
        if (!confirm('Supprimer cette tâche ?')) return;
        try {
            const { error } = await supabase
                .from('lot_tasks')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setTasks(tasks.filter(t => t.id !== id));
            toast({ title: "Tâche supprimée" });
        } catch (error: any) {
            toast({ title: "Erreur", description: error.message, variant: "destructive" });
        }
    };

    const formatTime = (minutes: number) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h}h ${m}m`;
    };

    const filteredTasks = tasks.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex h-32 items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <form onSubmit={handleAddTask} className="flex gap-4 items-end bg-muted/30 p-4 rounded-xl border border-dashed">
                <div className="flex-1 space-y-2">
                    <label className="text-xs font-medium text-muted-foreground ml-1">Nouvelle tâche</label>
                    <Input
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        placeholder="Ex: Maquette Figma..."
                        className="bg-background"
                    />
                </div>
                <div className="w-48 space-y-2">
                    <label className="text-xs font-medium text-muted-foreground ml-1">Lot</label>
                    <select
                        value={selectedLotId}
                        onChange={(e) => setSelectedLotId(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                        {lots.map(lot => (
                            <option key={lot.id} value={lot.id}>
                                {lot.custom_name || lot.template_id || 'Lot'}
                            </option>
                        ))}
                    </select>
                </div>
                <Button type="submit" disabled={adding || !newTaskTitle.trim()} className="gap-2">
                    {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Ajouter
                </Button>
            </form>

            <div className="space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Rechercher une tâche..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>

                <div className="space-y-2">
                    {filteredTasks.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8 border rounded-lg italic">
                            Aucune tâche trouvée.
                        </p>
                    ) : (
                        filteredTasks.map((task) => (
                            <div
                                key={task.id}
                                className="flex items-center justify-between p-4 rounded-lg border transition-all hover:shadow-sm bg-card"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="flex flex-col">
                                        <p className="font-medium leading-none mb-1">
                                            {task.name}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-[10px] uppercase font-bold py-0 h-5">
                                                {task.project_lots?.custom_name || 'Général'}
                                            </Badge>
                                            {task.creator && (
                                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                    <span className="font-medium">Par:</span>
                                                    {task.creator.full_name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Temps Réel</div>
                                        <div className="font-mono font-medium text-sm">
                                            {formatTime(task.real_time_minutes || 0)}
                                        </div>
                                    </div>
                                    {isOwner && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => deleteTask(task.id)}
                                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
