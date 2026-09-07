"use client";

// One editable row per ingredient / step, with add and remove. Each row is an
// input with the same `name`, so the Server Action reads them with
// formData.getAll() and joins them back into the newline-separated text the DB
// column stores. Client-side because add/remove is dynamic form state.

import { Plus, X } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Row = { key: string; value: string };

export function RowsEditor({
  name,
  addLabel,
  placeholder,
  defaultValues = [],
  ordered = false,
  multiline = false,
}: {
  name: string;
  addLabel: string;
  placeholder: string;
  defaultValues?: string[];
  ordered?: boolean;
  multiline?: boolean;
}) {
  const baseId = useId();
  const [rows, setRows] = useState<Row[]>(() =>
    (defaultValues.length ? defaultValues : [""]).map((value, i) => ({
      key: `${baseId}-${i}`,
      value,
    })),
  );

  function removeRow(key: string) {
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs));
  }

  const Field = multiline ? Textarea : Input;

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={row.key} className="flex items-start gap-2">
          {ordered && (
            <span className="text-muted-foreground w-5 shrink-0 pt-2 text-right text-sm tabular-nums">
              {i + 1}.
            </span>
          )}
          <Field
            name={name}
            defaultValue={row.value}
            placeholder={i === 0 ? placeholder : undefined}
            rows={multiline ? 2 : undefined}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground shrink-0"
            aria-label="Remove"
            onClick={() => removeRow(row.key)}
          >
            <X />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() =>
          setRows((rs) => [...rs, { key: crypto.randomUUID(), value: "" }])
        }
      >
        <Plus />
        {addLabel}
      </Button>
    </div>
  );
}
