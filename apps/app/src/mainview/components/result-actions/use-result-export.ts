import type { RefObject } from "react";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CardResult, CardViewKind } from "@/lib/card-data";
import type { CardSpec } from "@/lib/ipc";

import { FLASH_FOR_MS } from "@/hooks/use-flash-message";
import { blobToBase64, chartLegendOf, renderChartPng } from "@/lib/chart-image";
import { copyText } from "@/lib/clipboard";
import { getErrorMessage } from "@/lib/error-message";
import { copyImage, revealSaved, saveCsvToDownloads } from "@/lib/ipc";
import { exportBaseName, toCsv, toMarkdown, toTsv } from "@/lib/table-text";

import type { ExportActionId } from "./result-actions";

export type TableFormat = "csv" | "tsv" | "markdown";

export type ExportStatus =
  | { kind: "working"; message: string }
  | { kind: "done"; message: string }
  | { kind: "saved"; fileName: string; savedId: string }
  | { kind: "failed"; message: string };

export interface ExportSource {
  spec: CardSpec;
  result: CardResult;
  view: CardViewKind;
}

const SAVED_FOR_MS = 6000;
const FAILED_FOR_MS = 4000;
const CHART_FAILED = "The chart couldn't be copied.";

const FORMAT_LABELS: Record<TableFormat, string> = {
  csv: "CSV",
  markdown: "Markdown",
  tsv: "TSV",
};

const tableText = (format: TableFormat, result: CardResult): string => {
  switch (format) {
    case "csv": {
      return toCsv(result, "clipboard");
    }
    case "tsv": {
      return toTsv(result);
    }
    default: {
      return toMarkdown(result);
    }
  }
};

const rowsCopied = (result: CardResult, format: TableFormat): string => {
  const count = result.rows.length;
  const rows = `${count.toLocaleString("en-US")} ${count === 1 ? "row" : "rows"}`;
  const capped = result.isTruncated
    ? ` · first ${count.toLocaleString("en-US")} rows`
    : "";
  return `Copied ${rows} as ${FORMAT_LABELS[format]}${capped}`;
};

const useTimedStatus = () => {
  const [status, setStatus] = useState<ExportStatus | null>(null);
  const timer = useRef(0);

  const show = useCallback((next: ExportStatus, forMs: number | null) => {
    window.clearTimeout(timer.current);
    setStatus(next);
    if (forMs !== null) {
      timer.current = window.setTimeout(() => setStatus(null), forMs);
    }
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { show, status };
};

interface UseResultExportOptions {
  source: ExportSource | null;
  cardRef: RefObject<HTMLElement | null>;
}

export const useResultExport = ({
  source,
  cardRef,
}: UseResultExportOptions) => {
  const { show, status } = useTimedStatus();
  const [chartCopies, setChartCopies] = useState(0);

  const announce = useCallback(
    (message: string) => show({ kind: "done", message }, FLASH_FOR_MS),
    [show]
  );
  const fail = useCallback(
    (message: string) => show({ kind: "failed", message }, FAILED_FOR_MS),
    [show]
  );

  const copyTable = useCallback(
    async (format: TableFormat) => {
      if (!source) {
        return;
      }
      if (await copyText(tableText(format, source.result))) {
        announce(rowsCopied(source.result, format));
      } else {
        fail("The rows couldn't be copied.");
      }
    },
    [announce, fail, source]
  );

  const copyChart = useCallback(async () => {
    const svg = cardRef.current?.querySelector("figure svg");
    if (!(source && svg instanceof SVGSVGElement)) {
      fail(CHART_FAILED);
      return;
    }
    show({ kind: "working", message: "Copying chart…" }, null);
    try {
      const png = await renderChartPng({
        legend: chartLegendOf(source.spec, source.result, source.view),
        subtitle: source.spec.subtitle,
        svg,
        title: source.spec.title,
      });
      await copyImage(await blobToBase64(png));
      setChartCopies((count) => count + 1);
      announce("Copied chart");
    } catch {
      fail(CHART_FAILED);
    }
  }, [announce, cardRef, fail, show, source]);

  const saveCsv = useCallback(async () => {
    if (!source) {
      return;
    }
    try {
      const saved = await saveCsvToDownloads(
        exportBaseName(source.spec.title),
        toCsv(source.result, "file")
      );
      show({ kind: "saved", ...saved }, SAVED_FOR_MS);
    } catch (error) {
      fail(getErrorMessage(error, "The file couldn't be saved."));
    }
  }, [fail, show, source]);

  const reveal = useCallback(async () => {
    if (status?.kind !== "saved") {
      return;
    }
    try {
      await revealSaved(status.savedId);
    } catch (error) {
      fail(getErrorMessage(error, "The file couldn't be shown."));
    }
  }, [fail, status]);

  return {
    announce,
    chartCopies,
    copyChart,
    copyTable,
    reveal,
    saveCsv,
    status,
  };
};

export type ResultExport = ReturnType<typeof useResultExport>;

export const runExportAction = (
  id: ExportActionId,
  exporter: ResultExport,
  copySql: () => void
): Promise<void> | void => {
  switch (id) {
    case "copy-sql": {
      return copySql();
    }
    case "copy-csv": {
      return exporter.copyTable("csv");
    }
    case "copy-tsv": {
      return exporter.copyTable("tsv");
    }
    case "copy-markdown": {
      return exporter.copyTable("markdown");
    }
    case "copy-png": {
      return exporter.copyChart();
    }
    default: {
      return exporter.saveCsv();
    }
  }
};
