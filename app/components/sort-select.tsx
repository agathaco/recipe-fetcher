"use client";

// Lives inside the same GET <form> as SearchBox: a plain <select name="sort">
// works with JS disabled (its value submits with the rest of the form). With
// JS, changing it updates the URL immediately, same pattern as SearchBox.

import { ChevronDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const SORT_OPTIONS = [
  { value: "date", label: "Newest first" },
  { value: "name", label: "Name (A–Z)" },
  { value: "rating", label: "Highest rated" },
] as const;

export function SortSelect() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams);
    // "date" is the default order, keep it out of the URL when selected.
    if (value === "date") params.delete("sort");
    else params.set("sort", value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    // The browser's native <select> arrow sits flush against the edge with no
    // way to pad it directly, so it's turned off (appearance-none) in favour
    // of our own icon, same trick SearchBox uses for its spinner.
    <div className="relative shrink-0">
      <select
        name="sort"
        defaultValue={searchParams.get("sort") ?? "date"}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Sort recipes"
        className="border-input h-8 appearance-none rounded-lg border bg-transparent py-1 pr-8 pl-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2" />
    </div>
  );
}
