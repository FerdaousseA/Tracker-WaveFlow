'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from '@/components/ui/badge';
import { ModalNouveauMembre } from '@/components/equipe/modal-nouveau-membre';
import { Plus, Trash2, Users, UserCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  user_id: string | null;
  status: string;
  created_at: string;
  profiles?: { role: string; avatar_url?: string; } | null;
}

export default function EquipePage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [modalNouveauOpen, setModalNouveauOpen] = useState(false);
  const [membres, setMembres] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && profile) {
      if (profile.role === 'member') {
        router.replace('/dashboard');
      }
    }
  }, [profile, authLoading, router]);

  const chargerMembres = useCallback(async () => {
    if (!profile?.id) return;
    try {
      let query = supabase
        .from('team_members')
        .select(`*, profiles:user_id (role, avatar_url)`)
        .order('created_at', { ascending: false });

      if (profile.role !== 'chef_de_projet' && profile.role !== 'admin') {
        query = query.eq('owner_id', profile.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setMembres(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    if (profile && profile.role !== 'member') {
      chargerMembres();
    }
  }, [profile, chargerMembres]);

  const handleSupprimer = async (id: string, nom: string) => {
    if (!confirm(`Supprimer ${nom} de l'équipe ?`)) return;
    try {
      const { error } = await supabase.from('team_members').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Membre supprimé", description: `${nom} n'est plus dans votre équipe` });
      chargerMembres();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message || "Impossible de supprimer", variant: "destructive" });
    }
  };

  const handleDesactiver = async (m: TeamMember) => {
    try {
      const { error } = await supabase
        .from('profiles').update({ is_active: false }).eq('id', m.user_id);
      if (error) throw error;
      if (m.user_id) {
        await supabase.from('notifications').insert({
          user_id: m.user_id,
          type: 'warning',
          title: '⚠️ Compte désactivé',
          message: `Votre compte a été désactivé par ${profile?.full_name || 'un administrateur'}. Contactez votre responsable pour plus d'informations.`,
          link: `/dashboard`
        });
      }
      toast({ title: "Compte désactivé", description: "Le membre ne peut plus se connecter" });
      chargerMembres();
    } catch (e: any) {
      toast({ title: "Erreur", description: "Échec de la désactivation", variant: "destructive" });
    }
  };

  const handleActiver = async (m: TeamMember) => {
    try {
      const { error } = await supabase
        .from('profiles').update({ is_active: true }).eq('id', m.user_id);
      if (error) throw error;
      if (m.user_id) {
        await supabase.from('notifications').insert({
          user_id: m.user_id,
          type: 'success',
          title: '✅ Compte réactivé',
          message: `Votre compte a été réactivé par ${profile?.full_name || 'un administrateur'}. Vous pouvez à nouveau vous connecter.`,
          link: `/dashboard`
        });
      }
      toast({ title: "Compte activé", description: "Le membre peut à nouveau se connecter" });
      chargerMembres();
    } catch (e: any) {
      toast({ title: "Erreur", description: "Échec de l'activation", variant: "destructive" });
    }
  };

  if (authLoading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (profile.role === 'member') return null;

  const actifs = membres.filter(m => m.status === 'active');

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Membres de l'équipe</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gérez vos collaborateurs et leurs accès à la plateforme.
          </p>
        </div>
        {profile.role === 'chef_de_projet' && (
          <Button
            onClick={() => setModalNouveauOpen(true)}
            className="h-10 px-5 gap-2 font-bold"
          >
            <Plus className="w-4 h-4" />
            <span>Inviter un membre</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900/50 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Membres</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white px-1">{membres.length}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/50 p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actifs</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white px-1">{actifs.length}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
            <UserCheck className="w-5 h-5 text-emerald-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
          <>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-48 w-full animate-pulse bg-slate-50 dark:bg-slate-800/50 rounded-2xl" />
            ))}
          </>
        ) : membres.length === 0 ? (
          <div className="col-span-full py-20 text-center space-y-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm">
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto text-slate-300">
              <Users size={32} />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-bold text-slate-900 dark:text-white">Aucun membre pour le moment</p>
              <p className="text-sm text-slate-500 max-w-xs mx-auto">
                Commencez par inviter vos collaborateurs pour travailler ensemble.
              </p>
            </div>
          </div>
        ) : (
          membres.map((membre) => (
            <div key={membre.id} className="group relative bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 flex flex-col justify-between overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/5 to-transparent rounded-bl-full -z-10 transition-transform group-hover:scale-110" />

              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <Avatar className="h-16 w-16 border-4 border-white dark:border-slate-900 shadow-sm">
                    <AvatarImage src={membre.profiles?.avatar_url || ''} alt={membre.full_name || 'Membre'} className="object-cover" />
                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary text-xl font-black">
                      {membre.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || membre.email.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>

                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight truncate">
                    {membre.full_name || 'En attente...'}
                  </h3>
                  <p className="text-[11px] font-bold text-slate-400 truncate tracking-tight">
                    {membre.email}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={membre.profiles?.role === 'admin' ? 'destructive' : membre.profiles?.role === 'chef_de_projet' ? 'default' : 'secondary'} className="capitalize bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-100 dark:border-slate-700">
                    {membre.profiles?.role?.replace(/_/g, ' ') || 'membre'}
                  </Badge>
                  <span className="text-[10px] text-slate-400 font-medium tracking-tight bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded-full">
                    {membre.user_id ? 'Compte lié' : 'Invitation'}
                  </span>
                </div>
              </div>

              {profile.role === 'chef_de_projet' && (
                <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-slate-50 dark:border-slate-800/50">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleSupprimer(membre.id, membre.full_name || membre.email)}
                    className="h-9 w-9 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-600 shrink-0"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              )}
              {profile.role === 'admin' && (
                <div className="mt-6 pt-4 border-t border-slate-50 dark:border-slate-800/50 flex justify-center">
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Lecture seule</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <ModalNouveauMembre
        open={modalNouveauOpen}
        onOpenChange={setModalNouveauOpen}
        onMembreCree={chargerMembres}
      />
    </div>
  );
}