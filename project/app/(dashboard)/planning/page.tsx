'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";

const PlanningSheet = dynamic(
    () => import('@/components/planning/planning-sheet').then((mod) => mod.PlanningSheet),
    { ssr: false, loading: () => null }
);
const ExcelImportedPlanning = dynamic(
    () => import('@/components/planning/excel-imported-planning').then((mod) => mod.ExcelImportedPlanning),
    { ssr: false, loading: () => null }
);
import { Briefcase, FileSpreadsheet, Loader2, FileUp, LayoutGrid, Plus, Table2, Trash2, Palette, FolderOpen, ExternalLink, ChevronLeft, CalendarDays } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function PlanningPage() {
    const { profile } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [allProjects, setAllProjects] = useState<any[]>([]);
    const [projectsWithPlanning, setProjectsWithPlanning] = useState<any[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<'owner' | 'member' | null>(null);
    const [view, setView] = useState<'grid' | 'sheet'>('grid');
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [importProjectId, setImportProjectId] = useState<string>('');
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [advancedMode, setAdvancedMode] = useState(false);
    const [sheetRefreshTrigger, setSheetRefreshTrigger] = useState(0);
    const [showImportedPlanning, setShowImportedPlanning] = useState(false);
    const [isEditingImport, setIsEditingImport] = useState(false);
    const [excelImports, setExcelImports] = useState<any[]>([]);
    const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
    const [importsLoading, setImportsLoading] = useState(false);
    const { toast } = useToast();

    const projectFromUrl = searchParams.get('project');
    const projectIdFromUrl = searchParams.get('projectId');
    const sheetIdFromUrl = searchParams.get('sheetId');
    const importIdFromUrl = searchParams.get('importId');

    const isAdmin = profile?.role === 'admin';
    const isChef = profile?.role === 'chef_de_projet';

    const resolveRole = (proj: any): 'owner' | 'member' | null => {
        if (isChef) return 'owner';
        if (proj?.project_members?.length > 0) return proj.project_members[0].role_in_project;
        return null;
    };

    useEffect(() => {
        fetchData();
    }, [profile?.id]);

    useEffect(() => {
        if (allProjects.length === 0) return;

        if (projectIdFromUrl && sheetIdFromUrl) {
            const proj = allProjects.find(p => p.id === projectIdFromUrl);
            if (proj) {
                setSelectedProjectId(projectIdFromUrl);
                setUserRole(resolveRole(proj));
                setShowImportedPlanning(false);
                setView('sheet');
                setAdvancedMode(true);
                setSheetRefreshTrigger(t => t + 1);
                loadExcelImports(projectIdFromUrl);
            }
            return;
        }

        if (projectIdFromUrl && importIdFromUrl) {
            const proj = allProjects.find(p => p.id === projectIdFromUrl);
            if (proj) {
                setSelectedProjectId(projectIdFromUrl);
                setUserRole(resolveRole(proj));
                setSelectedImportId(importIdFromUrl);
                setShowImportedPlanning(true);
                setView('sheet');
                loadExcelImports(projectIdFromUrl);
            }
            return;
        }

        const pid = projectFromUrl || projectIdFromUrl;
        if (pid) {
            const proj = allProjects.find(p => p.id === pid);
            if (proj) {
                setSelectedProjectId(pid);
                setUserRole(resolveRole(proj));
            }
        }
    }, [projectFromUrl, projectIdFromUrl, sheetIdFromUrl, importIdFromUrl, allProjects, profile?.role]);

    const fetchData = async () => {
        if (!profile?.id) return;
        setLoading(true);
        try {
            let memberProjects: any[] = [];

            if (isAdmin || isChef) {
                const { data: projs, error: projsError } = await supabase
                    .from('projects')
                    .select(`id, name, color, project_members(role_in_project, user_id)`);
                if (projsError) throw projsError;
                memberProjects = projs || [];
            } else {
                const { data: projs, error: projsError } = await supabase
                    .from('projects')
                    .select(`id, name, color, project_members!inner(role_in_project, user_id)`)
                    .eq('project_members.user_id', profile.id);
                if (projsError) throw projsError;
                memberProjects = projs || [];
            }

            setAllProjects(memberProjects);

            const { data: sheets, error: sheetsError } = await supabase
                .from('planning_sheets').select('project_id');
            if (sheetsError) throw sheetsError;

            const projectIdsWithSheets = new Set((sheets || []).map((s: any) => s.project_id));
            setProjectsWithPlanning(memberProjects.filter((p: any) => projectIdsWithSheets.has(p.id)));

            await loadExcelImports(null, memberProjects);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleProjectSelect = async (id: string) => {
        setSelectedProjectId(id);
        const proj = allProjects.find(p => p.id === id);
        setUserRole(resolveRole(proj));
        setView('grid');
        setAdvancedMode(false);
        setShowImportedPlanning(false);
        setSelectedImportId(null);
        setIsCreateDialogOpen(false);
        router.replace(`/planning?project=${id}`, { scroll: false });
        await loadExcelImports(id);
    };

    const handleProjectOpen = async (id: string) => {
        setSelectedProjectId(id);
        const proj = allProjects.find(p => p.id === id);
        setUserRole(resolveRole(proj));
        setView('sheet');
        setAdvancedMode(true);
        setShowImportedPlanning(false);
        setSelectedImportId(null);
        setIsCreateDialogOpen(false);
        router.replace(`/planning?project=${id}`, { scroll: false });
        await loadExcelImports(id);
        setSheetRefreshTrigger((t) => t + 1);

        if (!isAdmin) {
            const { data: projectMembers } = await supabase
                .from('project_members')
                .select('user_id')
                .eq('project_id', id)
                .neq('user_id', profile?.id || '');

            if (projectMembers && projectMembers.length > 0) {
                const projectName = allProjects.find(p => p.id === id)?.name || 'le projet';
                await supabase.from('notifications').insert(
                    projectMembers.map(m => ({
                        user_id: m.user_id,
                        type: 'info',
                        title: '📅 Planning initialisé',
                        message: `Le planning du projet "${projectName}" a été initialisé par ${profile?.full_name || 'un membre'}.`,
                        link: `/projets/${id}`
                    }))
                );
            }
        }
    };

    const ownerProjects = (isChef || isAdmin)
        ? allProjects
        : allProjects.filter((p: any) => p.project_members?.some((m: any) => m.role_in_project === 'owner'));

    const projectsToCreate = ownerProjects.filter((p: any) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const projectsToImport = ownerProjects.filter((p: any) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const loadExcelImports = async (projectId: string | null, memberProjects?: any[]) => {
        if (!profile?.id) return;
        setImportsLoading(true);
        try {
            let query = supabase
                .from('excel_imports')
                .select('*')
                .order('created_at', { ascending: false });

            if (projectId) {
                // Projet spécifique sélectionné
                query = query.eq('project_id', projectId);
            } else if (!isAdmin && !isChef) {
                // Membre: restreindre aux projets dont il fait partie
                const projectIds = (memberProjects ?? allProjects).map((p: any) => p.id);
                if (projectIds.length === 0) {
                    setExcelImports([]);
                    setImportsLoading(false);
                    return;
                }
                query = query.in('project_id', projectIds);
            }
            // admin / chef sans filtre → voit tous les imports

            const { data, error } = await query;

            if (error) {
                console.error('Erreur chargement excel_imports:', error);
                throw error;
            }

            setExcelImports(data || []);
            if (!selectedImportId && data && data.length > 0) setSelectedImportId(data[0].id);
        } catch (err) {
            console.error('Error loading excel imports', err);
        } finally {
            setImportsLoading(false);
        }
    };

    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !importProjectId) return;
        setImporting(true);
        try {
            const xlsxMod = await import('xlsx');
            const XLSX = xlsxMod.default ?? xlsxMod;
            if (!XLSX?.read) throw new Error('XLSX library failed to load (missing read)');

            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetNames = workbook?.SheetNames;
            if (!sheetNames?.length) throw new Error('Le fichier est vide');
            const ws = workbook.Sheets[sheetNames[0]];
            if (!ws) throw new Error('Le fichier est vide');

            const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
            const rowCount = range.e.r - range.s.r + 1;
            const colCount = range.e.c - range.s.c + 1;
            if (rowCount < 1 || colCount < 1) throw new Error('Feuille vide');

            const cellPayload: { r: number; c: number; value_text: string; value_type: string | null; style_json: any }[] = [];
            for (let r = 0; r < rowCount; r++) {
                for (let c = 0; c < colCount; c++) {
                    const cell = ws[XLSX.utils.encode_cell({ r: range.s.r + r, c: range.s.c + c })];
                    const val = cell?.w ?? (cell?.v != null ? String(cell.v) : '');
                    let valueType: string | null = null;
                    const t = cell?.t as string | undefined;
                    if (t === 's' || t === 'str') valueType = 'string';
                    else if (t === 'n') valueType = 'number';
                    else if (t === 'b') valueType = 'bool';
                    else if (t === 'd') valueType = 'date';
                    else if (t) valueType = t;
                    cellPayload.push({ r, c, value_text: val ?? '', value_type: valueType, style_json: {} });
                }
            }

            const excelMerges: { startRow: number; startCol: number; rowSpan: number; colSpan: number }[] = [];
            const merges = (ws['!merges'] || []) as Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>;
            for (const m of merges) {
                const sr = m.s.r - range.s.r;
                const sc = m.s.c - range.s.c;
                if (sr >= 0 && sc >= 0 && sr < rowCount && sc < colCount) {
                    excelMerges.push({
                        startRow: sr, startCol: sc,
                        rowSpan: Math.min(m.e.r - m.s.r + 1, rowCount - sr),
                        colSpan: Math.min(m.e.c - m.s.c + 1, colCount - sc),
                    });
                }
            }

            const { data: importIdResult, error: importErr } = await supabase.rpc('create_excel_import', {
                p_project_id: importProjectId,
                p_file_name: file.name,
                p_sheet_name: sheetNames[0],
                p_row_count: rowCount,
                p_col_count: colCount
            });
            if (importErr) throw importErr;
            const importId: string = Array.isArray(importIdResult) ? importIdResult[0] : importIdResult;
            if (!importId) throw new Error("Impossible de créer l'import Excel");

            const CHUNK = 500;
            for (let i = 0; i < cellPayload.length; i += CHUNK) {
                const { error: cellErr } = await supabase
                    .from('excel_import_cells')
                    .upsert(
                        cellPayload.slice(i, i + CHUNK).map(c => ({ import_id: importId, ...c })),
                        { onConflict: 'import_id,r,c' }
                    );
                if (cellErr) throw cellErr;
            }

            if (excelMerges.length > 0) {
                const mergeInserts = excelMerges
                    .filter(m => m.rowSpan > 1 || m.colSpan > 1)
                    .map(m => ({ import_id: importId, start_r: m.startRow, start_c: m.startCol, row_span: m.rowSpan, col_span: m.colSpan }));
                if (mergeInserts.length > 0) {
                    const { error: mergeErr } = await supabase
                        .from('excel_import_merges')
                        .upsert(mergeInserts, { onConflict: 'import_id,start_r,start_c' });
                    if (mergeErr) throw mergeErr;
                }
            }

            const { data: members } = await supabase
                .from('project_members').select('user_id').eq('project_id', importProjectId);

            if (members?.length) {
                const { data: proj } = await supabase
                    .from('projects').select('name').eq('id', importProjectId).single();

                const notifications = members
                    .filter(m => m.user_id !== profile?.id)
                    .map(m => ({
                        user_id: m.user_id,
                        type: 'info',
                        title: '📊 Planning Excel importé',
                        message: `Un planning Excel "${file.name}" a été importé pour le projet "${proj?.name || 'Inconnu'}" par ${profile?.full_name || 'un membre'}.`,
                        link: `/projets/${importProjectId}`
                    }));
                if (notifications.length > 0) {
                    await supabase.from('notifications').insert(notifications);
                }
            }

            toast({ title: "Import réussi", description: `${colCount} colonnes, ${rowCount} lignes importées` });
            setIsImportDialogOpen(false);
            setImportProjectId('');
            if (fileInputRef.current) fileInputRef.current.value = '';

            setSelectedImportId(importId);
            setShowImportedPlanning(true);
            setView('sheet');
            if (selectedProjectId === importProjectId) await loadExcelImports(selectedProjectId);
            else {
                setSelectedProjectId(importProjectId);
                await loadExcelImports(importProjectId);
            }
        } catch (err: any) {
            console.error('Import Excel error:', err);
            toast({
                title: "Erreur import",
                description: err?.message || err?.details || err?.hint || "Impossible d'importer le fichier",
                variant: "destructive"
            });
        } finally {
            setImporting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="animate-spin rounded-xl h-10 w-10 border-b-2 border-blue-500 shadow-lg shadow-blue-500/20" />
            </div>
        );
    }

    const selectedProject = allProjects.find(p => p.id === selectedProjectId);
    const planningCount = projectsWithPlanning.filter(p => !selectedProjectId || p.id === selectedProjectId).length;
    const importCount = excelImports.filter(imp => !selectedProjectId || imp.project_id === selectedProjectId).length;

    return (
        <div className="min-h-screen bg-[#f4f5f7] dark:bg-slate-950">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center">
                            <CalendarDays className="w-4 h-4 text-blue-500" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800 dark:text-white">Planning Stratégique</h1>
                            <p className="text-[11px] text-slate-400 font-medium">Gérez la planification de vos projets</p>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                        {view === 'sheet' && (
                            <button
                                onClick={() => {
                                    setView('grid');
                                    setAdvancedMode(false);
                                    setShowImportedPlanning(false);
                                    router.replace('/planning', { scroll: false });
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-full transition-all shadow-sm hover:border-blue-300 hover:text-blue-500"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                                Vue Projets
                            </button>
                        )}

                        {isChef && (
                            <>
                                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                                    <DialogTrigger asChild>
                                        <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-full transition-all shadow-sm hover:border-blue-300 hover:text-blue-500">
                                            <Plus className="w-3.5 h-3.5" />
                                            Initialiser
                                        </button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-md rounded-2xl border-0 shadow-2xl p-0 overflow-hidden">
                                        <div className="bg-blue-500 p-7 text-white relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
                                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12 blur-2xl" />
                                            <DialogTitle className="text-xl font-black mb-1 relative z-10">Créer un planning</DialogTitle>
                                            <DialogDescription className="text-blue-100 text-xs font-medium relative z-10">Sélectionnez un projet pour initialiser sa planification.</DialogDescription>
                                        </div>
                                        <div className="p-6 space-y-3">
                                            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                                                {projectsToCreate.length === 0 ? (
                                                    <div className="text-center py-10">
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aucun projet trouvé</p>
                                                    </div>
                                                ) : (
                                                    projectsToCreate.map((project) => (
                                                        <button
                                                            key={project.id}
                                                            onClick={() => handleProjectOpen(project.id)}
                                                            className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:hover:border-blue-800 border border-transparent transition-all text-left"
                                                        >
                                                            <span className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: project.color }} />
                                                            <span className="font-bold flex-1 text-sm text-slate-700 dark:text-slate-300">{project.name}</span>
                                                            <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                                                <Plus className="w-3 h-3 text-blue-500" />
                                                            </div>
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </DialogContent>
                                </Dialog>

                                <button
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-full transition-all shadow-md shadow-blue-200 dark:shadow-blue-900/30"
                                    onClick={() => { setImportProjectId(''); setIsImportDialogOpen(true); }}
                                >
                                    <FileUp className="w-3.5 h-3.5" />
                                    Importer Excel
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* ── Filter bar ── */}
                <div className="bg-white dark:bg-slate-800 border-0 shadow-sm rounded-2xl p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-2 shrink-0">
                            <LayoutGrid className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filtrer par projet</span>
                        </div>
                        <div className="flex-1 max-w-sm">
                            <select
                                value={selectedProjectId || ''}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    if (v) {
                                        handleProjectSelect(v);
                                    } else {
                                        setSelectedProjectId(null);
                                        setUserRole(null);
                                        setView('grid');
                                        loadExcelImports(null);
                                        setSelectedImportId(null);
                                        setShowImportedPlanning(false);
                                        router.replace('/planning', { scroll: false });
                                    }
                                }}
                                className="w-full h-9 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 px-4 text-xs font-bold text-slate-600 dark:text-slate-300 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                            >
                                <option value="">Tous les projets</option>
                                {allProjects.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Counters */}
                        <div className="flex items-center gap-2 sm:ml-auto">
                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-700 px-3 py-1.5 rounded-full">
                                <Table2 className="w-3 h-3 text-blue-400" />
                                {planningCount} planning{planningCount !== 1 ? 's' : ''}
                            </span>
                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-700 px-3 py-1.5 rounded-full">
                                <FileSpreadsheet className="w-3 h-3 text-blue-400" />
                                {importCount} import{importCount !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── Vue grille ── */}
                {view === 'grid' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {/* Planning initialisés */}
                        {allProjects
                            .filter(p => !selectedProjectId || p.id === selectedProjectId)
                            .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map(project => {
                                const hasPlanning = projectsWithPlanning.some(wp => wp.id === project.id);
                                if (!hasPlanning) return null;
                                return (
                                    <div
                                        key={`plan-${project.id}`}
                                        className="group relative bg-white dark:bg-slate-800 border-0 shadow-sm rounded-2xl overflow-hidden flex flex-col cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-200"
                                        onClick={() => handleProjectOpen(project.id)}
                                    >
                                        {/* Top color strip */}
                                        <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: project.color }} />
                                        {/* Bg accent */}
                                        <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-[0.06] group-hover:scale-125 transition-transform duration-300" style={{ backgroundColor: project.color }} />

                                        <div className="p-5 flex flex-col flex-1 relative z-10">
                                            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                                <Table2 className="w-5 h-5 text-blue-500" />
                                            </div>
                                            <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-1 line-clamp-2 leading-snug group-hover:text-blue-500 transition-colors">
                                                {project.name}
                                            </h3>
                                            <p className="text-[10px] text-slate-400 font-medium">Planning Général</p>
                                            <div className="flex-1" />
                                            <div className="flex items-center justify-between mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-700">
                                                <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-full">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                    Initialisé
                                                </span>
                                                <FolderOpen className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        }

                        {/* Excel imports — visibles pour tous les membres de leurs projets */}
                        {excelImports
                            .filter(imp => !selectedProjectId || imp.project_id === selectedProjectId)
                            .filter(imp => {
                                const proj = allProjects.find(p => p.id === imp.project_id);
                                // Si le projet n'est pas dans allProjects du membre → masquer
                                if (!proj) return false;
                                return proj.name.toLowerCase().includes(searchQuery.toLowerCase());
                            })
                            .map(imp => {
                                const proj = allProjects.find(p => p.id === imp.project_id);
                                return (
                                    <div
                                        key={`imp-${imp.id}`}
                                        className="group relative bg-white dark:bg-slate-800 border-0 shadow-sm rounded-2xl overflow-hidden flex flex-col cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-200"
                                        onClick={() => {
                                            setSelectedImportId(imp.id);
                                            setView('sheet');
                                            setShowImportedPlanning(true);
                                            if (proj) setSelectedProjectId(proj.id);
                                        }}
                                    >
                                        {/* Top strip — blue for excel */}
                                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-cyan-400" />
                                        <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-[0.05] bg-blue-500 group-hover:scale-125 transition-transform duration-300" />

                                        <div className="p-5 flex flex-col flex-1 relative z-10">
                                            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                                <FileSpreadsheet className="w-5 h-5 text-blue-500" />
                                            </div>
                                            <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-1 line-clamp-2 leading-snug group-hover:text-blue-500 transition-colors">
                                                {proj?.name || imp.file_name}
                                            </h3>
                                            <p className="text-[10px] text-slate-400 font-medium truncate">{imp.file_name}</p>
                                            <div className="flex-1" />
                                            <div className="flex items-center justify-between mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-700">
                                                <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                                    Importé
                                                </span>
                                                <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        }

                        {/* Empty state */}
                        {allProjects.length > 0 &&
                            !allProjects.some(p => projectsWithPlanning.some(wp => wp.id === p.id) && p.name.toLowerCase().includes(searchQuery.toLowerCase())) &&
                            excelImports.filter(imp => !selectedProjectId || imp.project_id === selectedProjectId).length === 0 && (
                                <div className="col-span-full bg-white dark:bg-slate-800 border-0 shadow-sm rounded-2xl flex flex-col items-center justify-center py-20 text-center">
                                    <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4">
                                        <Briefcase className="w-7 h-7 text-blue-300" />
                                    </div>
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-1">Aucun planning trouvé</h3>
                                    <p className="text-xs text-slate-400 max-w-xs">Réinitialisez vos filtres ou créez une nouvelle planification.</p>
                                </div>
                            )}
                    </div>
                )}

                {/* ── Dialog import Excel ── */}
                <Dialog open={isImportDialogOpen} onOpenChange={(open) => { setIsImportDialogOpen(open); if (!open) setImportProjectId(''); }}>
                    <DialogContent className="sm:max-w-md rounded-2xl border-0 shadow-2xl">
                        <DialogHeader>
                            <div className="flex items-center gap-3 mb-1">
                                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                                    <FileSpreadsheet className="w-4 h-4 text-blue-500" />
                                </div>
                                <div>
                                    <DialogTitle className="text-sm font-bold text-slate-800 dark:text-white">Importer un fichier Excel</DialogTitle>
                                    <DialogDescription className="text-[10px] text-slate-400">La première feuille du fichier .xlsx sera importée.</DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Projet</label>
                                <select
                                    value={importProjectId}
                                    onChange={(e) => setImportProjectId(e.target.value)}
                                    className="w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                >
                                    <option value="">Choisir un projet</option>
                                    {projectsToImport.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fichier .xlsx</label>
                                <div className={cn(
                                    "relative flex flex-col items-center justify-center w-full h-28 rounded-xl border-2 border-dashed transition-all",
                                    !importProjectId
                                        ? "opacity-40 cursor-not-allowed bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                                        : "bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50/30"
                                )}>
                                    {importing ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                                            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Import en cours...</span>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-2">
                                                <FileUp className="w-5 h-5 text-blue-500" />
                                            </div>
                                            <span className="text-xs font-semibold text-slate-400">Cliquer pour choisir un fichier</span>
                                        </>
                                    )}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".xlsx,.xls"
                                        onChange={handleImportExcel}
                                        disabled={!importProjectId || importing}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                    />
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* ── Vue sheet ── */}
                {view === 'sheet' && (
                    <div className="space-y-5">
                        {!showImportedPlanning && (
                            <div className="bg-white dark:bg-slate-800 border-0 shadow-sm rounded-2xl overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {selectedProject && (
                                            <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: selectedProject.color }} />
                                        )}
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                                                {selectedProject?.name || 'Planning'}
                                            </h3>
                                            <p className="text-[10px] text-slate-400 font-medium">Pilotage opérationnel du projet</p>
                                        </div>
                                    </div>
                                    <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-full">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                        Initialisé
                                    </span>
                                </div>
                                <div className="p-6">
                                    {selectedProjectId && (
                                        <PlanningSheet
                                            projectId={selectedProjectId}
                                            isOwner={userRole === 'owner' && !isAdmin}
                                            advancedMode={advancedMode}
                                            refreshTrigger={sheetRefreshTrigger}
                                        />
                                    )}
                                </div>
                            </div>
                        )}

                        {showImportedPlanning && selectedProjectId && (
                            <div className="bg-white dark:bg-slate-800 border-0 shadow-sm rounded-2xl overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                                            <FileSpreadsheet className="w-4 h-4 text-blue-500" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                                                Visualisation Excel
                                            </h3>
                                            <p className="text-[10px] text-slate-400 font-medium">{selectedProject?.name}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {!isAdmin && (
                                            <button
                                                onClick={() => setIsEditingImport(!isEditingImport)}
                                                className={cn(
                                                    "flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-bold transition-all",
                                                    isEditingImport
                                                        ? "bg-blue-500 text-white shadow-md shadow-blue-200 dark:shadow-blue-900/30"
                                                        : "bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:border-blue-300 hover:text-blue-500"
                                                )}
                                            >
                                                <Palette className="w-3.5 h-3.5" />
                                                {isEditingImport ? "Quitter l'édition" : "Modifier"}
                                            </button>
                                        )}
                                        {isChef && (
                                            <button
                                                onClick={async () => {
                                                    if (!selectedImportId) return;
                                                    if (!confirm("Supprimer cet import Excel ?")) return;
                                                    const { error } = await supabase.from('excel_imports').delete().eq('id', selectedImportId);
                                                    if (error) {
                                                        toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
                                                    } else {
                                                        const remaining = excelImports.filter((i) => i.id !== selectedImportId);
                                                        setExcelImports(remaining);
                                                        setSelectedImportId(remaining[0]?.id ?? null);
                                                        toast({ title: 'Import supprimé', description: "L'import Excel a été supprimé." });
                                                    }
                                                }}
                                                className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-700 text-red-500 border border-slate-200 dark:border-slate-600 hover:bg-red-50 hover:border-red-200 transition-all"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                Supprimer
                                            </button>
                                        )}
                                        {isAdmin && (
                                            <span className="text-[9px] font-black text-slate-400 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-full uppercase tracking-wider">
                                                Lecture seule
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="p-6">
                                    {importsLoading ? (
                                        <div className="flex h-48 items-center justify-center gap-3 text-slate-400">
                                            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                                            <span className="text-xs font-bold uppercase tracking-wider">Chargement des données...</span>
                                        </div>
                                    ) : (
                                        <div className="w-full rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                                            <ExcelImportedPlanning importId={selectedImportId} canEdit={isEditingImport && !isAdmin} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}