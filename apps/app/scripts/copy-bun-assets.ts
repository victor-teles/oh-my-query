import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import {
  APP_DIR,
  ASSETS_BUN_DIR,
  nativeBunModules,
} from "./native-bun-assets.ts";

mkdirSync(ASSETS_BUN_DIR, { recursive: true });

for (const module of nativeBunModules) {
  for (const asset of module.assets) {
    const source = asset.resolveSource();
    const dest = path.join(ASSETS_BUN_DIR, asset.fileName);
    copyFileSync(source, dest);
    console.log(
      `[${module.id}] ${path.relative(APP_DIR, source)} → ${path.relative(APP_DIR, dest)}`
    );
  }
}
