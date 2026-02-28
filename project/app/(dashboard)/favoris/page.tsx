'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Star,
    Trash2,
    ExternalLink,
    FolderKanban,
    FileText,
    Clock,
    LayoutDashboard,
    LayoutGrid
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface Favorite {
    id: string;
    user_id: string;
    type: 'project' | 'page' | 'dashboard';
    item_id: string;
    label: string;
    created_at: string;
}

export default function FavorisPage() {
    const { profile } = useAuth();
    const { toast } = useToast();
    const [favorites, setFavorites] = useState<Favorite[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (profile) {
            fetchFavorites();
        }
    }, [profile]);

    const fetchFavorites = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('favorites')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setFavorites(data || []);
        } catch (error) {
            console.error('Erreur chargement favoris:', error);
        } finally {
            setLoading(false);
        }
    };

    const removeFavorite = async (id: string) => {
        try {
            const { error } = await supabase
                .from('favorites')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setFavorites(prev => prev.filter(f => f.id !== id));
            toast({ title: "Retiré des favoris" });
        } catch (error: any) {
            toast({ title: "Erreur", description: error.message, variant: "destructive" });
        }
    };

    const getIcon = (type: Favorite['type']) => {
        switch (type) {
            case 'project': return <FolderKanban className="w-5 h-5 text-blue-500" />;
            case 'page': return <FileText className="w-5 h-5 text-purple-500" />;
            case 'dashboard': return <LayoutDashboard className="w-5 h-5 text-green-500" />;
        }
    };

    const getHref = (favorite: Favorite) => {
        if (favorite.type === 'project') return `/projets/${favorite.item_id}`;
        return favorite.item_id; // For pages, item_id is the path
    };

    return (
        <div className="space-y-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <h1 className="section-title">Accès Favoris</h1>
                    <p className="section-subtitle">
                        Retrouvez instantanément vos ressources les plus importantes.
                    </p>
                </div>
                <div className="flex items-center gap-2 px-6 py-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{favorites.length} ÉLÉMENT{favorites.length > 1 ? 'S' : ''}</span>
                </div>
            </div>

            <div className="h-px bg-gradient-to-r from-slate-200 via-slate-100 to-transparent dark:from-slate-800 dark:via-slate-900" />

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : favorites.length === 0 ? (
                <div className="text-center py-24 border-2 border-dashed rounded-2xl bg-muted/20">
                    <Star className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <h3 className="text-lg font-medium">Aucun favori</h3>
                    <p className="text-muted-foreground">{"Cliquez sur l'étoile dans vos projets ou pages pour les ajouter ici."}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {favorites.map((favorite) => (
                        <div key={favorite.id} className="premium-card group hover:scale-[1.02] transition-all duration-300 bg-white dark:bg-slate-900 border-none shadow-xl overflow-hidden relative flex flex-col p-8">
                            <div className="flex items-start justify-between mb-8">
                                <div className={cn(
                                    "w-14 h-14 rounded-2xl flex items-center justify-center border shadow-inner",
                                    favorite.type === 'project' ? "bg-blue-50 border-blue-100" :
                                        favorite.type === 'dashboard' ? "bg-green-50 border-green-100" :
                                            "bg-purple-50 border-purple-100"
                                )}>
                                    {getIcon(favorite.type)}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 rounded-xl text-red-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
                                    onClick={() => removeFavorite(favorite.id)}
                                >
                                    <Trash2 className="w-5 h-5" />
                                </Button>
                            </div>

                            <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-3 bg-primary/30 rounded-full" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        {favorite.type === 'project' ? "Projet de l'agence" :
                                            favorite.type === 'dashboard' ? 'Tableau de bord' : 'Page outil'}
                                    </span>
                                </div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-tight group-hover:text-primary transition-colors">
                                    {favorite.label}
                                </h3>
                            </div>

                            <div className="mt-10 pt-6 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                                    DEPUI LE {new Date(favorite.created_at).toLocaleDateString('fr-FR')}
                                </span>
                                <Button variant="ghost" size="sm" className="h-11 px-6 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-primary gap-3" asChild>
                                    <Link href={getHref(favorite)}>
                                        OUVRIR <ExternalLink className="w-4 h-4" />
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
