import {
  BookmarkPlusIcon,
  ClipboardCopyIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  ImageIcon,
  LayoutGridIcon,
  TableIcon,
} from "lucide-react";

import type { MenuAction } from "@/components/launcher/actions/menu-action";
import type { CardViewKind } from "@/lib/card-data";

export type ExportActionId =
  | "copy-sql"
  | "copy-csv"
  | "copy-tsv"
  | "copy-markdown"
  | "copy-png"
  | "save-csv";

export type AskOnlyActionId = "save-widget" | "add-to-board";

export type ResultActionId = ExportActionId | AskOnlyActionId;

export interface ResultAction<
  Id extends ResultActionId = ResultActionId,
> extends MenuAction {
  id: Id;
}

export interface ResultContext {
  hasSql: boolean;
  hasRows: boolean;
  view: CardViewKind | null;
}

const IMAGE_VIEWS: ReadonlySet<CardViewKind> = new Set([
  "bar",
  "line",
  "area",
  "pie",
]);

export const canCopyChart = (view: CardViewKind | null): boolean =>
  view !== null && IMAGE_VIEWS.has(view);

export const exportActions = ({
  hasSql,
  hasRows,
  view,
}: ResultContext): ResultAction<ExportActionId>[] => {
  const noRows = !hasRows;
  const actions: ResultAction<ExportActionId>[] = [
    {
      disabled: !hasSql,
      icon: ClipboardCopyIcon,
      id: "copy-sql",
      keys: ["⌘", "C"],
      label: "Copy SQL",
      tone: "default",
    },
    {
      disabled: noRows,
      icon: FileSpreadsheetIcon,
      id: "copy-csv",
      label: "Copy as CSV",
      tone: "default",
    },
    {
      disabled: noRows,
      icon: TableIcon,
      id: "copy-tsv",
      label: "Copy as TSV",
      tone: "default",
    },
    {
      disabled: noRows,
      icon: FileTextIcon,
      id: "copy-markdown",
      label: "Copy as Markdown",
      tone: "default",
    },
  ];
  if (canCopyChart(view)) {
    actions.push({
      disabled: noRows,
      icon: ImageIcon,
      id: "copy-png",
      label: "Copy Chart as PNG",
      tone: "default",
    });
  }
  actions.push({
    disabled: noRows,
    icon: DownloadIcon,
    id: "save-csv",
    label: "Save CSV to Downloads",
    tone: "default",
  });
  return actions;
};

export const askResultActions = (
  context: ResultContext & { canSave: boolean }
): ResultAction[] => [
  ...exportActions(context),
  {
    disabled: !context.canSave,
    icon: BookmarkPlusIcon,
    id: "save-widget",
    keys: ["⌘", "S"],
    label: "Save as Widget…",
    tone: "default",
  },
  {
    disabled: !context.canSave,
    icon: LayoutGridIcon,
    id: "add-to-board",
    label: "Add to Board…",
    tone: "default",
  },
];
