import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type DragEvent } from "react";
import {
  MDXEditor,
  type MDXEditorMethods,
  headingsPlugin,
  imagePlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  thematicBreakPlugin,
  type RealmPlugin,
} from "@mdxeditor/editor";
import { cn } from "../lib/utils";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  contentClassName?: string;
  onBlur?: () => void;
  imageUploadHandler?: (file: File) => Promise<string>;
  bordered?: boolean;
}

export interface MarkdownEditorRef {
  focus: () => void;
}

export const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>(function MarkdownEditor({
  value,
  onChange,
  placeholder,
  className,
  contentClassName,
  onBlur,
  imageUploadHandler,
  bordered = true,
}: MarkdownEditorProps, forwardedRef) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ref = useRef<MDXEditorMethods>(null);
  const latestValueRef = useRef(value);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragDepthRef = useRef(0);

  useImperativeHandle(forwardedRef, () => ({
    focus: () => {
      ref.current?.focus(undefined, { defaultSelection: "rootEnd" });
    },
  }), []);

  const plugins = useMemo<RealmPlugin[]>(() => {
    const imageHandler = imageUploadHandler
      ? async (file: File) => {
          try {
            const src = await imageUploadHandler(file);
            setUploadError(null);
            return src;
          } catch (err) {
            const message = err instanceof Error ? err.message : "Image upload failed";
            setUploadError(message);
            throw err;
          }
        }
      : undefined;
    const withImage = Boolean(imageHandler);
    const all: RealmPlugin[] = [
      headingsPlugin(),
      listsPlugin(),
      quotePlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      thematicBreakPlugin(),
      markdownShortcutPlugin(),
    ];
    if (imageHandler) {
      all.push(imagePlugin({ imageUploadHandler: imageHandler }));
    }
    return all;
  }, [imageUploadHandler]);

  useEffect(() => {
    if (value !== latestValueRef.current) {
      ref.current?.setMarkdown(value);
      latestValueRef.current = value;
    }
  }, [value]);

  function hasFilePayload(evt: DragEvent<HTMLDivElement>) {
    return Array.from(evt.dataTransfer?.types ?? []).includes("Files");
  }

  const canDropImage = Boolean(imageUploadHandler);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative paperclip-mdxeditor-scope",
        bordered ? "rounded-md border border-border bg-transparent" : "bg-transparent",
        isDragOver && "ring-1 ring-primary/60 bg-accent/20",
        className,
      )}
      onDragEnter={(evt) => {
        if (!canDropImage || !hasFilePayload(evt)) return;
        dragDepthRef.current += 1;
        setIsDragOver(true);
      }}
      onDragOver={(evt) => {
        if (!canDropImage || !hasFilePayload(evt)) return;
        evt.preventDefault();
        evt.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(evt) => {
        if (!canDropImage) return;
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) setIsDragOver(false);
      }}
      onDrop={() => {
        dragDepthRef.current = 0;
        setIsDragOver(false);
      }}
    >
      <MDXEditor
        ref={ref}
        markdown={value}
        placeholder={placeholder}
        onChange={(next) => {
          latestValueRef.current = next;
          onChange(next);
        }}
        onBlur={() => onBlur?.()}
        className={cn("paperclip-mdxeditor", !bordered && "paperclip-mdxeditor--borderless")}
        contentEditableClassName={cn(
          "paperclip-mdxeditor-content focus:outline-none",
          contentClassName,
        )}
        overlayContainer={containerRef.current}
        plugins={plugins}
      />
      {isDragOver && canDropImage && (
        <div
          className={cn(
            "pointer-events-none absolute inset-1 z-40 flex items-center justify-center rounded-md border border-dashed border-primary/80 bg-primary/10 text-xs font-medium text-primary",
            !bordered && "inset-0 rounded-sm",
          )}
        >
          Drop image to upload
        </div>
      )}
      {uploadError && (
        <p className="px-3 pb-2 text-xs text-destructive">{uploadError}</p>
      )}
    </div>
  );
});
