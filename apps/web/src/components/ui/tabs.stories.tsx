import type { Meta, StoryObj } from "@storybook/react-vite";

import { expect, userEvent } from "storybook/test";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const meta = {
  component: Tabs,
  title: "UI/Tabs",
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Write your SQL here.")).toBeVisible();

    await userEvent.click(canvas.getByRole("tab", { name: "Results" }));
    await expect(canvas.getByText("Query results appear here.")).toBeVisible();

    await userEvent.click(canvas.getByRole("tab", { name: "History" }));
    await expect(canvas.getByText("Previous queries.")).toBeVisible();

    await userEvent.click(canvas.getByRole("tab", { name: "Query" }));
    await expect(canvas.getByText("Write your SQL here.")).toBeVisible();
  },
  render: () => (
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
  ),
};

export const Line: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Table overview.")).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "Structure" }));
    await expect(canvas.getByText("Column definitions.")).toBeVisible();
  },
  render: () => (
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
  ),
};

export const Segment: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Table view.")).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "JSON" }));
    await expect(canvas.getByText("Raw JSON output.")).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "Chart" }));
    await expect(canvas.getByText("Chart visualization.")).toBeVisible();
  },
  render: () => (
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
  ),
};

export const Vertical: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("General settings.")).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "Editor" }));
    await expect(canvas.getByText("Editor preferences.")).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "AI" }));
    await expect(canvas.getByText("AI configuration.")).toBeVisible();
  },
  render: () => (
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
  ),
};

export const WithDisabledTab: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Run a query first.")).toBeVisible();
    const resultsTab = canvas.getByRole("tab", { name: "Results" });
    await expect(resultsTab).toHaveAttribute("aria-disabled", "true");
  },
  render: () => (
    <Tabs defaultValue="query">
      <TabsList>
        <TabsTrigger value="query">Query</TabsTrigger>
        <TabsTrigger value="results" disabled>
          Results
        </TabsTrigger>
      </TabsList>
      <TabsContent value="query">Run a query first.</TabsContent>
      <TabsContent value="results">No results yet.</TabsContent>
    </Tabs>
  ),
};
