import type { WindowOptionsType } from "electrobun/bun";

const DEV_URL = process.env.ELECTROBUN_DEV_URL ?? null;

export const windowOptions: Partial<WindowOptionsType> = {
  frame: { height: 860, width: 1280, x: 200, y: 200 },
  passthrough: false,
  title: "oh-my-query",
  titleBarStyle: "hiddenInset",
  transparent: true,
  url: DEV_URL ?? "views://mainview/dist/index.html",
};
