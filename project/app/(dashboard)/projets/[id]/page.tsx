'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Plus, Trash2, Clock, Briefcase, BarChart, Users, FileSpreadsheet, Settings, ChevronDown, ChevronRight, Crown, Beaker } from 'lucide-react';
import type { Project, ProjectLot, LotTemplate } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ProjectMembersManager } from '@/components/projets/project-members-manager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProjectWithClient extends Project {
    clients?: { name: string } | null;
    real_time_minutes?: number;
}

interface ProjectMemberDisplay {
    id: string;
    full_name: string;
    avatar_url?: string;
    role_in_project: 'owner' | 'member';
    email?: string;
}

const formatMinutes = (minutes: number) => {
    if (!minutes || minutes === 0) return '—';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h === 0) return `${m}min`;
    return `${h}h ${m.toString().padStart(2, '0')}min`;
};

const formatSeconds = (seconds: number) => {
    const t = Math.round(seconds);
    if (t <= 0) return '—';
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    if (h === 0 && m === 0) return `${s}s`;
    if (h === 0) return `${m}min ${s.toString().padStart(2, '0')}s`;
    return `${h}h ${m.toString().padStart(2, '0')}min ${s.toString().padStart(2, '0')}s`;
};

// ── Convertit des heures en label "semaines" (base 40h) ──
const formatWeeks = (hours: number): string => {
    const weeks = hours / 40;
    if (weeks < 0.1) return '< 0.1 sem.';
    const rounded = Math.round(weeks * 10) / 10;
    return `≈ ${rounded} sem.${rounded >= 2 ? 's' : ''}`;
};

const PASTEL_COLORS = [
    'bg-rose-100/80 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200',
    'bg-emerald-100/80 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200',
    'bg-amber-100/80 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200',
    'bg-sky-100/80 dark:bg-sky-900/30 text-sky-800 dark:text-sky-200',
    'bg-purple-100/80 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200'
];

const EMOJIS = ['💡', '👀', '✨', '🐛', '🎯', '🚀', '📌', '🤔'];

async function notifyProjectMembers({ projectId, senderId, type, title, message, link }: {
    projectId: string; senderId: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string; message: string; link?: string;
}) {
    try {
        const { data: members } = await supabase.from('project_members').select('user_id').eq('project_id', projectId).neq('user_id', senderId);
        if (!members || members.length === 0) return;
        await supabase.from('notifications').insert(members.map((m) => ({ user_id: m.user_id, type, title, message, link: link || `/projets/${projectId}` })));
    } catch (e) { console.error('Erreur notification:', e); }
}

function LotNameInput({ initialValue, disabled, onChange }: { initialValue: string; disabled: boolean; onChange: (value: string) => void; }) {
    const [localValue, setLocalValue] = useState(initialValue);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    useEffect(() => { setLocalValue(initialValue); }, [initialValue]);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLocalValue(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { onChange(val); }, 1500);
    };
    return (
        <Input value={localValue} disabled={disabled} onChange={handleChange}
            className="bg-transparent border-none p-0 h-auto text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight focus-visible:ring-0 focus-visible:bg-slate-100/50 rounded-lg px-2 -ml-2" />
    );
}

function EstimationInput({ taskId, currentMinutes, disabled, onChange }: {
    taskId: string; currentMinutes: number; disabled: boolean;
    onChange: (taskId: string, totalMinutes: number) => void;
}) {
    const h = Math.floor(currentMinutes / 60);
    const m = currentMinutes % 60;
    return (
        <div className="flex items-center gap-1">
            <Input type="number" min="0" disabled={disabled} value={h}
                onChange={(e) => { const newH = Math.max(0, parseInt(e.target.value) || 0); onChange(taskId, newH * 60 + m); }}
                className="w-12 h-8 text-center font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-xs p-0" />
            <span className="text-[9px] font-black text-slate-400">h</span>
            <Input type="number" min="0" max="59" disabled={disabled} value={m}
                onChange={(e) => { const newM = Math.min(59, Math.max(0, parseInt(e.target.value) || 0)); onChange(taskId, h * 60 + newM); }}
                className="w-12 h-8 text-center font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-xs p-0" />
            <span className="text-[9px] font-black text-slate-400">min</span>
        </div>
    );
}

export default function ProjetDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { profile } = useAuth();
    const { toast } = useToast();

    const [projet, setProjet] = useState<ProjectWithClient | null>(null);
    const [userRole, setUserRole] = useState<'owner' | 'member' | null>(null);
    const [lots, setLots] = useState<any[]>([]);
    const [lotTasksByLot, setLotTasksByLot] = useState<Record<string, any[]>>({});
    const [timerSessions, setTimerSessions] = useState<any[]>([]);
    const [templates, setTemplates] = useState<LotTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [pendingUpdates, setPendingUpdates] = useState<Map<string, { name?: string }>>(new Map());
    const [plannings, setPlannings] = useState<any[]>([]);
    const [excelImports, setExcelImports] = useState<any[]>([]);
    const [expandedLots, setExpandedLots] = useState<Set<string>>(new Set());
    const [pendingTaskEstimate, setPendingTaskEstimate] = useState<Map<string, number>>(new Map());
    const [addingLot, setAddingLot] = useState(false);
    const [projectMembers, setProjectMembers] = useState<ProjectMemberDisplay[]>([]);
    const [projectCreator, setProjectCreator] = useState<any>(null);
    const [memberMap, setMemberMap] = useState<Record<string, string>>({});
    const [tests, setTests] = useState<any[]>([]);
    const [remarksByTest, setRemarksByTest] = useState<Record<string, any[]>>({});
    const [loadingTests, setLoadingTests] = useState(false);
    const [newTestTitle, setNewTestTitle] = useState('');
    const [newTestDesc, setNewTestDesc] = useState('');
    const [newRemarkByTest, setNewRemarkByTest] = useState<Record<string, string>>({});

    const isAdminUser = profile?.role === 'admin';

    const chargerDonnees = async () => {
        try {
            const { data: projetData, error: projetError } = await supabase
                .from('projects')
                .select(`*, clients(name), project_members(role_in_project, user_id, profiles(id, full_name, avatar_url, role))`)
                .eq('id', params.id).single();
            if (projetError) throw projetError;
            setProjet(projetData);

            const membership = projetData.project_members?.find((m: any) => m.user_id === profile?.id);
            if (membership) setUserRole(membership.role_in_project);
            else if (profile?.role === 'chef_de_projet') setUserRole('owner');
            else setUserRole(null);

            const members = (projetData.project_members || [])
                .filter((pm: any) => pm.profiles?.role !== 'admin')
                .map((pm: any) => ({ id: pm.user_id, full_name: pm.profiles?.full_name || '', avatar_url: pm.profiles?.avatar_url, role_in_project: pm.role_in_project || 'member' }));
            setProjectMembers(members);

            const map: Record<string, string> = {};
            members.forEach((m: any) => { map[m.id] = m.full_name; });
            setMemberMap(map);

            try {
                const { data: teamData } = await supabase.from('team_members').select('user_id, full_name').eq('owner_id', projetData.created_by);
                if (teamData) teamData.forEach(tm => { if (tm.user_id && tm.full_name) setMemberMap(prev => ({ ...prev, [tm.user_id!]: tm.full_name! })); });
            } catch (e) { console.error('Erreur fallback team_members:', e); }

            if (projetData.created_by) {
                const { data: creatorData } = await supabase.from('profiles').select('id, full_name, avatar_url, email, role').eq('id', projetData.created_by).maybeSingle();
                if (creatorData && creatorData.role !== 'admin') {
                    setProjectCreator(creatorData);
                    setMemberMap(prev => ({ ...prev, [creatorData.id]: creatorData.full_name }));
                } else {
                    setProjectCreator(null);
                }
            }

            const { data: lotsData } = await supabase.from('project_lots').select('*').eq('project_id', params.id).order('order_index');
            const { data: tasksData } = await supabase.from('lot_tasks').select(`*, creator:profiles!created_by(id, full_name, avatar_url)`).eq('project_id', params.id);
            const { data: taskTimeData } = await supabase.from('time_entries').select('lot_task_id, duration_minutes').eq('project_id', params.id).not('lot_task_id', 'is', null).not('duration_minutes', 'is', null);

            const taskTimeMap = new Map<string, number>();
            (taskTimeData || []).forEach((t: any) => { taskTimeMap.set(t.lot_task_id, (taskTimeMap.get(t.lot_task_id) || 0) + (t.duration_minutes || 0)); });

            const tasksWithTime = (tasksData || []).map((t: any) => ({ ...t, real_time_seconds: taskTimeMap.get(t.id) || 0 }));
            const byLot: Record<string, any[]> = {};
            tasksWithTime.forEach((t: any) => { if (!byLot[t.lot_id]) byLot[t.lot_id] = []; byLot[t.lot_id].push(t); });
            setLotTasksByLot(byLot);

            const enrichedLots = (lotsData || []).map((lot: any) => {
                const lotTasks = tasksWithTime.filter((t: any) => t.lot_id === lot.id);
                return { ...lot, computed_estimated_minutes: lotTasks.reduce((s: number, t: any) => s + (t.estimated_minutes || 0), 0), computed_real_seconds: lotTasks.reduce((s: number, t: any) => s + (t.real_time_seconds || 0), 0) };
            });
            setLots(enrichedLots);

            const { data: plData } = await supabase.from('planning_sheets').select('*').eq('project_id', params.id).order('created_at', { ascending: false });
            setPlannings(plData || []);
            const { data: impData } = await supabase.from('excel_imports').select('*').eq('project_id', params.id).order('created_at', { ascending: false });
            setExcelImports(impData || []);
            const { data: templatesData } = await supabase.from('lot_templates').select('*').eq('is_default', true).order('order_index');
            setTemplates(templatesData || []);
            const { data: sessions } = await supabase.from('project_timer_sessions').select('*').eq('project_id', params.id).order('started_at', { ascending: false });
            setTimerSessions(sessions || []);
        } catch (error) {
            console.error(error);
            toast({ title: "Erreur", description: "Impossible de charger le projet", variant: "destructive" });
        } finally { setLoading(false); }
    };

    const chargerTests = async () => {
        setLoadingTests(true);
        try {
            const { data: testsData } = await supabase.from('project_tests').select('*, creator:profiles!created_by(id, full_name, avatar_url)').eq('project_id', params.id).order('created_at', { ascending: false });
            setTests(testsData || []);
            if (testsData && testsData.length > 0) {
                const { data: remarksData } = await supabase.from('test_remarks').select('*, creator:profiles!created_by(id, full_name, avatar_url)').in('test_id', testsData.map((t: any) => t.id)).order('created_at', { ascending: true });
                const rByTest: Record<string, any[]> = {};
                (remarksData || []).forEach((r: any) => { if (!rByTest[r.test_id]) rByTest[r.test_id] = []; rByTest[r.test_id].push(r); });
                setRemarksByTest(rByTest);
            }
        } catch (e) { console.error(e); } finally { setLoadingTests(false); }
    };

    useEffect(() => { if (params.id && profile?.id) { chargerDonnees(); chargerTests(); } }, [params.id, profile?.id]);

    const debouncedUpdate = useCallback((lotId: string, data: { name?: string }) => {
        setPendingUpdates(prev => { const m = new Map(prev); m.set(lotId, { ...(m.get(lotId) || {}), ...data }); return m; });
    }, []);

    useEffect(() => {
        if (pendingUpdates.size === 0) return;
        const timer = setTimeout(async () => {
            for (const [lotId, updateData] of Array.from(pendingUpdates.entries())) {
                try { const d: any = {}; if (updateData.name !== undefined) d.custom_name = updateData.name; await supabase.from('project_lots').update(d).eq('id', lotId); } catch { }
            }
            toast({ title: "Modifications enregistrées" });
            setPendingUpdates(new Map());
            chargerDonnees();
        }, 2000);
        return () => clearTimeout(timer);
    }, [pendingUpdates]);

    const canManageTests = !isAdminUser && userRole === 'owner';

    const ajouterTest = async () => {
        if (!newTestTitle.trim() || !canManageTests) return;
        try {
            await supabase.from('project_tests').insert({ project_id: params.id, title: newTestTitle.trim(), description: newTestDesc.trim(), created_by: profile?.id });
            setNewTestTitle(''); setNewTestDesc(''); chargerTests(); toast({ title: "Test créé avec succès" });
        } catch (e: any) { toast({ title: "Erreur", description: e.message, variant: "destructive" }); }
    };

    const modifierStatutTest = async (testId: string, status: string) => {
        if (!canManageTests) return;
        try { await supabase.from('project_tests').update({ status }).eq('id', testId); chargerTests(); toast({ title: "Statut mis à jour" }); } catch (e) { }
    };

    const ajouterRemarque = async (testId: string) => {
        if (!canManageTests) return;
        const content = newRemarkByTest[testId];
        if (!content?.trim()) return;
        try {
            await supabase.from('test_remarks').insert({ test_id: testId, content: content.trim(), created_by: profile?.id });
            setNewRemarkByTest(prev => ({ ...prev, [testId]: '' })); chargerTests(); toast({ title: "Remarque ajoutée" });
        } catch (e) { }
    };

    const supprimerRemarque = async (remarkId: string) => {
        if (!canManageTests || !confirm("Supprimer cette remarque ?")) return;
        try { await supabase.from('test_remarks').delete().eq('id', remarkId); chargerTests(); toast({ title: "Remarque supprimée" }); } catch (e) { }
    };

    const supprimerLot = async (lotId: string) => {
        if (!confirm('Supprimer ce lot ?')) return;
        try { await supabase.from('project_lots').delete().eq('id', lotId); toast({ title: "Lot supprimé" }); chargerDonnees(); } catch (e: any) { toast({ title: "Erreur", description: e.message, variant: "destructive" }); }
    };

    const getLotName = (lot: ProjectLot) => {
        if (lot.custom_name) return lot.custom_name;
        return templates.find(t => t.id === (lot as any).template_id)?.name || 'Lot sans nom';
    };

    const ajouterLotPersonnalise = async () => {
        setAddingLot(true);
        try { await supabase.from('project_lots').insert({ project_id: params.id, template_id: null, custom_name: 'Nouveau lot', estimated_hours: 0, actual_hours: 0, order_index: lots.length }); toast({ title: "Lot créé" }); await chargerDonnees(); }
        catch (e: any) { toast({ title: "Erreur", description: e.message, variant: "destructive" }); } finally { setAddingLot(false); }
    };

    const ajouterTache = async (lotId: string, nom: string) => {
        if (!nom.trim()) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            await supabase.from('lot_tasks').insert({ lot_id: lotId, project_id: params.id, name: nom.trim(), created_by: user?.id });
            toast({ title: "Tâche ajoutée" });
            if (profile?.id && projet?.name) await notifyProjectMembers({ projectId: params.id as string, senderId: profile.id, type: 'info', title: '🗂 Nouvelle Tâche', message: `"${nom.trim()}" a été ajoutée dans le projet "${projet.name}" par ${profile.full_name || 'un membre'}.`, link: `/projets/${params.id}` });
            chargerDonnees();
        } catch (e: any) { toast({ title: "Erreur", description: e.message, variant: "destructive" }); }
    };

    const updateTaskEstimated = useCallback((taskId: string, minutes: number) => {
        setPendingTaskEstimate(prev => { const n = new Map(prev); n.set(taskId, minutes); return n; });
    }, []);

    useEffect(() => {
        if (pendingTaskEstimate.size === 0) return;
        const timer = setTimeout(async () => {
            for (const [taskId, minutes] of Array.from(pendingTaskEstimate.entries())) {
                try {
                    const { data: taskData } = await supabase.from('lot_tasks').select('name, real_time_minutes, estimated_minutes').eq('id', taskId).maybeSingle();
                    await supabase.from('lot_tasks').update({ estimated_minutes: minutes }).eq('id', taskId);
                    if (taskData && profile?.id && projet?.name && minutes > 0 && (taskData.real_time_minutes || 0) > minutes) {
                        await notifyProjectMembers({ projectId: params.id as string, senderId: profile.id, type: 'warning', title: '⚠️ Dépassement de temps', message: `La tâche "${taskData.name}" du projet "${projet.name}" a dépassé le temps estimé (${minutes}min).`, link: `/projets/${params.id}` });
                    }
                } catch { }
            }
            setPendingTaskEstimate(new Map());
            chargerDonnees();
        }, 1500);
        return () => clearTimeout(timer);
    }, [pendingTaskEstimate]);

    const updateProjectStatus = async (newStatus: string) => {
        if (userRole !== 'owner') return;
        try {
            await supabase.from('projects').update({ status: newStatus }).eq('id', params.id);
            setProjet(prev => prev ? { ...prev, status: newStatus as any } : null);
            toast({ title: "Statut mis à jour" });
            if (profile?.id && projet?.name) {
                const statusLabel = newStatus === 'active' ? 'En production' : newStatus === 'paused' ? 'En pause' : newStatus === 'completed' ? 'Terminé' : 'Archivé';
                await notifyProjectMembers({ projectId: params.id as string, senderId: profile.id, type: 'info', title: '📋 Statut Projet Modifié', message: `Le projet "${projet.name}" est maintenant "${statusLabel}".`, link: `/projets/${params.id}` });
            }
        } catch (e: any) { toast({ title: "Erreur", description: e.message, variant: "destructive" }); }
    };

    if (loading) return <div className="flex h-[50vh] items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

    if (!projet || (profile?.role !== 'admin' && profile?.role !== 'chef_de_projet' && !userRole)) {
        return (
            <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
                <p className="text-muted-foreground">Projet introuvable ou accès refusé</p>
                <Button onClick={() => router.push('/projets')} variant="outline">Retour aux projets</Button>
            </div>
        );
    }

    const totalEstimatedMinutes = lots.reduce((s, l) => s + (l.computed_estimated_minutes || 0), 0);
    const totalRealSeconds = lots.reduce((s, l) => s + (l.computed_real_seconds || 0), 0);
    const totalEstimatedSeconds = totalEstimatedMinutes * 60;
    const progressPercent = totalEstimatedSeconds > 0 ? Math.min(Math.round((totalRealSeconds / totalEstimatedSeconds) * 100), 100) : 0;
    const canCreateLot = !isAdminUser && (userRole === 'owner' || userRole === 'member');
    const canEditEstimation = !isAdminUser && (userRole === 'owner' || userRole === 'member');

    const allProjectMembers = [
        ...(projectCreator ? [{ id: projectCreator.id, full_name: projectCreator.full_name, isCreator: true }] : []),
        ...projectMembers.filter(m => m.id !== projectCreator?.id).map(m => ({ id: m.id, full_name: m.full_name, isCreator: false })),
    ];

    return (
        <div className="space-y-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col gap-6">
                <Button onClick={() => router.push('/projets')} variant="ghost" className="w-fit -ml-2 text-slate-400 hover:text-primary text-[10px] font-black uppercase tracking-widest gap-2">
                    <ArrowLeft className="w-4 h-4" />Retour aux projets
                </Button>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-3xl shadow-2xl flex items-center justify-center transform -rotate-3" style={{ backgroundColor: projet.color }}>
                            <Briefcase className="w-10 h-10 text-white/50" />
                        </div>
                        <div className="space-y-1">
                            <h1 className="section-title text-4xl">{projet.name}</h1>
                            <div className="flex items-center gap-4 flex-wrap">
                                {(projet.clients?.name || (projet as any).client_name) && (
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <Users className="w-4 h-4" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">{projet.clients?.name || (projet as any).client_name}</span>
                                    </div>
                                )}
                                <Badge className={cn("capitalize font-black text-[9px] px-3 py-1 rounded-full uppercase tracking-widest border-2",
                                    projet.status === 'active' ? "bg-primary/10 text-primary border-primary/20" :
                                        projet.status === 'paused' ? "bg-orange-100 text-orange-600 border-orange-200" :
                                            projet.status === 'completed' ? "bg-green-100 text-green-600 border-green-200" :
                                                "bg-slate-100 text-slate-600 border-slate-200")}>
                                    {projet.status === 'active' ? 'En production' : projet.status === 'paused' ? 'En pause' : projet.status === 'completed' ? 'Terminé' : 'Archivé'}
                                </Badge>
                                {projet.deadline && (
                                    <div className="flex items-center gap-2 text-slate-400 px-3 py-1 bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
                                        <Clock className="w-3.5 h-3.5 text-blue-500" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                                            Échéance : {new Date(projet.deadline).toLocaleDateString('fr-FR')}
                                        </span>
                                    </div>
                                )}
                                {userRole === 'owner' && !isAdminUser && (
                                    <Select value={projet.status} onValueChange={updateProjectStatus}>
                                        <SelectTrigger className="w-[160px] h-9 bg-slate-50 dark:bg-slate-800 border-none shadow-sm rounded-xl text-[10px] font-black uppercase tracking-widest">
                                            <SelectValue placeholder="Status" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="active" className="text-[10px] font-black uppercase tracking-widest">Production</SelectItem>
                                            <SelectItem value="paused" className="text-[10px] font-black uppercase tracking-widest">Mettre en pause</SelectItem>
                                            <SelectItem value="completed" className="text-[10px] font-black uppercase tracking-widest">Terminer</SelectItem>
                                            <SelectItem value="archived" className="text-[10px] font-black uppercase tracking-widest">Archiver</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {allProjectMembers.length > 0 && (
                    <div className="flex items-center gap-4 flex-wrap p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0">Équipe :</span>
                        {projectCreator && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20">
                                <Crown className="w-3 h-3 text-primary" />
                                <span className="text-[10px] font-black text-primary uppercase tracking-tight">{projectCreator.full_name}</span>
                            </div>
                        )}
                        {projectMembers.map((member) => (
                            <div key={member.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-black text-slate-500">
                                    {member.full_name?.charAt(0)?.toUpperCase() || ''}
                                </div>
                                <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">{member.full_name}</span>
                                {member.role_in_project === 'owner' && <Crown className="w-3 h-3 text-amber-500" />}
                            </div>
                        ))}
                    </div>
                )}

                <div className="h-px bg-gradient-to-r from-slate-200 via-slate-100 to-transparent dark:from-slate-800 dark:via-slate-900" />

                {/* ── KPI Cards ── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                    {/* Temps Estimé */}
                    <div className="premium-card p-8 flex flex-col gap-1 border-b-4 border-b-blue-500 shadow-xl overflow-hidden relative">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Temps Estimé</span>
                            <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20"><Clock className="h-5 w-5 text-blue-500" /></div>
                        </div>
                        <div className="text-4xl font-black text-slate-900 dark:text-white mt-4 tracking-tighter">
                            {totalEstimatedMinutes > 0 ? formatMinutes(totalEstimatedMinutes) : <span className="text-slate-300">—</span>}
                        </div>
                        {totalEstimatedMinutes > 0 && (
                            <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 w-fit border border-blue-100 dark:border-blue-800/40">
                                <span className="text-[11px] font-black text-blue-500 tabular-nums">
                                    {formatWeeks(totalEstimatedMinutes / 60)}
                                </span>
                                <span className="text-[9px] font-bold text-blue-300">· base 40h</span>
                            </div>
                        )}
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-2">{lots.length} LOTS DÉFINIS</p>
                        <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-blue-500/5 blur-3xl rounded-full" />
                    </div>

                    {/* Temps Réel */}
                    <div className="premium-card p-8 flex flex-col gap-1 border-b-4 border-b-primary shadow-xl overflow-hidden relative">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Temps Réel</span>
                            <div className="p-3 rounded-2xl bg-primary/10"><Clock className="h-5 w-5 text-primary" /></div>
                        </div>
                        <div className="text-4xl font-black text-primary mt-4 tracking-tighter">
                            {totalRealSeconds > 0 ? formatSeconds(totalRealSeconds) : <span className="text-primary/30">—</span>}
                        </div>
                        {totalRealSeconds > 0 && (
                            <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 w-fit border border-primary/10">
                                <span className="text-[11px] font-black text-primary tabular-nums">
                                    {formatWeeks(totalRealSeconds / 3600)}
                                </span>
                                <span className="text-[9px] font-bold text-primary/40">· base 40h</span>
                            </div>
                        )}
                        <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest mt-2">ACCUMULÉ SUR {timerSessions.length} SESSION{timerSessions.length !== 1 ? 'S' : ''}</p>
                        <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-primary/5 blur-3xl rounded-full" />
                    </div>

                    {/* Rentabilité — inchangée */}
                    <div className="premium-card p-8 flex flex-col gap-1 border-b-4 border-b-green-500 shadow-xl overflow-hidden relative">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Rentabilité</span>
                            <div className="p-3 rounded-2xl bg-green-50 dark:bg-green-900/20"><BarChart className="h-5 w-5 text-green-500" /></div>
                        </div>
                        <div className="text-4xl font-black text-slate-900 dark:text-white mt-4 tracking-tighter">
                            {progressPercent}<span className="text-xl text-slate-300 ml-1">%</span>
                        </div>
                        <div className="mt-4 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full", progressPercent > 100 ? "bg-red-500" : "bg-gradient-to-r from-green-400 to-green-600")} style={{ width: `${Math.min(progressPercent, 100)}%` }} />
                        </div>
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">{totalEstimatedMinutes > 0 ? `${formatMinutes(totalEstimatedMinutes)} estimé` : 'Aucune estimation'}</p>
                        <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-green-500/5 blur-3xl rounded-full" />
                    </div>

                </div>
            </div>

            <Tabs defaultValue="lots" className="space-y-10">
                <div className="border-b border-slate-100 dark:border-slate-800">
                    <TabsList className="bg-transparent h-auto p-0 gap-12 justify-start overflow-x-auto no-scrollbar pb-1">
                        {[
                            { value: 'lots', icon: <BarChart className="w-5 h-5" />, label: 'Structure des Lots' },
                            { value: 'members', icon: <Users className="w-5 h-5" />, label: 'Équipe Projet' },
                            { value: 'planning', icon: <FileSpreadsheet className="w-5 h-5" />, label: 'Planning Opérationnel' },
                            { value: 'tests', icon: <Beaker className="w-5 h-5" />, label: 'Tests' },
                        ].map(tab => (
                            <TabsTrigger key={tab.value} value={tab.value} className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-4 data-[state=active]:border-primary rounded-none h-14 px-0 gap-3 border-b-4 border-transparent text-slate-400 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white font-black uppercase text-[10px] tracking-widest transition-all">
                                <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-xl">{tab.icon}</div>
                                {tab.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                <TabsContent value="lots" className="mt-0">
                    <div className="premium-card bg-white dark:bg-slate-900 border-none shadow-xl overflow-hidden">
                        <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
                            <div className="space-y-1">
                                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Décomposition en Lots</h2>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Structure et avancement opérationnel</p>
                            </div>
                            {canCreateLot && (
                                <Button onClick={ajouterLotPersonnalise} className="premium-button h-10 px-6 text-[10px] font-black uppercase tracking-widest gap-2" variant="outline" disabled={addingLot}>
                                    <Plus className="w-4 h-4" />Nouveau Lot
                                </Button>
                            )}
                        </div>

                        {allProjectMembers.length > 0 && (
                            <div className="px-8 py-4 border-b border-slate-50 dark:border-slate-800 flex items-center gap-3 flex-wrap bg-slate-50/50 dark:bg-slate-800/30">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0">Membres du projet :</span>
                                {allProjectMembers.map((m) => (
                                    <div key={m.id} className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-tight",
                                        m.isCreator ? "bg-primary/10 border-primary/20 text-primary" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300")}>
                                        <div className={cn("w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black", m.isCreator ? "bg-primary text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-500")}>
                                            {m.full_name?.charAt(0)?.toUpperCase() || '?'}
                                        </div>
                                        {m.full_name}
                                        {m.isCreator && <Crown className="w-2.5 h-2.5" />}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="divide-y divide-slate-50 dark:divide-slate-800">
                            {lots.length === 0 ? (
                                <div className="p-20 text-center flex flex-col items-center justify-center">
                                    <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-6 text-slate-300"><BarChart className="w-8 h-8" /></div>
                                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Aucun lot défini</p>
                                </div>
                            ) : lots.map((lot: any) => {
                                const tasks = lotTasksByLot[lot.id] || [];
                                const isExpanded = expandedLots.has(lot.id);
                                const estimatedMinutes = lot.computed_estimated_minutes || 0;
                                const realSeconds = lot.computed_real_seconds || 0;
                                const estSeconds = estimatedMinutes * 60;
                                const progress = estSeconds > 0 ? Math.min(Math.round((realSeconds / estSeconds) * 100), 100) : 0;

                                return (
                                    <div key={lot.id} className="group/lot">
                                        <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                            <div className="flex-1 flex items-center gap-6">
                                                <button onClick={() => setExpandedLots(prev => { const n = new Set(prev); n.has(lot.id) ? n.delete(lot.id) : n.add(lot.id); return n; })}
                                                    className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all", isExpanded ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400")}>
                                                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                                </button>
                                                <div className="flex-1 space-y-2">
                                                    <LotNameInput initialValue={getLotName(lot)} disabled={!canCreateLot} onChange={(val) => debouncedUpdate(lot.id, { name: val })} />
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex-1 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                            <div className={cn("h-full", progress > 100 ? "bg-red-500" : "bg-primary")} style={{ width: `${Math.min(progress, 100)}%` }} />
                                                        </div>
                                                        <span className="text-[10px] font-black text-slate-400 min-w-[30px]">{progress}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-8 md:min-w-[300px] justify-between md:justify-end">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Estimation</span>
                                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                                                        <span className="text-sm font-black text-blue-700 dark:text-blue-300 tracking-tighter">{estimatedMinutes > 0 ? formatMinutes(estimatedMinutes) : '—'}</span>
                                                    </div>
                                                    <span className="text-[8px] font-black text-blue-300 uppercase tracking-widest mt-0.5">∑ tâches</span>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Consommé</span>
                                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                                                        <span className="text-sm font-black text-slate-900 dark:text-white tracking-tighter">{realSeconds > 0 ? formatSeconds(realSeconds) : '—'}</span>
                                                    </div>
                                                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest mt-0.5">∑ tâches</span>
                                                </div>
                                                {userRole === 'owner' && !isAdminUser && (
                                                    <Button onClick={() => supprimerLot(lot.id)} variant="ghost" size="icon" className="w-10 h-10 rounded-xl text-red-400 hover:text-red-500 hover:bg-red-50">
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="bg-slate-50/30 dark:bg-slate-900/30 p-8 pt-4 space-y-6">
                                                <div className="flex items-center justify-between px-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-1 h-4 bg-primary/30 rounded-full" />
                                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Liste des Tâches ({tasks.length})</h4>
                                                    </div>
                                                    {allProjectMembers.length > 0 && (
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Équipe :</span>
                                                            {allProjectMembers.map((m) => (
                                                                <div key={m.id} className={cn("flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tight",
                                                                    m.isCreator ? "bg-primary/10 text-primary" : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500")}>
                                                                    <div className={cn("w-3 h-3 rounded-full flex items-center justify-center text-[7px] font-black", m.isCreator ? "bg-primary text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-500")}>
                                                                        {m.full_name?.charAt(0)?.toUpperCase() || '?'}
                                                                    </div>
                                                                    {m.full_name}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-2">
                                                    {tasks.map((task: any) => {
                                                        const currentEstMin = pendingTaskEstimate.has(task.id) ? pendingTaskEstimate.get(task.id)! : (task.estimated_minutes || 0);
                                                        return (
                                                            <div key={task.id} className={cn(
                                                                "flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl border shadow-sm transition-all",
                                                                task.status === 'done'
                                                                    ? "bg-green-50/50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30"
                                                                    : "bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-700"
                                                            )}>
                                                                <div className="flex-1 flex items-center gap-4">
                                                                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs",
                                                                        task.status === 'done' ? "bg-green-100 dark:bg-green-900/30 text-green-600" : "bg-slate-50 dark:bg-slate-800 text-slate-400")}>
                                                                        {task.name.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        <span className={cn("text-sm font-bold truncate",
                                                                            task.status === 'done' ? "text-slate-400 dark:text-slate-500 line-through" : "text-slate-900 dark:text-white")}>
                                                                            {task.name}
                                                                        </span>
                                                                        {task.status === 'done' && (
                                                                            <span className="shrink-0 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-green-100 text-green-600 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                                                                                Terminé
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-6 justify-between sm:justify-end">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                                                            {(task.creator?.full_name || memberMap[task.created_by] || '-').charAt(0)}
                                                                        </div>
                                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">
                                                                            {task.creator?.full_name || memberMap[task.created_by] || 'Inconnu'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex flex-col items-end gap-1">
                                                                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Estimé</span>
                                                                        <EstimationInput taskId={task.id} currentMinutes={currentEstMin} disabled={!canEditEstimation} onChange={updateTaskEstimated} />
                                                                    </div>
                                                                    <div className="flex flex-col items-end gap-1">
                                                                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Réel</span>
                                                                        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                                            {(task.real_time_seconds || 0) > 0 ? formatSeconds(task.real_time_seconds) : '—'}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {!isAdminUser && (
                                                    <form onSubmit={(e) => { e.preventDefault(); const inp = (e.target as HTMLFormElement).querySelector<HTMLInputElement>('input[name="newTask"]'); if (inp?.value) { ajouterTache(lot.id, inp.value); inp.value = ''; } }} className="flex gap-4">
                                                        <Input name="newTask" placeholder="Ajouter une tâche opérationnelle..." className="h-12 rounded-2xl bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 font-bold px-6" />
                                                        <Button type="submit" className="premium-button h-12 px-8 bg-primary hover:bg-primary/90 text-white font-black uppercase text-[10px] tracking-widest">OK</Button>
                                                    </form>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="members" className="mt-0">
                    <div className="premium-card bg-white dark:bg-slate-900 border-none shadow-xl p-8">
                        <div className="mb-8">
                            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Accès & Collaboration</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Gestion de l&apos;équipe sur ce projet</p>
                        </div>
                        <ProjectMembersManager projectId={params.id as string} isOwner={userRole === 'owner'} />
                    </div>
                </TabsContent>

                <TabsContent value="planning" className="mt-0">
                    <div className="space-y-8">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Gestion du Planning</h2>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Visualisez et accédez à vos plannings opérationnels</p>
                            </div>
                            {!isAdminUser && profile?.role !== 'member' && (
                                <Button onClick={() => router.push('/planning')} className="premium-button h-10 px-6 text-[10px] font-black uppercase tracking-widest gap-2">
                                    <Settings className="w-4 h-4" />Accéder au module complet
                                </Button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {plannings.map((p) => (
                                <button key={p.id} onClick={() => router.push(`/planning?projectId=${params.id}&sheetId=${p.id}`)}
                                    className="premium-card p-6 flex items-start gap-4 hover:scale-[1.02] transition-all bg-white dark:bg-slate-900 border-none shadow-lg text-left group">
                                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-colors">
                                        <FileSpreadsheet className="w-6 h-6 text-primary group-hover:text-white" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-tight">{p.name || 'Planning Initialisé'}</h3>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Créé le {new Date(p.created_at).toLocaleDateString('fr-FR')}</p>
                                        <span className="inline-block text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/10 text-primary">Initialisé</span>
                                    </div>
                                </button>
                            ))}
                            {excelImports.map((imp) => (
                                <button key={imp.id} onClick={() => router.push(`/planning?projectId=${params.id}&importId=${imp.id}`)}
                                    className="premium-card p-6 flex items-start gap-4 hover:scale-[1.02] transition-all bg-white dark:bg-slate-900 border-none shadow-lg text-left group border-l-4 border-l-blue-500">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                                        <FileSpreadsheet className="w-6 h-6 text-blue-500 group-hover:text-white" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-tight">{imp.name || 'Import Excel'}</h3>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Importé le {new Date(imp.created_at).toLocaleDateString('fr-FR')}</p>
                                        <span className="inline-block text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">Importé</span>
                                    </div>
                                </button>
                            ))}
                            {plannings.length === 0 && excelImports.length === 0 && (
                                <div className="col-span-full p-20 text-center flex flex-col items-center justify-center bg-white/50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                                    <FileSpreadsheet className="w-12 h-12 text-slate-300 mb-4" />
                                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Aucun planning pour ce projet</p>
                                    {!isAdminUser && profile?.role !== 'member' && (
                                        <Button variant="link" onClick={() => router.push('/planning')} className="text-primary font-black uppercase tracking-widest text-[9px] mt-2">Initialiser un planning maintenant</Button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="tests" className="mt-0">
                    <div className="premium-card bg-white dark:bg-slate-900 border-none shadow-xl p-8">
                        <div className="flex flex-col mb-8 gap-2">
                            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Tests</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Suivi des cas de tests et remarques associées</p>
                        </div>
                        {canManageTests && (
                            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 mb-8 space-y-4 shadow-sm">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2"><Beaker className="w-4 h-4" />Nouveau Cas de Test</h3>
                                <div className="flex flex-col md:flex-row gap-3">
                                    <Input value={newTestTitle} onChange={e => setNewTestTitle(e.target.value)} placeholder="Titre (ex: Vérification du login)" className="flex-1 font-bold border-none shadow-sm rounded-xl h-11" />
                                    <Input value={newTestDesc} onChange={e => setNewTestDesc(e.target.value)} placeholder="Description optionnelle..." className="flex-1 font-bold border-none shadow-sm rounded-xl h-11 text-sm" />
                                    <Button onClick={ajouterTest} className="premium-button h-11 px-8 text-[10px] font-black uppercase tracking-widest gap-2 bg-primary text-white"><Plus className="w-4 h-4" />Créer</Button>
                                </div>
                            </div>
                        )}
                        <div className="space-y-6">
                            {loadingTests ? <p className="text-center text-sm font-bold text-slate-400">Chargement des tests...</p> : tests.map(test => (
                                <div key={test.id} className="p-6 md:p-8 bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-100 dark:border-slate-800 shadow-sm space-y-6 relative group/test transition-all hover:border-slate-200 dark:hover:border-slate-700">
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                        <div className="space-y-2 flex-1">
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">{test.title}</h3>
                                                <Badge className={cn("text-[9px] uppercase font-black px-3 py-1 shadow-sm rounded-lg border-none",
                                                    test.status === 'passed' ? "bg-emerald-100 text-emerald-700" : test.status === 'failed' ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700")}>
                                                    {test.status === 'passed' ? 'Validé' : test.status === 'failed' ? 'Échoué' : 'En attente'}
                                                </Badge>
                                            </div>
                                            {test.description && <p className="text-xs font-bold text-slate-500">{test.description}</p>}
                                        </div>
                                        {canManageTests && (
                                            <Select value={test.status} onValueChange={(val) => modifierStatutTest(test.id, val)}>
                                                <SelectTrigger className="w-[140px] h-10 bg-slate-50 dark:bg-slate-800 border-none shadow-sm rounded-xl text-[10px] font-black uppercase tracking-widest shrink-0"><SelectValue placeholder="Statut" /></SelectTrigger>
                                                <SelectContent className="rounded-xl border-slate-100 dark:border-slate-800 shadow-xl">
                                                    <SelectItem value="pending" className="text-[10px] font-black uppercase tracking-widest text-amber-600">En attente</SelectItem>
                                                    <SelectItem value="passed" className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Validé</SelectItem>
                                                    <SelectItem value="failed" className="text-[10px] font-black uppercase tracking-widest text-rose-600">Échoué</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </div>
                                    <div className="pt-6 border-t border-slate-50 dark:border-slate-800/50">
                                        <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-4">Remarques associées ({(remarksByTest[test.id] || []).length})</h4>
                                        {canManageTests ? (
                                            <div className="space-y-3">
                                                {(remarksByTest[test.id] || []).map(remark => (
                                                    <div key={remark.id} className="flex items-start justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl group/remark border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors shadow-sm">
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{remark.content}</p>
                                                            <div className="flex items-center gap-2 mt-2 opacity-60">
                                                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{remark.creator?.full_name || 'Inconnu'}</span>
                                                                <span className="text-[9px] font-bold text-slate-400">— {new Date(remark.created_at).toLocaleDateString('fr-FR')}</span>
                                                            </div>
                                                        </div>
                                                        <Button onClick={() => supprimerRemarque(remark.id)} variant="ghost" size="icon" className="opacity-0 group-hover/remark:opacity-100 transition-opacity h-8 w-8 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg shrink-0"><Trash2 className="w-4 h-4" /></Button>
                                                    </div>
                                                ))}
                                                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                                    <Input value={newRemarkByTest[test.id] || ''} onChange={(e) => setNewRemarkByTest(prev => ({ ...prev, [test.id]: e.target.value }))} placeholder="Ajouter une remarque..." className="h-10 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm" />
                                                    <Button onClick={() => ajouterRemarque(test.id)} className="h-10 px-6 text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 rounded-xl shrink-0 shadow-sm">Ajouter</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {(remarksByTest[test.id] || []).map((remark, i) => (
                                                    <div key={remark.id} className={cn("p-5 rounded-2xl shadow-sm transform hover:-translate-y-1 hover:rotate-3 transition-all relative overflow-hidden", PASTEL_COLORS[i % PASTEL_COLORS.length])}>
                                                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-4 bg-white/40 rotate-2 shadow-sm rounded-sm" />
                                                        <p className="text-sm font-black leading-snug mb-6 mt-2"><span className="mr-2 opacity-70">{EMOJIS[i % EMOJIS.length]}</span>{remark.content}</p>
                                                        <div className="flex items-center gap-2 opacity-80 mt-auto">
                                                            <div className="w-5 h-5 rounded-full bg-black/10 flex items-center justify-center text-[10px] font-black">{remark.creator?.full_name?.charAt(0) || '?'}</div>
                                                            <span className="text-[9px] font-black uppercase tracking-widest">{remark.creator?.full_name || 'Équipe'}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {(remarksByTest[test.id] || []).length === 0 && <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Aucune remarque.</p>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {!loadingTests && tests.length === 0 && (
                                <div className="text-center py-16 bg-slate-50/50 dark:bg-slate-800/30 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                                    <Beaker className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                                    <p className="text-sm font-black uppercase tracking-widest text-slate-400">Aucun test défini</p>
                                </div>
                            )}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}