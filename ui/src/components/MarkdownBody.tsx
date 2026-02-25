import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../lib/utils";

interface MarkdownBodyProps {
  children: string;
  className?: string;
}

export function MarkdownBody({ children, className }: MarkdownBodyProps) {
  return (
    <div
      className={cn(
        "prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:my-2 prose-pre:whitespace-pre-wrap prose-pre:break-words prose-headings:my-2 prose-headings:text-sm prose-table:my-2 prose-th:px-3 prose-th:py-1.5 prose-td:px-3 prose-td:py-1.5 prose-code:break-all",
        className,
      )}
    >
      <Markdown remarkPlugins={[remarkGfm]}>{children}</Markdown>
    </div>
  );
}
