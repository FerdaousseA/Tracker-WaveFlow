import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateAutoPause, calculateDurationMinutes } from '@/lib/pause-calculator';
import { awardPoints, updateStreak, getMotivationalMessage } from '@/lib/gamification';
import type { ActiveSession, TimeEntry } from '@/types';

interface StartTimerParams {
  userId: string;
  entryType: 'project' | 'simple_category';
  projectId?: string;
  lotId?: string;
  taskId?: string;
  lotTaskId?: string;
  categoryId?: string;
}

export function useTimer(userId: string) {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActiveSession = async () => {
      try {
        const { data, error } = await supabase
          .from('active_sessions')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (data && !error) {
          setActiveSession(data);
          const startTime = new Date(data.started_at);
          const now = new Date();
          setElapsedSeconds(Math.floor((now.getTime() - startTime.getTime()) / 1000));
        }
      } catch (error) {
        console.error('Error fetching active session:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveSession();
  }, [userId]);

  useEffect(() => {
    if (!activeSession) return;

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
      supabase
        .from('active_sessions')
        .update({ last_ping: new Date().toISOString() })
        .eq('id', activeSession.id)
        .then();
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  const startTimer = useCallback(async (params: StartTimerParams) => {
    try {
      const { data: timeEntry, error: timeEntryError } = await supabase
        .from('time_entries')
        .insert({
          user_id: params.userId,
          entry_type: params.entryType,
          project_id: params.projectId,
          lot_id: params.lotId,
          task_id: params.taskId,
          lot_task_id: params.lotTaskId,
          category_id: params.categoryId,
          start_time: new Date().toISOString(),
          duration_minutes: 0,
          auto_pause_minutes: 0,
        })
        .select()
        .single();

      if (timeEntryError) throw timeEntryError;

      const { data: session, error: sessionError } = await supabase
        .from('active_sessions')
        .insert({
          user_id: params.userId,
          time_entry_id: timeEntry.id,
          started_at: new Date().toISOString(),
          last_ping: new Date().toISOString(),
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      setActiveSession(session);
      setElapsedSeconds(0);

      return { success: true, message: getMotivationalMessage('start') };
    } catch (error: any) {
      console.error('Error starting timer:', error);
      throw error;
    }
  }, []);

  /**
   * stopTimer
   * @param notes - optional session notes
   * @param exactSeconds - exact elapsed seconds from the live local chrono
   *   If provided, we store this value directly instead of recalculating
   *   from start_time (which loses sub-minute precision).
   *   The value is stored as-is in duration_minutes (i.e. seconds stored
   *   in the minutes column so the display can reconstruct h/min/s).
   *   Requires the DB column to be float8.
   */
  const stopTimer = useCallback(async (notes?: string, exactSeconds?: number) => {
    if (!activeSession) return;

    try {
      const endTime = new Date();
      const { data: timeEntry } = await supabase
        .from('time_entries')
        .select('start_time, project_id, lot_id, lot_task_id')
        .eq('id', activeSession.time_entry_id)
        .single();

      if (!timeEntry) throw new Error('Time entry not found');

      const startTime = new Date(timeEntry.start_time);
      const autoPauseMinutes = calculateAutoPause(startTime, endTime);

      // ✅ Use exact seconds from live chrono if provided, else fall back to calc
      const rawSeconds = exactSeconds !== undefined
        ? exactSeconds
        : Math.round((endTime.getTime() - startTime.getTime()) / 1000);

      const autoPauseSeconds = Math.round(autoPauseMinutes * 60);
      const effectiveSeconds = Math.max(rawSeconds - autoPauseSeconds, 0);

      // ✅ Store seconds as a float in the minutes column (float8 required)
      // e.g. 95 seconds → stored as 95.0 — formatters divide by 60 to display
      // This avoids losing sub-minute precision while keeping one column.
      const durationToStore = effectiveSeconds; // stored as seconds in float8 column

      const { error: updateError } = await supabase
        .from('time_entries')
        .update({
          end_time: endTime.toISOString(),
          duration_minutes: durationToStore,
          auto_pause_minutes: autoPauseMinutes,
          notes: notes || null,
        })
        .eq('id', activeSession.time_entry_id);

      if (updateError) throw updateError;

      await supabase
        .from('active_sessions')
        .delete()
        .eq('id', activeSession.id);

      // ─── Update accumulated totals (all in seconds stored as float8) ───────
      if (timeEntry.project_id) {
        const { data: proj } = await supabase
          .from('projects')
          .select('real_time_minutes')
          .eq('id', timeEntry.project_id)
          .single();
        const current = proj?.real_time_minutes ?? 0;
        await supabase
          .from('projects')
          .update({ real_time_minutes: current + durationToStore })
          .eq('id', timeEntry.project_id);
      }

      if (timeEntry.lot_id) {
        const { data: lot } = await supabase
          .from('project_lots')
          .select('real_time_minutes')
          .eq('id', timeEntry.lot_id)
          .single();
        const currentLot = lot?.real_time_minutes ?? 0;
        await supabase
          .from('project_lots')
          .update({ real_time_minutes: currentLot + durationToStore })
          .eq('id', timeEntry.lot_id);
      }

      if (timeEntry.lot_task_id) {
        const { data: lt, error: ltErr } = await supabase
          .from('lot_tasks')
          .select('*, project:projects(id, owner_id, name)')
          .eq('id', timeEntry.lot_task_id)
          .single();

        if (!ltErr && lt) {
          const currentTask = lt.real_time_minutes ?? 0;
          const newTotal = currentTask + durationToStore;

          await supabase
            .from('lot_tasks')
            .update({ real_time_minutes: newTotal })
            .eq('id', timeEntry.lot_task_id);

          // estimated_minutes is already in minutes in DB, convert to seconds to compare
          const estSeconds = ((lt.estimated_hours || 0) * 60 + (lt.estimated_minutes || 0)) * 60;
          if (estSeconds > 0 && newTotal > estSeconds && currentTask <= estSeconds) {
            await supabase.from('notifications').insert({
              user_id: lt.project.owner_id,
              type: 'warning',
              title: 'Temps Dépassé',
              message: `Le temps estimé pour la tâche "${lt.name}" (Projet: ${lt.project.name}) a été dépassé.`,
              link: `/projets/${lt.project.id}`
            });
          }
        }
      }

      const effectiveMinutesForPoints = effectiveSeconds / 60;
      const pointsResult = await awardPoints(userId, effectiveMinutesForPoints, !!notes);
      await updateStreak(userId);

      setActiveSession(null);
      setElapsedSeconds(0);

      return {
        success: true,
        duration: effectiveSeconds,
        durationMinutes: effectiveSeconds / 60,
        points: pointsResult?.pointsAwarded || 0,
      };
    } catch (error: any) {
      console.error('Error stopping timer:', error);
      throw error;
    }
  }, [activeSession, userId]);

  return {
    activeSession,
    elapsedSeconds,
    loading,
    startTimer,
    stopTimer,
  };
}