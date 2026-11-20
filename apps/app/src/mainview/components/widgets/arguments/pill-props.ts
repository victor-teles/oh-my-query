import type { ParamDef, ParamValue } from "@/lib/ipc";

export interface PillProps<P extends ParamDef = ParamDef> {
  widgetId: string;
  param: P;
  valueKey: string;
  value: ParamValue;
  index: number;
  active: boolean;
  register: (index: number, element: HTMLElement | null) => void;
  onFocus: (index: number) => void;
  onChange: (name: string, value: ParamValue) => void;
  onCommit: (name: string, value: ParamValue) => void;
}

export type PillOf<T extends ParamDef["type"]> = PillProps<
  Extract<ParamDef, { type: T }>
>;
