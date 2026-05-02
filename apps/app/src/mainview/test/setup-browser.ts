import "@/index.css";
import "./setup";
import { beforeEach } from "vitest";

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
