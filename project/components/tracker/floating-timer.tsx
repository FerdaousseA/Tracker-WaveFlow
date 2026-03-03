'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTimerContext } from '@/contexts/timer-context';
import { Square, Clock, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import FocusTimer3DDynamic from '@/components/focus/FocusTimer3D.dynamic';

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
    const { activeSession, currentEntry, liveSeconds, stopTimer, isPaused } = useTimerContext();
    const [isHovered, setIsHovered] = useState(false);

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
        <div
            className="fixed bottom-6 right-6 z-[99999] flex flex-col items-end gap-1"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <FocusTimer3DDynamic status={isPaused ? 'paused' : activeSession ? 'running' : 'stopped'} isHovered={isHovered} />
            <div
                className="backdrop-blur-sm rounded-lg shadow-sm border px-3 py-1 flex items-center gap-2.5 hover:scale-[1.01] transition-all duration-150 h-[42px]"
                style={{
                    backgroundColor: 'rgba(56, 189, 248, 0.10)',
                    borderColor: 'rgba(56, 189, 248, 0.28)'
                }}
            >
                <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#38bdf8]" />
                    <div className="text-[13px] font-semibold text-[#38bdf8] tabular-nums tracking-wide">
                        {formatTime(liveSeconds)}
                    </div>
                </div>

                <div className="h-4 w-[1px] bg-[#38bdf8]/20" />

                <div className="flex items-center gap-2 max-w-[140px]">
                    <span className="text-[11px] font-medium text-[#38bdf8]/80 truncate">
                        {currentEntry?.lot_task?.name || currentEntry?.project?.name || '...'}
                    </span>
                    {!isPaused && <div className="w-1 h-1 rounded-full bg-[#38bdf8] animate-pulse" />}
                </div>

                <div className="flex items-center gap-1.5 ml-1">
                    <button
                        onClick={() => { stopTimer(); stopNotification(); }}
                        className="w-7 h-7 rounded-md flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-150"
                        title="Arrêter"
                    >
                        <Square className="w-3 h-3 fill-current" />
                    </button>
                    <Link href="/tracker">
                        <button
                            className="w-7 h-7 rounded-md flex items-center justify-center bg-[#38bdf8] text-white hover:bg-[#0ea5e9] transition-all duration-150"
                            title="Ouvrir Tracker"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
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