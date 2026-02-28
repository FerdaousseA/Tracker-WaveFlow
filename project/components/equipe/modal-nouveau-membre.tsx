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
import { useToast } from '@/hooks/use-toast';

interface ModalNouveauMembreProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMembreCree: () => void;
}

export function ModalNouveauMembre({ open, onOpenChange, onMembreCree }: ModalNouveauMembreProps) {
  const { profile } = useAuth();
  const [nomComplet, setNomComplet] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({
        title: "Erreur",
        description: "L'email est obligatoire",
        variant: "destructive",
      });
      return;
    }
    if (!profile?.id) return;

    setLoading(true);
    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', email.trim())
        .limit(1)
        .maybeSingle();

      const { error } = await supabase
        .from('team_members')
        .upsert(
          {
            owner_id: profile.id,
            email: email.trim().toLowerCase(),
            full_name: nomComplet.trim() || null,
            user_id: existingProfile?.id || null,
            status: 'active',
          },
          { onConflict: 'owner_id,email', ignoreDuplicates: false }
        );

      if (error) {
        if (error.code === '23505') {
          throw new Error('Ce membre est déjà dans votre équipe');
        }
        if (error.message?.includes('schema cache') || error.message?.includes('team_members')) {
          throw new Error("La table team_members n'existe pas. Exécutez la migration SQL dans Supabase (voir supabase/migrations/20260218160000_ensure_team_members.sql)");
        }
        throw error;
      }

      toast({
        title: "Membre ajouté",
        description: existingProfile ? `${nomComplet || email} peut être assigné aux projets` : "Invitez-le à s'inscrire pour l'assigner aux projets",
      });

      setNomComplet('');
      setEmail('');
      onOpenChange(false);
      onMembreCree();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'ajouter le membre",
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
          <DialogTitle className="text-2xl text-[var(--navy-blue)]">Nouveau membre</DialogTitle>
          <DialogDescription>
            Ajoutez un membre à votre équipe. Il pourra être assigné aux projets.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="membre@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nomComplet">Nom (optionnel)</Label>
            <Input
              id="nomComplet"
              placeholder="Ex: Jean Dupont"
              value={nomComplet}
              onChange={(e) => setNomComplet(e.target.value)}
              disabled={loading}
            />
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
              className="bg-[var(--turquoise)] hover:bg-[var(--turquoise-light)] text-white"
              disabled={loading}
            >
              {loading ? 'Ajout...' : 'Ajouter'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
