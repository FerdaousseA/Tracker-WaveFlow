'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useTimerContext } from '@/contexts/timer-context';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Play, Pause, Square, Clock, Search, Briefcase, ChevronLeft,
  Timer, Filter, X, Lock,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Project, ProjectLot } from '@/types';
import { cn } from '@/lib/utils';

interface ProjectWithDetails extends Project {
  lots?: ProjectLot[];
  clients?: { name: string } | null;
}

interface LotTaskWithTime {
  id: string;
  name: string;
  status?: string;
  estimated_minutes?: number;
  real_time_seconds?: number;
  lot_id: string;
  project_id: string;
  created_by?: string;
  creator?: { id: string; full_name: string; avatar_url: string; };
}

interface HistoryEntry {
  id: string;
  start_time: string;
  duration_minutes: number;
  project?: { name: string };
  lot?: { custom_name: string };
  lot_task?: { name: string };
  user?: { full_name: string; avatar_url: string; };
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt_live = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};
const fmt_hms = (raw: number) => {
  const t = Math.round(raw);
  if (t <= 0) return '0s';
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  if (h === 0 && m === 0) return `${s}s`;
  if (h === 0) return `${m}min ${String(s).padStart(2, '0')}s`;
  return `${h}h ${String(m).padStart(2, '0')}min ${String(s).padStart(2, '0')}s`;
};
const fmt_full = (raw: number) => {
  const t = Math.round(raw);
  if (t <= 0) return '0s';
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}min`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  return parts.join(' ');
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TrackerPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const { activeSession, currentEntry, liveSeconds, isPaused, pauseTimer, resumeTimer, stopTimer } = useTimerContext();
  const { toast } = useToast();

  const [projects, setProjects] = useState<ProjectWithDetails[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showStopModal, setShowStopModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [navLevel, setNavLevel] = useState<'projects' | 'lots' | 'tasks'>('projects');
  const [selectedProj, setSelectedProj] = useState<ProjectWithDetails | null>(null);
  const [selectedLot, setSelectedLot] = useState<ProjectLot | null>(null);
  const [projectLots, setProjectLots] = useState<ProjectLot[]>([]);
  const [lotTasks, setLotTasks] = useState<LotTaskWithTime[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [starting, setStarting] = useState(false);

  const [filterDate, setFilterDate] = useState('');
  const [filterProject, setFilterProject] = useState('');

  const isChef = profile?.role === 'chef_de_projet';
  const isMember = profile?.role === 'member';

  useEffect(() => {
    if (profile) {
      if (profile.role === 'admin') { router.replace('/dashboard'); return; }
      fetchProjects();
      fetchTemplates();
    }
  }, [profile]);

  useEffect(() => {
    if (profile) fetchHistory();
  }, [profile, filterDate, filterProject]);

  const fetchProjects = async () => {
    try {
      let query = supabase
        .from('projects')
        .select(`*, clients(name), project_lots(*)`)
        .eq('status', 'active')
        .order('name');

      if (isMember) {
        const { data: memberships } = await supabase
          .from('project_members').select('project_id').eq('user_id', profile!.id);
        const ids = memberships?.map((m: any) => m.project_id) || [];
        if (ids.length === 0) { setProjects([]); return; }
        query = query.in('id', ids);
      }

      const { data, error } = await query;
      if (error) throw error;
      setProjects((data || []).map((p: any) => ({ ...p, lots: p.project_lots })));
    } catch (e) { console.error(e); }
  };

  const fetchTemplates = async () => {
    const { data } = await supabase.from('lot_templates').select('*');
    setTemplates(data || []);
  };

  const fetchHistory = async () => {
    if (!profile) return;
    try {
      let startOfDay: Date;
      if (filterDate) {
        startOfDay = new Date(filterDate);
        startOfDay.setHours(0, 0, 0, 0);
      } else {
        startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
      }
      const endOfDay = new Date(startOfDay);
      endOfDay.setHours(23, 59, 59, 999);

      let query = supabase
        .from('time_entries')
        .select(`id, start_time, duration_minutes, user_id,
          project:projects(name),
          lot:project_lots(custom_name),
          lot_task:lot_tasks(name),
          user:profiles!user_id(full_name, avatar_url)`)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .not('duration_minutes', 'is', null)
        .gt('duration_minutes', 0)
        .order('start_time', { ascending: false });

      if (isMember) query = query.eq('user_id', profile.id);
      if (filterProject) query = (query as any).eq('project_id', filterProject);

      const { data, error } = await query;
      if (error) throw error;
      const entries = data || [];
      setHistoryEntries(entries as any);
      const total = entries.reduce((s: number, e: any) => s + (e.duration_minutes || 0), 0);
      setTotalSeconds(Math.round(total));
    } catch (e) { console.error(e); }
  };

  const fetchTasksForLot = async (lotId: string) => {
    setLoadingTasks(true);
    try {
      let query = supabase
        .from('lot_tasks')
        .select(`*, creator:profiles!created_by(id, full_name, avatar_url)`)
        .eq('lot_id', lotId)
        // ✅ NE PAS afficher les tâches terminées dans le Tracker
        .neq('status', 'done')
        .order('created_at', { ascending: false });

      if (isMember) {
        query = query.eq('created_by', profile!.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const taskIds = (data || []).map((t: any) => t.id);
      const taskTimeMap = new Map<string, number>();
      if (taskIds.length > 0) {
        const { data: timeData } = await supabase
          .from('time_entries').select('lot_task_id, duration_minutes')
          .in('lot_task_id', taskIds).not('duration_minutes', 'is', null);
        (timeData || []).forEach((t: any) => {
          taskTimeMap.set(t.lot_task_id, (taskTimeMap.get(t.lot_task_id) || 0) + (t.duration_minutes || 0));
        });
      }

      setLotTasks((data || []).map((t: any) => ({
        ...t,
        real_time_seconds: taskTimeMap.get(t.id) || 0,
      })));
    } catch (e) { console.error(e); }
    finally { setLoadingTasks(false); }
  };

  const canStartTask = (task: LotTaskWithTime): boolean => {
    if (isChef) return true;
    return task.created_by === profile?.id;
  };

  const handleStartTask = async (task: LotTaskWithTime) => {
    if (!profile || !selectedProj || !selectedLot || starting || activeSession) return;
    if (!canStartTask(task)) {
      toast({ title: "Accès refusé", description: "Vous ne pouvez démarrer que vos propres tâches.", variant: "destructive" });
      return;
    }
    setStarting(true);
    try {
      const { data: timeEntry, error: teErr } = await supabase
        .from('time_entries')
        .insert({
          user_id: profile.id,
          entry_type: 'project',
          project_id: selectedProj.id,
          lot_id: selectedLot.id,
          lot_task_id: task.id,
          start_time: new Date().toISOString(),
          duration_minutes: 0,
          auto_pause_minutes: 0,
        })
        .select().single();
      if (teErr) throw teErr;

      const { error: sessErr } = await supabase
        .from('active_sessions')
        .insert({
          user_id: profile.id,
          time_entry_id: timeEntry.id,
          started_at: new Date().toISOString(),
          last_ping: new Date().toISOString(),
          accumulated_seconds: 0,
          paused_at: null,
        });
      if (sessErr) throw sessErr;

      toast({ title: "Timer démarré", description: task.name });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setStarting(false); }
  };

  const handleStartLot = async (lot: ProjectLot) => {
    if (!profile || !selectedProj || starting || activeSession) return;
    setStarting(true);
    try {
      const { data: timeEntry, error: teErr } = await supabase
        .from('time_entries')
        .insert({
          user_id: profile.id,
          entry_type: 'project',
          project_id: selectedProj.id,
          lot_id: lot.id,
          start_time: new Date().toISOString(),
          duration_minutes: 0,
          auto_pause_minutes: 0,
        })
        .select().single();
      if (teErr) throw teErr;

      await supabase.from('active_sessions').insert({
        user_id: profile.id,
        time_entry_id: timeEntry.id,
        started_at: new Date().toISOString(),
        last_ping: new Date().toISOString(),
        accumulated_seconds: 0,
        paused_at: null,
      });

      toast({ title: "Timer démarré", description: getLotName(lot) });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally { setStarting(false); }
  };

  const handlePause = async () => {
    try {
      await pauseTimer();
      toast({ title: "En pause", description: `Chrono suspendu à ${fmt_live(liveSeconds)}` });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  const handleResume = async () => {
    try {
      await resumeTimer();
      toast({ title: "Reprise", description: "Le chrono repart !" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  const confirmStop = async () => {
    try {
      await stopTimer(notes);
      toast({ title: "Session terminée", description: `Temps enregistré : ${fmt_hms(liveSeconds)}` });
      setShowStopModal(false);
      setNotes('');
      fetchHistory();
      if (selectedLot) fetchTasksForLot(selectedLot.id);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  const getLotName = (lot: ProjectLot | null | undefined) => {
    if (!lot) return '';
    if (lot.custom_name) return lot.custom_name;
    return templates.find(t => t.id === (lot as any).template_id)?.name || 'Lot sans nom';
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="section-title">Tracker</h1>
            <p className="section-subtitle">
              Enregistrez et gérez votre temps de travail sur les différents projets.
            </p>
          </div>
        </div>

        {/* ── Active banner ─────────────────────────────────────────────────── */}
        {activeSession && (
          <div className={cn(
            "p-5 flex flex-col md:flex-row items-center justify-between gap-4 rounded-3xl shadow-xl relative overflow-hidden",
            isPaused ? "bg-slate-600 text-white" : "bg-primary text-white"
          )}>
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24 blur-3xl" />
            <div className="relative z-10 flex items-center gap-4 flex-1 min-w-0">
              <span className="flex h-2.5 w-2.5 shrink-0 relative">
                {isPaused ? (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white/60" />
                ) : (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                  </>
                )}
              </span>
              <div className="min-w-0">
                <p className="text-white font-black text-base uppercase tracking-tight truncate">
                  {currentEntry?.lot_task?.name || 'Session en cours'}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {currentEntry?.project?.name && (
                    <span className="text-[10px] font-bold text-white/60 uppercase">{currentEntry.project.name}</span>
                  )}
                  {currentEntry?.lot?.custom_name && (
                    <><span className="text-white/30">›</span>
                      <span className="text-[10px] font-bold text-white/70 uppercase">{currentEntry.lot.custom_name}</span></>
                  )}
                  {isPaused && (
                    <span className="text-[10px] font-black text-white/80 uppercase bg-white/20 px-2 py-0.5 rounded-full ml-1">
                      En pause
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="relative z-10 flex items-center gap-2 shrink-0">
              <span className="text-2xl font-black tabular-nums text-slate-900 bg-white px-4 py-2 rounded-2xl tracking-tighter shadow-lg">
                {fmt_live(liveSeconds)}
              </span>
              {isPaused ? (
                <Button onClick={handleResume} className="h-10 px-4 rounded-xl bg-white/20 hover:bg-white/30 text-white font-black uppercase tracking-widest text-xs gap-2 border border-white/30">
                  <Play className="w-3.5 h-3.5 fill-current" /> Continuer
                </Button>
              ) : (
                <Button onClick={handlePause} className="h-10 px-4 rounded-xl bg-white/20 hover:bg-white/30 text-white font-black uppercase tracking-widest text-xs gap-2 border border-white/30">
                  <Pause className="w-3.5 h-3.5 fill-current" /> Pause
                </Button>
              )}
              <Button onClick={() => setShowStopModal(true)} className="h-10 px-4 rounded-xl bg-white text-primary hover:bg-white/90 font-black uppercase tracking-widest text-xs gap-2 shadow-lg">
                <Square className="w-3.5 h-3.5 fill-current" /> Arrêter
              </Button>
            </div>
          </div>
        )}

        {/* ── Summary ───────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm w-fit">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {filterDate ? new Date(filterDate).toLocaleDateString('fr-FR') : "Aujourd'hui"} :
          </span>
          <span className="text-sm font-black text-primary">{fmt_full(totalSeconds)}</span>
        </div>

        {/* ── Drill-down navigation ─────────────────────────────────────────── */}
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              {navLevel !== 'projects' && (
                <Button variant="ghost" size="sm"
                  onClick={() => {
                    if (navLevel === 'tasks') setNavLevel('lots');
                    else { setNavLevel('projects'); setSelectedProj(null); }
                  }}
                  className="h-9 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest gap-2">
                  <ChevronLeft className="w-4 h-4" /> Retour
                </Button>
              )}
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span
                  className={cn(navLevel === 'projects' ? 'text-primary' : 'cursor-pointer hover:text-slate-600')}
                  onClick={() => { setNavLevel('projects'); setSelectedProj(null); }}>
                  Projets
                </span>
                {navLevel !== 'projects' && (
                  <><span>/</span>
                    <span className={cn(navLevel === 'lots' ? 'text-primary' : 'cursor-pointer')} onClick={() => setNavLevel('lots')}>
                      {selectedProj?.name}
                    </span></>
                )}
                {navLevel === 'tasks' && (
                  <><span>/</span><span className="text-primary">{getLotName(selectedLot)}</span></>
                )}
              </div>
            </div>
            {navLevel === 'projects' && (
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input placeholder="Rechercher..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 rounded-xl border-none bg-slate-100 dark:bg-slate-800 text-xs font-bold" />
              </div>
            )}
          </div>

          {/* ── Level 1 : Projets ─────────────────────────────────────────── */}
          {navLevel === 'projects' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.length === 0 ? (
                <div className="col-span-full py-16 text-center rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                  <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Aucun projet actif</p>
                </div>
              ) : filteredProjects.map((project) => (
                <button key={project.id}
                  onClick={() => { setSelectedProj(project); setProjectLots(project.lots || []); setNavLevel('lots'); }}
                  className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-primary/30 transition-all p-5 text-left relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl" style={{ backgroundColor: project.color }} />
                  <div className="pl-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${project.color}20` }}>
                        <Briefcase className="w-4 h-4" style={{ color: project.color }} />
                      </div>
                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{project.lots?.length || 0} lots</span>
                    </div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight group-hover:text-primary transition-colors">
                      {project.name}
                    </h3>
                    {project.clients?.name && (
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">{project.clients.name}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── Level 2 : Lots ────────────────────────────────────────────── */}
          {navLevel === 'lots' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projectLots.length === 0 ? (
                <div className="col-span-full py-16 text-center rounded-3xl border-2 border-dashed border-slate-200">
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Aucun lot défini</p>
                </div>
              ) : projectLots.map((lot) => (
                <div key={lot.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all p-5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl bg-blue-400" />
                  <div className="pl-3">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight mb-1">{getLotName(lot)}</h3>
                    <p className="text-[10px] font-bold text-slate-400 mb-4">{(lot as any).estimated_hours || 0}h estimées</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setSelectedLot(lot); fetchTasksForLot(lot.id); setNavLevel('tasks'); }}
                        className="flex-1 flex items-center justify-center py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-100 transition-all border border-slate-100 dark:border-slate-700">
                        Voir les tâches
                      </button>
                      {isChef && (
                        <button onClick={() => handleStartLot(lot)} disabled={!!activeSession || starting}
                          className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-md",
                            activeSession || starting
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                              : "bg-primary text-white hover:scale-105 active:scale-95 shadow-primary/20")}>
                          <Play className="w-4 h-4 fill-current" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Level 3 : Tâches ──────────────────────────────────────────── */}
          {navLevel === 'tasks' && (
            loadingTasks ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => <div key={i} className="h-48 rounded-2xl bg-slate-100 animate-pulse" />)}
              </div>
            ) : lotTasks.length === 0 ? (
              <div className="py-16 text-center rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">
                  {isMember ? 'Aucune tâche assignée dans ce lot' : 'Aucune tâche active dans ce lot'}
                </p>
                {isMember && (
                  <p className="text-xs text-slate-300 mt-2">Les tâches que vous créez apparaissent ici</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lotTasks.map((task) => {
                  const isActive = !!activeSession && currentEntry?.lot_task?.id === task.id;
                  const taskSeconds = task.real_time_seconds || 0;
                  const estSeconds = (task.estimated_minutes || 0) * 60;
                  const isOverTime = taskSeconds > estSeconds && estSeconds > 0;
                  const progressPct = estSeconds > 0 ? Math.min(Math.round((taskSeconds / estSeconds) * 100), 100) : 0;
                  const liveTaskSeconds = isActive ? taskSeconds + liveSeconds : taskSeconds;

                  const canStart = canStartTask(task);
                  const isMyTask = task.created_by === profile?.id;

                  return (
                    <div key={task.id} className={cn(
                      "bg-white dark:bg-slate-900 rounded-2xl border shadow-sm transition-all p-5 flex flex-col gap-3",
                      isActive
                        ? "border-primary shadow-primary/20 shadow-md ring-2 ring-primary/10"
                        : canStart
                          ? "border-slate-100 dark:border-slate-800 hover:shadow-md"
                          : "border-slate-100 dark:border-slate-800 opacity-60"
                    )}>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full shrink-0", isMyTask ? "bg-primary" : "bg-slate-300")} />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">
                          {getLotName(selectedLot)}
                        </span>
                        {isActive && !isPaused && (
                          <span className="ml-auto flex h-1.5 w-1.5 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                          </span>
                        )}
                        {isActive && isPaused && (
                          <span className="ml-auto text-[8px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-1.5 py-0.5 rounded-md">
                            En pause
                          </span>
                        )}
                        {isMember && isMyTask && !isActive && (
                          <span className="ml-auto text-[8px] font-black text-primary uppercase tracking-widest bg-primary/10 px-1.5 py-0.5 rounded-md">
                            Ma tâche
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">{task.name}</h3>

                      {isChef && task.creator?.full_name && (
                        <div className="flex items-center gap-1.5">
                          <Avatar className="w-4 h-4 rounded-full">
                            <AvatarImage src={task.creator.avatar_url || ''} alt={task.creator.full_name} className="object-cover" />
                            <AvatarFallback className="bg-slate-200 text-slate-500 text-[8px] font-black uppercase">
                              {task.creator.full_name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            {task.creator.full_name}
                          </span>
                        </div>
                      )}

                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Temps passé</p>
                          <p className={cn("text-xl font-black tabular-nums", isOverTime ? "text-red-500" : "text-primary")}>
                            {isActive ? fmt_live(liveTaskSeconds) : fmt_hms(taskSeconds)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Estimé</p>
                          <p className="text-xl font-black text-slate-400">
                            {task.estimated_minutes
                              ? `${Math.floor(task.estimated_minutes / 60)}h ${String(task.estimated_minutes % 60).padStart(2, '0')}min`
                              : '—'}
                          </p>
                        </div>
                      </div>

                      {estSeconds > 0 && (
                        <div className="space-y-1">
                          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all", isOverTime ? "bg-red-500" : "bg-primary")}
                              style={{ width: `${progressPct}%` }} />
                          </div>
                          <p className="text-[9px] font-black text-right text-slate-300 uppercase tracking-widest">{progressPct}%</p>
                        </div>
                      )}

                      {isActive ? (
                        isPaused ? (
                          <button onClick={handleResume}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white font-black text-xs uppercase tracking-widest hover:bg-primary/90 transition-all shadow-md shadow-primary/20">
                            <Play className="w-4 h-4 fill-current" /> Continuer
                          </button>
                        ) : (
                          <button onClick={handlePause}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-500 text-white font-black text-xs uppercase tracking-widest hover:bg-orange-600 transition-all">
                            <Pause className="w-4 h-4 fill-current" /> Pause
                          </button>
                        )
                      ) : canStart ? (
                        <button onClick={() => handleStartTask(task)} disabled={!!activeSession || starting}
                          className={cn(
                            "w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all",
                            activeSession || starting
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                              : "bg-primary text-white hover:bg-primary/90 shadow-md shadow-primary/20"
                          )}>
                          <Play className="w-4 h-4 fill-current" />
                          {activeSession ? 'Timer actif' : 'Démarrer'}
                        </button>
                      ) : (
                        <div className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-black uppercase tracking-widest cursor-not-allowed">
                          <Lock className="w-3.5 h-3.5" /> Tâche d&apos;un autre membre
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* ── Historique ────────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-wrap">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Historique</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                className="h-8 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20" />
              <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
                className="h-8 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20">
                <option value="">Tous les projets</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {(filterDate || filterProject) && (
                <button onClick={() => { setFilterDate(''); setFilterProject(''); }}
                  className="h-8 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-1">
                  <X className="w-3 h-3" /> Reset
                </button>
              )}
            </div>
          </div>

          {historyEntries.length === 0 ? (
            <div className="py-10 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <p className="text-xs font-black text-slate-300 uppercase tracking-widest">Aucune session enregistrée</p>
            </div>
          ) : (
            <div className="space-y-2">
              {historyEntries.map((entry) => (
                <div key={entry.id} className="flex items-center gap-4 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Timer className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">
                      {(entry as any).lot_task?.name || 'Sans tâche'}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex-wrap">
                      <span className="text-primary/70">{(entry as any).project?.name}</span>
                      {(entry as any).lot?.custom_name && (
                        <><span className="text-slate-200">/</span><span>{(entry as any).lot.custom_name}</span></>
                      )}
                      <span className="text-slate-200">•</span>
                      <span>{new Date(entry.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {isChef && (entry as any).user?.full_name && (
                        <>
                          <span className="text-slate-200">•</span>
                          <span className="flex items-center gap-1.5">
                            <Avatar className="w-4 h-4 rounded-full">
                              <AvatarImage src={(entry as any).user.avatar_url || ''} alt={(entry as any).user.full_name} className="object-cover" />
                              <AvatarFallback className="bg-slate-200 text-slate-500 text-[8px] font-black uppercase">
                                {(entry as any).user.full_name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-primary/60 font-black">{(entry as any).user.full_name}</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20">
                    <p className="text-sm font-black text-primary tabular-nums">{fmt_hms(entry.duration_minutes || 0)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Stop Modal ────────────────────────────────────────────────────────── */}
      <Dialog open={showStopModal} onOpenChange={setShowStopModal}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight">Arrêter la session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl space-y-2">
              <p className="text-4xl font-black text-primary tabular-nums">{fmt_live(liveSeconds)}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {currentEntry?.lot_task?.name || currentEntry?.project?.name || 'Session'}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notes (optionnel)</label>
              <Textarea placeholder="Décrivez ce que vous avez accompli..." value={notes}
                onChange={(e) => setNotes(e.target.value)} rows={3} className="resize-none rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowStopModal(false)}>Annuler</Button>
            <Button onClick={confirmStop} className="bg-primary text-white font-black uppercase tracking-widest text-xs">
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}