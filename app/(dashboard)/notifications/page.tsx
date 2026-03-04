'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
    Bell,
    Info,
    CheckCircle,
    AlertTriangle,
    XCircle,
    Trash2,
    CheckCircle2,
    MailOpen,
    ExternalLink,
    BellOff,
    MoreHorizontal,
    Clock
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface Notification {
    id: string;
    user_id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message?: string;
    sender_name?: string;
    link?: string;
    is_read: boolean;
    created_at: string;
}

export default function NotificationsPage() {
    const { profile } = useAuth();
    const { toast } = useToast();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');

    useEffect(() => {
        if (profile) {
            fetchNotifications();
        }
    }, [profile]);

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setNotifications(data || []);
        } catch (error) {
            console.error('Erreur chargement notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (id: string) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', id);

            if (error) throw error;
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        } catch (error: any) {
            toast({ title: "Erreur", description: error.message, variant: "destructive" });
        }
    };

    const markAllAsRead = async () => {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', profile?.id)
                .eq('is_read', false);

            if (error) throw error;
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            toast({ title: "Tout est marqué comme lu" });
        } catch (error: any) {
            toast({ title: "Erreur", description: error.message, variant: "destructive" });
        }
    };

    const deleteNotification = async (id: string) => {
        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (error: any) {
            toast({ title: "Erreur", description: error.message, variant: "destructive" });
        }
    };

    const deleteAllNotifications = async () => {
        if (!confirm('Voulez-vous vraiment supprimer toutes vos notifications ?')) return;
        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('user_id', profile?.id);

            if (error) throw error;
            setNotifications([]);
            toast({ title: "Notifications supprimées" });
        } catch (error: any) {
            toast({ title: "Erreur", description: error.message, variant: "destructive" });
        }
    };

    const getTypeIcon = (type: Notification['type']) => {
        const base = "w-4 h-4";
        switch (type) {
            case 'info': return <Bell className={cn(base, "text-blue-400")} />;
            case 'success': return <CheckCircle className={cn(base, "text-green-400")} />;
            case 'warning': return <AlertTriangle className={cn(base, "text-amber-400")} />;
            case 'error': return <XCircle className={cn(base, "text-red-400")} />;
        }
    };

    const getCardStyle = (type: Notification['type'], is_read: boolean) => {
        if (is_read) return "bg-white border border-gray-100";
        switch (type) {
            case 'info': return "bg-blue-50/60 border border-blue-100";
            case 'success': return "bg-green-50/60 border border-green-100";
            case 'warning': return "bg-amber-50/60 border border-amber-100";
            case 'error': return "bg-red-50/60 border border-red-100";
        }
    };

    const getIconBg = (type: Notification['type'], is_read: boolean) => {
        if (is_read) return "bg-gray-100 text-gray-400";
        switch (type) {
            case 'info': return "bg-blue-100 text-blue-500";
            case 'success': return "bg-green-100 text-green-500";
            case 'warning': return "bg-amber-100 text-amber-500";
            case 'error': return "bg-red-100 text-red-500";
        }
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;
    const filteredNotifications = notifications.filter(n => filter === 'all' || !n.is_read);

    const getTimeAgo = (dateStr: string) => {
        const now = new Date();
        const date = new Date(dateStr);
        const diffMs = now.getTime() - date.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        const diffHr = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHr / 24);
        if (diffMin < 1) return "À l'instant";
        if (diffMin < 60) return `Il y a ${diffMin} min`;
        if (diffHr < 24) return `Il y a ${diffHr}h`;
        return `Il y a ${diffDay}j`;
    };

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
            {/* Header */}
            <div className="flex items-start justify-between mb-1">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
                    {unreadCount > 0 && (
                        <p className="text-sm text-gray-400 mt-0.5">{unreadCount} notification{unreadCount > 1 ? 's' : ''} non lue{unreadCount > 1 ? 's' : ''}</p>
                    )}
                </div>

                {/* Tabs + Mark all */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                        <button
                            onClick={() => setFilter('all')}
                            className={cn(
                                "px-4 py-1.5 rounded-lg text-sm font-semibold transition-all",
                                filter === 'all'
                                    ? "bg-blue-500 text-white shadow-sm"
                                    : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            Toutes
                        </button>
                        <button
                            onClick={() => setFilter('unread')}
                            className={cn(
                                "px-4 py-1.5 rounded-lg text-sm font-semibold transition-all",
                                filter === 'unread'
                                    ? "bg-blue-500 text-white shadow-sm"
                                    : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            Non lues
                        </button>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                onClick={markAllAsRead}
                                className="flex items-center gap-1.5 text-sm font-semibold text-blue-500 hover:text-blue-600 transition-colors px-2 py-1.5"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                Tout marquer
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl border-gray-100 p-1 min-w-[180px] shadow-xl">
                            <DropdownMenuItem onClick={markAllAsRead} className="rounded-lg py-2 text-sm gap-2 cursor-pointer">
                                <MailOpen className="w-4 h-4" />
                                Tout marquer comme lu
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={deleteAllNotifications} className="rounded-lg py-2 text-sm gap-2 text-red-500 focus:text-red-500 focus:bg-red-50 cursor-pointer">
                                <Trash2 className="w-4 h-4" />
                                Vider le flux
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div className="mt-6">
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
                        ))}
                    </div>
                ) : filteredNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                            <BellOff className="w-8 h-8 text-gray-300" />
                        </div>
                        <h3 className="text-base font-semibold text-gray-700 mb-1">Tout est à jour</h3>
                        <p className="text-sm text-gray-400 max-w-xs">Aucune notification ne nécessite votre attention pour le moment.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredNotifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={cn(
                                    "group relative rounded-2xl px-5 py-4 flex items-center gap-4 transition-all duration-200 hover:shadow-md",
                                    getCardStyle(notification.type, notification.is_read)
                                )}
                            >
                                {/* Icon */}
                                <div className={cn(
                                    "shrink-0 w-9 h-9 rounded-xl flex items-center justify-center",
                                    getIconBg(notification.type, notification.is_read)
                                )}>
                                    {getTypeIcon(notification.type)}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    {notification.sender_name && (
                                        <p className={cn(
                                            "text-xs font-semibold mb-0.5",
                                            notification.is_read ? "text-gray-400" : "text-gray-600"
                                        )}>
                                            {notification.sender_name}
                                        </p>
                                    )}
                                    <p className={cn(
                                        "text-sm font-semibold leading-snug truncate",
                                        notification.is_read ? "text-gray-400" : "text-gray-800 dark:text-white"
                                    )}>
                                        {notification.title}
                                    </p>
                                    {notification.message && (
                                        <p className="text-xs text-gray-400 mt-0.5 truncate">{notification.message}</p>
                                    )}
                                    <p className="text-xs text-gray-400 mt-1">{getTimeAgo(notification.created_at)}</p>

                                    {notification.link && (
                                        <Link
                                            href={notification.link}
                                            className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-blue-500 hover:text-blue-600 transition-colors"
                                        >
                                            Consulter <ExternalLink className="w-3 h-3" />
                                        </Link>
                                    )}
                                </div>

                                {/* Unread dot */}
                                {!notification.is_read && (
                                    <div className="shrink-0 w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-200" />
                                )}

                                {/* Actions on hover */}
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0">
                                    {!notification.is_read && (
                                        <button
                                            onClick={() => markAsRead(notification.id)}
                                            className="w-8 h-8 rounded-xl bg-white shadow-sm border border-gray-100 flex items-center justify-center text-blue-500 hover:bg-blue-50 transition-colors"
                                            title="Marquer comme lu"
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => deleteNotification(notification.id)}
                                        className="w-8 h-8 rounded-xl bg-white shadow-sm border border-gray-100 flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                                        title="Supprimer"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}