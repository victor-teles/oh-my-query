import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import type { DatabaseConnection, DatabaseType } from "@/lib/connections";

import { DATABASE_ICON_MAP } from "@/components/icons/database-icons";
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
import {
  DEFAULT_PORTS,
  saveConnection,
  updateConnection,
} from "@/lib/connections";
import { testConnection } from "@/lib/tauri";

interface ConnectionFormProps {
  connection?: DatabaseConnection;
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

const connectionToFormState = (conn: DatabaseConnection): FormState => ({
  database: conn.database,
  host: conn.host,
  name: conn.name,
  password: conn.password,
  port: String(conn.port),
  type: conn.type,
  username: conn.username,
});

const DATABASE_OPTIONS: { value: DatabaseType; label: string }[] = [
  { label: "PostgreSQL", value: "postgresql" },
  { label: "MySQL", value: "mysql" },
  { label: "SQLite", value: "sqlite" },
  { label: "MongoDB", value: "mongodb" },
  { label: "Redis", value: "redis" },
];

const NEEDS_HOST = new Set<DatabaseType>([
  "postgresql",
  "mysql",
  "mongodb",
  "redis",
]);
const NEEDS_USERNAME = new Set<DatabaseType>([
  "postgresql",
  "mysql",
  "mongodb",
]);

const getDatabaseLabel = (type: DatabaseType): string => {
  if (type === "sqlite") {
    return "File path";
  }
  if (type === "redis") {
    return "Database index (0-15)";
  }
  return "Database";
};

const getDatabasePlaceholder = (type: DatabaseType): string => {
  if (type === "sqlite") {
    return "/path/to/database.db";
  }
  if (type === "redis") {
    return "0";
  }
  return "my_database";
};

const buildConnection = (form: FormState): DatabaseConnection => {
  const hasHost = NEEDS_HOST.has(form.type);
  const hasUsername = NEEDS_USERNAME.has(form.type);
  return {
    createdAt: new Date().toISOString(),
    database: form.database.trim(),
    host: hasHost ? form.host.trim() : "",
    id: crypto.randomUUID(),
    name: form.name.trim(),
    password: hasHost ? form.password : "",
    port: hasHost ? Number(form.port) : 0,
    type: form.type,
    username: hasUsername ? form.username.trim() : "",
  };
};

const buildConnectionParams = (form: FormState) => {
  const hasHost = NEEDS_HOST.has(form.type);
  const hasUsername = NEEDS_USERNAME.has(form.type);
  return {
    database: form.database.trim(),
    host: hasHost ? form.host.trim() : "",
    password: hasHost ? form.password : "",
    port: hasHost ? Number(form.port) : 0,
    type: form.type,
    username: hasUsername ? form.username.trim() : "",
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
  if (form.type !== "redis" && !form.database.trim()) {
    return "Database name is required";
  }
  if (NEEDS_HOST.has(form.type) && !form.host.trim()) {
    return "Host is required";
  }
  return null;
};

export const ConnectionForm = ({
  connection,
  onSuccess,
}: ConnectionFormProps) => {
  const [form, setForm] = useState<FormState>(
    connection ? connectionToFormState(connection) : INITIAL_STATE
  );
  const [testStatus, setTestStatus] = useState<TestStatus>({ state: "idle" });
  const hasHost = NEEDS_HOST.has(form.type);
  const hasUsername = NEEDS_USERNAME.has(form.type);
  const showDatabase = form.type !== "redis" || true;

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
      database: value === "redis" ? "0" : prev.database,
      host: NEEDS_HOST.has(value) ? prev.host || "localhost" : "",
      password: NEEDS_HOST.has(value) ? prev.password : "",
      port: String(DEFAULT_PORTS[value]),
      type: value,
      username: NEEDS_USERNAME.has(value) ? prev.username : "",
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

      if (connection) {
        const updated: DatabaseConnection = {
          ...buildConnection(form),
          createdAt: connection.createdAt,
          id: connection.id,
        };
        updateConnection(updated);
        toast.success(`Connection "${updated.name}" updated`);
        onSuccess?.(updated);
      } else {
        const newConn = buildConnection(form);
        saveConnection(newConn);
        toast.success(`Connection "${newConn.name}" saved`);
        onSuccess?.(newConn);
      }
    },
    [form, connection, onSuccess]
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
            {DATABASE_OPTIONS.map((opt) => {
              const Icon = DATABASE_ICON_MAP[opt.value];
              return (
                <SelectItem key={opt.value} value={opt.value}>
                  <Icon className="size-4 shrink-0" />
                  {opt.label}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {hasHost && (
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
      )}

      {hasUsername && (
        <div className="grid gap-1.5">
          <Label htmlFor="conn-username">Username</Label>
          <Input
            id="conn-username"
            placeholder={form.type === "mongodb" ? "" : "postgres"}
            value={form.username}
            onChange={updateField("username")}
          />
        </div>
      )}

      {hasHost && (
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
      )}

      {showDatabase && (
        <div className="grid gap-1.5">
          <Label htmlFor="conn-database">{getDatabaseLabel(form.type)}</Label>
          <Input
            id="conn-database"
            placeholder={getDatabasePlaceholder(form.type)}
            value={form.database}
            onChange={updateField("database")}
            type={form.type === "redis" ? "number" : "text"}
            min={form.type === "redis" ? 0 : undefined}
            max={form.type === "redis" ? 15 : undefined}
            required={form.type !== "redis"}
          />
        </div>
      )}

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

      <Button type="submit">
        {connection ? "Update connection" : "Save connection"}
      </Button>
    </form>
  );
};
