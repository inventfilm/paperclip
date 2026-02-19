import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface MetricCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  description?: ReactNode;
  onClick?: () => void;
}

export function MetricCard({ icon: Icon, value, label, description, onClick }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex gap-3">
          <div className="flex-1 min-w-0">
            <p
              className={`text-2xl font-bold${onClick ? " cursor-pointer" : ""}`}
              onClick={onClick}
            >
              {value}
            </p>
            <p
              className={`text-sm text-muted-foreground${onClick ? " cursor-pointer" : ""}`}
              onClick={onClick}
            >
              {label}
            </p>
            {description && (
              <div className="text-xs text-muted-foreground mt-1">{description}</div>
            )}
          </div>
          <div className="bg-muted p-2 rounded-md h-fit shrink-0">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
