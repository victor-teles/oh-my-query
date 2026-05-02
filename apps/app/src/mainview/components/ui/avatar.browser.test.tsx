import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "./avatar";

describe("avatar", () => {
  it("withImage", () => {
    const screen = render(
      <Avatar>
        <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
        <AvatarFallback>CN</AvatarFallback>
      </Avatar>
    );
    const avatar = screen.container.querySelector("[data-slot='avatar']");
    expect(avatar).toBeTruthy();
  });

  it("fallback", async () => {
    const screen = render(
      <Avatar>
        <AvatarImage src="/broken-image.png" alt="User" />
        <AvatarFallback>VM</AvatarFallback>
      </Avatar>
    );
    await expect.element(screen.getByText("VM")).toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("small", async () => {
    const screen = render(
      <Avatar size="sm">
        <AvatarFallback>SM</AvatarFallback>
      </Avatar>
    );
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("large", async () => {
    const screen = render(
      <Avatar size="lg">
        <AvatarFallback>LG</AvatarFallback>
      </Avatar>
    );
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("withBadge", async () => {
    const screen = render(
      <Avatar>
        <AvatarFallback>VM</AvatarFallback>
        <AvatarBadge />
      </Avatar>
    );
    const badge = screen.container.querySelector("[data-slot='avatar-badge']");
    expect(badge).toBeTruthy();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("group", async () => {
    const screen = render(
      <AvatarGroup>
        <Avatar>
          <AvatarFallback>A</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>B</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>C</AvatarFallback>
        </Avatar>
        <AvatarGroupCount>+3</AvatarGroupCount>
      </AvatarGroup>
    );
    await expect.element(screen.getByText("A")).toBeVisible();
    await expect.element(screen.getByText("+3")).toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });
});
