import type { DatabaseType } from "@/lib/connections";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_PORTS } from "@/lib/connections";

import type { FormState } from "./connection-form-state";

import { getUsernamePlaceholder } from "./lib";

interface ServerFieldsProps {
  type: DatabaseType;
  host: string;
  port: string;
  username: string;
  password: string;
  authSource: string;
  hasHost: boolean;
  hasUsername: boolean;
  updateField: (
    key: keyof FormState
  ) => (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ServerFields = ({
  type,
  host,
  port,
  username,
  password,
  authSource,
  hasHost,
  hasUsername,
  updateField,
}: ServerFieldsProps) => (
  <>
    {hasHost && (
      <div className="grid grid-cols-[1fr_100px] gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="conn-host">Host</Label>
          <Input
            id="conn-host"
            onChange={updateField("host")}
            placeholder="localhost"
            required
            value={host}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="conn-port">Port</Label>
          <Input
            id="conn-port"
            onChange={updateField("port")}
            placeholder={String(DEFAULT_PORTS[type])}
            required
            type="number"
            value={port}
          />
        </div>
      </div>
    )}

    {hasUsername && (
      <div className="grid gap-1.5">
        <Label htmlFor="conn-username">Username</Label>
        <Input
          id="conn-username"
          onChange={updateField("username")}
          placeholder={getUsernamePlaceholder(type)}
          value={username}
        />
      </div>
    )}

    {type === "mongodb" && hasUsername && (
      <div className="grid gap-1.5">
        <Label htmlFor="conn-auth-source">Auth source</Label>
        <Input
          id="conn-auth-source"
          onChange={updateField("authSource")}
          placeholder="admin"
          value={authSource}
        />
        <p className="text-xs text-muted-foreground">
          Database where the user was created. Defaults to admin.
        </p>
      </div>
    )}

    {hasHost && (
      <div className="grid gap-1.5">
        <Label htmlFor="conn-password">Password</Label>
        <Input
          id="conn-password"
          onChange={updateField("password")}
          placeholder="••••••••"
          type="password"
          value={password}
        />
      </div>
    )}
  </>
);
