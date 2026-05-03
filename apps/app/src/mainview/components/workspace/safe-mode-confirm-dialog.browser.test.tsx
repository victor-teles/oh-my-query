import type { DestructiveClassification } from "@oh-my-query/core/client";

import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import type { SafeModeConfirmationRequest } from "@/contexts/safe-mode-context";

import { SafeModeConfirmDialog } from "./safe-mode-confirm-dialog";

const dropClassification: DestructiveClassification = {
  keyword: "DROP",
  kind: "drop",
  reason: "Permanently removes a database object.",
};

const buildRequest = (
  overrides: Partial<SafeModeConfirmationRequest> = {}
): SafeModeConfirmationRequest => ({
  classification: dropClassification,
  connectionName: null,
  environment: null,
  query: "DROP TABLE users",
  ...overrides,
});

const getPreviewText = (): string => {
  const pre = page.getByRole("dialog").element().querySelector("pre");
  return pre?.textContent ?? "";
};

describe("safeModeConfirmDialog", () => {
  it("renders nothing when request is null", () => {
    const screen = render(
      <SafeModeConfirmDialog
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        request={null}
      />
    );
    expect(screen.getByRole("dialog").query()).toBeNull();
  });

  it("renders a generic destructive prompt", async () => {
    render(
      <SafeModeConfirmDialog
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        request={buildRequest()}
      />
    );
    await expect.element(page.getByRole("dialog")).toBeVisible();
    expect(page.getByText("Run DROP query?")).toBeInTheDocument();
    expect(
      page.getByText(/Permanently removes a database object\./)
    ).toBeInTheDocument();
    expect(
      page.getByRole("button", { name: "Run anyway" })
    ).toBeInTheDocument();
    expect(page.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    await expect(page.getByRole("dialog").element()).toMatchSnapshot();
  });

  it("calls onConfirm when Run anyway is clicked", async () => {
    const onConfirm = vi.fn();
    render(
      <SafeModeConfirmDialog
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        request={buildRequest()}
      />
    );
    await page.getByRole("button", { name: "Run anyway" }).click();
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const onCancel = vi.fn();
    render(
      <SafeModeConfirmDialog
        onCancel={onCancel}
        onConfirm={vi.fn()}
        request={buildRequest()}
      />
    );
    await page.getByRole("button", { name: "Cancel" }).click();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("uses the warning tone for staging environments", async () => {
    render(
      <SafeModeConfirmDialog
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        request={buildRequest({
          connectionName: "staging-db",
          environment: "staging",
        })}
      />
    );
    await expect.element(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog").element()).toMatchSnapshot();
  });

  it("requires typing the connection name in production", async () => {
    const onConfirm = vi.fn();
    render(
      <SafeModeConfirmDialog
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        request={buildRequest({
          connectionName: "prod-db",
          environment: "prod",
        })}
      />
    );

    const confirmButton = page.getByRole("button", {
      name: "I understand — run against prod",
    });
    await expect.element(confirmButton).toBeDisabled();

    await page.getByLabelText(/Type/).fill("prod-d");
    await expect.element(confirmButton).toBeDisabled();

    await page.getByLabelText(/Type/).fill("prod-db");
    await expect.element(confirmButton).toBeEnabled();
    await confirmButton.click();
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("truncates SQL previews longer than 400 characters", () => {
    const longQuery = `DROP TABLE ${"a".repeat(500)}`;
    render(
      <SafeModeConfirmDialog
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        request={buildRequest({ query: longQuery })}
      />
    );
    const text = getPreviewText();
    expect(text).toMatch(/…$/);
    expect(text.length).toBeLessThanOrEqual(401);
    expect(text.length).toBeGreaterThan(0);
  });

  it("clears the typed confirmation when reopened", async () => {
    const prodRequest = buildRequest({
      connectionName: "prod-db",
      environment: "prod",
    });
    const screen = render(
      <SafeModeConfirmDialog
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        request={prodRequest}
      />
    );

    await page.getByLabelText(/Type/).fill("prod-db");
    await expect
      .element(
        page.getByRole("button", { name: "I understand — run against prod" })
      )
      .toBeEnabled();

    screen.rerender(
      <SafeModeConfirmDialog
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        request={null}
      />
    );

    screen.rerender(
      <SafeModeConfirmDialog
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        request={prodRequest}
      />
    );

    const reopenedInput = page.getByLabelText(/Type/);
    await expect.element(reopenedInput).toHaveValue("");
    await expect
      .element(
        page.getByRole("button", { name: "I understand — run against prod" })
      )
      .toBeDisabled();
  });

  it("calls onCancel when the user dismisses with Escape", async () => {
    const onCancel = vi.fn();
    render(
      <SafeModeConfirmDialog
        onCancel={onCancel}
        onConfirm={vi.fn()}
        request={buildRequest()}
      />
    );
    await expect.element(page.getByRole("dialog")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
