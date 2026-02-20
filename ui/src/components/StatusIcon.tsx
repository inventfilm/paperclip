import { useState } from "react";
import { cn } from "../lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

const statusColors: Record<string, string> = {
  backlog: "text-muted-foreground border-muted-foreground",
  todo: "text-blue-400 border-blue-400",
  in_progress: "text-yellow-400 border-yellow-400",
  in_review: "text-violet-400 border-violet-400",
  done: "text-green-400 border-green-400",
  cancelled: "text-neutral-500 border-neutral-500",
  blocked: "text-red-400 border-red-400",
};

const allStatuses = ["backlog", "todo", "in_progress", "in_review", "done", "cancelled", "blocked"];

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface StatusIconProps {
  status: string;
  onChange?: (status: string) => void;
  className?: string;
  showLabel?: boolean;
}

export function StatusIcon({ status, onChange, className, showLabel }: StatusIconProps) {
  const [open, setOpen] = useState(false);
  const colorClass = statusColors[status] ?? "text-muted-foreground border-muted-foreground";
  const isDone = status === "done";

  const circle = (
    <span
      className={cn(
        "relative inline-flex h-4 w-4 rounded-full border-2 shrink-0",
        colorClass,
        onChange && !showLabel && "cursor-pointer",
        className
      )}
    >
      {isDone && (
        <span className="absolute inset-0 m-auto h-2 w-2 rounded-full bg-current" />
      )}
    </span>
  );

  if (!onChange) return showLabel ? <span className="inline-flex items-center gap-1.5">{circle}<span className="text-sm">{statusLabel(status)}</span></span> : circle;

  const trigger = showLabel ? (
    <button className="inline-flex items-center gap-1.5 cursor-pointer hover:bg-accent/50 rounded px-1 -mx-1 py-0.5 transition-colors">
      {circle}
      <span className="text-sm">{statusLabel(status)}</span>
    </button>
  ) : circle;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="start">
        {allStatuses.map((s) => (
          <Button
            key={s}
            variant="ghost"
            size="sm"
            className={cn("w-full justify-start gap-2 text-xs", s === status && "bg-accent")}
            onClick={() => {
              onChange(s);
              setOpen(false);
            }}
          >
            <StatusIcon status={s} />
            {statusLabel(s)}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
