import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/auth-context';
import { ThemeProvider } from '@/contexts/theme-context';
import { TimerProvider } from '@/contexts/timer-context';
import { Toaster } from '@/components/ui/toaster';
import { FloatingTimer } from '@/components/tracker/floating-timer';

export const metadata: Metadata = {
  title: 'WaveFlow - Time Tracking Wave Digital Agency',
  description: 'Surfez sur votre productivité avec WaveFlow',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <AuthProvider>
            <TimerProvider>
              {children}
              <FloatingTimer />
              <Toaster />
            </TimerProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}