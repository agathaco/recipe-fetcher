"use client";

// A tag combobox: selected tags shown as removable coloured pills inside the
// field, a dropdown of existing tags below that filters as you type, and a
// "Create ..." option when what you typed is new. Each selected tag is emitted
// as a hidden <input name="tag">, so the Server Action reads them with
// formData.getAll("tag"). Client-side because it's real interactive form state.

import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "cn";
import { tagColorClasses } from "@/components/tag-pill";

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function TagInput({
  defaultValue = [],
  allTags = [],
}: {
  defaultValue?: string[];
  allTags?: string[];
}) {
  const [selected, setSelected] = useState<string[]>(defaultValue);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = normalize(query);
  const unselected = allTags.filter((t) => !selected.includes(t));
  const matches = q ? unselected.filter((t) => t.includes(q)) : unselected;
  const canCreate = q.length > 0 && !allTags.includes(q) && !selected.includes(q);

  const options: { kind: "existing" | "create"; value: string }[] = [
    ...matches.map((value) => ({ kind: "existing" as const, value })),
    ...(canCreate ? [{ kind: "create" as const, value: q }] : []),
  ];

  function add(name: string) {
    const clean = normalize(name);
    if (!clean || selected.includes(clean)) return;
    setSelected((s) => [...s, clean]);
    setQuery("");
    setActiveIndex(0);
  }

  function remove(name: string) {
    setSelected((s) => s.filter((t) => t !== name));
  }

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const opt = options[activeIndex];
      if (opt) add(opt.value);
      else if (q) add(q);
    } else if (e.key === "Backspace" && query === "" && selected.length > 0) {
      remove(selected[selected.length - 1]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      {selected.map((t) => (
        <input key={t} type="hidden" name="tag" value={t} />
      ))}

      <div
        className="border-input focus-within:border-ring focus-within:ring-ring/40 flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border bg-transparent px-2 py-1.5 text-sm focus-within:ring-[3px]"
        onClick={() => {
          inputRef.current?.focus();
          setOpen(true);
        }}
      >
        {selected.map((t) => (
          <span
            key={t}
            className={cn(
              "inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2 text-xs font-medium",
              tagColorClasses(t),
            )}
          >
            {t}
            <button
              type="button"
              aria-label={`Remove ${t}`}
              onClick={(e) => {
                e.stopPropagation();
                remove(t);
              }}
              className="hover:bg-black/10 rounded-full p-0.5"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={selected.length ? "" : "Add tags..."}
          className="placeholder:text-muted-foreground min-w-24 flex-1 bg-transparent outline-none"
          aria-label="Add tags"
        />
      </div>

      {open && options.length > 0 && (
        <ul className="bg-popover absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border p-1 shadow-md">
          {options.map((opt, i) => (
            <li key={opt.kind + opt.value}>
              <button
                type="button"
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => add(opt.value)}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm",
                  i === activeIndex && "bg-accent",
                )}
              >
                {opt.kind === "create" ? (
                  <>
                    <Plus className="size-3.5" />
                    Create &ldquo;{opt.value}&rdquo;
                  </>
                ) : (
                  opt.value
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
