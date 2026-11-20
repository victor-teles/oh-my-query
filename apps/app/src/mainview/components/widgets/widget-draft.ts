import type { DialectType } from "@conch/core/client";

import type { CardViewKind } from "@/lib/card-data";
import type { CardSpec, ParamDef, Widget, WidgetDraft } from "@/lib/ipc";

export interface AnsweredAsk {
  prompt: string;
  sql: string;
  dialect: DialectType;
  spec: CardSpec;
  view: CardViewKind;
  connectionId: string;
}

const NAME_MAX = 60;

export const defaultWidgetName = (spec: CardSpec): string =>
  spec.title.slice(0, NAME_MAX);

export const draftFromAsk = (
  ask: AnsweredAsk,
  name: string,
  inputs: { template: string; params: ParamDef[] } | null = null
): WidgetDraft => ({
  connectionId: ask.connectionId,
  database: null,
  dialect: ask.dialect,
  lastValues: {},
  name: name.trim().slice(0, NAME_MAX),
  params: inputs?.params ?? [],
  prompt: ask.prompt,
  spec: ask.spec,
  sqlTemplate: inputs?.template ?? ask.sql,
  view: ask.view,
});

export const draftFromWidget = (widget: Widget): WidgetDraft => ({
  connectionId: widget.connectionId,
  database: widget.database,
  dialect: widget.dialect,
  id: widget.id,
  lastValues: widget.lastValues,
  name: widget.name,
  params: widget.params,
  prompt: widget.prompt,
  spec: widget.spec,
  sqlTemplate: widget.sqlTemplate,
  view: widget.view,
});

export const duplicateDraft = (widget: Widget): WidgetDraft => {
  const { id: _id, ...rest } = draftFromWidget(widget);
  return { ...rest, name: `${widget.name} copy`.slice(0, NAME_MAX) };
};
