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
      <CardContent className="p-3 sm:p-4">
        <div className="flex gap-2 sm:gap-3">
          <div className="flex-1 min-w-0">
            <p
              className={`text-lg sm:text-2xl font-bold${onClick ? " cursor-pointer" : ""}`}
              onClick={onClick}
            >
              {value}
            </p>
            <p
              className={`text-xs sm:text-sm text-muted-foreground${onClick ? " cursor-pointer" : ""}`}
              onClick={onClick}
            >
              {label}
            </p>
            {description && (
              <div className="text-[11px] sm:text-xs text-muted-foreground mt-1 hidden sm:block">{description}</div>
            )}
          </div>
          <div className="bg-muted p-1.5 sm:p-2 rounded-md h-fit shrink-0">
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
