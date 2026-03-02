'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ModalNouveauProjet } from '@/components/projets/modal-nouveau-projet';
import { ModalEditProjet } from '@/components/projets/modal-edit-projet';
import { Plus, Archive, Pause, Play, Trash2, Folder, Briefcase, Pencil, ChevronRight } from 'lucide-react';
import type { Project } from '@/types';
import { cn } from '@/lib/utils';

interface ProjectWithClient extends Project {
  clients?: {
    name: string;
  } | null;
}

export default function ProjetsPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projets, setProjets] = useState<ProjectWithClient[]>([]);
  const [showArchived, setShowArchived] = useState<'active' | 'paused' | 'archived' | 'completed'>('active');
  const [loading, setLoading] = useState(true);

  const chargerProjets = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          clients(name),
          project_members(role_in_project)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjets(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des projets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    chargerProjets();
  }, []);

  const changerStatut = async (projectId: string, newStatus: 'active' | 'paused' | 'archived' | 'completed') => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus })
        .eq('id', projectId);

      if (error) {
        alert("Erreur base de données: " + error.message);
        throw error;
      }
      chargerProjets();
    } catch (error) {
      console.error('Erreur lors du changement de statut:', error);
    }
  };

  const supprimerProjet = async (projectId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) return;

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;
      chargerProjets();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    }
  };

  const activeCount = projets.filter(p => p.status === 'active').length;
  const pausedCount = projets.filter(p => p.status === 'paused').length;
  const completedCount = projets.filter(p => p.status === 'completed').length;
  const archivedCount = projets.filter(p => p.status === 'archived').length;

  const statusConfig = {
    active: {
      label: 'En cours',
      dot: 'bg-emerald-400',
      badge: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30',
    },
    paused: {
      label: 'En pause',
      dot: 'bg-amber-400',
      badge: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30',
    },
    completed: {
      label: 'Terminé',
      dot: 'bg-green-400',
      badge: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-100 dark:border-green-900/30',
    },
    archived: {
      label: 'Archivé',
      dot: 'bg-slate-300 dark:bg-slate-600',
      badge: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f5f7] dark:bg-slate-950">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-56 rounded-2xl bg-white dark:bg-slate-800 animate-pulse shadow-sm" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f5f7] dark:bg-slate-950">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-white">Projets</h1>
              <p className="text-[11px] text-slate-400 font-medium">Gérez vos projets et suivez leur progression</p>
            </div>
          </div>

          {profile?.role === 'chef_de_projet' && (
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-full transition-all shadow-md shadow-blue-200 dark:shadow-blue-900/30 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Nouveau Projet
            </button>
          )}
        </div>

        {/* ── Onglets Actifs / Pausés / Terminés / Archivés ── */}
        <div className="flex items-center gap-2 p-1 bg-slate-200/50 dark:bg-slate-800/50 rounded-full w-fit flex-wrap">
          <button
            onClick={() => setShowArchived('active')}
            className={cn("px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-widest transition-all", showArchived === 'active' ? "bg-white dark:bg-slate-700 text-blue-500 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}
          >
            Projets Actifs
          </button>
          <button
            onClick={() => setShowArchived('paused')}
            className={cn("px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-widest transition-all", showArchived === 'paused' ? "bg-white dark:bg-slate-700 text-amber-500 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}
          >
            Projets en Pause
          </button>
          <button
            onClick={() => setShowArchived('completed')}
            className={cn("px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-widest transition-all", showArchived === 'completed' ? "bg-white dark:bg-slate-700 text-green-500 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}
          >
            Projets Terminés
          </button>
          <button
            onClick={() => setShowArchived('archived')}
            className={cn("px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-widest transition-all", showArchived === 'archived' ? "bg-white dark:bg-slate-700 text-slate-500 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300")}
          >
            Projets Archivés
          </button>
        </div>

        {/* ── KPI Strip ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'En cours', value: activeCount, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', dot: 'bg-emerald-400' },
            { label: 'En pause', value: pausedCount, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', dot: 'bg-amber-400' },
            { label: 'Terminés', value: completedCount, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20', dot: 'bg-green-400' },
            { label: 'Archivés', value: archivedCount, color: 'text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800', dot: 'bg-slate-300 dark:bg-slate-600' },
          ].map((stat, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 border-0 shadow-sm rounded-2xl p-5 flex items-center gap-4">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", stat.bg)}>
                <span className={cn("w-3 h-3 rounded-full", stat.dot)} />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-800 dark:text-white leading-none">{stat.value}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Empty state ── */}
        {projets.filter(p => {
          if (showArchived === 'completed') return p.status === 'completed';
          if (showArchived === 'archived') return p.status === 'archived';
          if (showArchived === 'paused') return p.status === 'paused';
          return p.status === 'active';
        }).length === 0 ? (
          <div className="bg-white dark:bg-slate-800 border-0 shadow-sm rounded-2xl flex flex-col items-center justify-center py-24 text-center">
            {/* Decorative rings */}
            <div className="relative mb-8">
              <div className="w-24 h-24 rounded-full border-2 border-dashed border-blue-100 dark:border-blue-900/30 absolute -inset-4 animate-spin" style={{ animationDuration: '12s' }} />
              <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center relative z-10">
                <Folder className="w-8 h-8 text-blue-400" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Aucun projet trouvé</h3>
            <p className="text-sm text-slate-400 mb-8 max-w-xs">
              Commencez par créer votre premier projet pour organiser vos tâches et votre équipe.
            </p>
            {profile?.role === 'chef_de_projet' && (
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-full transition-all shadow-md shadow-blue-200 dark:shadow-blue-900/30"
              >
                <Plus className="w-3.5 h-3.5" />
                Créer un projet
              </button>
            )}
          </div>
        ) : (
          /* ── Project Grid ── */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projets.filter(p => {
              if (showArchived === 'completed') return p.status === 'completed';
              if (showArchived === 'archived') return p.status === 'archived';
              if (showArchived === 'paused') return p.status === 'paused';
              return p.status === 'active';
            }).map((projet) => {
              const cfg = statusConfig[projet.status as keyof typeof statusConfig] || statusConfig.active;
              return (
                <div
                  key={projet.id}
                  className="group relative bg-white dark:bg-slate-800 border-0 shadow-sm rounded-2xl overflow-hidden flex flex-col hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-200"
                >
                  {/* Color top strip + gradient fade */}
                  <div className="absolute top-0 left-0 right-0 h-1 z-10" style={{ backgroundColor: projet.color }} />
                  <div
                    className="absolute top-0 left-0 right-0 h-20 opacity-[0.04] dark:opacity-[0.07]"
                    style={{ background: `linear-gradient(to bottom, ${projet.color}, transparent)` }}
                  />

                  {/* Decorative circle accent */}
                  <div
                    className="absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-[0.07] transition-transform duration-300 group-hover:scale-125"
                    style={{ backgroundColor: projet.color }}
                  />

                  {/* Card body */}
                  <div className="p-5 flex flex-col flex-1 relative z-10">

                    {/* Title row */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      {/* Color dot + name */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: projet.color }}
                        />
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white truncate group-hover:text-blue-500 transition-colors">
                          {projet.name}
                        </h3>
                      </div>

                      {/* Status badge */}
                      <span className={cn(
                        "shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border",
                        cfg.badge
                      )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                        {cfg.label}
                      </span>
                    </div>

                    {/* Client */}
                    {(projet.clients?.name || projet.client_name) && (
                      <div className="flex items-center gap-1.5 mb-4">
                        <Briefcase className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="text-[10px] font-semibold text-slate-400 truncate">
                          {projet.clients?.name || projet.client_name}
                        </span>
                      </div>
                    )}

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Explorer button */}
                    <button
                      onClick={() => router.push(`/projets/${projet.id}`)}
                      className="w-full mt-4 flex items-center justify-center gap-2 h-9 rounded-xl text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 transition-all duration-200 hover:shadow-lg hover:shadow-blue-200 dark:hover:shadow-blue-900/30"
                    >
                      Explorer
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    {/* Actions footer */}
                    <div className="flex items-center justify-between gap-1 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                      {/* Status actions */}
                      <div className="flex gap-1 flex-wrap">
                        {projet.status === 'active' ? (
                          <button
                            onClick={() => changerStatut(projet.id, 'paused')}
                            disabled={profile?.role !== 'chef_de_projet'}
                            className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[9px] font-bold uppercase tracking-wider text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <Pause className="w-3 h-3" />
                            Pause
                          </button>
                        ) : (
                          <button
                            onClick={() => changerStatut(projet.id, 'active')}
                            disabled={profile?.role !== 'chef_de_projet'}
                            className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[9px] font-bold uppercase tracking-wider text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <Play className="w-3 h-3" />
                            Activer
                          </button>
                        )}

                        {projet.status !== 'archived' && (
                          <button
                            onClick={() => changerStatut(projet.id, 'archived')}
                            disabled={profile?.role !== 'chef_de_projet'}
                            className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[9px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <Archive className="w-3 h-3" />
                            Archiver
                          </button>
                        )}

                        {projet.status !== 'completed' && (
                          <button
                            onClick={() => changerStatut(projet.id, 'completed')}
                            disabled={profile?.role !== 'chef_de_projet'}
                            className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[9px] font-bold uppercase tracking-wider text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Terminer
                          </button>
                        )}
                      </div>

                      {/* Edit + Delete */}
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setSelectedProject(projet); setEditModalOpen(true); }}
                          disabled={profile?.role !== 'chef_de_projet'}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>

                        {profile?.role === 'chef_de_projet' && (
                          <button
                            onClick={() => supprimerProjet(projet.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ModalNouveauProjet
        open={modalOpen}
        onOpenChange={setModalOpen}
        onProjetCree={chargerProjets}
      />

      <ModalEditProjet
        project={selectedProject}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onProjetMisAJour={chargerProjets}
      />
    </div>
  );
}