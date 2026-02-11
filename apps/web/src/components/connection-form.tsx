import { CheckCircle2, Loader2, XCircle } from "lucide-react";
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
import { testConnection } from "@/lib/tauri";

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

type TestStatus =
  | { state: "idle" }
  | { state: "testing" }
  | { state: "success"; message: string; latencyMs: number }
  | { state: "error"; message: string };

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

const buildConnectionParams = (form: FormState) => {
  const isSqlite = form.type === "sqlite";
  return {
    database: form.database.trim(),
    host: isSqlite ? "" : form.host.trim(),
    password: isSqlite ? "" : form.password,
    port: isSqlite ? 0 : Number(form.port),
    type: form.type,
    username: isSqlite ? "" : form.username.trim(),
  };
};

const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "Connection failed";
};

const attemptTestConnection = async (form: FormState): Promise<TestStatus> => {
  try {
    const result = await testConnection(buildConnectionParams(form));
    if (result.success) {
      return {
        latencyMs: result.latencyMs,
        message: result.message,
        state: "success",
      };
    }
    return { message: result.message, state: "error" };
  } catch (error: unknown) {
    return { message: getErrorMessage(error), state: "error" };
  }
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
  const [testStatus, setTestStatus] = useState<TestStatus>({ state: "idle" });
  const isSqlite = form.type === "sqlite";

  const updateField = useCallback(
    <K extends keyof FormState>(key: K) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm((prev) => ({ ...prev, [key]: e.target.value }));
        setTestStatus({ state: "idle" });
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
    setTestStatus({ state: "idle" });
  }, []);

  const handleTestConnection = useCallback(async () => {
    const validationError = validate(form);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setTestStatus({ state: "testing" });
    const status = await attemptTestConnection(form);
    setTestStatus(status);

    if (status.state === "success") {
      toast.success(`Connected in ${status.latencyMs}ms`);
    } else if (status.state === "error") {
      toast.error(status.message);
    }
  }, [form]);

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

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleTestConnection}
          disabled={testStatus.state === "testing"}
        >
          {testStatus.state === "testing" ? (
            <>
              <Loader2 className="animate-spin" />
              Testing...
            </>
          ) : (
            "Test connection"
          )}
        </Button>

        {testStatus.state === "success" && (
          <span className="flex items-center gap-1 text-xs text-emerald-500">
            <CheckCircle2 className="size-3.5" />
            Connected ({testStatus.latencyMs}ms)
          </span>
        )}

        {testStatus.state === "error" && (
          <span className="text-destructive flex items-center gap-1 text-xs">
            <XCircle className="size-3.5" />
            {testStatus.message}
          </span>
        )}
      </div>

      <Button type="submit">Save connection</Button>
    </form>
  );
};
