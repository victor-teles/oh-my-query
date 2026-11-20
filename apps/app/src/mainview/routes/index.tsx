import { createFileRoute } from "@tanstack/react-router";

import { LauncherPanel } from "@/components/launcher/launcher-panel";

export const Route = createFileRoute("/")({
  component: LauncherPanel,
});
