import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    identifier: "dev.ohmyquery.app",
    name: "oh-my-query",
    version: "0.0.10",
  },
  build: {
    copy: {
      "dist/**/*": "views/mainview/",
    },
    linux: {
      bundleCEF: false,
    },
    mac: {
      bundleCEF: false,
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
