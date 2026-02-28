import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Play, Briefcase } from 'lucide-react';
import type { ProjectWithDetails } from '@/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface CarteProjetProps {
  project: ProjectWithDetails;
  onStart: (projectId: string) => void;
  disabled?: boolean;
}

export function CarteProjet({ project, onStart, disabled }: CarteProjetProps) {
  const progress = project.total_estimated_hours
    ? Math.round((project.total_actual_hours || 0) / project.total_estimated_hours * 100)
    : 0;

  const clientName = project.clients?.name || project.client_name;

  return (
    <Card className="p-4 hover:shadow-md transition-all duration-200 hover:border-primary/50 group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base text-card-foreground truncate group-hover:text-primary transition-colors">
            {project.name}
          </h3>
          {clientName && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <Briefcase className="w-3 h-3" />
              <span className="truncate">{clientName}</span>
            </div>
          )}
        </div>
        <div
          className="w-3 h-3 rounded-full flex-shrink-0 ml-2 ring-2 ring-background"
          style={{ backgroundColor: project.color }}
        />
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{project.total_actual_hours || 0}h / {project.total_estimated_hours || 0}h</span>
          <span className={cn(
            "font-medium",
            progress > 100 ? "text-destructive" : "text-primary"
          )}>{progress}%</span>
        </div>
        <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              progress > 100 ? "bg-destructive" : "bg-primary"
            )}
            style={{
              width: `${Math.min(progress, 100)}%`,
            }}
          />
        </div>
      </div>

    </Card>
  );
}
