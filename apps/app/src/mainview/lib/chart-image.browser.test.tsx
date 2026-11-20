import type { CardResult } from "@oh-my-query/rpc";

import { CARD_SPEC_VERSION } from "@oh-my-query/rpc";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { CardViewKind } from "@/lib/card-data";
import type { CardSpec } from "@/lib/ipc";

import { AskCard } from "@/components/ask/ask-card";
import { kpi, revenue } from "@/test/card-fixtures";

import {
  blobToBase64,
  ChartImageError,
  chartLegendOf,
  renderChartPng,
} from "./chart-image";

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const SCALE = 2;
const PADDING = 24;

interface Fixture {
  spec: CardSpec;
  result: CardResult;
}

const share: Fixture = {
  result: {
    columns: [
      { name: "region", typeName: "TEXT" },
      { name: "mrr", typeName: "NUMERIC" },
    ],
    isTruncated: false,
    rowCount: 3,
    rows: [
      ["North America", 260_000],
      ["Europe", 145_000],
      ["Asia Pacific", 70_000],
    ],
  },
  spec: {
    formats: {},
    title: "MRR share by region",
    version: CARD_SPEC_VERSION,
    view: { kind: "pie", label: "region", value: "mrr" },
  },
};

const renderCard = async (fixture: Fixture, view: CardViewKind) => {
  const screen = render(
    <div style={{ width: 760 }}>
      <AskCard
        intro="skip"
        onSelectView={vi.fn()}
        result={fixture.result}
        spec={fixture.spec}
        view={view}
      />
    </div>
  );
  await expect
    .element(screen.getByRole("img", { name: /chart:/ }))
    .toBeVisible();
  const svg = screen.container.querySelector("figure svg");
  if (!(svg instanceof SVGSVGElement)) {
    throw new TypeError("the card has no chart");
  }
  return svg;
};

const readHeader = async (png: Blob) => {
  const bytes = new Uint8Array(await png.arrayBuffer());
  const view = new DataView(bytes.buffer);
  return {
    height: view.getUint32(20),
    signature: [...bytes.subarray(0, 8)],
    width: view.getUint32(16),
  };
};

const cornerAlpha = async (png: Blob): Promise<number> => {
  const bitmap = await createImageBitmap(png);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d");
  context?.drawImage(bitmap, 0, 0);
  return context?.getImageData(2, 2, 1, 1).data[3] ?? 0;
};

describe("renderChartPng", () => {
  it.each([
    ["bar", revenue],
    ["line", revenue],
    ["pie", share],
  ] as const)(
    "draws the %s chart as an opaque PNG sized to the layout",
    async (view, fixture) => {
      const svg = await renderCard(fixture, view);
      const png = await renderChartPng({
        legend: chartLegendOf(fixture.spec, fixture.result, view),
        scale: SCALE,
        subtitle: fixture.spec.subtitle,
        svg,
        title: fixture.spec.title,
      });
      const header = await readHeader(png);
      const box = svg.getBoundingClientRect();
      expect(header.signature).toStrictEqual(PNG_SIGNATURE);
      expect(header.width).toBe(Math.round((box.width + PADDING * 2) * SCALE));
      expect(header.height).toBeGreaterThan(box.height * SCALE);
      await expect(cornerAlpha(png)).resolves.toBe(255);
    }
  );

  it("encodes the PNG as base64 without a data URL prefix", async () => {
    const encoded = await blobToBase64(
      new Blob([new Uint8Array(PNG_SIGNATURE)])
    );
    expect(encoded).toBe("iVBORw0KGgo=");
  });

  it("names a typed error", () => {
    expect(new ChartImageError("nope").name).toBe("ChartImageError");
  });
});

describe("chartLegendOf", () => {
  it("lists one entry per series with its colour", () => {
    const legend = chartLegendOf(revenue.spec, revenue.result, "bar");
    expect(legend.length).toBeGreaterThan(0);
    expect(legend[0]).toMatchObject({ color: "var(--chart-1)" });
  });

  it("lists pie slices", () => {
    expect(
      chartLegendOf(share.spec, share.result, "pie").map((entry) => entry.label)
    ).toStrictEqual(["North America", "Europe", "Asia Pacific"]);
  });

  it("has no legend for KPI and table views", () => {
    expect(chartLegendOf(kpi.spec, kpi.result, "kpi")).toStrictEqual([]);
    expect(chartLegendOf(revenue.spec, revenue.result, "table")).toStrictEqual(
      []
    );
  });
});
