'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Timer, BarChart3, FolderKanban, Users, Trophy, Settings, Bell, Moon, LogOut, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Profile } from '@/types';

interface SidebarProps {
  profile: Profile | null;
  onSignOut: () => void;
}

export function Sidebar({ profile, onSignOut }: SidebarProps) {
  const pathname = usePathname();

  const isAdmin = profile?.role === 'admin';
  const isChefDeProjet = profile?.role === 'chef_de_projet';
  const isMember = profile?.role === 'member';
  const canAccessDashboard = isChefDeProjet;

  const navItems = [
    ...(canAccessDashboard ? [{ href: '/dashboard', label: 'Dashboard', icon: Home }] : []),
    { href: '/tracker', label: 'Tracker', icon: Timer },
    ...(isMember ? [{ href: '/stats', label: 'Mes stats', icon: BarChart3 }] : []),
    ...(isAdmin ? [{ href: '/analytics', label: 'Analytics', icon: BarChart3 }] : []),
    ...(canAccessDashboard ? [{ href: '/projets', label: 'Projets', icon: FolderKanban }] : []),
    ...(canAccessDashboard ? [{ href: '/equipe', label: 'Équipe', icon: Users }] : []),
    ...(isAdmin ? [{ href: '/classement', label: 'Classement', icon: Trophy }] : []),
    { href: '/parametres', label: 'Paramètres', icon: Settings },
  ];

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-[280px] bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-1">
          <div className="text-2xl">🌊</div>
          <h1 className="text-xl font-bold text-[var(--navy-blue)]">WaveFlow</h1>
        </div>
        <p className="text-xs text-gray-600 ml-8">Wave Digital Agency</p>
      </div>

      {profile && (
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={profile.avatar_url} />
              <AvatarFallback className="bg-[var(--turquoise)] text-white">
                {getInitials(profile.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-[var(--dark-gray)] truncate">
                {profile.full_name}
              </p>
              <div className="flex items-center gap-1 text-xs text-gray-600">
                <Sparkles className="w-3 h-3 text-[var(--turquoise)]" />
                <span>Niveau {profile.level}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-4">
        <div className="space-y-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive
                  ? 'bg-[var(--turquoise)]/10 text-[var(--turquoise)] border-l-3 border-[var(--turquoise)]'
                  : 'text-gray-700 hover:bg-gray-100'
                  }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-gray-200 p-4 space-y-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-gray-700 hover:bg-gray-100"
          size="sm"
        >
          <Bell className="w-5 h-5" />
          Notifications
          <span className="ml-auto bg-[var(--turquoise)] text-white text-xs px-2 py-0.5 rounded-full">
            3
          </span>
        </Button>

        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-gray-700 hover:bg-gray-100"
          size="sm"
        >
          <Moon className="w-5 h-5" />
          Mode sombre
        </Button>

        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-gray-700 hover:bg-gray-100 hover:text-[var(--error)]"
          size="sm"
          onClick={onSignOut}
        >
          <LogOut className="w-5 h-5" />
          Déconnexion
        </Button>
      </div>
    </aside>
  );
}
