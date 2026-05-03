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
    expect(screen.getByText("Write your SQL here.")).toBeVisible();

    await screen.getByRole("tab", { name: "Results" }).click();
    await expect(screen.getByText("Query results appear here.")).toBeVisible();

    await screen.getByRole("tab", { name: "History" }).click();
    expect(screen.getByText("Previous queries.")).toBeVisible();

    await screen.getByRole("tab", { name: "Query" }).click();
    await expect(screen.getByText("Write your SQL here.")).toBeVisible();
    expect(screen.container).toMatchSnapshot();
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
    expect(screen.getByText("Table overview.")).toBeVisible();
    await screen.getByRole("tab", { name: "Structure" }).click();
    await expect(screen.getByText("Column definitions.")).toBeVisible();
    expect(screen.container).toMatchSnapshot();
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
    expect(screen.getByText("Table view.")).toBeVisible();
    await screen.getByRole("tab", { name: "JSON" }).click();
    await expect(screen.getByText("Raw JSON output.")).toBeVisible();
    await screen.getByRole("tab", { name: "Chart" }).click();
    expect(screen.getByText("Chart visualization.")).toBeVisible();
    expect(screen.container).toMatchSnapshot();
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
    expect(screen.getByText("General settings.")).toBeVisible();
    await screen.getByRole("tab", { name: "Editor" }).click();
    await expect(screen.getByText("Editor preferences.")).toBeVisible();
    await screen.getByRole("tab", { name: "AI" }).click();
    expect(screen.getByText("AI configuration.")).toBeVisible();
    expect(screen.container).toMatchSnapshot();
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
    expect(screen.getByText("Run a query first.")).toBeVisible();
    const resultsTab = screen.getByRole("tab", { name: "Results" });
    await expect(resultsTab).toHaveAttribute("aria-disabled", "true");
    expect(screen.container).toMatchSnapshot();
  });
});
