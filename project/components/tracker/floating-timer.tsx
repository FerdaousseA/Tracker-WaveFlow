'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTimerContext } from '@/contexts/timer-context';
import { Square, Clock, ExternalLink } from 'lucide-react';
import Link from 'next/link';

// ── Web Notification manager ──────────────────────────────────────────────────
// Keeps a persistent notification open while timer is active.
// Updates title every second so user sees the time even when Chrome is minimized.

let notifInterval: ReturnType<typeof setInterval> | null = null;
let activeNotif: Notification | null = null;

function stopNotification() {
    if (notifInterval) { clearInterval(notifInterval); notifInterval = null; }
    if (activeNotif) { activeNotif.close(); activeNotif = null; }
    // Reset tab title
    document.title = 'WaveFlow';
}

function startNotification(taskName: string, projectName: string, startMs: number) {
    stopNotification();

    const fmt = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const tick = () => {
        const elapsed = Math.floor((Date.now() - startMs) / 1000);
        const timeStr = fmt(elapsed);
        const label = taskName || projectName || 'Timer';

        // ✅ Update browser tab title — visible even when Chrome is minimized
        document.title = `⏱ ${timeStr} — ${label}`;

        // ✅ Update notification body if supported and permitted
        if (activeNotif) {
            // Can't update body on existing notif — close and reopen every minute
            if (elapsed % 60 === 0) {
                activeNotif.close();
                try {
                    activeNotif = new Notification(`⏱ WaveFlow — ${label}`, {
                        body: `Temps écoulé : ${timeStr}\n${projectName}`,
                        icon: '/favicon.ico',
                        tag: 'wf-timer', // same tag = replaces previous
                        silent: true,
                    });
                } catch { }
            }
        }
    };

    // Request permission and show first notification
    if (typeof Notification !== 'undefined') {
        const showNotif = () => {
            try {
                const elapsed = Math.floor((Date.now() - startMs) / 1000);
                activeNotif = new Notification(`⏱ WaveFlow — ${taskName || projectName || 'Timer'}`, {
                    body: `Timer démarré — ${projectName || ''}`,
                    icon: '/favicon.ico',
                    tag: 'wf-timer',
                    silent: true,
                    requireInteraction: false,
                });
                // Click on notification → focus the tab
                activeNotif.onclick = () => {
                    window.focus();
                    activeNotif?.close();
                };
            } catch (e) {
                // Notifications not supported silently fail
            }
        };

        if (Notification.permission === 'granted') {
            showNotif();
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(perm => {
                if (perm === 'granted') showNotif();
            });
        }
    }

    // Always update tab title every second regardless of notification permission
    tick();
    notifInterval = setInterval(tick, 1000);
}

// ── Widget UI ─────────────────────────────────────────────────────────────────

function TimerWidget() {
    const { activeSession, currentEntry, liveSeconds, stopTimer } = useTimerContext();

    // Start/stop notification when session changes
    useEffect(() => {
        if (activeSession?.started_at) {
            const startMs = new Date(activeSession.started_at).getTime();
            const taskName = currentEntry?.lot_task?.name || '';
            const projectName = currentEntry?.project?.name || '';
            startNotification(taskName, projectName, startMs);
        } else {
            stopNotification();
        }
        return () => {
            // Don't stop on unmount — we want it to persist!
            // Only stop when session actually ends (handled above)
        };
    }, [activeSession?.id, currentEntry?.lot_task?.name, currentEntry?.project?.name, activeSession?.started_at]);

    // Update tab title task name when entry details load
    useEffect(() => {
        if (activeSession?.started_at && currentEntry) {
            const startMs = new Date(activeSession.started_at).getTime();
            startNotification(
                currentEntry?.lot_task?.name || '',
                currentEntry?.project?.name || '',
                startMs
            );
        }
    }, [currentEntry?.lot_task?.name, currentEntry?.project?.name]);

    if (!activeSession) return null;

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed bottom-6 right-6 z-[99999]">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 min-w-[280px] flex items-center gap-4 hover:scale-[1.02] transition-all">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Clock className="w-6 h-6 animate-pulse" />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Session Active</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    </div>
                    <div className="text-xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                        {formatTime(liveSeconds)}
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 truncate max-w-[160px]">
                        {currentEntry?.lot_task?.name || currentEntry?.project?.name || 'Chargement...'}
                        {currentEntry?.lot?.custom_name && ` / ${currentEntry.lot.custom_name}`}
                    </div>
                </div>

                <div className="flex flex-col gap-2 border-l border-slate-100 dark:border-slate-800 pl-3">
                    <button
                        onClick={() => { stopTimer(); stopNotification(); }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Arrêter"
                    >
                        <Square className="w-4 h-4 fill-current" />
                    </button>
                    <Link href="/tracker">
                        <button
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
                            title="Ouvrir Tracker"
                        >
                            <ExternalLink className="w-4 h-4" />
                        </button>
                    </Link>
                </div>
            </div>
        </div>
    );
}

export function FloatingTimer() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Ask for notification permission on load
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    if (!mounted) return null;
    return createPortal(<TimerWidget />, document.body);
}