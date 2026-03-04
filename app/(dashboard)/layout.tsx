import { Shell } from '@/components/layout/shell';
import DashboardClient from "@/components/dashboard/DashboardClient";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Shell>
      <DashboardClient>
        {children}
      </DashboardClient>
    </Shell>
  );
}
