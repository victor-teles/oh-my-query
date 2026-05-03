import { useCallback, useState } from "react";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { cn } from "@/lib/utils";

import { ListCursor } from "./list-cursor";

const items = ["users", "orders", "products", "categories"];

function ListCursorItem({
  item,
  active,
  onSelect,
}: {
  item: string;
  active: string;
  onSelect: (item: string) => void;
}) {
  const handleClick = useCallback(() => onSelect(item), [item, onSelect]);
  return (
    <button className={cn(`
            relative rounded-md px-3 py-1.5 text-left text-xs
            transition-colors
          `, active === item ? "text-primary-foreground" : `
              text-muted-foreground
              hover:text-foreground
            `)} onClick={handleClick} type="button">
      {active === item && (
        <ListCursor className="inset-0 -z-10" layoutId="list-cursor-demo" />
      )}
      {item}
    </button>
  );
}

function ListCursorDemo() {
  const [active, setActive] = useState("users");
  return (
    <nav className="flex flex-col gap-0.5 p-2">
      {items.map((item) => (
        <ListCursorItem
          active={active}
          item={item}
          key={item}
          onSelect={setActive}
        />
      ))}
    </nav>
  );
}

describe("list-cursor", () => {
  it("default", async () => {
    const screen = render(<ListCursorDemo />);
    expect(screen.getByText("users")).toBeVisible();
    await screen.getByText("products").click();
    await expect(screen.getByText("products")).toBeVisible();
    await screen.getByText("orders").click();
    expect(screen.container).toMatchSnapshot();
  });
});
