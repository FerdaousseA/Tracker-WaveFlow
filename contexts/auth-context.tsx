'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => { },
  refreshProfile: async () => { },
});

// Fonction centralisée pour récupérer et corriger le profil
async function fetchAndFixProfile(authUser: User): Promise<Profile | null> {
  try {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profileError) {
      console.error('Erreur profil:', profileError);
      return null;
    }

    if (!profileData) {
      return null;
    }

    // FIX: si email est NULL dans profiles, on le met à jour
    // avec l'email venant de l'objet auth Supabase
    if (!profileData.email && authUser.email) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ email: authUser.email })
        .eq('id', authUser.id);

      if (updateError) {
        console.error('Erreur mise à jour email:', updateError);
      } else {
        profileData.email = authUser.email;
      }
    }

    return profileData;
  } catch (err) {
    console.error('Erreur fetchAndFixProfile:', err);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Erreur session:', sessionError);
          setLoading(false);
          return;
        }

        if (session?.user) {
          setUser(session.user);
          const profileData = await fetchAndFixProfile(session.user);
          setProfile(profileData);
        }
      } catch (error) {
        console.error('Erreur lors de la récupération de la session:', error);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        (async () => {
          try {
            if (session?.user) {
              setUser(session.user);
              const profileData = await fetchAndFixProfile(session.user);
              setProfile(profileData);
            } else {
              setUser(null);
              setProfile(null);
            }
          } catch (error) {
            console.error('Erreur dans onAuthStateChange:', error);
          } finally {
            setLoading(false);
          }
        })();
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchAndFixProfile(user);
      setProfile(profileData);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);