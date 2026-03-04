'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    LayoutDashboard,
    FolderKanban,
    CheckSquare,
    Clock,
    FileText,
    Users,
    StickyNote,
    BarChart3,
    FileSpreadsheet,
    ChevronLeft,
    ChevronRight,
    Star,
    Sun,
    Moon,
    Trophy
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';

const navItems = [
    { label: 'Tableau de bord', icon: LayoutDashboard, href: '/dashboard' },
    { label: 'Projets', icon: FolderKanban, href: '/projets' },
    { label: 'Planning', icon: FileSpreadsheet, href: '/planning' },
    { label: 'Tâches', icon: CheckSquare, href: '/taches' },
    { label: 'Tracker', icon: Clock, href: '/tracker' },
    { label: 'Feuilles de temps', icon: FileText, href: '/feuilles-de-temps' },
    { label: 'Notes', icon: StickyNote, href: '/notes' },
    { label: 'Rapports', icon: FileText, href: '/rapports' },
    { label: 'Classement', icon: Trophy, href: '/classement' },
    { label: 'Statistiques', icon: BarChart3, href: '/statistiques', adminOnly: true },
    { label: 'Équipe', icon: Users, href: '/equipe', restricted: true },
];

export function Sidebar() {
    const pathname = usePathname();
    const { profile } = useAuth();
    const { theme, toggleTheme } = useTheme();

    const [collapsed, setCollapsed] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('sidebar_collapsed');
            return saved === 'true';
        }
        return false;
    });

    const toggleCollapsed = () => {
        const newState = !collapsed;
        setCollapsed(newState);
        localStorage.setItem('sidebar_collapsed', String(newState));
    };

    const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('sidebar_pinned');
            return saved ? JSON.parse(saved) : [];
        }
        return [];
    });

    const togglePin = (label: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const newPinned = pinnedIds.includes(label)
            ? pinnedIds.filter(id => id !== label)
            : [...pinnedIds, label];
        setPinnedIds(newPinned);
        localStorage.setItem('sidebar_pinned', JSON.stringify(newPinned));
    };

    // ── Filtrage des items selon le rôle ─────────────────────────────────────
    const filteredItems = navItems.filter(item => {
        // Restricted → masqué pour les membres
        if (item.restricted && profile?.role === 'member') return false;
        // Dashboard → masqué pour les admins
        if (item.label === 'Tableau de bord' && profile?.role === 'admin') return false;
        // Feuilles de temps → masqué pour les membres
        if (item.href === '/feuilles-de-temps' && profile?.role === 'member') return false;
        // Tracker → masqué pour les admins
        if (item.label === 'Tracker' && profile?.role === 'admin') return false;
        // Classement → masqué pour les non-admins
        if (item.label === 'Classement' && profile?.role !== 'admin') return false;
        if (item.label === 'Statistiques' && profile?.role !== 'admin') return false;
        return true;
    });

    const sortedItems = [...filteredItems].sort((a, b) => {
        const aPinned = pinnedIds.includes(a.label);
        const bPinned = pinnedIds.includes(b.label);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        return 0;
    });

    return (
        <aside className={cn(
            'relative flex flex-col border-r bg-white dark:bg-slate-900 transition-all duration-300 ease-in-out shadow-sm z-50',
            collapsed ? 'w-[72px]' : 'w-60'
        )}>
            {/* ── Logo ─────────────────────────────────────────────────────── */}
            <div className="flex h-16 items-center justify-between px-4 border-b border-slate-100 dark:border-slate-800">
                {!collapsed ? (
                    <div className="flex items-center gap-2 pl-2">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold shadow-sm">
                            W
                        </div>
                        <span className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">
                            WaveFlow
                        </span>
                    </div>
                ) : (
                    <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-bold shadow-sm">
                        W
                    </div>
                )}

                <button
                    onClick={toggleCollapsed}
                    className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border bg-white dark:bg-slate-900 shadow-sm text-slate-400 hover:text-primary transition-all hover:scale-110 z-50"
                >
                    {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
            </div>

            {/* ── Navigation ───────────────────────────────────────────────── */}
            <ScrollArea className="flex-1 py-4 custom-scrollbar">
                <nav className="flex flex-col gap-1 px-3">
                    {sortedItems.map((item) => {
                        const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                        const isPinned = pinnedIds.includes(item.label);

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    'group flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 relative',
                                    'hover:bg-slate-50 dark:hover:bg-slate-800/40',
                                    isActive
                                        ? 'bg-blue-50/80 dark:bg-primary/10 text-primary font-semibold'
                                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white',
                                    collapsed && 'justify-center px-0 h-10 w-10 mx-auto'
                                )}
                                title={collapsed ? item.label : undefined}
                            >
                                {isActive && !collapsed && (
                                    <div className="absolute left-0 w-1 h-5 bg-primary rounded-r-full" />
                                )}
                                <div className={cn("flex items-center gap-3 transition-transform", collapsed && "gap-0")}>
                                    <item.icon
                                        size={collapsed ? 20 : 18}
                                        className={cn(
                                            "transition-colors shrink-0",
                                            isActive
                                                ? "text-primary"
                                                : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                                        )}
                                    />
                                    {!collapsed && (
                                        <span className="text-[13px] whitespace-nowrap">{item.label}</span>
                                    )}
                                </div>
                                {!collapsed && (
                                    <button
                                        onClick={(e) => togglePin(item.label, e)}
                                        className={cn(
                                            "opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-slate-200/50 dark:hover:bg-slate-700/50 ml-auto",
                                            isPinned && "opacity-100 text-yellow-500"
                                        )}
                                    >
                                        <Star size={12} className={cn(isPinned && "fill-current")} />
                                    </button>
                                )}
                            </Link>
                        );
                    })}
                </nav>
            </ScrollArea>

            {/* ── Footer — thème uniquement, pas de profil ni déconnexion ─── */}
            <div className="mt-auto border-t border-slate-100 dark:border-slate-800 p-3 bg-white dark:bg-slate-900/50">
                <button
                    onClick={toggleTheme}
                    className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all hover:bg-slate-50 dark:hover:bg-slate-800/40",
                        collapsed && "justify-center px-0 h-10 w-10 mx-auto"
                    )}
                    title={theme === 'light' ? 'Mode sombre' : 'Mode clair'}
                >
                    {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                    {!collapsed && (
                        <span className="text-[13px]">
                            {theme === 'light' ? 'Mode sombre' : 'Mode clair'}
                        </span>
                    )}
                </button>
            </div>
        </aside>
    );
}