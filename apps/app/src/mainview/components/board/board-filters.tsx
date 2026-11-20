import { SlidersHorizontalIcon } from "lucide-react";
import { useState } from "react";

import type { ParamValues } from "@/lib/ipc";

import { ArgumentPills } from "@/components/widgets/arguments/argument-pills";

import type { SharedInput } from "./board-inputs";

interface BoardFiltersProps {
  inputs: readonly SharedInput[];
  values: ParamValues;
  onApply: (values: ParamValues) => void;
}

export function BoardFilters({ inputs, values, onApply }: BoardFiltersProps) {
  const [draft, setDraft] = useState(values);
  const [source, setSource] = useState(values);
  if (source !== values) {
    setSource(values);
    setDraft(values);
  }
  if (inputs.length === 0) {
    return null;
  }
  return (
    <div className="relative z-20 flex min-h-12 shrink-0 items-center gap-3 border-b border-panel-border px-6 py-2">
      <span className="flex shrink-0 items-center gap-1.5 type-meta text-panel-muted">
        <SlidersHorizontalIcon aria-hidden className="size-3.5" />
        Inputs
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <ArgumentPills
          initialFocus="none"
          inputs={inputs}
          label="Board inputs"
          onChange={setDraft}
          onSubmit={onApply}
          values={draft}
        />
      </div>
      <span className="ml-auto shrink-0 type-micro text-panel-muted">
        Applies to every tile with the same input
      </span>
    </div>
  );
}
