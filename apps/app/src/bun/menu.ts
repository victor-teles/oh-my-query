import type { ApplicationMenuItemConfig } from "electrobun/bun";

export const APPLICATION_MENU: ApplicationMenuItemConfig[] = [
  {
    label: "oh-my-query",
    submenu: [
      { accelerator: "CmdOrCtrl+,", action: "settings", label: "Settings…" },
      { type: "separator" },
      { role: "hide" },
      { role: "hideOthers" },
      { role: "showAll" },
      { type: "separator" },
      { role: "quit" },
    ],
  },
  {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" },
    ],
  },
  {
    label: "View",
    submenu: [{ role: "toggleFullScreen" }],
  },
  {
    label: "Window",
    submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "close" }],
  },
];
