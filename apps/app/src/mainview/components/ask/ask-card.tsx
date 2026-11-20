import type { CardResult } from "@oh-my-query/rpc";
import type { ReactNode, Ref } from "react";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import type { CardViewKind, ViewOption } from "@/lib/card-data";
import type { CardSpec } from "@/lib/ipc";

import { Reveal } from "@/components/motion/reveal";
import { SwapText } from "@/components/motion/swap-text";
import {
  alternatesFor,
  chartModelOf,
  pieModelOf,
  trendOf,
} from "@/lib/card-data";
import { useMotionPreset } from "@/lib/motion";

import type { ChartAnimation } from "./card-chart";

import { CardChart, DATA_UPDATE_MS } from "./card-chart";
import { CardInsight } from "./card-insight";
import { CardKpi } from "./card-kpi";
import { CardLegend } from "./card-legend";
import { CardPie } from "./card-pie";
import { CardTable } from "./card-table";
import { CardViewToggle } from "./card-view-toggle";

export type CardIntro = "play" | "skip" | "update";

// A refined insight waits for the data morph to settle, then 120ms more.
const INSIGHT_AFTER_UPDATE_S = DATA_UPDATE_MS / 1000 + 0.12;

export interface CardSlots {
  actions?: ReactNode;
  overlay?: ReactNode;
}

interface AskCardProps {
  spec: CardSpec;
  result: CardResult;
  view: CardViewKind;
  onSelectView: (view: CardViewKind) => void;
  intro?: CardIntro;
  slots?: CardSlots;
  ref?: Ref<HTMLElement>;
}

const chartLabel = (spec: CardSpec, option: ViewOption, series: string[]) =>
  `${option.label} chart: ${spec.title}. Series: ${series.join(", ")}.`;

interface CardBodyProps {
  spec: CardSpec;
  result: CardResult;
  option: ViewOption;
  animation: ChartAnimation;
}

function CardBody({ spec, result, option, animation }: CardBodyProps) {
  const { view } = option;
  switch (view.kind) {
    case "chart": {
      const model = chartModelOf(view, result, spec.formats);
      const series = model.data.series.map((item) => item.label);
      return (
        <>
          <CardLegend model={model} />
          <CardChart
            animation={animation}
            label={chartLabel(spec, option, series)}
            model={model}
            view={view}
          />
        </>
      );
    }
    case "pie": {
      const model = pieModelOf(view, result, spec.formats);
      const series = model.data.series.map((item) => item.label);
      return (
        <>
          <CardLegend model={model} />
          <CardPie
            animation={animation}
            label={chartLabel(spec, option, series)}
            model={model}
            view={view}
          />
        </>
      );
    }
    case "kpi": {
      return <CardKpi formats={spec.formats} result={result} view={view} />;
    }
    default: {
      return (
        <CardTable
          columns={view.columns}
          formats={spec.formats}
          result={result}
        />
      );
    }
  }
}

const chartAnimation = (
  reduced: boolean,
  intro: CardIntro,
  introducing: boolean
): ChartAnimation => {
  if (reduced) {
    return "none";
  }
  if (intro === "update") {
    return "update";
  }
  return introducing ? "intro" : "none";
};

const trendFor = (option: ViewOption, result: CardResult, spec: CardSpec) => {
  if (option.view.kind !== "chart") {
    return "flat";
  }
  const model = chartModelOf(option.view, result, spec.formats);
  return model.showsLatest ? trendOf(model.data) : "flat";
};

export function AskCard({
  spec,
  result,
  view,
  onSelectView,
  intro = "play",
  slots,
  ref,
}: AskCardProps) {
  const { reduced, fadeIn, fadeOut } = useMotionPreset();
  const options = alternatesFor(spec, result);
  const option = options.find((item) => item.kind === view) ?? options[0];
  const [introView, setIntroView] = useState<CardViewKind | null>(
    intro === "play" ? view : null
  );
  if (introView !== null && introView !== view) {
    setIntroView(null);
  }
  if (!option) {
    return null;
  }

  return (
    <section
      aria-label={spec.title}
      className="relative flex flex-col"
      ref={ref}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pt-3 pb-3">
        <Reveal className="flex min-w-[9rem] flex-1 flex-col gap-0.5">
          <h3 className="truncate type-title text-foreground">
            <SwapText value={spec.title} />
          </h3>
          {spec.subtitle ? (
            <p className="truncate type-meta text-panel-muted">
              <SwapText value={spec.subtitle} />
            </p>
          ) : null}
        </Reveal>
        <div className="flex shrink-0 items-center gap-1">
          <CardViewToggle
            onChange={onSelectView}
            options={options}
            value={option.kind}
          />
          {slots?.actions}
        </div>
      </div>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: fadeOut }}
          initial={{ opacity: 0 }}
          key={option.kind}
          transition={fadeIn}
        >
          <CardBody
            animation={chartAnimation(
              reduced,
              intro,
              introView === option.kind
            )}
            option={option}
            result={result}
            spec={spec}
          />
        </motion.div>
      </AnimatePresence>
      <AnimatePresence initial={false} mode="popLayout">
        {spec.insight ? (
          <motion.div
            exit={{ opacity: 0, transition: fadeOut }}
            key={spec.insight}
          >
            <CardInsight
              delay={intro === "update" ? INSIGHT_AFTER_UPDATE_S : undefined}
              text={spec.insight}
              trend={trendFor(option, result, spec)}
            />
          </motion.div>
        ) : (
          <div className="h-3" key="no-insight" />
        )}
      </AnimatePresence>
      {slots?.overlay}
    </section>
  );
}
