import { useCallback, useState } from "react";
import { toast } from "sonner";

import type { DatabaseConnection, DatabaseType } from "@/lib/connections";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_PORTS, saveConnection } from "@/lib/connections";

interface ConnectionFormProps {
  onSuccess?: (connection: DatabaseConnection) => void;
}

interface FormState {
  name: string;
  type: DatabaseType;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
}

const INITIAL_STATE: FormState = {
  database: "",
  host: "localhost",
  name: "",
  password: "",
  port: String(DEFAULT_PORTS.postgresql),
  type: "postgresql",
  username: "",
};

const DATABASE_OPTIONS: { value: DatabaseType; label: string }[] = [
  { label: "PostgreSQL", value: "postgresql" },
  { label: "MySQL", value: "mysql" },
  { label: "SQLite", value: "sqlite" },
];

const buildConnection = (form: FormState): DatabaseConnection => {
  const isSqlite = form.type === "sqlite";
  return {
    createdAt: new Date().toISOString(),
    database: form.database.trim(),
    host: isSqlite ? "" : form.host.trim(),
    id: crypto.randomUUID(),
    name: form.name.trim(),
    password: isSqlite ? "" : form.password,
    port: isSqlite ? 0 : Number(form.port),
    type: form.type,
    username: isSqlite ? "" : form.username.trim(),
  };
};

const validate = (form: FormState): string | null => {
  if (!form.name.trim()) {
    return "Connection name is required";
  }
  if (!form.database.trim()) {
    return "Database name is required";
  }
  if (form.type !== "sqlite" && !form.host.trim()) {
    return "Host is required";
  }
  return null;
};

export const ConnectionForm = ({ onSuccess }: ConnectionFormProps) => {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const isSqlite = form.type === "sqlite";

  const updateField = useCallback(
    <K extends keyof FormState>(key: K) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm((prev) => ({ ...prev, [key]: e.target.value }));
      },
    []
  );

  const handleTypeChange = useCallback((value: DatabaseType | null) => {
    if (!value) {
      return;
    }
    setForm((prev) => ({
      ...prev,
      host: value === "sqlite" ? "" : prev.host || "localhost",
      password: value === "sqlite" ? "" : prev.password,
      port: String(DEFAULT_PORTS[value]),
      type: value,
      username: value === "sqlite" ? "" : prev.username,
    }));
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const error = validate(form);
      if (error) {
        toast.error(error);
        return;
      }
      const connection = buildConnection(form);
      saveConnection(connection);
      toast.success(`Connection "${connection.name}" saved`);
      onSuccess?.(connection);
    },
    [form, onSuccess]
  );

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="conn-name">Connection name</Label>
        <Input
          id="conn-name"
          placeholder="My Database"
          value={form.name}
          onChange={updateField("name")}
          required
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="conn-type">Database type</Label>
        <Select value={form.type} onValueChange={handleTypeChange}>
          <SelectTrigger id="conn-type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATABASE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!isSqlite && (
        <>
          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="conn-host">Host</Label>
              <Input
                id="conn-host"
                placeholder="localhost"
                value={form.host}
                onChange={updateField("host")}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="conn-port">Port</Label>
              <Input
                id="conn-port"
                type="number"
                placeholder={String(DEFAULT_PORTS[form.type])}
                value={form.port}
                onChange={updateField("port")}
                required
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="conn-username">Username</Label>
            <Input
              id="conn-username"
              placeholder="postgres"
              value={form.username}
              onChange={updateField("username")}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="conn-password">Password</Label>
            <Input
              id="conn-password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={updateField("password")}
            />
          </div>
        </>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="conn-database">
          {isSqlite ? "File path" : "Database"}
        </Label>
        <Input
          id="conn-database"
          placeholder={isSqlite ? "/path/to/database.db" : "my_database"}
          value={form.database}
          onChange={updateField("database")}
          required
        />
      </div>

      <Button type="submit" className="mt-2">
        Save connection
      </Button>
    </form>
  );
};
