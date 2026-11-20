import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";

import { LauncherInput } from "./launcher-input";

const inputProps = { "aria-label": "Search commands", placeholder: "Search…" };

describe("launcherInput", () => {
  it("renders the search field and a run button", async () => {
    const onSubmit = vi.fn();
    const screen = render(
      <LauncherInput inputProps={inputProps} onSubmit={onSubmit} />
    );

    await expect
      .element(screen.getByRole("textbox", { name: "Search commands" }))
      .toBeVisible();
    await screen.getByRole("button", { name: "Run" }).click();
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("turns the button into a stop control while busy", async () => {
    const onSubmit = vi.fn();
    const onStop = vi.fn();
    const screen = render(
      <LauncherInput
        busy
        inputProps={inputProps}
        onStop={onStop}
        onSubmit={onSubmit}
      />
    );

    await screen.getByRole("button", { name: "Stop" }).click();
    expect(onStop).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("renders the context chip slot before the field", async () => {
    const screen = render(
      <LauncherInput
        chip={<span>analytics</span>}
        inputProps={inputProps}
        onSubmit={vi.fn()}
      />
    );
    await expect.element(screen.getByText("analytics")).toBeVisible();
  });

  it("flattens pasted multi-line SQL so it stays runnable", async () => {
    function Controlled() {
      const [value, setValue] = useState("> ");
      return (
        <LauncherInput
          inputProps={{
            ...inputProps,
            onChange: (event) => setValue(event.target.value),
            value,
          }}
          onSubmit={vi.fn()}
        />
      );
    }
    const screen = render(<Controlled />);
    const field = screen.getByRole("textbox", { name: "Search commands" });
    await field.click();
    await userEvent.keyboard("{End}");
    const data = new DataTransfer();
    data.setData("text/plain", "-- Orders\nselect id\nfrom orders");
    field.element().dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: data,
      })
    );
    await expect
      .element(field)
      .toHaveValue("> /* Orders */ select id from orders");
  });

  it("leaves single-line pastes to the browser", () => {
    const screen = render(
      <LauncherInput inputProps={inputProps} onSubmit={vi.fn()} />
    );
    const field = screen.getByRole("textbox", { name: "Search commands" });
    const data = new DataTransfer();
    data.setData("text/plain", "select 1");
    const event = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: data,
    });
    field.element().dispatchEvent(event);
    expect(event.defaultPrevented).toBeFalsy();
  });
});
