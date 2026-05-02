import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

describe("tabs", () => {
  it("default", async () => {
    const screen = render(
      <Tabs defaultValue="query">
        <TabsList>
          <TabsTrigger value="query">Query</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="query">Write your SQL here.</TabsContent>
        <TabsContent value="results">Query results appear here.</TabsContent>
        <TabsContent value="history">Previous queries.</TabsContent>
      </Tabs>
    );
    await expect
      .element(screen.getByText("Write your SQL here."))
      .toBeVisible();

    await screen.getByRole("tab", { name: "Results" }).click();
    await expect
      .element(screen.getByText("Query results appear here."))
      .toBeVisible();

    await screen.getByRole("tab", { name: "History" }).click();
    await expect.element(screen.getByText("Previous queries.")).toBeVisible();

    await screen.getByRole("tab", { name: "Query" }).click();
    await expect
      .element(screen.getByText("Write your SQL here."))
      .toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("line", async () => {
    const screen = render(
      <Tabs defaultValue="overview">
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="structure">Structure</TabsTrigger>
          <TabsTrigger value="indexes">Indexes</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">Table overview.</TabsContent>
        <TabsContent value="structure">Column definitions.</TabsContent>
        <TabsContent value="indexes">Index list.</TabsContent>
      </Tabs>
    );
    await expect.element(screen.getByText("Table overview.")).toBeVisible();
    await screen.getByRole("tab", { name: "Structure" }).click();
    await expect.element(screen.getByText("Column definitions.")).toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("segment", async () => {
    const screen = render(
      <Tabs defaultValue="table">
        <TabsList variant="segment">
          <TabsTrigger value="table">Table</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
          <TabsTrigger value="chart">Chart</TabsTrigger>
        </TabsList>
        <TabsContent value="table">Table view.</TabsContent>
        <TabsContent value="json">Raw JSON output.</TabsContent>
        <TabsContent value="chart">Chart visualization.</TabsContent>
      </Tabs>
    );
    await expect.element(screen.getByText("Table view.")).toBeVisible();
    await screen.getByRole("tab", { name: "JSON" }).click();
    await expect.element(screen.getByText("Raw JSON output.")).toBeVisible();
    await screen.getByRole("tab", { name: "Chart" }).click();
    await expect
      .element(screen.getByText("Chart visualization."))
      .toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("vertical", async () => {
    const screen = render(
      <Tabs defaultValue="general" orientation="vertical">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
        </TabsList>
        <TabsContent value="general">General settings.</TabsContent>
        <TabsContent value="editor">Editor preferences.</TabsContent>
        <TabsContent value="ai">AI configuration.</TabsContent>
      </Tabs>
    );
    await expect.element(screen.getByText("General settings.")).toBeVisible();
    await screen.getByRole("tab", { name: "Editor" }).click();
    await expect.element(screen.getByText("Editor preferences.")).toBeVisible();
    await screen.getByRole("tab", { name: "AI" }).click();
    await expect.element(screen.getByText("AI configuration.")).toBeVisible();
    await expect.element(screen.container).toMatchScreenshot();
  });

  it("withDisabledTab", async () => {
    const screen = render(
      <Tabs defaultValue="query">
        <TabsList>
          <TabsTrigger value="query">Query</TabsTrigger>
          <TabsTrigger disabled value="results">
            Results
          </TabsTrigger>
        </TabsList>
        <TabsContent value="query">Run a query first.</TabsContent>
        <TabsContent value="results">No results yet.</TabsContent>
      </Tabs>
    );
    await expect.element(screen.getByText("Run a query first.")).toBeVisible();
    const resultsTab = screen.getByRole("tab", { name: "Results" });
    await expect.element(resultsTab).toHaveAttribute("aria-disabled", "true");
    await expect.element(screen.container).toMatchScreenshot();
  });
});
