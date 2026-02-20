import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { useToast, type ToastTone } from "../context/ToastContext";
import { cn } from "../lib/utils";

const toneClasses: Record<ToastTone, string> = {
  info: "border-border bg-card text-card-foreground",
  success: "border-emerald-500/40 bg-emerald-50 text-emerald-950 dark:bg-emerald-900/30 dark:text-emerald-100",
  warn: "border-amber-500/40 bg-amber-50 text-amber-950 dark:bg-amber-900/30 dark:text-amber-100",
  error: "border-red-500/45 bg-red-50 text-red-950 dark:bg-red-900/35 dark:text-red-100",
};

const toneDotClasses: Record<ToastTone, string> = {
  info: "bg-sky-400",
  success: "bg-emerald-400",
  warn: "bg-amber-400",
  error: "bg-red-400",
};

export function ToastViewport() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <aside
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 top-3 z-[120] flex justify-center px-3 sm:inset-auto sm:right-4 sm:top-4 sm:w-full sm:max-w-sm"
    >
      <ol className="flex w-full flex-col gap-2">
        {toasts.map((toast) => (
          <li
            key={toast.id}
            className={cn(
              "pointer-events-auto rounded-lg border shadow-lg backdrop-blur-sm",
              toneClasses[toast.tone],
            )}
          >
            <div className="flex items-start gap-3 px-3 py-2.5">
              <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", toneDotClasses[toast.tone])} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-5">{toast.title}</p>
                {toast.body && (
                  <p className="mt-1 text-xs leading-4 text-muted-foreground dark:text-foreground/70">
                    {toast.body}
                  </p>
                )}
                {toast.action && (
                  <Link
                    to={toast.action.href}
                    onClick={() => dismissToast(toast.id)}
                    className="mt-2 inline-flex text-xs font-medium underline underline-offset-4 hover:opacity-90"
                  >
                    {toast.action.label}
                  </Link>
                )}
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => dismissToast(toast.id)}
                className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground hover:bg-black/10 hover:text-foreground dark:hover:bg-white/10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}
