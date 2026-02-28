'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Search, X, Shield, User } from 'lucide-react';
import type { ProjectMember, Profile } from '@/types';

interface ProjectMembersManagerProps {
    projectId: string;
    isOwner: boolean;
}

interface MemberWithProfile extends ProjectMember {
    profiles: Profile;
}

interface TeamMember {
    id: string;
    email: string;
    full_name: string | null;
    user_id: string | null;
    status: string;
}

export function ProjectMembersManager({ projectId, isOwner }: ProjectMembersManagerProps) {
    const { profile } = useAuth();
    const [members, setMembers] = useState<MemberWithProfile[]>([]);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        fetchMembers();
        if (isOwner) fetchTeamMembers();
    }, [projectId, profile?.id, isOwner]);

    const fetchMembers = async () => {
        try {
            const { data, error } = await supabase
                .from('project_members')
                .select(`
                    *,
                    profiles:user_id (
                        id,
                        full_name,
                        avatar_url,
                        email,
                        role
                    )
                `)
                .eq('project_id', projectId);
            if (error) throw error;
            setMembers(data || []);
        } catch (error) {
            console.error('Erreur chargement membres:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchTeamMembers = async () => {
        if (!profile?.id) return;
        try {
            // ✅ On joint profiles pour pouvoir filtrer les admins
            const { data, error } = await supabase
                .from('team_members')
                .select(`
                    id, email, full_name, user_id, status,
                    profiles:user_id (role)
                `)
                .eq('status', 'active');
            if (error) throw error;

            // ✅ Exclure les admins — ils ont accès en lecture à tout sans être membres
            const nonAdmins = (data || []).filter((tm: any) => tm.profiles?.role !== 'admin');
            setTeamMembers(nonAdmins);
        } catch (error) {
            console.error('Erreur chargement équipe:', error);
        }
    };

    const getProjectName = async (): Promise<string> => {
        try {
            const { data } = await supabase.from('projects').select('name').eq('id', projectId).single();
            return data?.name || 'le projet';
        } catch { return 'le projet'; }
    };

    const handleToggleMember = async (teamMember: TeamMember, checked: boolean) => {
        if (!teamMember.user_id) {
            toast({ title: "Erreur", description: "Ce membre n'a pas encore de compte. Demandez-lui de s'inscrire.", variant: "destructive" });
            return;
        }
        setSaving(true);
        try {
            if (checked) {
                const { error } = await supabase
                    .from('project_members')
                    .insert({ project_id: projectId, user_id: teamMember.user_id, role_in_project: 'member' });
                if (error) throw error;

                const projectName = await getProjectName();

                // ✅ Notifier le membre ajouté
                await supabase.from('notifications').insert({
                    user_id: teamMember.user_id,
                    type: 'success',
                    title: '✅ Ajout au projet',
                    message: `Vous avez été ajouté au projet "${projectName}" par ${profile?.full_name || 'un administrateur'}.`,
                    link: `/projets/${projectId}`
                });

                // ✅ Notifier les autres membres existants
                const { data: existingMembers } = await supabase
                    .from('project_members')
                    .select('user_id')
                    .eq('project_id', projectId)
                    .neq('user_id', teamMember.user_id)
                    .neq('user_id', profile?.id || '');

                if (existingMembers && existingMembers.length > 0) {
                    await supabase.from('notifications').insert(
                        existingMembers.map(m => ({
                            user_id: m.user_id,
                            type: 'info',
                            title: '👤 Nouveau membre',
                            message: `${teamMember.full_name || teamMember.email} a rejoint le projet "${projectName}".`,
                            link: `/projets/${projectId}`
                        }))
                    );
                }

                toast({ title: "Membre ajouté", description: `${teamMember.full_name || teamMember.email} a été ajouté` });
            } else {
                const pm = members.find(m => m.user_id === teamMember.user_id);
                if (pm) {
                    const { error } = await supabase
                        .from('project_members')
                        .delete()
                        .eq('id', pm.id);
                    if (error) throw error;

                    const projectName = await getProjectName();

                    // ✅ Notifier le membre retiré
                    await supabase.from('notifications').insert({
                        user_id: teamMember.user_id,
                        type: 'warning',
                        title: '⚠️ Retrait du projet',
                        message: `Vous avez été retiré du projet "${projectName}".`,
                        link: `/projets`
                    });

                    toast({ title: "Membre retiré", description: `${teamMember.full_name || teamMember.email} n'est plus membre du projet` });
                }
            }
            await fetchMembers();
            if (isOwner) await fetchTeamMembers();
        } catch (e: any) {
            toast({ title: "Erreur", description: e.message || "Action impossible", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveMember = async (memberId: string, userId: string, fullName: string) => {
        if (!confirm(`Retirer ${fullName} du projet ?`)) return;
        try {
            const { error } = await supabase
                .from('project_members')
                .delete()
                .eq('id', memberId);
            if (error) throw error;

            const projectName = await getProjectName();

            // ✅ Notifier le membre retiré
            await supabase.from('notifications').insert({
                user_id: userId,
                type: 'warning',
                title: '⚠️ Retrait du projet',
                message: `Vous avez été retiré du projet "${projectName}".`,
                link: `/projets`
            });

            toast({ title: "Membre retiré", description: `${fullName} n'est plus membre du projet` });
            fetchMembers();
        } catch (e: any) {
            toast({ title: "Erreur", description: "Impossible de retirer le membre", variant: "destructive" });
        }
    };

    const isInProject = (userId: string) => members.some(m => m.user_id === userId);
    const selectableTeam = teamMembers.filter(t => t.user_id);
    const filteredTeam = searchQuery.trim()
        ? selectableTeam.filter(t =>
            (t.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.email || '').toLowerCase().includes(searchQuery.toLowerCase())
        )
        : selectableTeam;

    return (
        <div className="space-y-6">
            {/* ✅ Section ajout — uniquement pour owner */}
            {isOwner && (
                <div className="space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">Sélectionner depuis l&apos;équipe</p>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Rechercher par nom ou email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                        {filteredTeam.length === 0 ? (
                            <p className="p-4 text-sm text-muted-foreground text-center">
                                {selectableTeam.length === 0 ? "Aucun membre dans votre équipe. Ajoutez-en depuis la page Équipe." : "Aucun résultat."}
                            </p>
                        ) : (
                            filteredTeam.map((tm) => {
                                const checked = isInProject(tm.user_id!);
                                return (
                                    <div key={tm.id} className="flex items-center justify-between p-3 hover:bg-muted/50">
                                        <div className="flex items-center gap-3">
                                            <Checkbox
                                                id={tm.id}
                                                checked={checked}
                                                onCheckedChange={(c) => handleToggleMember(tm, !!c)}
                                                disabled={saving}
                                            />
                                            <label htmlFor={tm.id} className="cursor-pointer flex items-center gap-2">
                                                <span className="text-sm font-medium">{tm.full_name || tm.email}</span>
                                                <span className="text-xs text-muted-foreground">{tm.email}</span>
                                            </label>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* ✅ Liste visible pour TOUS les rôles */}
            <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Membres du projet</p>
                {loading ? (
                    <div className="space-y-2">
                        {[1, 2].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}
                    </div>
                ) : members.length === 0 ? (
                    <p className="text-sm text-center text-muted-foreground py-4">Aucun membre</p>
                ) : (
                    <div className="divide-y border rounded-lg overflow-hidden">
                        {members.map((member) => {
                            const displayName = member.profiles?.full_name || 'Membre';
                            const avatarUrl = member.profiles?.avatar_url;
                            // ✅ Ne pas afficher les admins dans la liste des membres du projet
                            if (member.profiles?.role === 'admin') return null;
                            return (
                                <div key={member.id} className="flex items-center justify-between p-3 bg-card hover:bg-accent/5 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={avatarUrl} />
                                            <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-sm font-medium">{displayName}</p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                {member.role_in_project === 'owner' ? (
                                                    <Badge variant="secondary" className="h-5 text-[10px] gap-1 px-1.5 bg-primary/10 text-primary border-primary/20">
                                                        <Shield className="w-3 h-3" />Propriétaire
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="h-5 text-[10px] gap-1 px-1.5">
                                                        <User className="w-3 h-3" />Membre
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {/* ✅ Bouton supprimer — uniquement pour owner, pas sur les owners */}
                                    {isOwner && member.role_in_project !== 'owner' && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleRemoveMember(member.id, member.user_id!, displayName)}
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}