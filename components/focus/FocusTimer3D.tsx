'use client';

import React, { useEffect, useState } from 'react';

interface FocusTimer3DProps {
    status: 'running' | 'paused' | 'stopped';
    isHovered?: boolean;
}

export default function FocusTimer3D({ isHovered = false }: FocusTimer3DProps) {
    const [renderMascot, setRenderMascot] = useState(false);

    // Keep it mounted shortly after hover loss to let the slide-out CSS transition complete
    useEffect(() => {
        let timeout: NodeJS.Timeout;
        if (isHovered) {
            setRenderMascot(true);
        } else {
            timeout = setTimeout(() => setRenderMascot(false), 500); // Wait for transition
        }
        return () => clearTimeout(timeout);
    }, [isHovered]);

    if (!renderMascot && !isHovered) return null;

    return (
        <div className="h-[155px] w-full flex justify-center items-end" style={{ pointerEvents: 'none' }}>
            <style>{`
                .bravo-mascot {
                    transform: translateY(30px);
                    opacity: 0;
                    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .bravo-mascot.visible {
                    transform: translateY(0px);
                    opacity: 1;
                }
                @keyframes bravo-bounce {
                    0%, 100% { transform: translateY(0px); }
                    50%      { transform: translateY(-7px); }
                }
                @keyframes applaud-left {
                    0%   { transform: rotate(-15deg); }
                    50%  { transform: rotate(-75deg); }
                    100% { transform: rotate(-25deg); }
                }
                @keyframes applaud-right {
                    0%   { transform: rotate(15deg); }
                    50%  { transform: rotate(75deg); }
                    100% { transform: rotate(25deg); }
                }
                @keyframes text-pop {
                    0%   { transform: scale(0) translateY(10px); opacity: 0; }
                    40%  { transform: scale(1.1) translateY(-2px); opacity: 1; }
                    60%  { transform: scale(1) translateY(0); opacity: 1; }
                    100% { transform: scale(1) translateY(0); opacity: 1; }
                }
                
                .bravo-mascot.visible {
                    animation: bravo-bounce 0.6s ease-in-out infinite alternate;
                }
                .bravo-mascot.visible .bc-speech {
                    animation: text-pop 0.6s ease forwards;
                    opacity: 1;
                }
                .bravo-mascot.visible .bc-arm-l {
                    animation: applaud-left 0.35s ease-in-out infinite alternate;
                }
                .bravo-mascot.visible .bc-arm-r {
                    animation: applaud-right 0.35s ease-in-out infinite alternate;
                }

                .bc-speech {
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
                    transform: scale(0);
                    pointer-events: none;
                }
                .bc-speech::after {
                    content: "";
                    position: absolute;
                    bottom: -9px;
                    left: 50%;
                    transform: translateX(-50%);
                    border: 9px solid transparent;
                    border-top-color: #ffffff;
                    border-bottom: none;
                }
                .bc-arm-l { transform-origin: 23px 72px; }
                .bc-arm-r { transform-origin: 87px 72px; }
            `}</style>

            <div className={`bravo-mascot ${isHovered ? 'visible' : ''}`}>
                <div className="bc-speech">
                    You're doing great!
                </div>
                <svg width="110" height="155" viewBox="0 0 110 155" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <ellipse cx="55" cy="152" rx="26" ry="4" fill="rgba(0,0,0,0.10)" />
                    {/* LEFT ARM (Applaud animation) */}
                    <g className="bc-arm-l" style={{ transform: 'rotate(-45deg)' }}>
                        <rect x="14" y="68" width="13" height="32" rx="6.5" fill="#7dd3fc" transform="rotate(12 20 68)" />
                        <circle cx="19" cy="101" r="7" fill="#bae6fd" />
                    </g>
                    {/* RIGHT ARM (Applaud animation) */}
                    <g className="bc-arm-r" style={{ transform: 'rotate(45deg)' }}>
                        <rect x="83" y="68" width="13" height="32" rx="6.5" fill="#38bdf8" transform="rotate(-10 89 68)" />
                        <circle cx="91" cy="102" r="7" fill="#7dd3fc" />
                    </g>
                    {/* BODY */}
                    <rect x="25" y="62" width="60" height="58" rx="20" fill="#38bdf8" />
                    <ellipse cx="55" cy="86" rx="16" ry="20" fill="white" fillOpacity="0.15" />
                    <path d="M30 88 Q40 80 50 88 Q60 96 70 88 Q75 84 80 88" stroke="white" strokeWidth="2.2" strokeOpacity="0.3" strokeLinecap="round" fill="none" />

                    {/* HEAD */}
                    <circle cx="55" cy="46" r="30" fill="#38bdf8" />
                    <circle cx="44" cy="35" r="9" fill="white" fillOpacity="0.13" />
                    {/* HAPPY EYES */}
                    <path d="M 37 45 Q 43 38 49 45" stroke="#0c4a6e" strokeWidth="3" fill="none" strokeLinecap="round" />
                    <path d="M 61 45 Q 67 38 73 45" stroke="#0c4a6e" strokeWidth="3" fill="none" strokeLinecap="round" />

                    {/* BLUSH CHEEKS */}
                    <circle cx="33" cy="56" r="6" fill="#f9a8d4" fillOpacity="0.8" />
                    <circle cx="77" cy="56" r="6" fill="#f9a8d4" fillOpacity="0.8" />

                    {/* BIG SMILE */}
                    <path d="M44 58 Q55 75 66 58" stroke="white" strokeWidth="3.2" strokeLinecap="round" fill="none" />

                    {/* LEGS */}
                    <g className="bc-leg-l">
                        <rect x="32" y="116" width="15" height="28" rx="7.5" fill="#0ea5e9" />
                        <ellipse cx="39" cy="144" rx="10" ry="5.5" fill="#0284c7" />
                    </g>
                    <g className="bc-leg-r">
                        <rect x="63" y="116" width="15" height="28" rx="7.5" fill="#0ea5e9" />
                        <ellipse cx="70" cy="144" rx="10" ry="5.5" fill="#0284c7" />
                    </g>
                </svg>
            </div>
        </div>
    );
}