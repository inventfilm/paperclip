import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../lib/utils";
import { useTheme } from "../context/ThemeContext";

interface MarkdownBodyProps {
  children: string;
  className?: string;
}

export function MarkdownBody({ children, className }: MarkdownBodyProps) {
  const { theme } = useTheme();
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:my-2 prose-pre:whitespace-pre-wrap prose-pre:break-words prose-headings:my-2 prose-headings:text-sm prose-table:my-2 prose-th:px-3 prose-th:py-1.5 prose-td:px-3 prose-td:py-1.5 prose-code:break-all",
        theme === "dark" && "prose-invert",
        className,
      )}
    >
      <Markdown remarkPlugins={[remarkGfm]}>{children}</Markdown>
    </div>
  );
}
