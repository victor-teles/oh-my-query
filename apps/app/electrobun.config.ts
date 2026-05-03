import type { ElectrobunConfig } from "electrobun";

import { nativeBunModules } from "./scripts/native-bun-assets.ts";

const bunExternals = nativeBunModules.flatMap((m) => [...m.externals]);
const bunAssetCopy = Object.fromEntries(
  nativeBunModules.flatMap((m) =>
    m.assets.map(
      (a) => [`assets/bun/${a.fileName}`, `bun/${a.fileName}`] as const
    )
  )
);

export default {
  app: {
    identifier: "dev.ohmyquery.app",
    name: "oh-my-query",
    version: "0.0.10",
  },
  build: {
    bun: {
      external: bunExternals,
    },
    copy: {
      ...bunAssetCopy,
      "dist/**/*": "views/mainview/",
    },
    linux: {
      bundleCEF: false,
      icon: "assets/icon.png",
    },
    mac: {
      bundleCEF: false,
      codesign: process.env.ELECTROBUN_DEVELOPER_ID !== undefined,
      icons: "assets/icon.iconset",
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
      icon: "assets/icon.ico",
    },
  },
} satisfies ElectrobunConfig;
