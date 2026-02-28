'use client';

import React from 'react';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

interface ShellProps {
    children: React.ReactNode;
}

export function Shell({ children }: ShellProps) {
    return (
        <div className="flex h-screen w-full overflow-hidden bg-[#f4f5f7] dark:bg-slate-950">
            <Sidebar />
            <div className="flex flex-col flex-1 overflow-hidden relative">
                <Topbar />
                <main className="flex-1 overflow-y-auto px-4 py-8 md:px-8 lg:px-12 custom-scrollbar">
                    <div className="mx-auto max-w-7xl">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
