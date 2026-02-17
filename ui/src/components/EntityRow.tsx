import { type ReactNode } from "react";
import { cn } from "../lib/utils";

interface EntityRowProps {
  leading?: ReactNode;
  identifier?: string;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function EntityRow({
  leading,
  identifier,
  title,
  subtitle,
  trailing,
  selected,
  onClick,
  className,
}: EntityRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2 text-sm border-b border-border last:border-b-0 transition-colors",
        onClick && "cursor-pointer hover:bg-accent/50",
        selected && "bg-accent/30",
        className
      )}
      onClick={onClick}
    >
      {leading && <div className="flex items-center gap-2 shrink-0">{leading}</div>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {identifier && (
            <span className="text-xs text-muted-foreground font-mono shrink-0">
              {identifier}
            </span>
          )}
          <span className="truncate">{title}</span>
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>
        )}
      </div>
      {trailing && <div className="flex items-center gap-2 shrink-0">{trailing}</div>}
    </div>
  );
}
