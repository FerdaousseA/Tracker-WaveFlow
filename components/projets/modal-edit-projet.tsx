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
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2 } from 'lucide-react';
import type { Project, Client, Profile, ProjectLot } from '@/types';

interface ModalEditProjetProps {
    project: Project | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onProjetMisAJour: () => void;
}

const COULEURS_PRESET = [
    '#06B6D4',
    '#8B5CF6',
    '#EC4899',
    '#F59E0B',
    '#10B981',
    '#EF4444',
    '#6366F1',
    '#14B8A6',
];

export function ModalEditProjet({ project, open, onOpenChange, onProjetMisAJour }: ModalEditProjetProps) {
    const [nom, setNom] = useState('');
    const [clientId, setClientId] = useState<string>('none');
    const [status, setStatus] = useState<Project['status']>('active');
    const [couleur, setCouleur] = useState(COULEURS_PRESET[0]);
    const [deadline, setDeadline] = useState('');
    const [assignedUsers, setAssignedUsers] = useState<string[]>([]);

    const [clients, setClients] = useState<Partial<Client>[]>([]);
    const [profiles, setProfiles] = useState<Partial<Profile>[]>([]);
    const [lots, setLots] = useState<ProjectLot[]>([]);
    const [newLotName, setNewLotName] = useState('');
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (open && project) {
            setNom(project.name);
            setClientId(project.client_id || 'none');
            setStatus(project.status);
            setCouleur(project.color);
            setDeadline(project.deadline || '');
            setAssignedUsers(project.assigned_users || []);
            fetchClients();
            fetchProfiles();
            fetchLots();
        }
    }, [open, project]);

    const fetchLots = async () => {
        if (!project) return;
        const { data } = await supabase
            .from('project_lots')
            .select('*')
            .eq('project_id', project.id)
            .order('order_index');
        setLots(data || []);
    };

    const handleAddLot = async () => {
        if (!newLotName.trim() || !project) return;
        try {
            const { error } = await supabase
                .from('project_lots')
                .insert({
                    project_id: project.id,
                    custom_name: newLotName.trim(),
                    order_index: lots.length
                });
            if (error) throw error;
            setNewLotName('');
            fetchLots();
        } catch (error: any) {
            toast({ title: "Erreur", description: error.message, variant: "destructive" });
        }
    };

    const handleDeleteLot = async (id: string) => {
        try {
            const { error } = await supabase
                .from('project_lots')
                .delete()
                .eq('id', id);
            if (error) throw error;
            fetchLots();
        } catch (error: any) {
            toast({ title: "Erreur", description: "Impossible de supprimer le lot (il contient peut-être des tâches)", variant: "destructive" });
        }
    };

    const fetchClients = async () => {
        const { data } = await supabase.from('clients').select('id, name').order('name');
        setClients(data || []);
    };

    const fetchProfiles = async () => {
        const { data } = await supabase.from('profiles').select('*').order('full_name');
        setProfiles(data || []);
    };

    const handleUserToggle = (userId: string) => {
        setAssignedUsers(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!project) return;

        if (!nom.trim()) {
            toast({ title: "Erreur", description: "Le nom du projet est requis", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase
                .from('projects')
                .update({
                    name: nom.trim(),
                    client_id: clientId === 'none' ? null : clientId,
                    status,
                    color: couleur,
                    deadline: deadline || null,
                    assigned_users: assignedUsers,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', project.id);

            if (error) throw error;

            toast({
                title: "Projet mis à jour",
                description: `Le projet "${nom}" a été mis à jour avec succès`,
            });

            onOpenChange(false);
            onProjetMisAJour();
        } catch (error: any) {
            console.error('Erreur mise à jour projet:', error);
            toast({
                title: "Erreur",
                description: error.message || "Impossible de mettre à jour le projet",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Modifier le projet</DialogTitle>
                    <DialogDescription>
                        Modifiez les informations et les accès du projet
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-nom">Nom du projet *</Label>
                            <Input
                                id="edit-nom"
                                value={nom}
                                onChange={(e) => setNom(e.target.value)}
                                disabled={loading}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-status">Statut</Label>
                            <Select value={status} onValueChange={(v: any) => setStatus(v)} disabled={loading}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Actif</SelectItem>
                                    <SelectItem value="paused">En pause</SelectItem>
                                    <SelectItem value="completed">Terminé</SelectItem>
                                    <SelectItem value="archived">Archivé</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit-deadline">Date d'échéance (optionnel)</Label>
                        <Input
                            id="edit-deadline"
                            type="date"
                            value={deadline}
                            onChange={(e) => setDeadline(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Couleur du projet</Label>
                        <div className="flex gap-2 flex-wrap">
                            {COULEURS_PRESET.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setCouleur(c)}
                                    disabled={loading}
                                    className="w-8 h-8 rounded-full border-2 transition-all hover:scale-110"
                                    style={{
                                        backgroundColor: c,
                                        borderColor: couleur === c ? 'black' : 'transparent',
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    <DialogFooter>
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
                            {loading ? 'Mise à jour...' : 'Enregistrer les modifications'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
