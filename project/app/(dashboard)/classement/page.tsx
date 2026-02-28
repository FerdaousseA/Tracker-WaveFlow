'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from '@/components/ui/badge';
import { Trophy, Star, Medal, Sparkles, TrendingUp, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface MemberStats {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  points: number;
  completedTasks: { id: string; name: string }[];
}

export default function ClassementPage() {
  const { profile } = useAuth();
  const [members, setMembers] = useState<MemberStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role, points')
        .neq('role', 'admin')
        .order('points', { ascending: false });

      if (error) throw error;

      const { data: doneTasks } = await supabase
        .from('lot_tasks')
        .select('id, name, created_by')
        .eq('status', 'done');

      const memberStats: MemberStats[] = (profiles || []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name || 'Utilisateur',
        avatar_url: p.avatar_url,
        role: p.role,
        points: p.points || 0,
        completedTasks: (doneTasks || []).filter((t: any) => t.created_by === p.id)
      }));

      memberStats.sort((a, b) => b.points - a.points);
      setMembers(memberStats);
    } catch (error) {
      console.error('Erreur chargement classement:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-xl h-10 w-10 border-b-2 border-blue-500 shadow-lg shadow-blue-500/20" />
      </div>
    );
  }

  if (profile && profile.role !== 'admin') {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center mb-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <Trophy className="w-10 h-10 text-slate-400 dark:text-slate-500" />
        </div>
        <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-3">Accès restreint</h2>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-sm">
          Seuls les administrateurs peuvent consulter le classement général.
        </p>
      </div>
    );
  }

  const top3 = members.slice(0, 3);
  const others = members.slice(3);

  // Rank configs — blue palette
  const rankConfig: Record<number, {
    gradient: string;
    ring: string;
    badge: string;
    badgeText: string;
    glow: string;
    label: string;
    icon: React.ReactNode;
    avatarSize: string;
    scale: string;
  }> = {
    1: {
      gradient: 'from-blue-600 via-blue-500 to-cyan-400',
      ring: 'ring-4 ring-blue-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-900',
      badge: 'bg-blue-600',
      badgeText: 'text-white',
      glow: 'shadow-[0_0_40px_rgba(59,130,246,0.45)]',
      label: '1er',
      icon: <Trophy className="w-5 h-5 text-white fill-white" />,
      avatarSize: 'w-24 h-24',
      scale: 'scale-105',
    },
    2: {
      gradient: 'from-slate-500 via-slate-400 to-slate-300',
      ring: 'ring-4 ring-slate-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-900',
      badge: 'bg-slate-500',
      badgeText: 'text-white',
      glow: 'shadow-[0_0_30px_rgba(100,116,139,0.3)]',
      label: '2e',
      icon: <Medal className="w-4 h-4 text-white fill-white" />,
      avatarSize: 'w-20 h-20',
      scale: 'scale-100',
    },
    3: {
      gradient: 'from-blue-400 via-sky-400 to-cyan-300',
      ring: 'ring-4 ring-sky-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-900',
      badge: 'bg-sky-500',
      badgeText: 'text-white',
      glow: 'shadow-[0_0_30px_rgba(56,189,248,0.3)]',
      label: '3e',
      icon: <Medal className="w-4 h-4 text-white fill-white" />,
      avatarSize: 'w-20 h-20',
      scale: 'scale-100',
    },
  };

  const PodiumCard = ({ member, rank }: { member: MemberStats; rank: number }) => {
    const cfg = rankConfig[rank];
    const isFirst = rank === 1;

    return (
      <div className={cn(
        "relative flex flex-col items-center group",
        isFirst ? "order-1 md:order-2 z-10" : rank === 2 ? "order-2 md:order-1" : "order-3"
      )}>
        {/* Connector bar under podium */}
        <div className={cn(
          "absolute bottom-0 left-1/2 -translate-x-1/2 w-full rounded-t-2xl opacity-10 dark:opacity-5",
          `bg-gradient-to-t ${cfg.gradient}`,
          isFirst ? "h-16" : "h-10"
        )} />

        {/* Card */}
        <div className={cn(
          "relative flex flex-col items-center px-6 py-8 rounded-3xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 transition-all duration-300 w-full",
          cfg.glow,
          cfg.scale,
          "hover:-translate-y-2 hover:shadow-2xl",
          isFirst && "pb-10 pt-12"
        )}>

          {/* Animated top gradient strip */}
          <div className={cn("absolute top-0 left-0 right-0 h-1.5 rounded-t-3xl bg-gradient-to-r", cfg.gradient)} />

          {/* Floating rank badge */}
          <div className={cn(
            "absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black shadow-lg",
            cfg.badge, cfg.badgeText
          )}>
            {cfg.icon}
            {cfg.label}
          </div>

          {/* Sparkle for 1st */}
          {isFirst && (
            <>
              <div className="absolute top-4 right-4">
                <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" />
              </div>
              <div className="absolute top-8 left-5">
                <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse delay-300" />
              </div>
            </>
          )}

          {/* Avatar */}
          <div className={cn("relative mb-4", isFirst && "mt-2")}>
            <div className={cn(
              "absolute inset-0 rounded-full blur-md opacity-50 bg-gradient-to-br",
              cfg.gradient
            )} />
            <Avatar className={cn("relative border-0", cfg.avatarSize, cfg.ring)}>
              <AvatarImage src={member.avatar_url || ''} className="object-cover" />
              <AvatarFallback className={cn(
                "font-black text-2xl text-white bg-gradient-to-br",
                cfg.gradient
              )}>
                {member.full_name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Name */}
          <h3 className="font-black text-base text-slate-800 dark:text-white text-center leading-tight mb-1">
            {member.full_name}
          </h3>

          {/* Role badge */}
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-4">
            {member.role === 'chef_de_projet' ? 'Chef de Projet' : 'Membre'}
          </span>

          {/* Points pill */}
          <div className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r text-white font-black text-lg shadow-inner w-full justify-center",
            cfg.gradient
          )}>
            <Star className="w-4 h-4 fill-white text-white" />
            {member.points}
            <span className="text-[10px] font-bold opacity-80 mt-0.5">pts</span>
          </div>

          {/* Tasks count */}
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
            <CheckCircle2 className="w-3 h-3 text-blue-400" />
            {member.completedTasks.length} tâche{member.completedTasks.length !== 1 ? 's' : ''} terminée{member.completedTasks.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Podium step */}
        <div className={cn(
          "w-full rounded-b-2xl mt-0",
          isFirst ? "h-12 bg-gradient-to-b from-blue-500/20 to-transparent" : "h-8 bg-gradient-to-b from-slate-200/40 dark:from-slate-700/40 to-transparent"
        )} />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f4f5f7] dark:bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">

        {/* ── Header ── */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-3xl border-0 shadow-sm px-8 py-10 text-center">
          {/* Background grid decoration */}
          <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
            style={{
              backgroundImage: 'linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(90deg, #3b82f6 1px, transparent 1px)',
              backgroundSize: '32px 32px'
            }}
          />
          {/* Glow orbs */}
          <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute -bottom-12 -right-12 w-48 h-48 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 mb-4 shadow-inner">
              <Trophy className="w-7 h-7 text-blue-500" />
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white tracking-tight">
              Le Mur des{' '}
              <span className="bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
                Champions
              </span>
            </h1>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 font-medium max-w-md mx-auto">
              Accumulez des points en accomplissant des tâches et hissez-vous au sommet. L'implication de chacun compte !
            </p>

            {/* Stats strip */}
            <div className="flex items-center justify-center gap-6 mt-6">
              <div className="flex flex-col items-center">
                <span className="text-xl font-black text-blue-500">{members.length}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Participants</span>
              </div>
              <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
              <div className="flex flex-col items-center">
                <span className="text-xl font-black text-blue-500">{members.reduce((s, m) => s + m.completedTasks.length, 0)}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tâches finies</span>
              </div>
              <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
              <div className="flex flex-col items-center">
                <span className="text-xl font-black text-blue-500">{members[0]?.points ?? 0}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Meilleur score</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Podium ── */}
        {top3.length > 0 && (
          <div className="flex flex-col md:flex-row items-end justify-center gap-4 md:gap-6 pt-6">
            {top3[1] && <div className="w-full md:w-1/3"><PodiumCard member={top3[1]} rank={2} /></div>}
            <div className="w-full md:w-1/3"><PodiumCard member={top3[0]} rank={1} /></div>
            {top3[2] && <div className="w-full md:w-1/3"><PodiumCard member={top3[2]} rank={3} /></div>}
          </div>
        )}

        {/* ── Full leaderboard ── */}
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-blue-500" />
            </div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Classement Général</h3>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
          </div>

          <div className="space-y-3">
            {others.map((member, index) => {
              const rank = index + 4;
              const isCurrentUser = member.id === profile?.id;
              return (
                <div
                  key={member.id}
                  className={cn(
                    "group relative flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-slate-800 border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                    isCurrentUser
                      ? "border-blue-300 dark:border-blue-700 shadow-[0_0_0_2px_rgba(59,130,246,0.15)]"
                      : "border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800/50"
                  )}
                >
                  {/* Left accent bar on hover */}
                  <div className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-gradient-to-b from-blue-500 to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

                  {/* Rank number */}
                  <div className="w-10 text-center shrink-0">
                    <span className="text-lg font-black text-slate-300 dark:text-slate-600">#{rank}</span>
                  </div>

                  {/* Avatar */}
                  <Avatar className="w-12 h-12 border-2 border-slate-100 dark:border-slate-700 shrink-0">
                    <AvatarImage src={member.avatar_url || ''} className="object-cover" />
                    <AvatarFallback className="bg-blue-50 dark:bg-blue-900/20 text-blue-500 font-black text-base">
                      {member.full_name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  {/* Name + role */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-800 dark:text-white truncate">
                        {member.full_name}
                      </span>
                      {isCurrentUser && (
                        <span className="text-[9px] font-black text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                          Vous
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {member.role === 'chef_de_projet' ? 'Chef de Projet' : 'Membre'}
                    </span>
                  </div>

                  {/* Tasks */}
                  <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                    {member.completedTasks.length} tâche{member.completedTasks.length !== 1 ? 's' : ''}
                  </div>

                  {/* Points */}
                  <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-xl shrink-0">
                    <Star className="w-3.5 h-3.5 text-blue-500 fill-blue-500" />
                    <span className="font-black text-base text-blue-600 dark:text-blue-400">{member.points}</span>
                    <span className="text-[9px] font-bold text-blue-400/70 uppercase mt-0.5">pts</span>
                  </div>
                </div>
              );
            })}

            {others.length === 0 && (
              <div className="text-center p-12 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                <Trophy className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400 font-bold text-sm">Le classement s'arrête ici pour le moment !</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}