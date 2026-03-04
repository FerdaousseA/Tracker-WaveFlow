'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface TimerContextValue {
    activeSession: any;
    currentEntry: any;
    liveSeconds: number;
    isPaused: boolean;
    pauseTimer: () => Promise<void>;
    resumeTimer: () => Promise<void>;
    stopTimer: (notes?: string) => Promise<void>;
}

const TimerContext = createContext<TimerContextValue>({
    activeSession: null,
    currentEntry: null,
    liveSeconds: 0,
    isPaused: false,
    pauseTimer: async () => { },
    resumeTimer: async () => { },
    stopTimer: async () => { },
});

export function TimerProvider({ children }: { children: React.ReactNode }) {
    const [userId, setUserId] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [activeSession, setActiveSession] = useState<any>(null);
    const [currentEntry, setCurrentEntry] = useState<any>(null);
    const [liveSeconds, setLiveSeconds] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const sessionStartRef = useRef<number | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    const accumulatedRef = useRef<number>(0);

    // ── Get Supabase user directly (no AuthContext dependency) ────────────────
    useEffect(() => {
        const getUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUserId(session.user.id);
                const { data } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single();
                setUserRole(data?.role || null);
            }
        };
        getUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                setUserId(session.user.id);
                supabase.from('profiles').select('role').eq('id', session.user.id).single()
                    .then(({ data }) => setUserRole(data?.role || null));
            } else {
                setUserId(null);
                setUserRole(null);
                setActiveSession(null);
                sessionIdRef.current = null;
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // ── Resync chrono when tab becomes visible ────────────────────────────────
    useEffect(() => {
        const onVisibility = () => {
            if (document.visibilityState === 'visible' && sessionStartRef.current && !isPaused) {
                setLiveSeconds(accumulatedRef.current + Math.floor((Date.now() - sessionStartRef.current) / 1000));
            }
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, [isPaused]);

    // ── Poll active_sessions ──────────────────────────────────────────────────
    useEffect(() => {
        if (!userId || userRole === 'admin') {
            if (pollRef.current) clearInterval(pollRef.current);
            return;
        }

        const poll = async () => {
            try {
                const { data } = await supabase
                    .from('active_sessions')
                    .select('*')
                    .eq('user_id', userId)
                    .maybeSingle();

                if (data) {
                    if (sessionIdRef.current !== data.id) {
                        sessionIdRef.current = data.id;
                        setActiveSession({ ...data });
                    } else {
                        setActiveSession((prev: any) => {
                            if (!prev) return { ...data };
                            if (prev.paused_at !== data.paused_at || prev.accumulated_seconds !== data.accumulated_seconds) {
                                return { ...data };
                            }
                            return prev;
                        });
                    }
                } else {
                    if (sessionIdRef.current !== null) {
                        sessionIdRef.current = null;
                        setActiveSession(null);
                    }
                }
            } catch (e) {
                console.error('TimerProvider poll error:', e);
            }
        };

        poll();
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(poll, 3000);

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [userId, userRole]);

    // ── Fetch entry details ───────────────────────────────────────────────────
    useEffect(() => {
        if (!activeSession?.time_entry_id) {
            setCurrentEntry(null);
            return;
        }
        supabase
            .from('time_entries')
            .select(`*, project:projects(name,id), lot:project_lots(custom_name,id), lot_task:lot_tasks(name,id)`)
            .eq('id', activeSession.time_entry_id)
            .maybeSingle()
            .then(({ data }) => setCurrentEntry(data));
    }, [activeSession?.id, activeSession?.time_entry_id]);

    // ── Live chrono ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;

        if (activeSession?.started_at) {
            const accumulated = activeSession.accumulated_seconds || 0;
            accumulatedRef.current = accumulated;
            const paused = !!activeSession.paused_at;
            setIsPaused(paused);

            if (paused) {
                // Timer is paused — show frozen accumulated time
                setLiveSeconds(accumulated);
                sessionStartRef.current = null;
            } else {
                // Timer is running — compute from started_at + accumulated
                const startMs = new Date(activeSession.started_at).getTime();
                sessionStartRef.current = startMs;
                setLiveSeconds(accumulated + Math.floor((Date.now() - startMs) / 1000));
                timerRef.current = setInterval(() => {
                    setLiveSeconds(accumulated + Math.floor((Date.now() - startMs) / 1000));
                }, 1000);
            }
        } else {
            sessionStartRef.current = null;
            accumulatedRef.current = 0;
            setIsPaused(false);
            setLiveSeconds(0);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [activeSession?.id, activeSession?.started_at, activeSession?.paused_at, activeSession?.accumulated_seconds]);

    // ── Pause (freeze chrono, do NOT save to time_entries) ───────────────────
    const pauseTimer = useCallback(async () => {
        if (!activeSession || activeSession.paused_at) return;

        const nowIso = new Date().toISOString();
        const startMs = sessionStartRef.current;
        const elapsed = startMs ? Math.floor((Date.now() - startMs) / 1000) : 0;
        const newAccumulated = (activeSession.accumulated_seconds || 0) + elapsed;

        try {
            await supabase.from('active_sessions').update({
                paused_at: nowIso,
                accumulated_seconds: newAccumulated,
            }).eq('id', activeSession.id);

            setActiveSession((prev: any) => ({
                ...prev,
                paused_at: nowIso,
                accumulated_seconds: newAccumulated,
            }));
        } catch (e) {
            console.error('pauseTimer error:', e);
            throw e;
        }
    }, [activeSession]);

    // ── Resume (restart chrono from accumulated) ──────────────────────────────
    const resumeTimer = useCallback(async () => {
        if (!activeSession || !activeSession.paused_at) return;

        const nowIso = new Date().toISOString();

        try {
            await supabase.from('active_sessions').update({
                paused_at: null,
                started_at: nowIso,
            }).eq('id', activeSession.id);

            setActiveSession((prev: any) => ({
                ...prev,
                paused_at: null,
                started_at: nowIso,
            }));
        } catch (e) {
            console.error('resumeTimer error:', e);
            throw e;
        }
    }, [activeSession]);

    // ── Stop ─────────────────────────────────────────────────────────────────
    const stopTimer = useCallback(async (notes?: string) => {
        if (!activeSession) return;

        const accumulated = activeSession.accumulated_seconds || 0;
        let exactSeconds = accumulated;
        if (!activeSession.paused_at && sessionStartRef.current) {
            exactSeconds += Math.floor((Date.now() - sessionStartRef.current) / 1000);
        }

        try {
            await supabase.from('time_entries').update({
                end_time: new Date().toISOString(),
                duration_minutes: exactSeconds,
                notes: notes || null,
            }).eq('id', activeSession.time_entry_id);

            if (currentEntry?.lot?.id) {
                const { data: lot } = await supabase.from('project_lots')
                    .select('real_time_minutes').eq('id', currentEntry.lot.id).single();
                await supabase.from('project_lots').update({
                    real_time_minutes: (lot?.real_time_minutes ?? 0) + exactSeconds,
                    actual_hours: ((lot?.real_time_minutes ?? 0) + exactSeconds) / 3600,
                }).eq('id', currentEntry.lot.id);
            }

            if (currentEntry?.lot_task?.id) {
                const { data: task } = await supabase.from('lot_tasks')
                    .select('real_time_minutes').eq('id', currentEntry.lot_task.id).single();
                await supabase.from('lot_tasks').update({
                    real_time_minutes: (task?.real_time_minutes ?? 0) + exactSeconds,
                }).eq('id', currentEntry.lot_task.id);
            }

            if (currentEntry?.project?.id) {
                const { data: proj } = await supabase.from('projects')
                    .select('real_time_minutes').eq('id', currentEntry.project.id).single();
                await supabase.from('projects').update({
                    real_time_minutes: (proj?.real_time_minutes ?? 0) + exactSeconds,
                }).eq('id', currentEntry.project.id);
            }

            await supabase.from('active_sessions').delete().eq('id', activeSession.id);

            sessionIdRef.current = null;
            accumulatedRef.current = 0;
            setActiveSession(null);
            setCurrentEntry(null);
            setLiveSeconds(0);
            setIsPaused(false);
        } catch (e) {
            console.error('stopTimer error:', e);
            throw e;
        }
    }, [activeSession, currentEntry]);

    return (
        <TimerContext.Provider value={{ activeSession, currentEntry, liveSeconds, isPaused, pauseTimer, resumeTimer, stopTimer }}>
            {children}
        </TimerContext.Provider>
    );
}

export const useTimerContext = () => useContext(TimerContext);