'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';

interface ModalNouveauProjetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjetCree: () => void;
}

const COULEURS_PRESET = [
  '#06B6D4',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#10B981',
  '#EF4444',
  '#6366F1',
  '#14B8A6',
];

export function ModalNouveauProjet({ open, onOpenChange, onProjetCree }: ModalNouveauProjetProps) {
  const [nom, setNom] = useState('');
  const [couleur, setCouleur] = useState(COULEURS_PRESET[0]);
  const [deadline, setDeadline] = useState('');
  const [status, setStatus] = useState<'active' | 'paused' | 'archived' | 'completed'>('active');
  const [loading, setLoading] = useState(false);
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent, startTimer = false) => {
    e.preventDefault();

    if (!nom.trim()) {
      toast({
        title: "Erreur",
        description: "Le nom du projet est requis",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Erreur",
        description: "Vous devez être connecté pour créer un projet",
        variant: "destructive",
      });
      return;
    }

    // Only chef_de_projet can créer des projets (owners)
    if (profile?.role !== 'chef_de_projet') {
      toast({
        title: "Accès refusé",
        description: "Seuls les administrateurs peuvent créer des projets.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // 1. Insert Project (created_by = owner, trigger adds to project_members)
      const { data: projet, error: projetError } = await supabase
        .from('projects')
        .insert({
          name: nom.trim(),
          client_id: null,
          color: couleur,
          created_by: user.id,
          assigned_users: [user.id],
          status: status,
          deadline: deadline || null,
        })
        .select()
        .single();

      if (projetError) throw projetError;

      // 2. Start Timer if requested
      if (startTimer && projet) {
        const { error: timerError } = await supabase
          .from('project_timer_sessions')
          .insert({
            project_id: projet.id,
            started_by: user?.id,
            started_at: new Date().toISOString()
          });

        if (timerError) console.error('Erreur démarrage timer:', timerError);
      }

      toast({
        title: startTimer ? "Projet créé et timer démarré !" : "Projet créé !",
        description: `Le projet "${nom}" a été créé avec succès`,
      });

      setNom('');
      setCouleur(COULEURS_PRESET[0]);
      setDeadline('');
      setStatus('active');
      onOpenChange(false);
      onProjetCree();
    } catch (error: any) {
      console.error('Erreur lors de la création du projet:', error);
      const msg = error?.message || "Impossible de créer le projet";
      const isRls = msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('policy');
      toast({
        title: "Erreur",
        description: isRls ? "Droits d'accès insuffisants. Vérifiez que les migrations Supabase sont appliquées (supabase db push)." : msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Nouveau projet</DialogTitle>
          <DialogDescription>
            Créez un nouveau projet pour commencer à tracker votre temps
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="nom">Nom du projet *</Label>
            <Input
              id="nom"
              placeholder="Ex: Refonte site web"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline">Date d'échéance (optionnel)</Label>
            <Input
              id="deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Statut</Label>
            <Select value={status} onValueChange={(val: any) => setStatus(val)} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Actif</SelectItem>
                <SelectItem value="paused">Pause</SelectItem>
                <SelectItem value="completed">Terminé</SelectItem>
                <SelectItem value="archived">Archivé</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Couleur du projet</Label>
            <div className="flex gap-3 flex-wrap">
              {COULEURS_PRESET.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCouleur(c)}
                  disabled={loading}
                  className="w-10 h-10 rounded-full border-2 transition-all hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: couleur === c ? 'hsl(var(--foreground))' : 'transparent',
                    boxShadow: couleur === c ? '0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--foreground))' : 'none',
                  }}
                  aria-label={`Couleur ${c}`}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Annuler
            </Button>

            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-6"
              disabled={loading}
            >
              {loading ? 'Démarrage...' : 'Créer et Démarrer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
