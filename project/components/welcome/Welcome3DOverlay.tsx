'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';

export default function Welcome3DOverlay() {
    const { user, profile, loading } = useAuth();
    const [phase, setPhase] = useState<'hidden' | 'walking-in' | 'waving' | 'walking-out' | 'gone'>('gone');
    const shownForUser = useRef<string | null>(null);

    // Compute name dynamically so we don't need 'profile' in useEffect dependencies
    const firstName = (profile?.full_name || user?.user_metadata?.full_name || '').split(' ')[0];

    useEffect(() => {
        if (loading) return;

        // Reset the ref if the user logs out, so it can trigger again on the next login
        if (!user) {
            shownForUser.current = null;
            setPhase('gone');
            return;
        }

        // If we've already shown it for this specific user in this session, skip
        if (shownForUser.current === user.id) return;

        shownForUser.current = user.id;

        setPhase('hidden');
        const t1 = setTimeout(() => setPhase('walking-in'), 100);
        const t2 = setTimeout(() => setPhase('waving'), 1400);
        const t3 = setTimeout(() => setPhase('walking-out'), 3200);
        const t4 = setTimeout(() => {
            setPhase('gone');
        }, 4400);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            clearTimeout(t4);
        };
    }, [user?.id, loading]); // CRITICAL: do not include 'profile' or it cancels the timeouts!

    if (phase === 'gone') return null;

    return (
        <>
            <style>{`
                @keyframes walk-in {
                    from { transform: translateX(-200px); opacity: 0; }
                    10%  { opacity: 1; }
                    to   { transform: translateX(0px); opacity: 1; }
                }
                @keyframes walk-out {
                    from { transform: translateX(0px); opacity: 1; }
                    90%  { opacity: 1; }
                    to   { transform: translateX(220px); opacity: 0; }
                }
                @keyframes bob {
                    0%, 100% { transform: translateY(0px); }
                    50%      { transform: translateY(-7px); }
                }
                @keyframes wave-arm {
                    0%   { transform: rotate(-10deg); }
                    50%  { transform: rotate(-65deg); }
                    100% { transform: rotate(-15deg); }
                }
                @keyframes leg-l {
                    0%, 100% { transform: rotate(-18deg); }
                    50%      { transform: rotate(18deg); }
                }
                @keyframes leg-r {
                    0%, 100% { transform: rotate(18deg); }
                    50%      { transform: rotate(-18deg); }
                }
                @keyframes speech-pop {
                    0%   { transform: scale(0) translateY(10px); opacity: 0; }
                    20%  { transform: scale(1.08) translateY(-2px); opacity: 1; }
                    35%  { transform: scale(1) translateY(0); opacity: 1; }
                    85%  { transform: scale(1) translateY(0); opacity: 1; }
                    100% { transform: scale(0.85) translateY(-8px); opacity: 0; }
                }
                @keyframes blink {
                    0%, 88%, 100% { transform: scaleY(1); }
                    94%           { transform: scaleY(0.08); }
                }
                .wc-root {
                    position: fixed;
                    bottom: 50px;
                    left: 60px;
                    z-index: 99999;
                    pointer-events: none;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    width: 160px;
                }
                .wc-root.hidden { opacity: 0; }
                .wc-root.walking-in {
                    animation: walk-in 1.2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
                }
                .wc-root.waving {
                    animation: bob 0.85s ease-in-out infinite;
                }
                .wc-root.walking-out {
                    animation: walk-out 1.1s cubic-bezier(0.55, 0, 1, 0.45) forwards;
                }
                .wc-speech {
                    background: #ffffff;
                    border-radius: 18px;
                    padding: 7px 18px;
                    font-family: system-ui, sans-serif;
                    font-size: 15px;
                    font-weight: 800;
                    color: #0ea5e9;
                    box-shadow: 0 4px 24px rgba(14,165,233,0.28);
                    margin-bottom: 10px;
                    white-space: nowrap;
                    position: relative;
                    opacity: 0;
                    pointer-events: none;
                }
                .wc-speech::after {
                    content: "";
                    position: absolute;
                    bottom: -9px;
                    left: 50%;
                    transform: translateX(-50%);
                    border: 9px solid transparent;
                    border-top-color: #ffffff;
                    border-bottom: none;
                }
                .waving .wc-speech {
                    animation: speech-pop 1.8s ease forwards;
                }
                .wc-arm-r { transform-origin: 8px 4px; }
                .waving .wc-arm-r {
                    animation: wave-arm 0.45s ease-in-out infinite alternate;
                }
                .wc-leg-l { transform-origin: 8px 0px; }
                .wc-leg-r { transform-origin: 8px 0px; }
                .walking-in .wc-leg-l, .walking-out .wc-leg-l {
                    animation: leg-l 0.38s ease-in-out infinite;
                }
                .walking-in .wc-leg-r, .walking-out .wc-leg-r {
                    animation: leg-r 0.38s ease-in-out infinite;
                }
                .wc-eye { transform-origin: center center; animation: blink 3.2s ease-in-out infinite; }
            `}</style>

            <div className={`wc-root ${phase}`} style={{ pointerEvents: 'none' }}>
                <div className="wc-speech">
                    Hi{firstName ? ` ${firstName}` : ''}! 👋
                </div>
                <svg width="110" height="155" viewBox="0 0 110 155" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <ellipse cx="55" cy="152" rx="26" ry="4" fill="rgba(0,0,0,0.10)" />
                    <rect x="14" y="68" width="13" height="32" rx="6.5" fill="#7dd3fc" transform="rotate(12 20 68)" />
                    <circle cx="19" cy="101" r="7" fill="#bae6fd" />
                    <g className="wc-arm-r" style={{ transform: 'rotate(-10deg)', transformOrigin: '87px 72px' }}>
                        <rect x="83" y="68" width="13" height="32" rx="6.5" fill="#38bdf8" transform="rotate(-10 89 68)" />
                        <circle cx="91" cy="102" r="7" fill="#7dd3fc" />
                    </g>
                    <rect x="25" y="62" width="60" height="58" rx="20" fill="#38bdf8" />
                    <ellipse cx="55" cy="86" rx="16" ry="20" fill="white" fillOpacity="0.15" />
                    <path d="M30 88 Q40 80 50 88 Q60 96 70 88 Q75 84 80 88" stroke="white" strokeWidth="2.2" strokeOpacity="0.3" strokeLinecap="round" fill="none" />
                    <circle cx="55" cy="46" r="30" fill="#38bdf8" />
                    <circle cx="44" cy="35" r="9" fill="white" fillOpacity="0.13" />
                    <g className="wc-eye" style={{ transformOrigin: '43px 45px' }}>
                        <circle cx="43" cy="45" r="5.5" fill="white" />
                        <circle cx="44.5" cy="46" r="3.2" fill="#0c4a6e" />
                        <circle cx="45.5" cy="44.5" r="1" fill="white" />
                    </g>
                    <g className="wc-eye" style={{ transformOrigin: '67px 45px' }}>
                        <circle cx="67" cy="45" r="5.5" fill="white" />
                        <circle cx="68.5" cy="46" r="3.2" fill="#0c4a6e" />
                        <circle cx="69.5" cy="44.5" r="1" fill="white" />
                    </g>
                    <path d="M44 58 Q55 70 66 58" stroke="white" strokeWidth="2.8" strokeLinecap="round" fill="none" />
                    <circle cx="33" cy="56" r="6" fill="#f9a8d4" fillOpacity="0.5" />
                    <circle cx="77" cy="56" r="6" fill="#f9a8d4" fillOpacity="0.5" />
                    <g className="wc-leg-l">
                        <rect x="32" y="116" width="15" height="28" rx="7.5" fill="#0ea5e9" />
                        <ellipse cx="39" cy="144" rx="10" ry="5.5" fill="#0284c7" />
                    </g>
                    <g className="wc-leg-r">
                        <rect x="63" y="116" width="15" height="28" rx="7.5" fill="#0ea5e9" />
                        <ellipse cx="70" cy="144" rx="10" ry="5.5" fill="#0284c7" />
                    </g>
                </svg>
            </div>
        </>
    );
}