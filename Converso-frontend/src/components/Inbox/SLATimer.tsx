import { Clock, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface SLATimerProps {
  minutesElapsed: number;
  slaMinutes: number;
  type?: "first-response" | "resolution";
}

export function SLATimer({ minutesElapsed, slaMinutes, type = "first-response" }: SLATimerProps) {
  const percentageElapsed = (minutesElapsed / slaMinutes) * 100;
  const isOverdue = minutesElapsed > slaMinutes;
  const isNearDeadline = percentageElapsed > 80 && !isOverdue;

  const getStatusColor = () => {
    if (isOverdue) return "destructive";
    if (isNearDeadline) return "default";
    return "secondary";
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isOverdue ? (
            <AlertCircle className="h-4 w-4 text-destructive" />
          ) : (
            <Clock className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">
            {type === "first-response" ? "First Response" : "Resolution"} SLA
          </span>
        </div>
        <Badge variant={getStatusColor()}>
          {formatTime(minutesElapsed)} / {formatTime(slaMinutes)}
        </Badge>
      </div>
      <Progress 
        value={Math.min(percentageElapsed, 100)} 
        className={isOverdue ? "bg-destructive/20" : ""}
      />
      {isOverdue && (
        <p className="text-xs text-destructive">
          Overdue by {formatTime(minutesElapsed - slaMinutes)}
        </p>
      )}
    </div>
  );
}
