import "@/index.css";
import "./setup";
import { beforeEach, expect } from "vitest";

const VOLATILE_STYLE_PROPS = new Set([
  "transform",
  "transform-origin",
  "opacity",
  "will-change",
  "--front-toast-height",
  "--initial-height",
  "--offset",
]);

const VOLATILE_SVG_TEXT_ATTRS = ["x", "y", "dx", "dy"];

const VOLATILE_DATA_ATTRS = ["data-mounted"];

function stripVolatileStyle(value: string): string | null {
  const cleaned = value
    .split(";")
    .map((part) => part.trim())
    .filter((part) => {
      const [prop] = part.split(":");
      return part && !VOLATILE_STYLE_PROPS.has((prop ?? "").trim());
    })
    .join("; ");
  return cleaned.length > 0 ? cleaned : null;
}

function normalize(node: Node): Node {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;
    const style = el.getAttribute("style");
    if (style !== null) {
      const cleaned = stripVolatileStyle(style);
      if (cleaned === null) {
        el.removeAttribute("style");
      } else {
        el.setAttribute("style", cleaned);
      }
    }
    const tag = el.tagName.toLowerCase();
    if (tag === "text" || tag === "tspan") {
      for (const attr of VOLATILE_SVG_TEXT_ATTRS) {
        el.removeAttribute(attr);
      }
    }
    for (const attr of VOLATILE_DATA_ATTRS) {
      el.removeAttribute(attr);
    }
  }
  for (const child of node.childNodes) {
    normalize(child);
  }
  return node;
}

const normalized = new WeakSet<Element>();

function markSubtree(el: Element): void {
  normalized.add(el);
  for (const child of el.children) {
    markSubtree(child);
  }
}

// oxlint-disable-next-line jest/require-hook -- vitest setup file
expect.addSnapshotSerializer({
  serialize(value, config, indentation, depth, refs, printer) {
    const clone = (value as Element).cloneNode(true) as Element;
    normalize(clone);
    markSubtree(clone);
    return printer(clone, config, indentation, depth, refs);
  },
  test(value) {
    return value instanceof Element && !normalized.has(value);
  },
});

if (typeof document !== "undefined") {
  document.documentElement.classList.add("dark");

  const style = document.createElement("style");
  style.textContent = `
    *, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
      caret-color: transparent !important;
    }
  `;
  document.head.append(style);
}

// oxlint-disable-next-line jest/require-top-level-describe -- vitest setup file
beforeEach(async () => {
  if (typeof document !== "undefined" && document.fonts) {
    await document.fonts.ready;
  }
});
