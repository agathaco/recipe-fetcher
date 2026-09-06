"use client";

// The second Client Component. Live search needs to react to every keystroke,
// which is browser state. It still writes the query to the URL (debounced), so
// the URL stays the source of truth: shareable, bookmarkable, back-button-safe.

import { Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useTransition } from "react";

import { Input } from "@/components/ui/input";

export function SearchBox() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function onChange(value: string) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (value) params.set("q", value);
      else params.delete("q");

      // replace, not push, so a burst of keystrokes doesn't fill browser history.
      // The transition lets the server re-render the list while the input stays live.
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    }, 250);
  }

  return (
    <div className="relative flex-1">
      <Input
        type="search"
        name="q"
        defaultValue={searchParams.get("q") ?? ""}
        placeholder="Search titles..."
        autoComplete="off"
        aria-label="Search recipes by title"
        className="pr-8"
        onChange={(e) => onChange(e.target.value)}
      />
      {isPending && (
        <Loader2 className="text-muted-foreground absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin" />
      )}
    </div>
  );
}
