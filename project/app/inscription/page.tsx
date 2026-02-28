'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';

export default function InscriptionPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'chef_de_projet' | 'admin' | 'member'>('chef_de_projet');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile } = useAuth();

  useEffect(() => {
    if (user && profile) {
      router.replace('/tracker');
    }
  }, [user, profile, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName || !email || !password) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Erreur",
        description: "Le mot de passe doit contenir au moins 6 caractères",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      console.log('Calling supabase.auth.signUp with email/password...', {
        email,
        hasPassword: !!password,
        endpoint: process.env.NEXT_PUBLIC_SUPABASE_URL
      });
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role,
          },
          emailRedirectTo: window.location.origin + '/tracker',
        },
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error("Erreur lors de la création du compte");
      }

      toast({
        title: "Compte créé avec succès !",
        description: "Bienvenue sur WaveFlow",
      });

      setTimeout(() => {
        router.replace('/tracker');
      }, 500);
    } catch (error: any) {
      console.error('Error signing up:', error);
      toast({
        title: "Erreur lors de la création du compte",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--gray-50)] to-white p-4">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 items-center">
        <div className="hidden md:block">
          <div className="relative">
            <div className="absolute inset-0 waveflow-gradient opacity-20 blur-3xl rounded-full"></div>
            <Image
              src="https://res.cloudinary.com/du3hl0zhl/image/upload/v1761043361/LOGO_WAVE_DIGITA_AGENCY_2025_rjyfg9.png"
              alt="Wave Digital Agency Logo"
              width={400}
              height={400}
              className="relative z-10"
            />
          </div>
          <h2 className="text-3xl font-bold text-[var(--navy-blue)] mt-8 mb-4">
            Rejoignez WaveFlow
          </h2>
          <p className="text-lg text-gray-600">
            Créez votre compte et commencez à tracker votre productivité
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 mb-4 md:hidden">
              <span className="text-3xl">🌊</span>
              <CardTitle className="text-2xl text-[var(--navy-blue)]">WaveFlow</CardTitle>
            </div>
            <CardTitle className="text-2xl">Créer un compte</CardTitle>
            <CardDescription>
              Remplissez le formulaire pour créer votre compte
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nom complet</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Ayoub Benali"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ayoub@wavedigital.ma"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                />
                <p className="text-xs text-gray-500">Au moins 6 caractères</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Rôle</Label>
                <Select value={role} onValueChange={(value: any) => setRole(value)} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez un rôle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chef_de_projet">Chef de projet</SelectItem>
                    <SelectItem value="admin">Admin (lecture seule)</SelectItem>
                    <SelectItem value="member">Membre</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Le Chef de projet peut créer et gérer les projets dont il est owner. L'admin voit tout en lecture seule.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full bg-[var(--turquoise)] hover:bg-[var(--turquoise-light)] text-white"
                disabled={loading}
              >
                {loading ? 'Création du compte...' : 'Créer mon compte'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="text-sm text-[var(--turquoise)] hover:underline inline-flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour à la connexion
              </Link>
            </div>

            <p className="text-xs text-center text-gray-500 mt-6">
              Wave Digital Agency - WaveFlow v1.0
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
