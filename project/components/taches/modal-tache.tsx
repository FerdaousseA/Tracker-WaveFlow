'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import type { Task, Project, ProjectLot, TaskStatus } from '@/types';

interface ModalTacheProps {
    task: Task | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onTacheEnregistree: () => void;
    initialProjectId?: string;
}

export function ModalTache({ task, open, onOpenChange, onTacheEnregistree, initialProjectId }: ModalTacheProps) {
    const [nom, setNom] = useState('');
    const [description, setDescription] = useState('');
    const [estimatedHours, setEstimatedHours] = useState<string>('0');
    const [status, setStatus] = useState<TaskStatus>('todo');
    const [projectId, setProjectId] = useState<string>(initialProjectId || '');
    const [lotId, setLotId] = useState<string>('');

    const [projects, setProjects] = useState<Project[]>([]);
    const [lots, setLots] = useState<ProjectLot[]>([]);
    const [planningTasks, setPlanningTasks] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const { profile } = useAuth();
    const { toast } = useToast();

    useEffect(() => {
        if (open) {
            fetchProjects();
            if (task) {
                setNom(task.name);
                setDescription(task.description || '');
                setEstimatedHours((task.estimated_hours || 0).toString());
                setStatus(task.status);
                setLotId(task.lot_id);
                // Find project_id for this lot
                fetchTaskProject(task.lot_id);
            } else {
                setNom('');
                setDescription('');
                setEstimatedHours('0');
                setStatus('todo');
                setLotId('');
                if (initialProjectId) {
                    setProjectId(initialProjectId);
                }
            }
        }
    }, [open, task, initialProjectId]);

    useEffect(() => {
        if (projectId) {
            fetchLots(projectId);
            fetchPlanningTasks(projectId);
        } else {
            setLots([]);
            setPlanningTasks([]);
        }
    }, [projectId]);

    const fetchProjects = async () => {
        // Fetch only projects user is member of
        const { data } = await supabase
            .from('projects')
            .select(`
                *,
                project_members!inner(user_id)
            `)
            .eq('project_members.user_id', profile?.id)
            .order('name');
        setProjects(data || []);
    };

    const fetchLots = async (pid: string) => {
        const { data } = await supabase
            .from('project_lots')
            .select('*')
            .eq('project_id', pid)
            .order('order_index');
        setLots(data || []);
        if (data && data.length > 0 && !lotId) {
            // Don't auto-set lotId if we are editing an existing task
        }
    };

    const fetchTaskProject = async (lid: string) => {
        const { data } = await supabase
            .from('project_lots')
            .select('project_id')
            .eq('id', lid)
            .single();
        if (data) setProjectId(data.project_id);
    };

    const fetchPlanningTasks = async (pid: string) => {
        try {
            // 1. Find sheet
            const { data: sheet } = await supabase
                .from('planning_sheets')
                .select('id')
                .eq('project_id', pid)
                .single();

            if (!sheet) return;

            // 2. Find column named 'Tâches'
            const { data: column } = await supabase
                .from('planning_columns')
                .select('id')
                .eq('sheet_id', sheet.id)
                .eq('name', 'Tâches')
                .single();

            if (!column) return;

            // 3. Get values
            const { data: cells } = await supabase
                .from('planning_cells')
                .select('value_text')
                .eq('column_id', column.id);

            if (cells) {
                setPlanningTasks(cells.map(c => c.value_text).filter(Boolean));
            }
        } catch (error) {
            console.error('Error fetching planning tasks:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!nom.trim() || !lotId) {
            toast({ title: "Erreur", description: "Le nom et le lot sont requis", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            const taskData = {
                name: nom.trim(),
                description: description.trim(),
                estimated_hours: parseFloat(estimatedHours) || 0,
                status,
                lot_id: lotId,
            };

            if (task) {
                const { error } = await supabase
                    .from('tasks')
                    .update(taskData)
                    .eq('id', task.id);
                if (error) throw error;
                toast({ title: "Tâche mise à jour" });
            } else {
                const { error } = await supabase
                    .from('tasks')
                    .insert([taskData]);
                if (error) throw error;
                toast({ title: "Tâche créée" });
            }

            onOpenChange(false);
            onTacheEnregistree();
        } catch (error: any) {
            console.error('Erreur enregistrement tâche:', error);
            toast({
                title: "Erreur",
                description: error.message || "Impossible d'enregistrer la tâche",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{task ? 'Modifier la tâche' : 'Nouvelle tâche'}</DialogTitle>
                    <DialogDescription>
                        Remplissez les détails de la tâche pour votre projet.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="task-name">Nom de la tâche *</Label>
                        <div className="relative">
                            <Input
                                id="task-name"
                                placeholder="Ex: Design du header"
                                value={nom}
                                onChange={(e) => setNom(e.target.value)}
                                disabled={loading}
                                required
                                list="planning-suggestions"
                            />
                            <datalist id="planning-suggestions">
                                {planningTasks.map((t, i) => (
                                    <option key={i} value={t} />
                                ))}
                            </datalist>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="task-project">Projet</Label>
                            <Select value={projectId} onValueChange={setProjectId} disabled={loading}>
                                <SelectTrigger id="task-project">
                                    <SelectValue placeholder="Choisir un projet" />
                                </SelectTrigger>
                                <SelectContent>
                                    {projects.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="task-lot">Lot *</Label>
                            <Select value={lotId} onValueChange={setLotId} disabled={loading || !projectId}>
                                <SelectTrigger id="task-lot">
                                    <SelectValue placeholder="Choisir un lot" />
                                </SelectTrigger>
                                <SelectContent>
                                    {lots.map((l) => (
                                        <SelectItem key={l.id} value={l.id}>{l.custom_name || 'Général'}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="task-hours">Heures estimées</Label>
                            <Input
                                id="task-hours"
                                type="number"
                                step="0.5"
                                value={estimatedHours}
                                onChange={(e) => setEstimatedHours(e.target.value)}
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="task-status">Statut</Label>
                            <Select value={status} onValueChange={(v: any) => setStatus(v)} disabled={loading}>
                                <SelectTrigger id="task-status">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todo">À faire</SelectItem>
                                    <SelectItem value="in_progress">En cours</SelectItem>
                                    <SelectItem value="done">Terminé</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="task-desc">Description</Label>
                        <Textarea
                            id="task-desc"
                            placeholder="Détails de la tâche..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={loading}
                            rows={3}
                        />
                    </div>

                    <DialogFooter className="pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            Annuler
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? 'Enregistrement...' : task ? 'Mettre à jour' : 'Créer la tâche'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
