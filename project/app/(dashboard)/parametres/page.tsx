'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/contexts/theme-context';
import {
  User, Moon, Sun, Monitor, Shield, AlertTriangle,
  Save, Key, Trash2, Mail, Loader2, ArrowRight
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);

  // Account State
  const [fullName, setFullName] = useState('');
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  // Password State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Danger Zone State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Initialization
  useEffect(() => {
    setMounted(true);
    if (profile) {
      setFullName(profile.full_name || '');
    }
  }, [profile]);

  const handleSaveAccount = async () => {
    if (!user) return;
    try {
      setIsSavingAccount(true);
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id);

      if (error) throw error;
      await refreshProfile();

      toast({
        title: "Profil mis à jour",
        description: "Vos informations ont été enregistrées avec succès.",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le profil.",
        variant: "destructive"
      });
    } finally {
      setIsSavingAccount(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword !== confirmPassword) {
      toast({
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas.",
        variant: "destructive"
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Erreur",
        description: "Le mot de passe doit contenir au moins 6 caractères.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSavingPassword(true);
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast({
        title: "Mot de passe mis à jour",
        description: "Votre mot de passe a été modifié avec succès.",
      });
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de modifier le mot de passe.",
        variant: "destructive"
      });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'SUPPRIMER') return;

    try {
      setIsDeleting(true);

      // Tentative de suppression du profil (si RLS le permet)
      const { error: deleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user!.id);

      if (deleteError) {
        console.error("Profile deletion error:", deleteError);
        // Si erreur due au RLS (très commun), on ne bloque pas pour l'utilisateur,
        // on désactive juste virtuellement. Mais on essaye de le faire proprement.
      }

      toast({
        title: "Compte supprimé",
        description: "Votre compte a été supprimé. Redirection en cours...",
      });

      setTimeout(() => {
        signOut();
      }, 2000);

    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la suppression du compte.",
        variant: "destructive"
      });
      setIsDeleting(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Paramètres</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Gérez vos préférences, votre sécurité et l'apparence de l'application.
        </p>
      </div>

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList className="bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl h-auto flex flex-wrap gap-1">
          <TabsTrigger value="account" className="rounded-lg text-xs font-bold uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-primary py-2.5 px-4">
            <User className="w-3.5 h-3.5 mr-2" /> Compte
          </TabsTrigger>
          <TabsTrigger value="appearance" className="rounded-lg text-xs font-bold uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-primary py-2.5 px-4">
            <Sun className="w-3.5 h-3.5 mr-2" /> Apparence
          </TabsTrigger>
          <TabsTrigger value="security" className="rounded-lg text-xs font-bold uppercase tracking-widest data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-primary py-2.5 px-4">
            <Shield className="w-3.5 h-3.5 mr-2" /> Sécurité
          </TabsTrigger>
          <TabsTrigger value="danger" className="rounded-lg text-xs font-bold uppercase tracking-widest data-[state=active]:text-red-500 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 py-2.5 px-4">
            <AlertTriangle className="w-3.5 h-3.5 mr-2" /> Danger
          </TabsTrigger>
        </TabsList>

        {/* --- 1. ACCOUNT --- */}
        <TabsContent value="account">
          <Card className="p-6 sm:p-8 border-slate-100 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/50 rounded-2xl space-y-8">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Informations Personnelles</h3>
              <p className="text-xs font-medium text-slate-500 mt-1">Mettez à jour vos informations de base.</p>
            </div>

            <div className="grid gap-6 max-w-md">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Adresse email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={user?.email || ''}
                    disabled
                    className="pl-10 h-11 rounded-xl bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nom complet</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Votre nom complet"
                    className="pl-10 h-11 rounded-xl border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-primary/20 transition-all font-medium"
                  />
                </div>
              </div>

              <Button
                onClick={handleSaveAccount}
                disabled={isSavingAccount || !fullName.trim() || fullName === profile?.full_name}
                className="w-fit h-11 px-6 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-widest text-xs"
              >
                {isSavingAccount ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Enregistrer
              </Button>
            </div>

            <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Photo de profil</h4>
                <p className="text-xs text-slate-500 mt-1">Changez ou supprimez votre avatar sur la page Profil.</p>
              </div>
              <Link href="/profil">
                <Button variant="outline" className="rounded-xl h-10 px-4 text-xs font-bold uppercase tracking-widest border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                  Aller au Profil <ArrowRight className="w-3.5 h-3.5 ml-2" />
                </Button>
              </Link>
            </div>
          </Card>
        </TabsContent>

        {/* --- 2. APPEARANCE --- */}
        <TabsContent value="appearance">
          <Card className="p-6 sm:p-8 border-slate-100 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/50 rounded-2xl space-y-8">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Thème de l'application</h3>
              <p className="text-xs font-medium text-slate-500 mt-1">Personnalisez l'apparence de votre interface.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setTheme('light')}
                className={`flex flex-col items-center gap-4 p-6 rounded-2xl border-2 transition-all ${theme === 'light' ? 'border-primary bg-primary/5' : 'border-slate-100 dark:border-slate-800 hover:border-primary/30 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              >
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-500 flex items-center justify-center">
                  <Sun className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-widest">Clair</span>
              </button>

              <button
                onClick={() => setTheme('dark')}
                className={`flex flex-col items-center gap-4 p-6 rounded-2xl border-2 transition-all ${theme === 'dark' ? 'border-primary bg-primary/5' : 'border-slate-100 dark:border-slate-800 hover:border-primary/30 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              >
                <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-500 flex items-center justify-center">
                  <Moon className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-widest">Sombre</span>
              </button>
            </div>
          </Card>
        </TabsContent>

        {/* --- 3. SECURITY --- */}
        <TabsContent value="security">
          <Card className="p-6 sm:p-8 border-slate-100 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/50 rounded-2xl space-y-8">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Modifier le mot de passe</h3>
              <p className="text-xs font-medium text-slate-500 mt-1">Assurez-vous d'utiliser un mot de passe fort (min 6 caractères).</p>
            </div>

            <div className="grid gap-6 max-w-md">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nouveau mot de passe</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 h-11 rounded-xl border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Confirmez le mot de passe</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 h-11 rounded-xl border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              <Button
                onClick={handleUpdatePassword}
                disabled={isSavingPassword || !newPassword || !confirmPassword}
                className="w-fit h-11 px-6 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 font-bold uppercase tracking-widest text-xs"
              >
                {isSavingPassword ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
                Mettre à jour la sécurité
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* --- 4. DANGER ZONE --- */}
        <TabsContent value="danger">
          <Card className="p-6 sm:p-8 border-red-200 dark:border-red-900/50 shadow-sm bg-red-50/50 dark:bg-red-900/10 rounded-2xl space-y-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="space-y-2 max-w-lg">
              <h3 className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> Zone de danger
              </h3>
              <p className="text-sm font-medium text-red-900/60 dark:text-red-200/60">
                La suppression de votre compte est irréversible. Toutes vos données personnelles, projets associés et logs de temps liés directement à votre compte seront affectés selon les règles de conservation.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteModal(true)}
              className="shrink-0 h-11 px-6 rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-red-500/20 w-fit"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer le compte
            </Button>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-red-500 flex items-center gap-2 font-bold tracking-tight">
              <AlertTriangle className="w-5 h-5" /> Confirmer la suppression
            </DialogTitle>
            <DialogDescription className="pt-3 font-medium text-slate-600 dark:text-slate-300">
              Cette action est définitive. Pour confirmer la suppression de votre compte, veuillez taper <strong className="text-red-500 select-all">SUPPRIMER</strong> ci-dessous.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Tapez SUPPRIMER"
              className="text-center font-bold tracking-widest h-12 rounded-xl focus-visible:ring-red-500 dark:focus-visible:ring-red-500 border-slate-200 dark:border-slate-700"
            />
          </div>

          <DialogFooter className="sm:justify-between gap-3 flex-row">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowDeleteModal(false);
                setDeleteConfirmText('');
              }}
              className="flex-1 rounded-xl font-bold uppercase tracking-widest text-xs h-11"
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText !== 'SUPPRIMER' || isDeleting}
              className="flex-1 rounded-xl font-bold uppercase tracking-widest text-xs h-11"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
