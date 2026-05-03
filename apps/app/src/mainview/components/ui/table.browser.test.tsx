import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

const rows = [
  { email: "alice@example.com", id: 1, name: "Alice Johnson", role: "Admin" },
  { email: "bob@example.com", id: 2, name: "Bob Smith", role: "Editor" },
  { email: "carol@example.com", id: 3, name: "Carol White", role: "Viewer" },
  { email: "dave@example.com", id: 4, name: "Dave Brown", role: "Editor" },
];

describe("table", () => {
  it("default", async () => {
    const screen = render(
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
    );
    expect(screen.getByText("Alice Johnson")).toBeVisible();
    await expect(screen.getByText("bob@example.com")).toBeVisible();
    expect(screen.container.querySelectorAll("tr")).toHaveLength(5);
    expect(screen.container).toMatchSnapshot();
  });

  it("withCaption", () => {
    const screen = render(
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
    );
    expect(screen.getByText("Query results — 4 rows returned")).toBeVisible();
    expect(screen.container).toMatchSnapshot();
  });

  it("empty", () => {
    const screen = render(
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
            <TableCell
              className="text-center text-muted-foreground"
              colSpan={3}
            >
              No results.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    expect(screen.getByText("No results.")).toBeVisible();
    expect(screen.container).toMatchSnapshot();
  });
});
