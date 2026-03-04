'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    StickyNote,
    Search,
    Plus,
    Pin,
    Trash2,
    MoreHorizontal,
    Palette,
    FolderOpen,
    Clock,
    Users
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import type { Project } from '@/types';

interface WorkNote {
    id: string;
    user_id: string;
    project_id?: string;
    content: string;
    is_pinned: boolean;
    color: string;
    created_at: string;
    updated_at: string;
    project?: Project;
}

const COLORS = [
    { name: 'Sky', value: '#bae6fd' },
    { name: 'Blue', value: '#bfdbfe' },
    { name: 'Indigo', value: '#c7d2fe' },
    { name: 'Cyan', value: '#a5f3fc' },
    { name: 'Slate', value: '#e2e8f0' },
    { name: 'Periwinkle', value: '#ddd6fe' },
    { name: 'Mint', value: '#bbf7d0' },
    { name: 'Lime', value: '#d9f99d' },
    { name: 'Yellow', value: '#fef08a' },
    { name: 'Peach', value: '#fed7aa' },
    { name: 'Rose', value: '#fecdd3' },
    { name: 'Pink', value: '#fbcfe8' },
    { name: 'Lavender', value: '#e9d5ff' },
    { name: 'Teal', value: '#99f6e4' },
    { name: 'Sand', value: '#fef3c7' },
    { name: 'Steel', value: '#cbd5e1' },
];

export default function NotesPage() {
    const { profile } = useAuth();
    const { toast } = useToast();
    const [notes, setNotes] = useState<WorkNote[]>([]);
    const [projects, setProjects] = useState<Partial<Project>[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const [newNoteContent, setNewNoteContent] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [selectedColor, setSelectedColor] = useState('#bfdbfe');

    useEffect(() => {
        if (profile) {
            fetchData();
        }
    }, [profile]);

    const fetchData = async () => {
        try {
            setLoading(true);

            const { data: projectsData } = await supabase
                .from('projects')
                .select('*')
                .order('name');
            setProjects(projectsData || []);

            const { data, error } = await supabase
                .from('work_notes')
                .select(`
          *,
          project:projects(*)
        `)
                .order('is_pinned', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) throw error;
            setNotes(data || []);
        } catch (error) {
            console.error('Erreur chargement notes:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddNote = async () => {
        if (!newNoteContent.trim()) return;

        try {
            const { data, error } = await supabase
                .from('work_notes')
                .insert({
                    user_id: profile?.id,
                    content: newNoteContent.trim(),
                    project_id: selectedProjectId,
                    color: selectedColor,
                    is_pinned: false
                })
                .select(`
          *,
          project:projects(*)
        `)
                .single();

            if (error) throw error;

            setNotes([data, ...notes]);
            setNewNoteContent('');
            setSelectedProjectId(null);
            setSelectedColor('#bfdbfe');
            toast({ title: "Note ajoutée" });
        } catch (error: any) {
            toast({ title: "Erreur", description: error.message, variant: "destructive" });
        }
    };

    const handleTogglePin = async (id: string, isPinned: boolean) => {
        try {
            const { error } = await supabase
                .from('work_notes')
                .update({ is_pinned: !isPinned })
                .eq('id', id);

            if (error) throw error;

            setNotes(prev => prev.map(n =>
                n.id === id ? { ...n, is_pinned: !isPinned } : n
            ).sort((a, b) => {
                if (a.is_pinned === b.is_pinned) return 0;
                return a.is_pinned ? -1 : 1;
            }));
        } catch (error: any) {
            toast({ title: "Erreur", description: error.message, variant: "destructive" });
        }
    };

    const handleDeleteNote = async (id: string) => {
        try {
            const { error } = await supabase
                .from('work_notes')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setNotes(prev => prev.filter(n => n.id !== id));
            toast({ title: "Note supprimée" });
        } catch (error: any) {
            toast({ title: "Erreur", description: error.message, variant: "destructive" });
        }
    };

    const filteredNotes = notes.filter(note =>
        note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.project?.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const pinnedNotes = filteredNotes.filter(n => n.is_pinned);
    const unpinnedNotes = filteredNotes.filter(n => !n.is_pinned);

    return (
        <div className="min-h-screen bg-[#f4f5f7] dark:bg-slate-950">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center">
                            <StickyNote className="w-4 h-4 text-blue-500" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800 dark:text-white">Mes Notes</h1>
                            <p className="text-[11px] text-slate-400 font-medium">
                                {notes.length} note{notes.length !== 1 ? 's' : ''} · {pinnedNotes.length} épinglée{pinnedNotes.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Create note card ── */}
                <div className="bg-white dark:bg-slate-800 border-0 shadow-sm rounded-2xl overflow-hidden">
                    {/* Top accent strip — BLUE */}
                    <div className="h-1 w-full bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-300" />

                    <div className="p-6 space-y-4">
                        {/* Color preview strip on textarea */}
                        <div
                            className="relative rounded-xl overflow-hidden border border-slate-100 dark:border-slate-700 transition-all"
                            style={{ backgroundColor: selectedColor === '#ffffff' ? undefined : selectedColor + '40' }}
                        >
                            <Textarea
                                placeholder="Qu'avez-vous en tête ?"
                                value={newNoteContent}
                                onChange={(e) => setNewNoteContent(e.target.value)}
                                className="min-h-[100px] text-base font-semibold placeholder:text-slate-300 dark:placeholder:text-slate-600 border-none focus-visible:ring-0 resize-none p-4 bg-transparent text-slate-700 dark:text-slate-200"
                            />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                {/* Project selector */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className="flex items-center gap-2 h-9 px-3 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-blue-300 hover:text-blue-500 transition-all">
                                            <FolderOpen className="w-3.5 h-3.5" />
                                            {selectedProjectId ? (
                                                <span className="flex items-center gap-1.5">
                                                    <span
                                                        className="w-2 h-2 rounded-full"
                                                        style={{ backgroundColor: projects.find(p => p.id === selectedProjectId)?.color }}
                                                    />
                                                    {projects.find(p => p.id === selectedProjectId)?.name}
                                                </span>
                                            ) : 'Projet'}
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="max-h-[280px] overflow-y-auto w-56 rounded-xl p-2 border-slate-100 dark:border-slate-700 shadow-lg">
                                        <DropdownMenuItem className="rounded-lg text-xs font-bold text-slate-500 uppercase tracking-wider" onClick={() => setSelectedProjectId(null)}>
                                            Aucun projet
                                        </DropdownMenuItem>
                                        <div className="h-px bg-slate-100 dark:bg-slate-700 my-1.5" />
                                        {projects.map(project => (
                                            <DropdownMenuItem
                                                key={project.id}
                                                className="rounded-lg text-sm font-medium"
                                                onClick={() => project.id && setSelectedProjectId(project.id)}
                                            >
                                                <div className="w-2.5 h-2.5 rounded-full mr-2 shrink-0" style={{ backgroundColor: project.color }} />
                                                {project.name}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                {/* Color picker */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            className="flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm hover:border-blue-300 transition-all relative overflow-hidden"
                                            style={{ backgroundColor: selectedColor }}
                                        >
                                            <Palette className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 relative z-10" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="p-3 rounded-xl border-slate-100 dark:border-slate-700 shadow-lg">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 px-1">Couleur</p>
                                        <div className="grid grid-cols-8 gap-2">
                                            {COLORS.map(color => (
                                                <button
                                                    key={color.value}
                                                    onClick={() => setSelectedColor(color.value)}
                                                    className={cn(
                                                        "w-7 h-7 rounded-full border border-slate-200 dark:border-slate-600 shadow-sm transition-all hover:scale-110",
                                                        selectedColor === color.value && "ring-2 ring-blue-400 ring-offset-2"
                                                    )}
                                                    style={{ backgroundColor: color.value }}
                                                    title={color.name}
                                                />
                                            ))}
                                        </div>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <button
                                onClick={handleAddNote}
                                disabled={!newNoteContent.trim()}
                                className="flex items-center gap-2 px-5 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-full transition-all shadow-md shadow-blue-200 dark:shadow-blue-900/30"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Enregistrer
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Search ── */}
                <div className="relative max-w-sm">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <Input
                        placeholder="Rechercher dans vos notes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9 rounded-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs shadow-sm focus-visible:ring-blue-300 placeholder:text-slate-400"
                    />
                </div>

                {/* ── Notes grid ── */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-52 rounded-2xl bg-white dark:bg-slate-800 animate-pulse shadow-sm" />
                        ))}
                    </div>
                ) : filteredNotes.length === 0 ? (
                    <div className="bg-white dark:bg-slate-800 border-0 shadow-sm rounded-2xl flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-4">
                            <StickyNote className="w-7 h-7 text-amber-400" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-1">Aucune note</h3>
                        <p className="text-xs text-slate-400">Vos notes épinglées et récentes apparaîtront ici.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Pinned section */}
                        {pinnedNotes.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Épinglées</span>
                                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {pinnedNotes.map(note => (
                                        <NoteCard
                                            key={note.id}
                                            note={note}
                                            profile={profile}
                                            onTogglePin={handleTogglePin}
                                            onDelete={handleDeleteNote}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Other notes */}
                        {unpinnedNotes.length > 0 && (
                            <div className="space-y-3">
                                {pinnedNotes.length > 0 && (
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Récentes</span>
                                        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                                    </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {unpinnedNotes.map(note => (
                                        <NoteCard
                                            key={note.id}
                                            note={note}
                                            profile={profile}
                                            onTogglePin={handleTogglePin}
                                            onDelete={handleDeleteNote}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── Note Card Component — Sticky Note Style ── */
function NoteCard({
    note,
    profile,
    onTogglePin,
    onDelete,
}: {
    note: WorkNote;
    profile: any;
    onTogglePin: (id: string, isPinned: boolean) => void;
    onDelete: (id: string) => void;
}) {
    const cornerColor = darkenColor(note.color || '#bfdbfe', 18);

    return (
        <div className="group relative hover:-translate-y-1.5 transition-all duration-200 cursor-default">
            {note.is_pinned && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 w-4 h-4 bg-white dark:bg-slate-900 rounded-full shadow-md flex items-center justify-center ring-2 ring-blue-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                </div>
            )}

            <div
                className="relative w-full min-h-[200px] flex flex-col shadow-md hover:shadow-xl transition-shadow duration-300"
                style={{
                    backgroundColor: note.color || '#bfdbfe',
                    borderRadius: '4px 20px 4px 4px',
                }}
            >
                <div
                    className="absolute top-0 right-0 w-10 h-10 z-10"
                    style={{
                        background: `linear-gradient(225deg, ${cornerColor} 50%, transparent 50%)`,
                        borderRadius: '0 20px 0 0',
                    }}
                />
                <div
                    className="absolute top-0 right-0 w-10 h-10 z-[5]"
                    style={{
                        background: `linear-gradient(225deg, rgba(0,0,0,0.08) 50%, transparent 50%)`,
                        borderRadius: '0 20px 0 0',
                        transform: 'translate(1px, 1px)',
                    }}
                />

                <div className="absolute top-2 right-12 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <button
                        onClick={() => onTogglePin(note.id, note.is_pinned)}
                        className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center transition-all hover:scale-110 bg-white/50 backdrop-blur-sm",
                            note.is_pinned ? "text-blue-600" : "text-slate-500"
                        )}
                    >
                        <Pin className={cn("w-3 h-3", note.is_pinned && "fill-current")} />
                    </button>
                    <button
                        onClick={() => onDelete(note.id)}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-slate-500 hover:text-red-500 hover:scale-110 transition-all bg-white/50 backdrop-blur-sm"
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>
                </div>

                <div className="flex flex-col flex-1 p-5 pr-12">
                    {note.project && (
                        <div className="flex items-center gap-1.5 mb-3">
                            <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: note.project.color }}
                            />
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-600/70 truncate">
                                {note.project.name}
                            </span>
                        </div>
                    )}

                    <p className="text-sm font-semibold text-slate-700 leading-relaxed whitespace-pre-wrap flex-1 line-clamp-6">
                        {note.content}
                    </p>

                    <div className="mt-5 pt-3 border-t border-black/10 flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-slate-600/80">
                            {profile?.full_name || 'Moi'}
                        </span>
                        <span className="text-[10px] text-slate-500/70 font-medium">
                            {new Date(note.updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Utility: darken a hex color by `amount` ── */
function darkenColor(hex: string, amount: number): string {
    const clamp = (v: number) => Math.max(0, Math.min(255, v));
    const h = hex.replace('#', '');
    const r = clamp(parseInt(h.substring(0, 2), 16) - amount);
    const g = clamp(parseInt(h.substring(2, 4), 16) - amount);
    const b = clamp(parseInt(h.substring(4, 6), 16) - amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}