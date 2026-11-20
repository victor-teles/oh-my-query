const DEV_URL = process.env.ELECTROBUN_DEV_URL ?? null;

export const LAUNCHER_URL = DEV_URL ?? "views://mainview/index.html";
