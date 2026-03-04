'use client';

import dynamic from 'next/dynamic';

const Welcome3DOverlay = dynamic(
    () => import('./Welcome3DOverlay'),
    { ssr: false }
);

export default function WelcomeOverlayHost() {
    return <Welcome3DOverlay />;
}