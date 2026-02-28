'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { signIn } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const motivationalMessages = [
  "Prêt à surfer sur une journée productive ?",
  "Transformez votre temps en victoires !",
  "Chaque minute compte, chaque heure brille !",
  "Aujourd'hui est le jour parfait pour briller !",
  "Le succès commence par un bon tracking !",
];

const DEFAULT_MESSAGE = motivationalMessages[0];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile } = useAuth();

  useEffect(() => {
    setMessage(motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)]);
  }, []);

  useEffect(() => {
    if (user && profile) {
      router.replace('/tracker');
    }
  }, [user, profile, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await signIn(email, password);

      if (!result.profile) {
        throw new Error('Profil non trouvé');
      }

      toast({
        title: "Connexion réussie !",
        description: "Bienvenue sur WaveFlow",
      });

      setTimeout(() => {
        router.replace('/tracker');
        router.refresh();
      }, 800);
    } catch (error: any) {
      console.error('Erreur de connexion:', error);
      toast({
        title: "Erreur de connexion",
        description: error.message || "Email ou mot de passe incorrect",
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
            Bienvenue sur WaveFlow
          </h2>
          <p className="text-lg text-gray-600">{message}</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 mb-4 md:hidden">
              <span className="text-3xl">🌊</span>
              <CardTitle className="text-2xl text-[var(--navy-blue)]">WaveFlow</CardTitle>
            </div>
            <CardTitle className="text-2xl">Connexion</CardTitle>
            <CardDescription>
              Entrez vos identifiants pour accéder à votre espace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre.email@wavedigital.ma"
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
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-[var(--turquoise)] hover:bg-[var(--turquoise-light)] text-white"
                disabled={loading}
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Pas encore de compte ?{' '}
                <Link
                  href="/inscription"
                  className="text-[var(--turquoise)] hover:underline font-medium"
                >
                  Créer un compte
                </Link>
              </p>
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
