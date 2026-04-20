import {
  Check,
  CheckCircle2,
  ChevronDown,
  Loader2,
  XCircle,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import type {
  ConnectionColor,
  ConnectionEnvironment,
  DatabaseConnection,
  DatabaseType,
} from "@/lib/connections";

import { DATABASE_ICON_MAP } from "@/components/icons/database-icons";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CONNECTION_COLORS,
  getConnectionColorClasses,
} from "@/lib/connection-appearance";
import {
  DEFAULT_PORTS,
  saveConnection,
  updateConnection,
} from "@/lib/connections";
import { testConnection } from "@/lib/tauri";
import { cn } from "@/lib/utils";

const EMOJI_CATALOG = [
  "🐘",
  "🐬",
  "🍃",
  "⚡️",
  "💾",
  "🗃",
  "📊",
  "📈",
  "🔑",
  "🔒",
  "🧪",
  "🚀",
  "🔥",
  "🌐",
  "🌲",
  "🌊",
  "⭐️",
  "🌱",
  "🍂",
  "🌙",
  "🧩",
  "⚙️",
  "📦",
  "🎯",
] as const;

const EMOJI_BY_TYPE: Record<DatabaseType, string> = {
  clickhouse: "📊",
  mongodb: "🍃",
  mysql: "🐬",
  postgresql: "🐘",
  redis: "⚡️",
  sqlite: "💾",
};

interface EmojiPickerProps {
  value: string;
  defaultEmoji: string;
  onSelect: (emoji: string) => void;
}

const EmojiPicker = ({ value, defaultEmoji, onSelect }: EmojiPickerProps) => {
  const [open, setOpen] = useState(false);

  const handleSelect = useCallback(
    (emoji: string) => {
      onSelect(emoji);
      setOpen(false);
    },
    [onSelect]
  );

  const handleClear = useCallback(() => {
    onSelect("");
    setOpen(false);
  }, [onSelect]);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <button
            aria-label="Choose emoji"
            className="flex size-9 items-center justify-center rounded-md border border-input bg-background text-lg transition-colors hover:border-foreground/40"
            type="button"
          >
            {value || <span className="opacity-40">{defaultEmoji}</span>}
          </button>
        }
      />
      <PopoverContent align="start" className="w-auto p-2">
        <div className="grid grid-cols-6 gap-1">
          {EMOJI_CATALOG.map((e) => (
            <EmojiButton
              emoji={e}
              isSelected={value === e}
              key={e}
              onSelect={handleSelect}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-end">
          <Button onClick={handleClear} size="sm" type="button" variant="ghost">
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface EmojiButtonProps {
  emoji: string;
  isSelected: boolean;
  onSelect: (emoji: string) => void;
}

const EmojiButton = ({ emoji, isSelected, onSelect }: EmojiButtonProps) => {
  const handleClick = useCallback(() => {
    onSelect(emoji);
  }, [emoji, onSelect]);

  return (
    <button
      aria-label={`Select ${emoji}`}
      aria-pressed={isSelected}
      className={cn(
        "flex size-8 items-center justify-center rounded-md text-base transition-colors hover:bg-muted",
        isSelected && "bg-accent"
      )}
      onClick={handleClick}
      type="button"
    >
      {emoji}
    </button>
  );
};

interface ColorSwatchProps {
  color: ConnectionColor | "";
  isSelected: boolean;
  onSelect: (color: ConnectionColor | "") => void;
}

const ColorSwatch = ({ color, isSelected, onSelect }: ColorSwatchProps) => {
  const classes = color ? getConnectionColorClasses(color) : null;
  const handleClick = useCallback(() => {
    onSelect(color);
  }, [color, onSelect]);

  if (color === "") {
    return (
      <button
        aria-label="No color"
        aria-pressed={isSelected}
        className={cn(
          "flex size-6 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground transition-colors hover:border-foreground/40",
          isSelected && "ring-2 ring-ring ring-offset-2 ring-offset-background"
        )}
        onClick={handleClick}
        type="button"
      >
        <span className="sr-only">None</span>
        <span aria-hidden="true" className="text-[10px]">
          ∅
        </span>
      </button>
    );
  }

  if (!classes) {
    return null;
  }

  return (
    <button
      aria-label={color}
      aria-pressed={isSelected}
      className={cn(
        "flex size-6 items-center justify-center rounded-full transition-transform hover:scale-110",
        classes.swatch,
        isSelected && "ring-2 ring-ring ring-offset-2 ring-offset-background"
      )}
      onClick={handleClick}
      type="button"
    >
      {isSelected && (
        <Check aria-hidden="true" className="size-3.5 text-white" />
      )}
    </button>
  );
};

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

const ServerFields = ({
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

interface AppearanceSectionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nickname: string;
  emoji: string;
  color: ConnectionColor | "";
  defaultEmoji: string;
  onNicknameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEmojiSelect: (emoji: string) => void;
  onColorSelect: (color: ConnectionColor | "") => void;
}

const AppearanceSection = ({
  open,
  onOpenChange,
  nickname,
  emoji,
  color,
  defaultEmoji,
  onNicknameChange,
  onEmojiSelect,
  onColorSelect,
}: AppearanceSectionProps) => (
  <Collapsible onOpenChange={onOpenChange} open={open}>
    <CollapsibleTrigger
      render={
        <button
          className="flex w-full items-center gap-1.5 text-section-label hover:text-foreground"
          type="button"
        >
          <ChevronDown
            className={cn("size-3 transition-transform", open && "rotate-180")}
          />
          Appearance
        </button>
      }
    />
    <CollapsibleContent className="grid gap-4 pt-3">
      <div className="grid gap-1.5">
        <Label htmlFor="conn-nickname">Nickname</Label>
        <Input
          id="conn-nickname"
          onChange={onNicknameChange}
          placeholder="analytics-prod"
          value={nickname}
        />
        <p className="text-xs text-muted-foreground">
          Shown in place of the connection name in lists.
        </p>
      </div>

      <div className="grid grid-cols-[auto_1fr] items-start gap-4">
        <div className="grid gap-1.5">
          <Label>Emoji</Label>
          <EmojiPicker
            defaultEmoji={defaultEmoji}
            onSelect={onEmojiSelect}
            value={emoji}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Color</Label>
          <div className="flex h-9 items-center gap-2">
            <ColorSwatch
              color=""
              isSelected={color === ""}
              onSelect={onColorSelect}
            />
            {CONNECTION_COLORS.map((c) => (
              <ColorSwatch
                color={c}
                isSelected={color === c}
                key={c}
                onSelect={onColorSelect}
              />
            ))}
          </div>
        </div>
      </div>
    </CollapsibleContent>
  </Collapsible>
);

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
  authSource: string;
  emoji: string;
  nickname: string;
  color: ConnectionColor | "";
  environment: ConnectionEnvironment | "";
}

type TestStatus =
  | { state: "idle" }
  | { state: "testing" }
  | { state: "success"; message: string; latencyMs: number }
  | { state: "error"; message: string };

const INITIAL_STATE: FormState = {
  authSource: "",
  color: "",
  database: "",
  emoji: "",
  environment: "",
  host: "localhost",
  name: "",
  nickname: "",
  password: "",
  port: String(DEFAULT_PORTS.postgresql),
  type: "postgresql",
  username: "",
};

const connectionToFormState = (conn: DatabaseConnection): FormState => ({
  authSource: conn.authSource ?? "",
  color: conn.color ?? "",
  database: conn.database,
  emoji: conn.emoji ?? "",
  environment: conn.environment ?? "",
  host: conn.host,
  name: conn.name,
  nickname: conn.nickname ?? "",
  password: conn.password,
  port: String(conn.port),
  type: conn.type,
  username: conn.username,
});

const DATABASE_OPTIONS: { value: DatabaseType; label: string }[] = [
  { label: "PostgreSQL", value: "postgresql" },
  { label: "MySQL", value: "mysql" },
  { label: "SQLite", value: "sqlite" },
  { label: "ClickHouse", value: "clickhouse" },
  { label: "MongoDB", value: "mongodb" },
  { label: "Redis", value: "redis" },
];

const NEEDS_HOST = new Set<DatabaseType>([
  "postgresql",
  "mysql",
  "clickhouse",
  "mongodb",
  "redis",
]);
const NEEDS_USERNAME = new Set<DatabaseType>([
  "postgresql",
  "mysql",
  "clickhouse",
  "mongodb",
]);

const getDatabaseLabel = (type: DatabaseType): string => {
  if (type === "sqlite") {
    return "File path";
  }
  if (type === "redis") {
    return "Database index";
  }
  return "Database";
};

const getDatabaseHint = (type: DatabaseType): string | null => {
  if (type === "redis") {
    return "Redis DBs are numbered 0–15. You can switch DBs inside the workspace after connecting.";
  }
  return null;
};

const getUsernamePlaceholder = (type: DatabaseType): string => {
  if (type === "mongodb") {
    return "";
  }
  if (type === "clickhouse") {
    return "default";
  }
  return "postgres";
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
  const emoji = form.emoji.trim();
  const nickname = form.nickname.trim();
  return {
    authSource:
      form.type === "mongodb" && form.authSource.trim()
        ? form.authSource.trim()
        : undefined,
    color: form.color || undefined,
    createdAt: new Date().toISOString(),
    database: form.database.trim(),
    emoji: emoji || undefined,
    environment: form.environment || undefined,
    host: hasHost ? form.host.trim() : "",
    id: crypto.randomUUID(),
    lastConnectedAt: null,
    name: form.name.trim(),
    nickname: nickname || undefined,
    password: hasHost ? form.password : "",
    pinned: false,
    port: hasHost ? Number(form.port) : 0,
    type: form.type,
    username: hasUsername ? form.username.trim() : "",
  };
};

const buildConnectionParams = (form: FormState) => {
  const hasHost = NEEDS_HOST.has(form.type);
  const hasUsername = NEEDS_USERNAME.has(form.type);
  return {
    authSource:
      form.type === "mongodb" && form.authSource.trim()
        ? form.authSource.trim()
        : undefined,
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
  const [appearanceOpen, setAppearanceOpen] = useState(
    Boolean(connection?.emoji || connection?.nickname || connection?.color)
  );
  const hasHost = NEEDS_HOST.has(form.type);
  const hasUsername = NEEDS_USERNAME.has(form.type);

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

  const handleColorSelect = useCallback((color: ConnectionColor | "") => {
    setForm((prev) => ({ ...prev, color }));
  }, []);

  const handleEmojiSelect = useCallback((emoji: string) => {
    setForm((prev) => ({ ...prev, emoji }));
  }, []);

  const handleEnvChange = useCallback((value: string | null) => {
    if (!value) {
      return;
    }
    setForm((prev) => ({
      ...prev,
      environment: value === "none" ? "" : (value as ConnectionEnvironment),
    }));
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
    async (e: React.FormEvent) => {
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
          lastConnectedAt: connection.lastConnectedAt,
          pinned: connection.pinned,
        };
        await updateConnection(updated);
        toast.success(`Connection "${updated.name}" updated`);
        onSuccess?.(updated);
      } else {
        const newConn = buildConnection(form);
        await saveConnection(newConn);
        toast.success(`Connection "${newConn.name}" saved`);
        onSuccess?.(newConn);
      }
    },
    [form, connection, onSuccess]
  );

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-1.5">
        <Label htmlFor="conn-name">Connection name</Label>
        <Input
          id="conn-name"
          onChange={updateField("name")}
          placeholder="My Database"
          required
          value={form.name}
        />
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="conn-type">Database type</Label>
          <Select onValueChange={handleTypeChange} value={form.type}>
            <SelectTrigger className="w-full" id="conn-type">
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
        <div className="grid gap-1.5">
          <Label htmlFor="conn-env">Environment</Label>
          <Select
            onValueChange={handleEnvChange}
            value={form.environment || "none"}
          >
            <SelectTrigger className="w-full" id="conn-env">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="dev">Dev</SelectItem>
              <SelectItem value="staging">Staging</SelectItem>
              <SelectItem value="prod">Prod</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {form.environment === "prod" && (
        <p className="-mt-2 text-xs text-destructive">
          Destructive queries will require typing the connection name to
          confirm.
        </p>
      )}

      <ServerFields
        authSource={form.authSource}
        hasHost={hasHost}
        hasUsername={hasUsername}
        host={form.host}
        password={form.password}
        port={form.port}
        type={form.type}
        updateField={updateField}
        username={form.username}
      />

      <div className="grid gap-1.5">
        <Label htmlFor="conn-database">{getDatabaseLabel(form.type)}</Label>
        <Input
          id="conn-database"
          max={form.type === "redis" ? 15 : undefined}
          min={form.type === "redis" ? 0 : undefined}
          onChange={updateField("database")}
          placeholder={getDatabasePlaceholder(form.type)}
          required={form.type !== "redis"}
          type={form.type === "redis" ? "number" : "text"}
          value={form.database}
        />
        {getDatabaseHint(form.type) && (
          <p className="text-xs text-muted-foreground">
            {getDatabaseHint(form.type)}
          </p>
        )}
      </div>

      <AppearanceSection
        color={form.color}
        defaultEmoji={EMOJI_BY_TYPE[form.type]}
        emoji={form.emoji}
        nickname={form.nickname}
        onColorSelect={handleColorSelect}
        onEmojiSelect={handleEmojiSelect}
        onNicknameChange={updateField("nickname")}
        onOpenChange={setAppearanceOpen}
        open={appearanceOpen}
      />

      <div className="flex items-center gap-2">
        <Button
          disabled={testStatus.state === "testing"}
          onClick={handleTestConnection}
          type="button"
          variant="outline"
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
          <span className="flex items-center gap-1 text-xs text-destructive">
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
