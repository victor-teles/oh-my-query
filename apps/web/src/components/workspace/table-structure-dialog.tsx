import { Check, Key, Link, ListOrdered, X } from "lucide-react";
import { useCallback, useState } from "react";

import type { DatabaseType } from "@/lib/connections";
import type { TableItem, ViewItem } from "@/lib/tauri";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isSqlDatabase } from "@/lib/connections";

import { TableStructureEditor } from "./table-structure-editor";

const isTableItem = (item: TableItem | ViewItem): item is TableItem =>
  "indexes" in item;

interface ColumnsTabProps {
  columns: TableItem["columns"];
}

const ColumnsTab = ({ columns }: ColumnsTabProps) => {
  if (columns.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-muted-foreground">
        No columns defined
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Nullable</TableHead>
          <TableHead>PK</TableHead>
          <TableHead>Default</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {columns.map((col) => (
          <TableRow key={col.name}>
            <TableCell className="font-medium">{col.name}</TableCell>
            <TableCell>
              <Badge variant="outline">{col.dataType}</Badge>
            </TableCell>
            <TableCell>
              {col.isNullable ? (
                <Check className="size-3.5 text-muted-foreground" />
              ) : (
                <X className="size-3.5 text-muted-foreground" />
              )}
            </TableCell>
            <TableCell>
              {col.isPrimaryKey && <Key className="size-3.5 text-amber-500" />}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {col.defaultValue ?? "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

interface IndexesTabProps {
  indexes: TableItem["indexes"];
}

const IndexesTab = ({ indexes }: IndexesTabProps) => {
  if (indexes.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-muted-foreground">
        No indexes defined
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Columns</TableHead>
          <TableHead>Unique</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {indexes.map((idx) => (
          <TableRow key={idx.name}>
            <TableCell className="font-medium">
              <div className="flex items-center gap-1.5">
                <ListOrdered className="size-3.5 shrink-0 text-muted-foreground" />
                {idx.name}
              </div>
            </TableCell>
            <TableCell>{idx.columns.join(", ")}</TableCell>
            <TableCell>
              {idx.isUnique && (
                <Badge variant="outline" className="text-amber-500">
                  unique
                </Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

interface ForeignKeysTabProps {
  foreignKeys: TableItem["foreignKeys"];
}

const ForeignKeysTab = ({ foreignKeys }: ForeignKeysTabProps) => {
  if (foreignKeys.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-muted-foreground">
        No foreign keys defined
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Columns</TableHead>
          <TableHead>References</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {foreignKeys.map((fk) => (
          <TableRow key={fk.name}>
            <TableCell className="font-medium">
              <div className="flex items-center gap-1.5">
                <Link className="size-3.5 shrink-0 text-muted-foreground" />
                {fk.name}
              </div>
            </TableCell>
            <TableCell>{fk.columns.join(", ")}</TableCell>
            <TableCell>
              {fk.referencedTable}({fk.referencedColumns.join(", ")})
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

interface TableStructureDialogProps {
  table: TableItem | ViewItem;
  isView: boolean;
  databaseType: DatabaseType;
  connectionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefreshSchema: () => void;
}

export const TableStructureDialog = ({
  table,
  isView,
  databaseType,
  connectionId,
  open,
  onOpenChange,
  onRefreshSchema,
}: TableStructureDialogProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const showEditButton = !isView && isSqlDatabase(databaseType);
  const hasIndexes = isTableItem(table);
  const hasForeignKeys = isTableItem(table);

  const handleEditClick = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleEditCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleEditSuccess = useCallback(() => {
    setIsEditing(false);
    onRefreshSchema();
  }, [onRefreshSchema]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setIsEditing(false);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{table.name}</DialogTitle>
            <Badge variant="outline">{isView ? "View" : "Table"}</Badge>
          </div>
        </DialogHeader>

        {isEditing && isTableItem(table) ? (
          <TableStructureEditor
            table={table}
            databaseType={databaseType}
            connectionId={connectionId}
            onSuccess={handleEditSuccess}
            onCancel={handleEditCancel}
          />
        ) : (
          <>
            <ScrollArea className="max-h-96">
              <Tabs defaultValue="columns">
                <TabsList>
                  <TabsTrigger value="columns">
                    Columns ({table.columns.length})
                  </TabsTrigger>
                  {hasIndexes && (
                    <TabsTrigger value="indexes">
                      Indexes ({table.indexes.length})
                    </TabsTrigger>
                  )}
                  {hasForeignKeys && (
                    <TabsTrigger value="foreignKeys">
                      Foreign Keys ({table.foreignKeys.length})
                    </TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="columns">
                  <ColumnsTab columns={table.columns} />
                </TabsContent>

                {hasIndexes && (
                  <TabsContent value="indexes">
                    <IndexesTab indexes={table.indexes} />
                  </TabsContent>
                )}

                {hasForeignKeys && (
                  <TabsContent value="foreignKeys">
                    <ForeignKeysTab foreignKeys={table.foreignKeys} />
                  </TabsContent>
                )}
              </Tabs>
            </ScrollArea>

            <DialogFooter>
              {showEditButton && (
                <Button variant="outline" size="sm" onClick={handleEditClick}>
                  Edit Structure
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
