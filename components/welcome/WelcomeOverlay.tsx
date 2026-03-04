'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';

export default function WelcomeOverlay() {
    const { user, profile, loading } = useAuth();
    const [visible, setVisible] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        // Only run on client
        if (typeof window === 'undefined') return;

        // Session guard: check if already shown
        const hasShown = sessionStorage.getItem('wf_welcome_shown');

        if (!hasShown && !loading && user) {
            setShouldRender(true);
            setVisible(true);

            // Set shown in session
            sessionStorage.setItem('wf_welcome_shown', 'true');

            // Auto-hide after 2.2s
            const timer = setTimeout(() => {
                setVisible(false);
                // Remove from DOM after transition
                setTimeout(() => setShouldRender(false), 500);
            }, 2200);

            return () => clearTimeout(timer);
        }
    }, [loading, user]);

    if (!shouldRender) return null;

    const displayName = profile?.full_name || user?.user_metadata?.full_name || '';

    return (
        <div
            className={`fixed inset-0 z-[99999] flex items-center justify-center transition-opacity duration-500 bg-black/20 backdrop-blur-sm ${visible ? 'opacity-100' : 'opacity-0'}`}
        >
            <div className={`bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-8 rounded-3xl border border-white/20 shadow-2xl flex flex-col items-center gap-6 transform transition-transform duration-500 ${visible ? 'scale-100' : 'scale-90'}`}>
                {/* Wave Character SVG */}
                <div className="animate-wave-float">
                    <svg width="120" height="120" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                        {/* Body / Wave */}
                        <path
                            d="M40 100C40 66.8629 66.8629 40 100 40C133.137 40 160 66.8629 160 100C160 133.137 133.137 160 100 160C66.8629 160 40 133.137 40 100Z"
                            fill="#38bdf8"
                            fillOpacity="0.2"
                        />
                        <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M100 150C127.614 150 150 127.614 150 100C150 72.3858 127.614 50 100 50C72.3858 50 50 72.3858 50 100C50 127.614 72.3858 150 100 150ZM100 160C133.137 160 160 133.137 160 100C160 66.8629 133.137 40 100 40C66.8629 40 40 66.8629 40 100C40 133.137 66.8629 160 100 160Z"
                            fill="#38bdf8"
                        />
                        {/* Eyes */}
                        <circle cx="85" cy="90" r="4" fill="#38bdf8" />
                        <circle cx="115" cy="90" r="4" fill="#38bdf8" />
                        {/* Smile */}
                        <path d="M85 110C90 120 110 120 115 110" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
                    </svg>
                </div>

                <div className="text-center">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                        Hello{displayName ? `, ${displayName}` : ''} 👋
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium tracking-wide">
                        Ravi de vous revoir sur WaveFlow
                    </p>
                </div>

                <style jsx global>{`
                    @keyframes wave-float {
                        0%, 100% { transform: translateY(0px) rotate(0deg); }
                        50% { transform: translateY(-10px) rotate(5deg); }
                    }
                    .animate-wave-float {
                        animation: wave-float 2s ease-in-out infinite;
                    }
                `}</style>
            </div>
        </div>
    );
}
