import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import type { DatabaseConnection } from "@/lib/connections";

import { DATABASE_ICON_MAP } from "@/components/icons/database-icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { AiContextSection } from "./ai-context-section";
import { AppearanceSection } from "./appearance-section";
import { DATABASE_OPTIONS, EMOJI_BY_TYPE } from "./constants";
import {
  getDatabaseHint,
  getDatabaseLabel,
  getDatabasePlaceholder,
} from "./lib";
import { ServerFields } from "./server-fields";
import { useConnectionForm } from "./use-connection-form";

interface ConnectionFormProps {
  connection?: DatabaseConnection;
  onSuccess?: (connection: DatabaseConnection) => void;
}

export const ConnectionForm = ({
  connection,
  onSuccess,
}: ConnectionFormProps) => {
  const {
    aiContextOpen,
    appearanceOpen,
    form,
    formError,
    handleColorSelect,
    handleCustomPiiPatternsChange,
    handleEmojiSelect,
    handleEnvChange,
    handlePiiRedactionChange,
    handleSubmit,
    handleTestConnection,
    handleTrustCertChange,
    handleTypeChange,
    hasHost,
    hasUsername,
    setAiContextOpen,
    setAppearanceOpen,
    testStatus,
    updateField,
  } = useConnectionForm(connection, onSuccess);

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

      {form.type === "mssql" && (
        <div className="grid gap-1.5">
          <Label className="flex items-center gap-2 font-normal">
            <Checkbox
              checked={form.trustServerCertificate}
              onCheckedChange={handleTrustCertChange}
            />
            Trust server certificate
          </Label>
          <p className="pl-6 text-xs text-muted-foreground">
            Skip TLS certificate verification. Disable for production servers
            with a valid certificate.
          </p>
        </div>
      )}

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
        onColorSelect={handleColorSelect}
        onEmojiSelect={handleEmojiSelect}
        onOpenChange={setAppearanceOpen}
        open={appearanceOpen}
      />

      <AiContextSection
        customPiiPatterns={form.customPiiPatterns}
        environment={form.environment}
        onCustomPiiPatternsChange={handleCustomPiiPatternsChange}
        onOpenChange={setAiContextOpen}
        onPiiRedactionChange={handlePiiRedactionChange}
        open={aiContextOpen}
        piiRedaction={form.piiRedaction}
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

      {formError && (
        <p
          aria-live="polite"
          className="flex items-center gap-1 text-xs text-destructive"
          role="alert"
        >
          <XCircle className="size-3.5" />
          {formError}
        </p>
      )}

      <Button type="submit">
        {connection ? "Update connection" : "Save connection"}
      </Button>
    </form>
  );
};
