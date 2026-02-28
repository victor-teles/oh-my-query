import { Plus, Trash2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import type { DatabaseType } from "@/lib/connections";
import type { EditedColumn } from "@/lib/generate-alter-sql";
import type { TableItem } from "@/lib/tauri";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { computeChanges, generateAlterSQL } from "@/lib/generate-alter-sql";
import { executeQuery } from "@/lib/tauri";

interface EditorRow {
  id: string;
  name: string;
  dataType: string;
  isNullable: boolean;
  defaultValue: string;
  originalName?: string;
}

const toEditorRows = (table: TableItem): EditorRow[] =>
  table.columns.map((col, i) => ({
    dataType: col.dataType,
    defaultValue: col.defaultValue ?? "",
    id: `existing-${String(i)}`,
    isNullable: col.isNullable,
    name: col.name,
    originalName: col.name,
  }));

interface ColumnRowProps {
  row: EditorRow;
  onUpdate: (
    id: string,
    field: keyof EditorRow,
    value: string | boolean
  ) => void;
  onRemove: (id: string) => void;
}

const ColumnRow = ({ row, onUpdate, onRemove }: ColumnRowProps) => {
  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate(row.id, "name", e.target.value);
    },
    [onUpdate, row.id]
  );

  const handleTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate(row.id, "dataType", e.target.value);
    },
    [onUpdate, row.id]
  );

  const handleNullableChange = useCallback(
    (checked: boolean) => {
      onUpdate(row.id, "isNullable", checked);
    },
    [onUpdate, row.id]
  );

  const handleDefaultChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate(row.id, "defaultValue", e.target.value);
    },
    [onUpdate, row.id]
  );

  const handleRemove = useCallback(() => {
    onRemove(row.id);
  }, [onRemove, row.id]);

  return (
    <TableRow>
      <TableCell>
        <Input value={row.name} onChange={handleNameChange} className="h-7" />
      </TableCell>
      <TableCell>
        <Input
          value={row.dataType}
          onChange={handleTypeChange}
          className="h-7"
        />
      </TableCell>
      <TableCell className="text-center">
        <Checkbox
          checked={row.isNullable}
          onCheckedChange={handleNullableChange}
        />
      </TableCell>
      <TableCell>
        <Input
          value={row.defaultValue}
          onChange={handleDefaultChange}
          className="h-7"
          placeholder="—"
        />
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleRemove}
          aria-label="Remove column"
        >
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  );
};

interface TableStructureEditorProps {
  table: TableItem;
  databaseType: DatabaseType;
  connectionId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const TableStructureEditor = ({
  table,
  databaseType,
  connectionId,
  onSuccess,
  onCancel,
}: TableStructureEditorProps) => {
  const nextIdRef = useRef(0);
  const [rows, setRows] = useState<EditorRow[]>(() => toEditorRows(table));
  const [isSaving, setIsSaving] = useState(false);

  const handleUpdate = useCallback(
    (id: string, field: keyof EditorRow, value: string | boolean) => {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
      );
    },
    []
  );

  const handleRemove = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const handleAddColumn = useCallback(() => {
    nextIdRef.current += 1;
    const id = `new-${String(nextIdRef.current)}`;
    setRows((prev) => [
      ...prev,
      {
        dataType: "text",
        defaultValue: "",
        id,
        isNullable: true,
        name: "",
      },
    ]);
  }, []);

  const handleSave = useCallback(async () => {
    const emptyName = rows.find((r) => !r.name.trim());
    if (emptyName) {
      toast.error("All columns must have a name");
      return;
    }

    const editedColumns: EditedColumn[] = rows.map((r) => ({
      dataType: r.dataType,
      defaultValue: r.defaultValue || null,
      isNullable: r.isNullable,
      name: r.name,
      originalName: r.originalName,
    }));

    const changes = computeChanges(table.columns, editedColumns);

    if (changes.length === 0) {
      toast.info("No changes to save");
      return;
    }

    const sql = generateAlterSQL(
      table.name,
      changes,
      databaseType,
      table.columns
    );

    if (!sql.trim()) {
      toast.info("No changes to save");
      return;
    }

    setIsSaving(true);

    try {
      const statements = sql
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith("--"));

      for (const statement of statements) {
        await executeQuery({
          connectionId,
          sql: statement,
        });
      }

      toast.success("Table structure updated successfully");
      onSuccess();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to alter table";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }, [rows, table, databaseType, connectionId, onSuccess]);

  return (
    <div className="space-y-3">
      <div className="max-h-80 overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-center">Nullable</TableHead>
              <TableHead>Default</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <ColumnRow
                key={row.id}
                row={row}
                onUpdate={handleUpdate}
                onRemove={handleRemove}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={handleAddColumn}
        className="w-full"
      >
        <Plus className="size-3.5" />
        Add Column
      </Button>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};
