import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "../lib/utils";

interface InlineEditorProps {
  value: string;
  onSave: (value: string) => void;
  as?: "h1" | "h2" | "p" | "span";
  className?: string;
  placeholder?: string;
  multiline?: boolean;
}

/** Shared padding so display and edit modes occupy the exact same box. */
const pad = "px-1 -mx-1";

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

  const autoSize = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
      if (multiline && inputRef.current instanceof HTMLTextAreaElement) {
        autoSize(inputRef.current);
      }
    }
  }, [editing, multiline, autoSize]);

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
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setDraft(e.target.value);
        if (multiline && e.target instanceof HTMLTextAreaElement) {
          autoSize(e.target);
        }
      },
      onBlur: commit,
      onKeyDown: handleKeyDown,
    };

    if (multiline) {
      return (
        <textarea
          {...sharedProps}
          rows={1}
          className={cn(
            "w-full resize-none bg-accent/30 rounded outline-none",
            pad,
            "py-0.5",
            className
          )}
        />
      );
    }

    return (
      <input
        type="text"
        {...sharedProps}
        className={cn(
          "w-full bg-transparent rounded outline-none",
          pad,
          className
        )}
      />
    );
  }

  return (
    <Tag
      className={cn(
        "cursor-pointer rounded hover:bg-accent/50 transition-colors",
        pad,
        !value && "text-muted-foreground italic",
        className
      )}
      onClick={() => setEditing(true)}
    >
      {value || placeholder}
    </Tag>
  );
}
