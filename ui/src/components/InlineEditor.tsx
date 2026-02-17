import { useState, useRef, useEffect } from "react";
import { cn } from "../lib/utils";

interface InlineEditorProps {
  value: string;
  onSave: (value: string) => void;
  as?: "h1" | "h2" | "p" | "span";
  className?: string;
  placeholder?: string;
  multiline?: boolean;
}

export function InlineEditor({
  value,
  onSave,
  as: Tag = "span",
  className,
  placeholder = "Click to edit...",
  multiline = false,
}: InlineEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    } else {
      setDraft(value);
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      commit();
    }
    if (e.key === "Escape") {
      setDraft(value);
      setEditing(false);
    }
  }

  if (editing) {
    const sharedProps = {
      ref: inputRef as any,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: handleKeyDown,
      className: cn(
        "bg-transparent border border-border rounded px-2 py-1 w-full outline-none focus:ring-1 focus:ring-ring",
        className
      ),
    };

    if (multiline) {
      return <textarea {...sharedProps} rows={4} />;
    }
    return <input type="text" {...sharedProps} />;
  }

  return (
    <Tag
      className={cn(
        "cursor-pointer rounded px-1 -mx-1 hover:bg-accent/50 transition-colors",
        !value && "text-muted-foreground italic",
        className
      )}
      onClick={() => setEditing(true)}
    >
      {value || placeholder}
    </Tag>
  );
}
