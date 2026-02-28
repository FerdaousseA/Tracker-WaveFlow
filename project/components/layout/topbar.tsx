'use client';

import React from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bell, User, Settings, LogOut } from 'lucide-react';
import Link from 'next/link';

export function Topbar() {
    const { user, profile, signOut } = useAuth();

    // Get initials for avatar fallback
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <header className="flex h-16 items-center gap-4 border-b bg-white/80 dark:bg-slate-900/80 px-6 backdrop-blur-md sticky top-0 z-40 border-slate-100 dark:border-slate-800">
            <div className="flex-1" />

            {/* Actions */}
            <div className="flex items-center gap-2">
                <Link href="/notifications">
                    <Button variant="ghost" size="icon" className="text-slate-500 hover:text-primary relative hover:bg-slate-50 dark:hover:bg-slate-800/50 h-9 w-9">
                        <Bell size={18} />
                        <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-blue-500 ring-2 ring-white dark:ring-slate-900"></span>
                    </Button>
                </Link>

                <div className="w-[1px] h-6 bg-slate-100 dark:bg-slate-800 mx-1" />

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                            <div className="flex flex-col items-end hidden md:flex">
                                <span className="text-[11px] font-bold text-slate-900 dark:text-white leading-none capitalize tracking-tighter">{profile?.full_name}</span>
                                <span className="text-[9px] text-slate-400 font-medium leading-none mt-1">{profile?.role?.replace(/_/g, ' ')}</span>
                            </div>
                            <Avatar className="h-8 w-8 border border-slate-200 dark:border-slate-700 transition-transform group-hover:scale-105">
                                <AvatarImage src={profile?.avatar_url || ''} alt={profile?.full_name} />
                                <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-black">
                                    {profile?.full_name ? getInitials(profile.full_name) : 'U'}
                                </AvatarFallback>
                            </Avatar>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 mt-2 shadow-xl border-slate-100 dark:border-slate-800 p-2 rounded-xl" align="end">
                        <DropdownMenuLabel className="font-normal p-2">
                            <div className="flex flex-col space-y-1">
                                <p className="text-xs font-bold leading-none text-slate-900 dark:text-white">{profile?.full_name}</p>
                                <p className="text-[10px] leading-none text-slate-400 mt-1">
                                    {user?.email}
                                </p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="my-2 bg-slate-50 dark:bg-slate-800" />
                        <Link href="/profil" className="w-full">
                            <DropdownMenuItem className="rounded-lg py-2 cursor-pointer focus:bg-slate-50 dark:focus:bg-slate-800 text-xs font-medium">
                                <User className="mr-3 h-3.5 w-3.5 text-slate-400" />
                                <span>Mon Profil</span>
                            </DropdownMenuItem>
                        </Link>
                        <Link href="/parametres" className="w-full">
                            <DropdownMenuItem className="rounded-lg py-2 cursor-pointer focus:bg-slate-50 dark:focus:bg-slate-800 text-xs font-medium">
                                <Settings className="mr-3 h-3.5 w-3.5 text-slate-400" />
                                <span>Paramètres</span>
                            </DropdownMenuItem>
                        </Link>
                        <DropdownMenuSeparator className="my-2 bg-slate-50 dark:bg-slate-800" />
                        <DropdownMenuItem className="rounded-lg py-2 cursor-pointer text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-900/10 text-xs font-bold" onClick={signOut}>
                            <LogOut className="mr-3 h-3.5 w-3.5" />
                            <span>Déconnexion</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
