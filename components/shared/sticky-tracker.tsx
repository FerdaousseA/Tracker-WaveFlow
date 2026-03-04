'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Square, Maximize2 } from 'lucide-react';

export function StickyTracker() {
  const router = useRouter();
  const pathname = usePathname();
  const { profile } = useAuth();
  const [activeSession, setActiveSession] = useState<any>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentEntry, setCurrentEntry] = useState<any>(null);

  const isTrackerPage = pathname === '/tracker';

  useEffect(() => {
    if (!profile) return;

    const checkActiveSession = async () => {
      try {
        const { data, error } = await supabase
          .from('active_sessions')
          .select('*')
          .eq('user_id', profile.id)
          .maybeSingle();

        if (data && !error) {
          setActiveSession(data);
          const startTime = new Date(data.started_at);
          const now = new Date();
          setElapsedSeconds(Math.floor((now.getTime() - startTime.getTime()) / 1000));

          await fetchCurrentEntry(data.time_entry_id);
        } else {
          setActiveSession(null);
          setCurrentEntry(null);
        }
      } catch (error) {
        console.error('Error checking active session:', error);
      }
    };

    checkActiveSession();
    const interval = setInterval(checkActiveSession, 3000);

    return () => clearInterval(interval);
  }, [profile?.id]);

  useEffect(() => {
    if (!activeSession) return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  const fetchCurrentEntry = async (timeEntryId: string) => {
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select(`
          *,
          project:projects(*),
          lot:project_lots(*),
          task:tasks(*),
          category:simple_categories(*)
        `)
        .eq('id', timeEntryId)
        .maybeSingle();

      if (error) throw error;
      setCurrentEntry(data);
    } catch (error) {
      console.error('Error fetching current entry:', error);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStop = async () => {
    router.push('/tracker');
  };

  if (!activeSession || !currentEntry || isTrackerPage) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pointer-events-none">
      <Card className="max-w-4xl mx-auto bg-white/95 backdrop-blur-sm shadow-lg border-2 border-[var(--turquoise)] pointer-events-auto">
        <div className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-gray-600">EN COURS</span>
              </div>

              <div className="text-2xl font-bold text-[var(--navy-blue)] font-mono">
                {formatTime(elapsedSeconds)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[var(--turquoise)] truncate">
                  {currentEntry.project?.name || currentEntry.category?.name}
                </div>
                {currentEntry.lot && (
                  <div className="text-xs text-gray-600 truncate">
                    {currentEntry.lot.custom_name || 'Lot'}
                    {currentEntry.task && ` > ${currentEntry.task.name}`}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => router.push('/tracker')}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Maximize2 className="w-4 h-4" />
                Voir
              </Button>
              <Button
                onClick={handleStop}
                variant="destructive"
                size="sm"
                className="gap-2"
              >
                <Square className="w-4 h-4" />
                Arrêter
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
