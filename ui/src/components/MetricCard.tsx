import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

interface MetricCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  description?: ReactNode;
  to?: string;
  onClick?: () => void;
}

export function MetricCard({ icon: Icon, value, label, description, to, onClick }: MetricCardProps) {
  const isClickable = !!(to || onClick);

  const inner = (
    <Card className="h-full">
      <CardContent className="p-3 sm:p-4 h-full">
        <div className="flex gap-2 sm:gap-3">
          <div className="flex-1 min-w-0">
            <p className={`text-lg sm:text-2xl font-bold${isClickable ? " cursor-pointer" : ""}`}>
              {value}
            </p>
            <p className={`text-sm text-muted-foreground${isClickable ? " cursor-pointer" : ""}`}>
              {label}
            </p>
            {description && (
              <div className="text-xs sm:text-sm text-muted-foreground mt-1 hidden sm:block">{description}</div>
            )}
          </div>
          <div className="bg-muted p-1.5 sm:p-2 rounded-md h-fit shrink-0">
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (to) {
    return (
      <Link to={to} className="no-underline text-inherit h-full" onClick={onClick}>
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <div className="cursor-pointer h-full" onClick={onClick}>
        {inner}
      </div>
    );
  }

  return inner;
}
