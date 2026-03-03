'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Star, TrendingUp, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────── */
interface MemberStats {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  points: number;
  completedTasks: { id: string; name: string }[];
}

/* ─────────────────────────────────────────────────────────────
   Mascot
   Appears from a random side each cycle.
   Says: "🏆 {firstName} est notre champion du moment !"
   championName = first name of members[0] (highest points).
───────────────────────────────────────────────────────────── */
type MascotSide = 'bottom' | 'top' | 'left' | 'right';
type MascotPhase = 'hidden' | `in-${MascotSide}` | 'bob' | `out-${MascotSide}`;

function Mascot({ championName }: { championName: string }) {
  const [phase, setPhase] = useState<MascotPhase>('hidden');
  const [pos, setPos] = useState<React.CSSProperties>({});
  const [flip, setFlip] = useState(false);
  const [bubbleDir, setBubbleDir] = useState<'above' | 'below' | 'left-bub' | 'right-bub'>('above');
  const [bubbleAnim, setBubbleAnim] = useState(false);

  const sideIdx = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearAll = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const after = (fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
  };

  /* The one and only message */
  const message = championName
    ? `🏆 ${championName} est notre champion du moment !`
    : '';

  const run = useCallback(() => {
    if (!championName) return;

    const SIDES: MascotSide[] = ['bottom', 'left', 'top', 'right'];
    const side = SIDES[sideIdx.current % 4];
    sideIdx.current++;

    const W = window.innerWidth;
    const H = window.innerHeight;
    const mW = 220;
    const mH = 320;

    let style: React.CSSProperties = {
      position: 'fixed',
      zIndex: 99999,
      pointerEvents: 'none',
      display: 'flex',
      alignItems: 'center',
    };
    let bDir: 'above' | 'below' | 'left-bub' | 'right-bub' = 'above';

    if (side === 'bottom') {
      style = { ...style, bottom: 60, left: Math.max(20, Math.min(W - mW - 20, Math.random() * (W - mW))), flexDirection: 'column' };
      bDir = 'above'; setFlip(false);
    } else if (side === 'top') {
      style = { ...style, top: 60, left: Math.max(20, Math.min(W - mW - 20, Math.random() * (W - mW))), flexDirection: 'column-reverse' };
      bDir = 'below'; setFlip(false);
    } else if (side === 'left') {
      style = { ...style, left: 30, top: Math.max(60, Math.min(H - mH - 60, Math.random() * (H - mH))), flexDirection: 'row' };
      bDir = 'right-bub'; setFlip(true);
    } else {
      style = { ...style, right: 30, top: Math.max(60, Math.min(H - mH - 60, Math.random() * (H - mH))), flexDirection: 'row-reverse' };
      bDir = 'left-bub'; setFlip(false);
    }

    setPos(style);
    setBubbleDir(bDir);
    setBubbleAnim(false);
    setPhase(`in-${side}`);

    after(() => { setPhase('bob'); setBubbleAnim(true); }, 1300);
    after(() => { setPhase(`out-${side}`); }, 4400);
    after(() => {
      setPhase('hidden');
      after(run, 5000 + Math.random() * 3000);
    }, 5600);
  }, [championName]);

  useEffect(() => {
    if (!championName) return;
    const id = setTimeout(run, 2000);
    return () => { clearTimeout(id); clearAll(); };
  }, [run, championName]);

  if (phase === 'hidden') return null;

  /* Derive animation name from phase */
  const inSide = phase.startsWith('in-') ? phase.slice(3) as MascotSide : null;
  const outSide = phase.startsWith('out-') ? phase.slice(4) as MascotSide : null;

  const wrapAnim =
    inSide === 'bottom' ? 'mascotFromBottom' :
      inSide === 'top' ? 'mascotFromTop' :
        inSide === 'left' ? 'mascotFromLeft' :
          inSide === 'right' ? 'mascotFromRight' :
            outSide === 'bottom' ? 'mascotToBottom' :
              outSide === 'top' ? 'mascotToTop' :
                outSide === 'left' ? 'mascotToLeft' :
                  outSide === 'right' ? 'mascotToRight' : 'mascotBob';

  const wrapDuration =
    phase === 'bob' ? '0.9s ease-in-out infinite' :
      phase.startsWith('in-') ? '1.2s cubic-bezier(.22,1,.36,1) forwards' :
        '1.1s cubic-bezier(.55,0,1,.45) forwards';

  const isWalking = phase !== 'bob';

  /* Bubble tail */
  const tail = (): React.CSSProperties => {
    const b: React.CSSProperties = { position: 'absolute', width: 0, height: 0, borderStyle: 'solid' };
    if (bubbleDir === 'above') return { ...b, bottom: -10, left: '50%', transform: 'translateX(-50%)', borderWidth: '10px 8px 0 8px', borderColor: 'white transparent transparent transparent' };
    if (bubbleDir === 'below') return { ...b, top: -10, left: '50%', transform: 'translateX(-50%)', borderWidth: '0 8px 10px 8px', borderColor: 'transparent transparent white transparent' };
    if (bubbleDir === 'left-bub') return { ...b, top: '50%', right: -10, transform: 'translateY(-50%)', borderWidth: '8px 0 8px 10px', borderColor: 'transparent transparent transparent white' };
    /* right-bub */                return { ...b, top: '50%', left: -10, transform: 'translateY(-50%)', borderWidth: '8px 10px 8px 0', borderColor: 'transparent white transparent transparent' };
  };

  const bubbleMargin =
    bubbleDir === 'above' ? '0 0 14px 0' :
      bubbleDir === 'below' ? '14px 0 0 0' : '0 14px';

  return (
    <div style={{ ...pos, animation: `${wrapAnim} ${wrapDuration}` }}>

      {/* Speech bubble */}
      <div style={{
        background: 'white',
        borderRadius: 18,
        padding: '9px 20px',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        fontWeight: 800,
        color: '#0ea5e9',
        boxShadow: '0 4px 24px rgba(14,165,233,0.3)',
        whiteSpace: 'nowrap',
        border: '1.5px solid rgba(59,130,246,0.15)',
        margin: bubbleMargin,
        position: 'relative',
        opacity: bubbleAnim ? undefined : 0,
        animation: bubbleAnim ? 'speechPop 3s ease forwards' : undefined,
      }}>
        {message}
        <span style={tail()} />
      </div>

      {/* SVG mascot — identical to Welcome3DOverlay */}
      <svg
        width="180" height="248"
        viewBox="0 0 110 155"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ transform: flip ? 'scaleX(-1)' : undefined, flexShrink: 0 }}
      >
        <ellipse cx="55" cy="152" rx="26" ry="4" fill="rgba(0,0,0,0.08)" />

        {/* Left arm */}
        <rect x="14" y="68" width="13" height="32" rx="6.5" fill="#7dd3fc" transform="rotate(12 20 68)" />
        <circle cx="19" cy="101" r="7" fill="#bae6fd" />

        {/* Right arm — waves when bobbing */}
        <g style={{ transformOrigin: '87px 72px', animation: phase === 'bob' ? 'waveArm 0.45s ease-in-out infinite alternate' : undefined }}>
          <rect x="83" y="68" width="13" height="32" rx="6.5" fill="#38bdf8" transform="rotate(-10 89 68)" />
          <circle cx="91" cy="102" r="7" fill="#7dd3fc" />
        </g>

        {/* Body */}
        <rect x="25" y="62" width="60" height="58" rx="20" fill="#38bdf8" />
        <ellipse cx="55" cy="86" rx="16" ry="20" fill="white" fillOpacity="0.15" />
        <path d="M30 88 Q40 80 50 88 Q60 96 70 88 Q75 84 80 88" stroke="white" strokeWidth="2.2" strokeOpacity="0.3" strokeLinecap="round" fill="none" />

        {/* Head */}
        <circle cx="55" cy="46" r="30" fill="#38bdf8" />
        <circle cx="44" cy="35" r="9" fill="white" fillOpacity="0.13" />

        {/* Eye left */}
        <g style={{ transformOrigin: '43px 45px', animation: 'mascotBlink 3.2s ease-in-out infinite' }}>
          <circle cx="43" cy="45" r="5.5" fill="white" />
          <circle cx="44.5" cy="46" r="3.2" fill="#0c4a6e" />
          <circle cx="45.5" cy="44.5" r="1" fill="white" />
        </g>

        {/* Eye right */}
        <g style={{ transformOrigin: '67px 45px', animation: 'mascotBlink 3.2s ease-in-out infinite' }}>
          <circle cx="67" cy="45" r="5.5" fill="white" />
          <circle cx="68.5" cy="46" r="3.2" fill="#0c4a6e" />
          <circle cx="69.5" cy="44.5" r="1" fill="white" />
        </g>

        {/* Smile */}
        <path d="M44 58 Q55 70 66 58" stroke="white" strokeWidth="2.8" strokeLinecap="round" fill="none" />

        {/* Cheeks */}
        <circle cx="33" cy="56" r="6" fill="#f9a8d4" fillOpacity="0.5" />
        <circle cx="77" cy="56" r="6" fill="#f9a8d4" fillOpacity="0.5" />

        {/* Leg left */}
        <g style={{ transformOrigin: '39px 116px', animation: isWalking ? 'legL 0.38s ease-in-out infinite' : undefined }}>
          <rect x="32" y="116" width="15" height="28" rx="7.5" fill="#0ea5e9" />
          <ellipse cx="39" cy="144" rx="10" ry="5.5" fill="#0284c7" />
        </g>

        {/* Leg right */}
        <g style={{ transformOrigin: '70px 116px', animation: isWalking ? 'legR 0.38s ease-in-out infinite' : undefined }}>
          <rect x="63" y="116" width="15" height="28" rx="7.5" fill="#0ea5e9" />
          <ellipse cx="70" cy="144" rx="10" ry="5.5" fill="#0284c7" />
        </g>
      </svg>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Rank configs
───────────────────────────────────────────────────────────── */
const rankCfg = {
  1: {
    gradient: 'linear-gradient(135deg,#2563eb,#22d3ee)',
    glow: 'rgba(59,130,246,0.45)',
    topLine: 'linear-gradient(90deg,transparent,#3b82f6,#22d3ee,#3b82f6,transparent)',
    topShadow: '0 0 14px rgba(59,130,246,0.5)',
    badge: 'linear-gradient(135deg,#2563eb,#22d3ee)',
    badgeShadow: '0 4px 18px rgba(59,130,246,0.4)',
    ring: 'conic-gradient(#2563eb,#22d3ee,#38bdf8,#2563eb)',
    ringShadow: '0 0 16px rgba(59,130,246,0.35)',
    platTop: 'linear-gradient(90deg,#1d4ed8,#3b82f6,#22d3ee,#3b82f6,#1d4ed8)',
    platH: 180,
    ptsBox: 'linear-gradient(135deg,#2563eb,#22d3ee)',
    ptsShadow: '0 5px 0 rgba(29,78,216,0.3),0 7px 20px rgba(59,130,246,0.3)',
    emoji: '🏆', label: '1er', animDelay: '0s', cardW: 220, cardH: 260,
  },
  2: {
    gradient: 'linear-gradient(135deg,#475569,#94a3b8)',
    glow: 'rgba(100,116,139,0.35)',
    topLine: 'linear-gradient(90deg,transparent,#94a3b8,transparent)',
    topShadow: 'none',
    badge: 'linear-gradient(135deg,#64748b,#94a3b8)',
    badgeShadow: '0 4px 12px rgba(0,0,0,0.15)',
    ring: 'conic-gradient(#94a3b8,#cbd5e1,#64748b,#94a3b8)',
    ringShadow: 'none',
    platTop: 'linear-gradient(90deg,#475569,#94a3b8,#cbd5e1,#94a3b8,#475569)',
    platH: 140,
    ptsBox: 'linear-gradient(135deg,#475569,#94a3b8)',
    ptsShadow: '0 4px 0 rgba(50,65,90,0.25),0 6px 16px rgba(0,0,0,0.1)',
    emoji: '🥈', label: '2e', animDelay: '-1.8s', cardW: 196, cardH: 234,
  },
  3: {
    gradient: 'linear-gradient(135deg,#0369a1,#38bdf8)',
    glow: 'rgba(56,189,248,0.4)',
    topLine: 'linear-gradient(90deg,transparent,#38bdf8,transparent)',
    topShadow: '0 0 12px rgba(56,189,248,0.4)',
    badge: 'linear-gradient(135deg,#0369a1,#38bdf8)',
    badgeShadow: '0 4px 14px rgba(56,189,248,0.3)',
    ring: 'conic-gradient(#38bdf8,#22d3ee,#0284c7,#38bdf8)',
    ringShadow: '0 0 12px rgba(56,189,248,0.3)',
    platTop: 'linear-gradient(90deg,#0369a1,#38bdf8,#22d3ee,#38bdf8,#0369a1)',
    platH: 110,
    ptsBox: 'linear-gradient(135deg,#0369a1,#38bdf8)',
    ptsShadow: '0 4px 0 rgba(3,50,90,0.25),0 6px 18px rgba(56,189,248,0.25)',
    emoji: '🥉', label: '3e', animDelay: '-3.5s', cardW: 186, cardH: 222,
  },
} as const;

/* ─────────────────────────────────────────────────────────────
   Cube Podium Card
───────────────────────────────────────────────────────────── */
function CubePodiumCard({ member, rank }: { member: MemberStats; rank: 1 | 2 | 3 }) {
  const cfg = rankCfg[rank];
  const isFirst = rank === 1;
  const cardRef = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = cardRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - r.left - r.width / 2) / (r.width / 2);
    const dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    el.style.animationPlayState = 'paused';
    el.style.transform = `rotateY(${dx * 20}deg) rotateX(${-dy * 16}deg)`;
  };
  const onLeave = () => {
    const el = cardRef.current; if (!el) return;
    el.style.animationPlayState = 'running';
    el.style.transform = '';
  };

  return (
    <div className="flex flex-col items-center" style={{ perspective: 900 }}>

      {/* 3D cube wrapper */}
      <div style={{ width: cfg.cardW, height: cfg.cardH, perspective: 700, marginBottom: 10 }}>
        <div
          ref={cardRef}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          style={{
            width: '100%', height: '100%',
            transformStyle: 'preserve-3d',
            animation: `cubeIdle 6s ease-in-out ${cfg.animDelay} infinite`,
            position: 'relative',
            transition: 'transform 0.15s ease-out',
          }}
        >
          {/* Top face */}
          <div style={{ position: 'absolute', width: '100%', height: 32, top: -16, left: 0, transform: 'rotateX(90deg) translateZ(16px)', background: 'linear-gradient(90deg,transparent,rgba(59,130,246,0.15),transparent)', borderRadius: '20px 20px 0 0' }} />
          {/* Right face */}
          <div style={{ position: 'absolute', width: 32, height: '100%', top: 0, right: -16, transform: 'rotateY(90deg) translateZ(16px)', background: 'linear-gradient(180deg,rgba(59,130,246,0.12),rgba(59,130,246,0.03))', borderRadius: '0 20px 20px 0' }} />

          {/* Front face */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 24,
            background: 'rgba(255,255,255,0.97)',
            border: `1.5px solid rgba(59,130,246,${isFirst ? 0.28 : 0.14})`,
            boxShadow: `0 0 0 1px rgba(59,130,246,0.05), 0 28px 64px -14px ${cfg.glow}, inset 0 1px 0 white`,
            transform: 'translateZ(16px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: isFirst ? '34px 18px 22px' : '28px 16px 18px',
            overflow: 'hidden',
          }}>
            {/* Inner shine */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: 24, background: 'linear-gradient(135deg,rgba(255,255,255,0.55) 0%,transparent 50%)', pointerEvents: 'none' }} />
            {/* Top glow line */}
            <div style={{ position: 'absolute', top: 0, left: '14%', right: '14%', height: 1.5, borderRadius: '50%', background: cfg.topLine, boxShadow: cfg.topShadow }} />
            {/* Bottom depth */}
            <div style={{ position: 'absolute', bottom: -4, left: '4%', right: '4%', height: 8, background: 'rgba(59,130,246,0.08)', filter: 'blur(4px)', borderRadius: '0 0 16px 16px' }} />

            {/* Rank badge */}
            <div style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', padding: '5px 16px', borderRadius: 20, background: cfg.badge, color: 'white', fontFamily: 'system-ui,sans-serif', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', boxShadow: cfg.badgeShadow, zIndex: 10 }}>
              {cfg.emoji} {cfg.label}
            </div>

            {/* Sparkles rank 1 */}
            {isFirst && <>
              <div style={{ position: 'absolute', top: 14, right: 18, width: 6, height: 6, borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 8px #22d3ee', animation: 'sparkAnim 2.4s ease-in-out infinite' }} />
              <div style={{ position: 'absolute', top: 28, left: 20, width: 4, height: 4, borderRadius: '50%', background: '#3b82f6', boxShadow: '0 0 6px #3b82f6', animation: 'sparkAnim 2.4s ease-in-out 0.8s infinite' }} />
              <div style={{ position: 'absolute', bottom: 24, right: 22, width: 4, height: 4, borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 5px #38bdf8', animation: 'sparkAnim 2.4s ease-in-out 1.5s infinite' }} />
            </>}

            {/* Avatar */}
            <div style={{ position: 'relative', marginBottom: 12, flexShrink: 0 }}>
              <div style={{ position: 'absolute', inset: -3, borderRadius: '50%', background: cfg.ring, boxShadow: cfg.ringShadow, animation: 'ringRotate 5s linear infinite' }} />
              <Avatar className={cn('relative border-[3px] border-white', isFirst ? 'w-[68px] h-[68px]' : 'w-[56px] h-[56px]')} style={{ zIndex: 1 }}>
                <AvatarImage src={member.avatar_url || ''} className="object-cover" />
                <AvatarFallback className="font-black text-2xl text-white" style={{ background: cfg.gradient }}>
                  {member.full_name?.charAt(0).toUpperCase() ?? '?'}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Name */}
            <h3 className="font-black text-[13px] text-slate-800 text-center leading-tight mb-[2px]">{member.full_name}</h3>
            {/* Role */}
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3">
              {member.role === 'chef_de_projet' ? 'Chef de Projet' : 'Membre'}
            </span>

            {/* Points */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '10px 0', borderRadius: 13, background: cfg.ptsBox, color: 'white', fontFamily: 'system-ui,sans-serif', fontWeight: 900, fontSize: 18, position: 'relative', overflow: 'hidden', boxShadow: cfg.ptsShadow }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', background: 'linear-gradient(to bottom,rgba(255,255,255,0.22),transparent)', borderRadius: '13px 13px 0 0' }} />
              <Star className="w-4 h-4 fill-white text-white" />
              {member.points.toLocaleString()}
              <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.75, alignSelf: 'flex-end', marginBottom: 2 }}>pts</span>
            </div>

            {/* Tasks */}
            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#3b82f6', boxShadow: '0 0 5px rgba(59,130,246,0.5)' }} />
              {member.completedTasks.length} tâche{member.completedTasks.length !== 1 ? 's' : ''} terminée{member.completedTasks.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Podium step */}
      <div style={{ width: cfg.cardW, position: 'relative' }}>
        <div style={{ height: isFirst ? 16 : rank === 2 ? 12 : 10, width: '100%', borderRadius: '6px 6px 0 0', background: cfg.platTop, boxShadow: isFirst ? '0 -3px 16px rgba(59,130,246,0.35)' : undefined }} />
        <div style={{ height: cfg.platH, width: '100%', background: `linear-gradient(180deg,rgba(59,130,246,${isFirst ? 0.07 : 0.04}) 0%,rgba(59,130,246,0.01) 100%)`, border: '1px solid rgba(59,130,246,0.08)', borderTop: 'none', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'system-ui', fontWeight: 900, fontSize: 72, color: 'rgba(59,130,246,0.035)', userSelect: 'none' }}>{rank}</span>
          <div style={{ position: 'absolute', right: -7, top: 0, bottom: 0, width: 7, background: `linear-gradient(180deg,rgba(59,130,246,${isFirst ? 0.4 : 0.25}),transparent)`, transform: 'skewY(-2deg)', transformOrigin: 'left' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 40, background: 'linear-gradient(to bottom,transparent,rgba(240,246,255,0.8))' }} />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Page
───────────────────────────────────────────────────────────── */
export default function ClassementPage() {
  const { profile } = useAuth();
  const [members, setMembers] = useState<MemberStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => { fetchLeaderboard(); }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role, points')
        .neq('role', 'admin')
        .order('points', { ascending: false });
      if (error) throw error;

      const { data: doneTasks } = await supabase
        .from('lot_tasks')
        .select('id, name, created_by')
        .eq('status', 'done');

      const stats: MemberStats[] = (profiles || []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name || 'Utilisateur',
        avatar_url: p.avatar_url,
        role: p.role,
        points: p.points || 0,
        completedTasks: (doneTasks || []).filter((t: any) => t.created_by === p.id),
      }));
      stats.sort((a, b) => b.points - a.points);
      setMembers(stats);
    } catch (err) {
      console.error('Erreur chargement classement:', err);
    } finally {
      setLoading(false);
    }
  };

  /* Loading */
  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="relative w-14 h-14">
        <div className="absolute inset-0 rounded-2xl border-2 border-blue-500/30 animate-ping" />
        <div className="absolute inset-2 rounded-xl border-2 border-cyan-400/50 animate-spin" />
        <div className="absolute inset-4 rounded-lg bg-blue-500 animate-pulse shadow-lg shadow-blue-500/50" />
      </div>
    </div>
  );

  /* Restricted */
  if (profile && profile.role !== 'admin') return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-8 text-center">
      <div className="w-20 h-20 rounded-3xl bg-blue-50 flex items-center justify-center mb-6" style={{ boxShadow: '0 8px 0 rgba(59,130,246,0.15),0 12px 28px rgba(59,130,246,0.15)' }}>
        <Trophy className="w-10 h-10 text-blue-400" />
      </div>
      <h2 className="text-3xl font-black text-slate-800 mb-3">Accès restreint</h2>
      <p className="text-sm font-medium text-slate-500 max-w-sm">Seuls les administrateurs peuvent consulter le classement général.</p>
    </div>
  );

  const top3 = members.slice(0, 3);
  const others = members.slice(3);
  const podiumOrder = [top3[1], top3[0], top3[2]]; // 2nd | 1st | 3rd

  /* First name of the #1 member → passed to Mascot */
  const championFirstName = members[0]?.full_name?.split(' ')[0] ?? '';

  return (
    <>
      {/* ══════════════════════════════════════
          Global keyframes
      ══════════════════════════════════════ */}
      <style>{`
        @keyframes cubeIdle {
          0%   { transform: rotateY(0deg)   rotateX(0deg);  }
          10%  { transform: rotateY(18deg)  rotateX(3deg);  }
          20%  { transform: rotateY(0deg)   rotateX(0deg);  }
          30%  { transform: rotateY(-14deg) rotateX(-2deg); }
          40%  { transform: rotateY(0deg)   rotateX(0deg);  }
          55%  { transform: rotateY(0deg)   rotateX(0deg);  }
          70%  { transform: rotateY(0deg)   rotateX(0deg);  }
          80%  { transform: rotateY(20deg)  rotateX(4deg);  }
          90%  { transform: rotateY(-8deg)  rotateX(-2deg); }
          100% { transform: rotateY(0deg)   rotateX(0deg);  }
        }
        @keyframes ringRotate  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes sparkAnim   { 0%,100%{opacity:0;transform:scale(0)} 50%{opacity:1;transform:scale(1)} }
        @keyframes rowIn       { from{opacity:0;transform:perspective(600px) rotateX(14deg) translateY(22px)} to{opacity:1;transform:perspective(600px) rotateX(0) translateY(0)} }
        @keyframes headerFloat { 0%,100%{transform:perspective(1000px) rotateX(3deg)} 50%{transform:perspective(1000px) rotateX(0deg) translateY(-4px)} }
        @keyframes bgScan      { from{bottom:0} to{bottom:55%} }
        @keyframes orbFloat1   { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(20px,-18px) scale(1.08)} }
        @keyframes orbFloat2   { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-18px,22px) scale(0.94)} }

        @keyframes mascotBlink       { 0%,88%,100%{transform:scaleY(1)} 94%{transform:scaleY(0.08)} }
        @keyframes speechPop         { 0%{transform:scale(0) translateY(10px);opacity:0} 18%{transform:scale(1.06) translateY(-2px);opacity:1} 32%{transform:scale(1) translateY(0);opacity:1} 88%{transform:scale(1) translateY(0);opacity:1} 100%{transform:scale(.85) translateY(-8px);opacity:0} }
        @keyframes waveArm           { 0%{transform:rotate(-10deg)} 100%{transform:rotate(-68deg)} }
        @keyframes legL              { 0%,100%{transform:rotate(-18deg)} 50%{transform:rotate(18deg)} }
        @keyframes legR              { 0%,100%{transform:rotate(18deg)} 50%{transform:rotate(-18deg)} }
        @keyframes mascotBob         { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes mascotFromBottom  { from{transform:translateY(260px);opacity:0} 10%{opacity:1} to{transform:translateY(0);opacity:1} }
        @keyframes mascotToBottom    { from{transform:translateY(0);opacity:1} 90%{opacity:1} to{transform:translateY(260px);opacity:0} }
        @keyframes mascotFromTop     { from{transform:translateY(-260px);opacity:0} 10%{opacity:1} to{transform:translateY(0);opacity:1} }
        @keyframes mascotToTop       { from{transform:translateY(0);opacity:1} 90%{opacity:1} to{transform:translateY(-260px);opacity:0} }
        @keyframes mascotFromLeft    { from{transform:translateX(-260px);opacity:0} 10%{opacity:1} to{transform:translateX(0);opacity:1} }
        @keyframes mascotToLeft      { from{transform:translateX(0);opacity:1} 90%{opacity:1} to{transform:translateX(-260px);opacity:0} }
        @keyframes mascotFromRight   { from{transform:translateX(260px);opacity:0} 10%{opacity:1} to{transform:translateX(0);opacity:1} }
        @keyframes mascotToRight     { from{transform:translateX(0);opacity:1} 90%{opacity:1} to{transform:translateX(260px);opacity:0} }
      `}</style>

      {/* ══════════════════════════════════════
          Background
      ══════════════════════════════════════ */}
      <div className="fixed inset-0 z-0 overflow-hidden" style={{ background: 'linear-gradient(160deg,#f0f6ff 0%,#e8f2ff 40%,#f5f9ff 100%)' }}>
        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(59,130,246,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.06) 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="absolute" style={{ bottom: '-5%', left: '-20%', width: '140%', height: '55%', backgroundImage: 'linear-gradient(rgba(59,130,246,0.11) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.11) 1px,transparent 1px)', backgroundSize: '56px 56px', transform: 'perspective(600px) rotateX(55deg)', transformOrigin: 'center bottom', maskImage: 'radial-gradient(ellipse 80% 55% at 50% 100%,black 20%,transparent 100%)', WebkitMaskImage: 'radial-gradient(ellipse 80% 55% at 50% 100%,black 20%,transparent 100%)' }} />
        <div className="absolute left-0 right-0" style={{ height: 1.5, background: 'linear-gradient(90deg,transparent,rgba(59,130,246,0.35),rgba(34,211,238,0.45),rgba(59,130,246,0.35),transparent)', animation: 'bgScan 6s linear infinite', bottom: 0 }} />
        <div className="absolute rounded-full pointer-events-none" style={{ width: 420, height: 420, background: 'rgba(59,130,246,0.07)', filter: 'blur(70px)', top: -100, left: -80, animation: 'orbFloat1 14s ease-in-out infinite alternate' }} />
        <div className="absolute rounded-full pointer-events-none" style={{ width: 320, height: 320, background: 'rgba(34,211,238,0.06)', filter: 'blur(70px)', top: -70, right: -60, animation: 'orbFloat2 16s ease-in-out infinite alternate' }} />
      </div>

      {/* ══════════════════════════════════════
          Mascot — announces champion #1
      ══════════════════════════════════════ */}
      <Mascot championName={championFirstName} />

      {/* ══════════════════════════════════════
          Page
      ══════════════════════════════════════ */}
      <div className="relative z-10 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">

          {/* Header */}
          <div style={{ perspective: 1000 }}>
            <div
              className="relative overflow-hidden rounded-3xl text-center"
              style={{ background: 'rgba(255,255,255,0.93)', border: '1px solid rgba(59,130,246,0.16)', boxShadow: '0 0 0 1px rgba(59,130,246,0.06),0 3px 0 rgba(59,130,246,0.1),0 20px 60px -14px rgba(59,130,246,0.18)', animation: 'headerFloat 7s ease-in-out infinite', backdropFilter: 'blur(20px)' }}
            >
              <div style={{ position: 'absolute', top: 0, left: '12%', right: '12%', height: 1.5, borderRadius: '50%', background: 'linear-gradient(90deg,transparent,#3b82f6,#22d3ee,#3b82f6,transparent)', boxShadow: '0 0 16px rgba(59,130,246,0.4)' }} />
              <div style={{ position: 'absolute', bottom: -4, left: '5%', right: '5%', height: 8, background: 'rgba(59,130,246,0.1)', filter: 'blur(4px)', borderRadius: '0 0 16px 16px' }} />
              <div className="absolute rounded-full pointer-events-none" style={{ width: 240, height: 240, background: 'rgba(59,130,246,0.07)', filter: 'blur(50px)', top: -60, left: -60, animation: 'orbFloat1 8s ease-in-out infinite' }} />
              <div className="absolute rounded-full pointer-events-none" style={{ width: 200, height: 200, background: 'rgba(34,211,238,0.06)', filter: 'blur(50px)', bottom: -50, right: -50, animation: 'orbFloat2 10s ease-in-out infinite' }} />
              <div style={{ position: 'absolute', inset: 0, borderRadius: 28, background: 'linear-gradient(135deg,rgba(255,255,255,0.5) 0%,transparent 45%)', pointerEvents: 'none' }} />

              <div className="relative px-8 py-10">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 mb-4" style={{ boxShadow: '0 8px 0 rgba(29,78,216,0.28),0 10px 24px rgba(59,130,246,0.4),inset 0 1px 0 rgba(255,255,255,0.3)', transform: 'perspective(180px) rotateX(10deg)' }}>
                  <Trophy className="w-8 h-8 text-white drop-shadow" />
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight">
                  Le Mur des{' '}
                  <span className="bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent" style={{ filter: 'drop-shadow(0 2px 4px rgba(59,130,246,0.25))' }}>
                    Champions
                  </span>
                </h1>
                <p className="mt-3 text-sm text-slate-500 font-medium max-w-md mx-auto">
                  Accumulez des points en accomplissant des tâches et hissez-vous au sommet. L'implication de chacun compte !
                </p>
                <div className="flex items-center justify-center mt-8">
                  {[
                    { val: members.length, lbl: 'Participants' },
                    { val: members.reduce((s, m) => s + m.completedTasks.length, 0), lbl: 'Tâches finies' },
                    { val: members[0]?.points ?? 0, lbl: 'Meilleur score' },
                  ].map((s, i) => (
                    <div key={i} className="relative flex flex-col items-center px-7 py-4 cursor-default group">
                      {i > 0 && <div className="absolute left-0 top-[20%] h-[60%] w-px bg-gradient-to-b from-transparent via-blue-200 to-transparent" />}
                      <div className="transition-transform duration-300 group-hover:-translate-y-1">
                        <span className="block text-2xl font-black text-blue-500" style={{ textShadow: '0 2px 8px rgba(59,130,246,0.25)' }}>{s.val.toLocaleString()}</span>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{s.lbl}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Podium */}
          {top3.length > 0 && (
            <div className="flex flex-col md:flex-row items-end justify-center gap-4 md:gap-5 pt-6" style={{ perspective: 1400, perspectiveOrigin: '50% 20%' }}>
              {podiumOrder.map((m) => {
                if (!m) return null;
                const rank = (top3.indexOf(m) + 1) as 1 | 2 | 3;
                return (
                  <div key={m.id} className="w-full md:w-auto flex justify-center">
                    <CubePodiumCard member={m} rank={rank} />
                  </div>
                );
              })}
            </div>
          )}

          {/* Full leaderboard */}
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center flex-shrink-0" style={{ boxShadow: '0 4px 0 rgba(29,78,216,0.22),0 4px 14px rgba(59,130,246,0.3)' }}>
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Classement Général</h3>
              <div className="flex-1 h-px bg-gradient-to-r from-blue-200 to-transparent" />
            </div>

            <div className="space-y-3">
              {others.map((member, index) => {
                const rank = index + 4;
                const isCurrentUser = member.id === profile?.id;
                const isHovered = hoveredId === member.id;
                return (
                  <div
                    key={member.id}
                    className="relative flex items-center gap-4 p-4 rounded-2xl cursor-default"
                    onMouseEnter={() => setHoveredId(member.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      background: isCurrentUser ? 'linear-gradient(135deg,rgba(219,234,254,0.85) 0%,rgba(207,250,254,0.55) 100%)' : 'rgba(255,255,255,0.92)',
                      border: `1px solid ${isCurrentUser ? 'rgba(59,130,246,0.28)' : isHovered ? 'rgba(59,130,246,0.22)' : 'rgba(59,130,246,0.09)'}`,
                      boxShadow: isHovered ? '0 14px 40px -8px rgba(59,130,246,0.2),0 4px 0 rgba(59,130,246,0.1)' : isCurrentUser ? '0 4px 20px rgba(59,130,246,0.12),0 2px 0 rgba(59,130,246,0.08)' : '0 2px 8px rgba(59,130,246,0.06)',
                      transform: isHovered ? 'perspective(600px) rotateX(-1.5deg) translateZ(10px) translateY(-2px)' : undefined,
                      transition: 'all 0.2s cubic-bezier(.23,1.01,.32,1)',
                      backdropFilter: 'blur(8px)',
                      animation: `rowIn 0.4s ease-out ${index * 0.05}s both`,
                    }}
                  >
                    <div style={{ position: 'absolute', inset: 0, borderRadius: 16, background: 'linear-gradient(135deg,rgba(255,255,255,0.5) 0%,transparent 50%)', pointerEvents: 'none', opacity: isHovered ? 1 : 0, transition: 'opacity .2s' }} />
                    <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 3, borderRadius: 3, background: 'linear-gradient(to bottom,#3b82f6,#22d3ee)', boxShadow: '2px 0 8px rgba(59,130,246,0.45)', opacity: isHovered || isCurrentUser ? 1 : 0, transition: 'opacity .2s' }} />

                    <div className="w-10 text-center shrink-0">
                      <span className="text-lg font-black" style={{ color: isHovered ? '#3b82f6' : '#cbd5e1', textShadow: isHovered ? '0 0 10px rgba(59,130,246,0.4)' : 'none', transition: 'color .2s,text-shadow .2s' }}>#{rank}</span>
                    </div>

                    <Avatar className="w-12 h-12 shrink-0" style={{ boxShadow: isHovered ? '0 0 16px rgba(59,130,246,0.3),0 0 0 2px rgba(59,130,246,0.3)' : '0 2px 6px rgba(0,0,0,0.07),0 0 0 2px rgba(255,255,255,0.8)', transition: 'box-shadow .2s' }}>
                      <AvatarImage src={member.avatar_url || ''} className="object-cover" />
                      <AvatarFallback className="bg-blue-50 text-blue-500 font-black text-base">{member.full_name?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-800 truncate">{member.full_name}</span>
                        {isCurrentUser && (
                          <span className="text-[9px] font-black text-blue-500 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.22)' }}>Vous</span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{member.role === 'chef_de_projet' ? 'Chef de Projet' : 'Membre'}</span>
                    </div>

                    <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                      {member.completedTasks.length} tâche{member.completedTasks.length !== 1 ? 's' : ''}
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl shrink-0" style={{ background: 'linear-gradient(135deg,rgba(219,234,254,0.9),rgba(207,250,254,0.7))', boxShadow: isHovered ? '0 5px 0 rgba(59,130,246,0.18),0 7px 18px rgba(59,130,246,0.15)' : '0 3px 0 rgba(59,130,246,0.14),0 4px 12px rgba(59,130,246,0.09)', border: '1px solid rgba(59,130,246,0.16)', transform: isHovered ? 'translateY(-2px)' : undefined, transition: 'transform .2s,box-shadow .2s', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', background: 'linear-gradient(to bottom,rgba(255,255,255,0.5),transparent)', borderRadius: '12px 12px 0 0' }} />
                      <Star className="w-3.5 h-3.5 text-blue-500 fill-blue-500" />
                      <span className="font-black text-base text-blue-600">{member.points}</span>
                      <span className="text-[9px] font-bold text-blue-400/70 uppercase mt-0.5">pts</span>
                    </div>
                  </div>
                );
              })}

              {others.length === 0 && (
                <div className="text-center p-12 rounded-2xl" style={{ background: 'rgba(255,255,255,0.8)', border: '1px dashed rgba(59,130,246,0.15)', boxShadow: '0 2px 12px rgba(59,130,246,0.06)' }}>
                  <Trophy className="w-8 h-8 text-blue-200 mx-auto mb-2" />
                  <p className="text-slate-400 font-bold text-sm">Le classement s'arrête ici pour le moment !</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}