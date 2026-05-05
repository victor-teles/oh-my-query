import { useCallback, useState } from "react";

import type {
  ConnectionColor,
  ConnectionEnvironment,
  DatabaseConnection,
  DatabaseType,
} from "@/lib/connections";

import {
  DEFAULT_PORTS,
  saveConnection,
  updateConnection,
} from "@/lib/connections";

import type { FormState, TestStatus } from "./connection-form-state";

import { INITIAL_STATE, connectionToFormState } from "./connection-form-state";
import { NEEDS_HOST, NEEDS_USERNAME } from "./constants";
import { attemptTestConnection, buildConnection, validate } from "./lib";

export const useConnectionForm = (
  connection: DatabaseConnection | undefined,
  onSuccess?: (connection: DatabaseConnection) => void
) => {
  const [form, setForm] = useState<FormState>(
    connection ? connectionToFormState(connection) : INITIAL_STATE
  );
  const [testStatus, setTestStatus] = useState<TestStatus>({ state: "idle" });
  const [formError, setFormError] = useState<string | null>(null);
  const [appearanceOpen, setAppearanceOpen] = useState(
    Boolean(connection?.emoji || connection?.color)
  );
  const [aiContextOpen, setAiContextOpen] = useState(
    Boolean(connection?.piiRedaction)
  );

  const hasHost = NEEDS_HOST.has(form.type);
  const hasUsername = NEEDS_USERNAME.has(form.type);

  const updateField = useCallback(
    <K extends keyof FormState>(key: K) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm((prev) => ({ ...prev, [key]: e.target.value }));
        setTestStatus({ state: "idle" });
        setFormError(null);
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

  const handleTrustCertChange = useCallback((checked: boolean) => {
    setForm((prev) => ({ ...prev, trustServerCertificate: checked }));
    setTestStatus({ state: "idle" });
  }, []);

  const handleEmojiSelect = useCallback((emoji: string) => {
    setForm((prev) => ({ ...prev, emoji }));
  }, []);

  const handleEnvChange = useCallback((value: string | null) => {
    if (!value) {
      return;
    }
    const env = value === "none" ? "" : (value as ConnectionEnvironment);
    setForm((prev) => ({
      ...prev,
      environment: env,
      piiRedaction:
        env === "prod" && prev.piiRedaction === undefined
          ? true
          : prev.piiRedaction,
    }));
  }, []);

  const handlePiiRedactionChange = useCallback((checked: boolean) => {
    setForm((prev) => ({ ...prev, piiRedaction: checked }));
  }, []);

  const handleCustomPiiPatternsChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, customPiiPatterns: e.target.value }));
    },
    []
  );

  const handleTestConnection = useCallback(async () => {
    const validationError = validate(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError(null);
    setTestStatus({ state: "testing" });
    const status = await attemptTestConnection(form);
    setTestStatus(status);
  }, [form]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const error = validate(form);
      if (error) {
        setFormError(error);
        return;
      }
      setFormError(null);

      if (connection) {
        const updated: DatabaseConnection = {
          ...buildConnection(form),
          createdAt: connection.createdAt,
          id: connection.id,
          lastConnectedAt: connection.lastConnectedAt,
          pinned: connection.pinned,
          runConfig: connection.runConfig,
        };
        await updateConnection(updated);
        onSuccess?.(updated);
      } else {
        const newConn = buildConnection(form);
        await saveConnection(newConn);
        onSuccess?.(newConn);
      }
    },
    [form, connection, onSuccess]
  );

  return {
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
  };
};
