import type { ApplicationMenuItemConfig } from "electrobun/main";

export const MENU_ACTIONS = { settings: "settings" } as const;

export const APPLICATION_MENU: ApplicationMenuItemConfig[] = [
  {
    label: "Conch",
    submenu: [
      {
        accelerator: "CmdOrCtrl+,",
        action: MENU_ACTIONS.settings,
        label: "Settings…",
      },
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
];
