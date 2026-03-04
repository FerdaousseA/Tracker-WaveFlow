'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    if (!loading && !hasRedirected) {
      setHasRedirected(true);
      if (user) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, hasRedirected, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--gray-50)]">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-pulse">🌊</div>
        <p className="text-lg font-semibold text-[var(--navy-blue)]">Chargement...</p>
      </div>
    </div>
  );
}
