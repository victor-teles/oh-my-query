import type { ApplicationMenuItemConfig } from "electrobun/bun";

export const APPLICATION_MENU: ApplicationMenuItemConfig[] = [
  {
    label: "oh-my-query",
    submenu: [
      { role: "about" },
      { type: "separator" },
      { accelerator: "CmdOrCtrl+,", action: "settings", label: "Settings…" },
      { type: "separator" },
      { role: "services" },
      { type: "separator" },
      { role: "hide" },
      { role: "hideOthers" },
      { role: "unhide" },
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
    submenu: [{ role: "togglefullscreen" }],
  },
  {
    label: "Window",
    submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "close" }],
  },
];
