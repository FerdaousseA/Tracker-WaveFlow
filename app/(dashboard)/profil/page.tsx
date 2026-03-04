'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Camera, Loader2, Mail, Shield, User, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ProfilePage() {
    const { user, profile, refreshProfile } = useAuth();
    const { toast } = useToast();
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const getInitials = (name?: string) => {
        if (!name) return 'U';
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const handleAvatarClick = () => {
        if (!uploading && fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user) return;

        try {
            setUploading(true);
            const fileExt = file.name.split('.').pop();
            const fileName = `avatar-${user.id}-${Date.now()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            // Upload the file to the documents bucket (using avatars folder)
            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            // Get the public URL
            const { data: { publicUrl } } = supabase.storage
                .from('documents')
                .getPublicUrl(filePath);

            // Update the user's profile
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', user.id);

            if (updateError) throw updateError;

            // Refresh the profile context to update UI everywhere
            await refreshProfile();

            toast({
                title: "Avatar mis à jour",
                description: "Votre photo de profil a été modifiée avec succès.",
            });
        } catch (error: any) {
            console.error('Erreur upload avatar:', error);
            toast({
                title: "Erreur",
                description: "Impossible de modifier la photo de profil.",
                variant: "destructive",
            });
        } finally {
            setUploading(false);
            if (event.target) event.target.value = '';
        }
    };

    const handleRemoveAvatar = async () => {
        if (!user) return;

        try {
            setUploading(true);
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: null })
                .eq('id', user.id);

            if (updateError) throw updateError;
            await refreshProfile();

            toast({
                title: "Avatar supprimé",
                description: "Votre photo de profil a été supprimée avec succès.",
            });
        } catch (error: any) {
            console.error('Erreur suppression avatar:', error);
            toast({
                title: "Erreur",
                description: "Impossible de supprimer la photo de profil.",
                variant: "destructive",
            });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
            <div className="space-y-1">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Mon Profil</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Gérez vos informations personnelles et votre photo de profil.
                </p>
            </div>

            <Card className="p-8 border-slate-100 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/50 rounded-2xl max-w-xl mx-auto">
                <div className="flex flex-col items-center text-center space-y-6">

                    {/* Avatar Upload Section */}
                    <div className="flex flex-col items-center gap-3">
                        <div className="relative group">
                            <div
                                className={cn(
                                    "relative w-32 h-32 rounded-full overflow-hidden border-4 border-white dark:border-slate-900 shadow-lg transition-transform duration-300",
                                    !uploading && "group-hover:scale-105 cursor-pointer"
                                )}
                                onClick={handleAvatarClick}
                            >
                                <Avatar className="w-full h-full rounded-none">
                                    <AvatarImage src={profile?.avatar_url || ''} alt={profile?.full_name} className="object-cover" />
                                    <AvatarFallback className="bg-primary/10 text-primary text-3xl font-black rounded-none">
                                        {getInitials(profile?.full_name)}
                                    </AvatarFallback>
                                </Avatar>

                                {/* Hover Overlay */}
                                <div className={cn(
                                    "absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white transition-opacity duration-300",
                                    uploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                )}>
                                    {uploading ? (
                                        <Loader2 className="w-8 h-8 animate-spin" />
                                    ) : (
                                        <>
                                            <Camera className="w-8 h-8 mb-1" />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">Modifier</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept="image/*"
                                className="hidden"
                            />
                        </div>

                        {profile?.avatar_url && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleRemoveAvatar}
                                disabled={uploading}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 h-8 px-3 text-xs"
                            >
                                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                Supprimer la photo
                            </Button>
                        )}
                    </div>

                    <div className="space-y-1 w-full pt-4 border-t border-slate-100 dark:border-slate-800">
                        {/* Name */}
                        <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                                <User className="w-5 h-5 text-blue-500" />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Nom complet</p>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white capitalize mt-1.5">{profile?.full_name || 'Non renseigné'}</p>
                            </div>
                        </div>

                        {/* Email */}
                        <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                                <Mail className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Adresse email</p>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1.5">{user?.email || 'Non renseignée'}</p>
                            </div>
                        </div>

                        {/* Role */}
                        <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
                                <Shield className="w-5 h-5 text-amber-500" />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Rôle</p>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white capitalize mt-1.5">{profile?.role?.replace(/_/g, ' ') || 'Membre'}</p>
                            </div>
                        </div>
                    </div>

                </div>
            </Card>
        </div>
    );
}
