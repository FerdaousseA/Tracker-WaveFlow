'use client';

import dynamic from 'next/dynamic';

const FocusTimer3D = dynamic(() => import('@/components/focus/FocusTimer3D'), {
    ssr: false,
});

export default function FocusTimer3DDynamic(props: { status: 'running' | 'paused' | 'stopped', isHovered?: boolean }) {
    return <FocusTimer3D {...props} />;
}
