import { ApplicationMenu, BrowserWindow } from "electrobun/bun";

import { APPLICATION_MENU } from "./menu.ts";
import { createRpc } from "./rpc.ts";
import { windowOptions } from "./window.ts";

function main(): void {
  let mainWindow: BrowserWindow | null = null;
  const rpc = createRpc({ getMainWindow: () => mainWindow });
  mainWindow = new BrowserWindow({
    ...windowOptions,
    rpc,
  } as never);

  ApplicationMenu.setApplicationMenu(APPLICATION_MENU);

  ApplicationMenu.on("application-menu-clicked", (event: unknown) => {
    const { action } = event as { action?: string };
    if (action === "settings") {
      rpc.send.menuNavigate({ route: "/settings" });
    }
  });

  console.log(`oh-my-query window started (id: ${mainWindow.id})`);
}

// oxlint-disable-next-line jest/require-hook
main();
