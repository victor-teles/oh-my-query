import type { Plugin } from "vite";

export declare function visualRegression(): Plugin;

export interface CompareResult {
  status: "pass" | "fail" | "new";
  diffPixels: number;
  diffPercent: number;
  message: string;
}
