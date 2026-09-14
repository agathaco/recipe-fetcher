"use client";

// Cross off ingredients as you gather them, steps as you finish them. Lives
// only in the browser (localStorage, keyed per recipe + section): "done
// cooking this" isn't part of the recipe's own data, and a stale checked-off
// state left over from last time you made it would be actively misleading,
// so it deliberately never touches the database.

import { useEffect, useState } from "react";

import { cn } from "cn";

export function RecipeChecklist({
  items,
  storageKey,
  ordered = false,
}: {
  items: string[];
  storageKey: string;
  ordered?: boolean;
}) {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  // Read saved progress after mount, not during render: localStorage isn't
  // available on the server, and reading it during the first client render
  // would mismatch the server-rendered (always-unchecked) HTML and trigger a
  // hydration error.
  // This is the "subscribe to an external system" case the lint rule's own
  // message carves out: syncing from localStorage (unavailable during SSR)
  // after mount, on purpose, is what avoids a hydration mismatch.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setChecked(new Set(JSON.parse(raw)));
      }
    } catch {
      // Private browsing, corrupted value, storage disabled: just start unchecked.
    }
  }, [storageKey]);

  function toggle(i: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        // ignore: not having this persist is fine, it just resets on reload
      }
      return next;
    });
  }

  const ListTag = ordered ? "ol" : "ul";

  return (
    <ListTag className="mt-2 list-none space-y-1.5 text-sm">
      {items.map((item, i) => {
        const done = checked.has(i);
        return (
          <li key={i}>
            <label className="flex cursor-pointer items-start gap-2.5">
              {ordered && (
                <span
                  className={cn(
                    "text-muted-foreground w-4 shrink-0 pt-px text-right text-xs font-medium tabular-nums",
                    done && "opacity-40",
                  )}
                >
                  {i + 1}.
                </span>
              )}
              <input
                type="checkbox"
                checked={done}
                onChange={() => toggle(i)}
                className="accent-primary mt-1 size-3.5 shrink-0"
              />
              <span className={cn(done && "text-muted-foreground line-through decoration-2")}>
                {item}
              </span>
            </label>
          </li>
        );
      })}
    </ListTag>
  );
}
