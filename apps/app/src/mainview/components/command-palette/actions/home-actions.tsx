import { useNavigate } from "@tanstack/react-router";
import { DatabaseIcon, PlusIcon } from "lucide-react";
import { useMemo } from "react";

import type { CommandAction } from "@/components/command-palette/types";
import type { DatabaseConnection } from "@/lib/connections";

import { useRegisterCommandActions } from "@/components/command-palette/use-register-command-actions";

interface HomeActionsProps {
  connections: DatabaseConnection[];
  onOpenAdd: () => void;
}

export const HomeActions = ({ connections, onOpenAdd }: HomeActionsProps) => {
  const navigate = useNavigate();

  const actions = useMemo<CommandAction[]>(() => {
    const list: CommandAction[] = [
      {
        group: "Connection",
        icon: PlusIcon,
        id: "connection.new",
        keywords: ["add", "create", "database"],
        label: "New Connection",
        perform: onOpenAdd,
        shortcut: ["⌘", "N"],
      },
    ];

    for (const connection of connections) {
      list.push({
        accentColor: connection.color
          ? `var(--conn-${connection.color})`
          : undefined,
        group: "Connection",
        icon: DatabaseIcon,
        id: `connection.open.${connection.id}`,
        keywords: [
          "connect",
          "workspace",
          connection.type,
          connection.name,
          connection.host,
        ].filter(Boolean),
        label: `Open ${connection.name}`,
        perform: () =>
          navigate({
            params: { connectionId: connection.id },
            to: "/workspace/$connectionId",
          }),
      });
    }

    return list;
  }, [connections, navigate, onOpenAdd]);

  useRegisterCommandActions(actions, [actions]);

  return null;
};
