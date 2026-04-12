export interface CompareResult {
  status: "pass" | "fail" | "new";
  diffPixels: number;
  diffPercent: number;
  message: string;
}
