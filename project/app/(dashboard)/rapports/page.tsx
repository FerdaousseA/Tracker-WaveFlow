'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
    FileText, Search, Download, Trash2, Plus, FileDown, Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from '@/lib/utils';
import type { Report, Project } from '@/types';
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ReportWithContext extends Report {
    project: { name: string; color: string; } | null;
    author?: { id: string; full_name: string; avatar_url: string; };
}

export default function RapportsPage() {
    const { profile } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const [reports, setReports] = useState<ReportWithContext[]>([]);
    const [projects, setProjects] = useState<Partial<Project>[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState<string | 'all'>('all');
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [newReportProject, setNewReportProject] = useState('');
    const [newReportContent, setNewReportContent] = useState('');

    const canUploadOrDelete = profile?.role === 'chef_de_projet' || profile?.role === 'member';

    useEffect(() => {
        if (profile) fetchData();
    }, [profile]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const { data: projectsData } = await supabase
                .from('projects').select('id, name, color').order('name');
            setProjects(projectsData || []);

            const { data, error } = await supabase
                .from('reports')
                .select(`*, project:projects (name, color), author:profiles!created_by (id, full_name, avatar_url)`)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setReports(data || []);
        } catch (error) {
            console.error('Erreur chargement rapports:', error);
            toast({ title: "Erreur", description: "Impossible de charger les rapports.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !newReportProject) return;
        try {
            setSaving(true);
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
            const filePath = `${profile?.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('documents').upload(filePath, file, { cacheControl: '3600', upsert: false });
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);

            const { data: reportData, error: dbError } = await supabase
                .from('reports')
                .insert({
                    project_id: newReportProject,
                    name: file.name,
                    description: newReportContent || null,
                    file_path: publicUrl,
                    file_type: file.type,
                    file_size: file.size,
                    created_by: profile?.id
                })
                .select(`*, project:projects (name, color), author:profiles!created_by (id, full_name, avatar_url)`)
                .single();
            if (dbError) throw dbError;

            const { data: projectMembers } = await supabase
                .from('project_members').select('user_id')
                .eq('project_id', newReportProject).neq('user_id', profile?.id || '');

            if (projectMembers && projectMembers.length > 0) {
                const projectName = projects.find(p => p.id === newReportProject)?.name || 'le projet';
                await supabase.from('notifications').insert(
                    projectMembers.map(m => ({
                        user_id: m.user_id, type: 'info',
                        title: '📄 Nouveau rapport',
                        message: `Un nouveau document "${file.name}" a été ajouté au projet "${projectName}" par ${profile?.full_name || 'un membre'}.`,
                        link: `/rapports`
                    }))
                );
            }

            setReports([reportData, ...reports]);
            setIsCreateDialogOpen(false);
            setNewReportProject('');
            setNewReportContent('');
            toast({ title: "Document ajouté", description: "Le fichier a été enregistré avec succès." });
        } catch (error: any) {
            console.error('Upload error:', error);
            toast({ title: "Erreur", description: error.message || "Échec de l'envoi", variant: "destructive" });
        } finally {
            setSaving(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleDeleteReport = async (report: ReportWithContext) => {
        if (!confirm('Supprimer ce document définitivement ?')) return;
        try {
            const { error: dbError } = await supabase.from('reports').delete().eq('id', report.id);
            if (dbError) throw dbError;
            if (report.file_path.includes('/storage/v1/object/public/documents/')) {
                const path = report.file_path.split('/documents/')[1];
                if (path) await supabase.storage.from('documents').remove([path]);
            }
            setReports(prev => prev.filter(r => r.id !== report.id));
            toast({ title: "Document supprimé" });
        } catch (error: any) {
            toast({ title: "Erreur", description: error.message, variant: "destructive" });
        }
    };

    const filteredReports = reports.filter(report => {
        const matchesSearch = report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (report.project?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesProject = selectedProjectId === 'all' || report.project_id === selectedProjectId;
        return matchesSearch && matchesProject;
    });

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const getFileStyle = (type?: string) => {
        if (type?.includes('pdf')) return { bg: 'bg-red-50 dark:bg-red-900/10', text: 'text-red-500', border: 'border-red-100 dark:border-red-900/20', dot: '#ef4444' };
        if (type?.includes('spreadsheet') || type?.includes('excel') || type?.includes('csv'))
            return { bg: 'bg-emerald-50 dark:bg-emerald-900/10', text: 'text-emerald-500', border: 'border-emerald-100 dark:border-emerald-900/20', dot: '#10b981' };
        return { bg: 'bg-blue-50 dark:bg-blue-900/10', text: 'text-blue-500', border: 'border-blue-100 dark:border-blue-900/20', dot: '#3b82f6' };
    };

    const getFileLabel = (type?: string) => {
        if (type?.includes('pdf')) return 'PDF';
        if (type?.includes('spreadsheet') || type?.includes('excel')) return 'XLS';
        if (type?.includes('csv')) return 'CSV';
        if (type?.includes('word') || type?.includes('document')) return 'DOC';
        if (type?.includes('image')) return 'IMG';
        return 'FILE';
    };

    const totalSize = reports.reduce((acc, r) => acc + (r.file_size || 0), 0);

    return (
        <div className="min-h-screen bg-[#f4f5f7] dark:bg-slate-950">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center">
                            <FileText className="w-4 h-4 text-blue-500" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800 dark:text-white">Rapports & Documents</h1>
                            <p className="text-[11px] text-slate-400 font-medium">Gestion centralisée des livrables de projet</p>
                        </div>
                    </div>

                    {canUploadOrDelete && (
                        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                            <DialogTrigger asChild>
                                <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-full transition-all shadow-md shadow-blue-200 dark:shadow-blue-900/30 shrink-0">
                                    <Plus className="w-3.5 h-3.5" />
                                    Ajouter un document
                                </button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[420px] rounded-2xl border-0 shadow-2xl">
                                <DialogHeader>
                                    <DialogTitle className="text-sm font-bold text-slate-800 dark:text-white">Nouveau Document</DialogTitle>
                                    <DialogDescription className="text-xs text-slate-400">
                                        Sélectionnez un projet et téléversez votre fichier.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-2">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Projet</label>
                                        <select
                                            value={newReportProject}
                                            onChange={(e) => setNewReportProject(e.target.value)}
                                            className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                        >
                                            <option value="">Sélectionner un projet</option>
                                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fichier</label>
                                        <input type="file" onChange={handleFileUpload} disabled={saving || !newReportProject} className="hidden" id="file-upload" />
                                        <label
                                            htmlFor="file-upload"
                                            className={cn(
                                                "flex flex-col items-center justify-center w-full h-28 rounded-xl border-2 border-dashed transition-all cursor-pointer",
                                                !newReportProject
                                                    ? "opacity-40 cursor-not-allowed bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                                                    : "bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50/40 dark:hover:border-blue-700"
                                            )}
                                        >
                                            {saving ? (
                                                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                                            ) : (
                                                <>
                                                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-2">
                                                        <FileDown className="w-5 h-5 text-blue-500" />
                                                    </div>
                                                    <span className="text-xs font-semibold text-slate-400">Cliquer pour choisir un fichier</span>
                                                </>
                                            )}
                                        </label>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                            Description <span className="text-slate-300 font-normal normal-case">(optionnel)</span>
                                        </label>
                                        <textarea
                                            placeholder="Ajouter une description..."
                                            value={newReportContent}
                                            onChange={(e) => setNewReportContent(e.target.value)}
                                            className="min-h-[70px] w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none placeholder:text-slate-400"
                                        />
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>

                {/* ── Stats KPI ── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                        {
                            label: 'Total Documents',
                            value: reports.length,
                            sub: `${reports.filter(r => r.file_type?.includes('pdf')).length} PDF · ${reports.filter(r => r.file_type?.includes('sheet') || r.file_type?.includes('excel')).length} Excel`,
                            icon: <FileText className="w-4 h-4 text-blue-500" />,
                            iconBg: 'bg-blue-50 dark:bg-blue-900/20',
                        },
                        {
                            label: 'Stockage Utilisé',
                            value: formatFileSize(totalSize),
                            sub: `Répartis sur ${projects.length} projets`,
                            icon: <Download className="w-4 h-4 text-emerald-500" />,
                            iconBg: 'bg-emerald-50 dark:bg-emerald-900/20',
                        },
                        {
                            label: 'Dernière Mise à Jour',
                            value: reports.length > 0 ? format(new Date(reports[0].created_at), 'dd MMM yyyy', { locale: fr }) : '—',
                            sub: reports.length > 0 ? format(new Date(reports[0].created_at), 'à HH:mm', { locale: fr }) : 'Aucun document',
                            icon: <FileDown className="w-4 h-4 text-amber-500" />,
                            iconBg: 'bg-amber-50 dark:bg-amber-900/20',
                        },
                    ].map((stat, i) => (
                        <div key={i} className="bg-white dark:bg-slate-800 border-0 shadow-sm rounded-2xl p-5 flex items-center gap-4">
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", stat.iconBg)}>
                                {stat.icon}
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{stat.label}</p>
                                <p className="text-2xl font-black text-slate-800 dark:text-white leading-none">{stat.value}</p>
                                <p className="text-[10px] text-slate-400 font-medium mt-1 truncate">{stat.sub}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Document Grid Card ── */}
                <div className="bg-white dark:bg-slate-800 border-0 shadow-sm rounded-2xl overflow-hidden">

                    {/* Toolbar */}
                    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="relative flex-1 max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <Input
                                placeholder="Rechercher un document..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-9 rounded-full bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-xs focus-visible:ring-blue-300 placeholder:text-slate-400"
                            />
                        </div>
                        <select
                            value={selectedProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                            className="h-9 px-3 rounded-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-xs text-slate-600 dark:text-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-blue-300"
                        >
                            <option value="all">Tous les projets</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        {filteredReports.length > 0 && (
                            <span className="text-[10px] font-bold text-slate-400 sm:ml-auto whitespace-nowrap bg-slate-50 dark:bg-slate-700 px-3 py-1.5 rounded-full">
                                {filteredReports.length} document{filteredReports.length > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
                        {loading ? (
                            [...Array(6)].map((_, i) => (
                                <div key={i} className="h-52 rounded-2xl bg-slate-100 dark:bg-slate-700/40 animate-pulse" />
                            ))
                        ) : filteredReports.length === 0 ? (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
                                <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-700 flex items-center justify-center mb-4">
                                    <FileText className="w-7 h-7 text-slate-300 dark:text-slate-600" />
                                </div>
                                <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Aucun document trouvé</p>
                                <p className="text-xs text-slate-400 mt-1">Modifiez vos filtres ou ajoutez un nouveau document.</p>
                            </div>
                        ) : (
                            filteredReports.map((report) => {
                                const style = getFileStyle(report.file_type);
                                const label = getFileLabel(report.file_type);
                                return (
                                    <div
                                        key={report.id}
                                        className="group relative flex flex-col bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800/60 hover:shadow-lg hover:shadow-blue-500/5 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
                                    >
                                        {/* Subtle background accent */}
                                        <div className={cn("absolute top-0 right-0 w-24 h-24 rounded-full opacity-[0.06] -translate-y-8 translate-x-8", style.bg)} />

                                        {/* Top row: icon + actions */}
                                        <div className="flex items-start justify-between gap-3 mb-4 relative z-10">
                                            <div className={cn("w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 border font-black text-[10px] tracking-wider shadow-sm", style.bg, style.text, style.border)}>
                                                <FileText className="w-5 h-5 mb-0.5" />
                                                {label}
                                            </div>
                                            <div className="flex gap-1.5">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <a
                                                                href={report.file_path}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all shadow-sm"
                                                            >
                                                                <Download className="w-3.5 h-3.5" />
                                                            </a>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Télécharger</TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                                {canUploadOrDelete && (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <button
                                                                    onClick={() => handleDeleteReport(report)}
                                                                    className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all shadow-sm"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Supprimer</TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
                                            </div>
                                        </div>

                                        {/* File name + meta */}
                                        <div className="flex-1 relative z-10 space-y-1">
                                            <h3 className="text-sm font-bold text-slate-800 dark:text-white line-clamp-2 leading-snug" title={report.name}>
                                                {report.name}
                                            </h3>
                                            <p className="text-[10px] text-slate-400 font-medium">
                                                {format(new Date(report.created_at), 'dd MMM yyyy · HH:mm', { locale: fr })}
                                                <span className="mx-1.5 text-slate-300">·</span>
                                                {formatFileSize(report.file_size)}
                                            </p>
                                        </div>

                                        {/* Footer: project + author */}
                                        <div className="mt-4 pt-3.5 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-2 relative z-10">
                                            {report.project ? (
                                                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 max-w-[120px]">
                                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: report.project.color }} />
                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 truncate">{report.project.name}</span>
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                                                    <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-slate-300" />
                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Supprimé</span>
                                                </span>
                                            )}

                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <Avatar className="w-5 h-5 rounded-lg ring-2 ring-white dark:ring-slate-900">
                                                    <AvatarImage src={report.author?.avatar_url || ''} className="object-cover" />
                                                    <AvatarFallback className="rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-500 text-[8px] font-black">
                                                        {report.author?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="text-[10px] font-semibold text-slate-400 truncate max-w-[70px]">
                                                    {report.author?.full_name?.split(' ')[0] || '—'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}