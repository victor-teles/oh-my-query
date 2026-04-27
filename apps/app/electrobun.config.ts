import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    identifier: "dev.ohmyquery.app",
    name: "oh-my-query",
    version: "0.0.10",
  },
  build: {
    copy: {
      "assets/bun/polyglot_sql_wasm_bg.wasm": "bun/polyglot_sql_wasm_bg.wasm",
      "dist/**/*": "views/mainview/",
    },
    linux: {
      bundleCEF: false,
    },
    mac: {
      bundleCEF: false,
      codesign: process.env.ELECTROBUN_DEVELOPER_ID !== undefined,
      notarize:
        process.env.ELECTROBUN_APPLEID !== undefined ||
        process.env.ELECTROBUN_APPLEAPIKEY !== undefined,
    },
    views: {
      mainview: {
        entrypoint: "dist/index.html",
      },
    },
    win: {
      bundleCEF: false,
    },
  },
} satisfies ElectrobunConfig;
