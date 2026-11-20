import {
  RouterProvider,
  createHashHistory,
  createRouter,
} from "@tanstack/react-router";
import ReactDOM from "react-dom/client";

import Loader from "./components/loader";
import { isMacOS } from "./lib/ipc";
import { routeTree } from "./routeTree.gen";

if (isMacOS()) {
  document.documentElement.dataset.platform = "macos";
}

const router = createRouter({
  context: {},
  defaultPendingComponent: () => <Loader />,
  defaultPreload: "intent",
  // Packaged builds load views://mainview/index.html, whose pathname matches no route.
  history: createHashHistory(),
  routeTree,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.querySelector("#app");

if (!rootElement) {
  throw new Error("Root element not found");
}

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<RouterProvider router={router} />);
}
