'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Profile } from '@/types';

interface ModalModifierMembreProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membre: Profile | null;
  onMembreModifie: () => void;
}

export function ModalModifierMembre({ open, onOpenChange, membre, onMembreModifie }: ModalModifierMembreProps) {
  const [nomComplet, setNomComplet] = useState('');
  const [role, setRole] = useState<'chef_de_projet' | 'admin' | 'member'>('member');
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (membre) {
      setNomComplet(membre.full_name);
      // Map any legacy roles (e.g. 'po', 'dev') to the closest new role
      if (membre.role === 'chef_de_projet') {
        setRole('chef_de_projet');
      } else if (membre.role === 'admin') {
        setRole('admin');
      } else {
        setRole('member');
      }
      setNouveauMotDePasse('');
    }
  }, [membre]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!membre || !nomComplet.trim()) {
      toast({
        title: "Erreur",
        description: "Le nom complet est requis",
        variant: "destructive",
      });
      return;
    }

    if (nouveauMotDePasse && nouveauMotDePasse.length < 6) {
      toast({
        title: "Erreur",
        description: "Le mot de passe doit contenir au moins 6 caractères",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: nomComplet.trim(),
          role: role,
        })
        .eq('id', membre.id);

      if (profileError) throw profileError;

      toast({
        title: "Membre modifié !",
        description: `Les informations de ${nomComplet} ont été mises à jour`,
      });

      setNomComplet('');
      setRole('member');
      setNouveauMotDePasse('');
      onOpenChange(false);
      onMembreModifie();
    } catch (error: any) {
      console.error('Erreur lors de la modification du membre:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de modifier le membre",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!membre) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl text-[var(--navy-blue)]">Modifier le membre</DialogTitle>
          <DialogDescription>
            Modifiez les informations de {membre.full_name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="nomComplet">Nom complet *</Label>
            <Input
              id="nomComplet"
              placeholder="Ex: Ayoub Benali"
              value={nomComplet}
              onChange={(e) => setNomComplet(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Rôle *</Label>
            <Select value={role} onValueChange={(value: any) => setRole(value)} disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chef_de_projet">Chef de projet</SelectItem>
                <SelectItem value="admin">Admin (lecture seule)</SelectItem>
                <SelectItem value="member">Membre</SelectItem>
              </SelectContent>
            </Select>
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
              {loading ? 'Modification...' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
