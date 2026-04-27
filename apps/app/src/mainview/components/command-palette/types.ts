import type { LucideIcon } from "lucide-react";

export type CommandActionGroup =
  | "Suggested"
  | "Navigate"
  | "Tabs"
  | "Query"
  | "Connection"
  | "Schema"
  | "AI"
  | "View";

export interface CommandAction {
  id: string;
  label: string;
  group: CommandActionGroup;
  icon?: LucideIcon;
  shortcut?: string[];
  keywords?: string[];
  accentColor?: string;
  destructive?: boolean;
  confirm?: boolean;
  perform: () => void | Promise<void>;
  when?: () => boolean;
}
