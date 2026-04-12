import type { Meta, StoryObj } from "@storybook/react-vite";

import { expect } from "storybook/test";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

const meta = {
  component: Table,
  title: "UI/Table",
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

const rows = [
  { email: "alice@example.com", id: 1, name: "Alice Johnson", role: "Admin" },
  { email: "bob@example.com", id: 2, name: "Bob Smith", role: "Editor" },
  { email: "carol@example.com", id: 3, name: "Carol White", role: "Viewer" },
  { email: "dave@example.com", id: 4, name: "Dave Brown", role: "Editor" },
];

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Name")).toBeVisible();
    await expect(canvas.getByText("Alice Johnson")).toBeVisible();
    await expect(canvas.getByText("bob@example.com")).toBeVisible();
    const tableRows = canvas.getAllByRole("row");
    await expect(tableRows).toHaveLength(5);
  },
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.id}</TableCell>
            <TableCell>{row.name}</TableCell>
            <TableCell>{row.email}</TableCell>
            <TableCell>{row.role}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

export const WithCaption: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText("Query results — 4 rows returned")
    ).toBeVisible();
  },
  render: () => (
    <Table>
      <TableCaption>Query results — 4 rows returned</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.id}</TableCell>
            <TableCell>{row.name}</TableCell>
            <TableCell>{row.role}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

export const Empty: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("No results.")).toBeVisible();
  },
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell colSpan={3} className="text-center text-muted-foreground">
            No results.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};
