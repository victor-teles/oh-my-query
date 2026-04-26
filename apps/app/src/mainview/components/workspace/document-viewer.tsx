import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useState } from "react";

import type { DocumentResult } from "@/lib/tauri";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { NoResultsState } from "./no-results-state";

interface DocumentViewerProps {
  result: DocumentResult;
}

const DOCS_PER_PAGE = 50;

export const DocumentViewer = ({ result }: DocumentViewerProps) => {
  const [page, setPage] = useState(0);

  if (result.documents.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <NoResultsState label="documents" />
      </div>
    );
  }

  const totalPages = Math.ceil(result.documents.length / DOCS_PER_PAGE);
  const start = page * DOCS_PER_PAGE;
  const pageDocuments = result.documents.slice(start, start + DOCS_PER_PAGE);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto p-3 font-mono text-sm">
        {pageDocuments.map((doc, idx) => {
          const docIndex = start + idx;
          return (
            // eslint-disable-next-line react/no-array-index-key -- documents have no guaranteed unique ID
            <DocumentCard key={docIndex} value={doc} index={docIndex + 1} />
          );
        })}
      </div>
      {totalPages > 1 && (
        <DocumentPagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
};

const DocumentCard = ({ value, index }: { value: unknown; index: number }) => (
  <div className="mb-3 rounded border border-border p-2">
    <span className="mb-1 block text-xs text-muted-foreground">
      Document {index}
    </span>
    <JsonNode value={value} defaultExpanded />
  </div>
);

interface DocumentPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const DocumentPagination = ({
  page,
  totalPages,
  onPageChange,
}: DocumentPaginationProps) => {
  const handlePrev = useCallback(() => {
    onPageChange(page - 1);
  }, [onPageChange, page]);

  const handleNext = useCallback(() => {
    onPageChange(page + 1);
  }, [onPageChange, page]);

  return (
    <div className="flex items-center justify-between border-t px-3 py-1.5 text-muted-foreground text-xs">
      <span>
        Page {page + 1} of {totalPages}
      </span>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Previous page"
                disabled={page === 0}
                onClick={handlePrev}
                size="icon-xs"
                variant="ghost"
              />
            }
          >
            <ChevronLeft className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent>Previous page</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Next page"
                disabled={page >= totalPages - 1}
                onClick={handleNext}
                size="icon-xs"
                variant="ghost"
              />
            }
          >
            <ChevronRight className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent>Next page</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

interface JsonNodeProps {
  value: unknown;
  keyName?: string;
  defaultExpanded?: boolean;
}

const JsonNode = ({
  value,
  keyName,
  defaultExpanded = false,
}: JsonNodeProps) => {
  if (value === null) {
    return (
      <JsonPrimitive keyName={keyName}>
        <span className="italic text-muted-foreground">null</span>
      </JsonPrimitive>
    );
  }

  if (typeof value === "boolean") {
    return (
      <JsonPrimitive keyName={keyName}>
        <span className="text-json-boolean">{String(value)}</span>
      </JsonPrimitive>
    );
  }

  if (typeof value === "number") {
    return (
      <JsonPrimitive keyName={keyName}>
        <span className="text-json-number">{String(value)}</span>
      </JsonPrimitive>
    );
  }

  if (typeof value === "string") {
    return (
      <JsonPrimitive keyName={keyName}>
        <span className="text-json-string">&quot;{value}&quot;</span>
      </JsonPrimitive>
    );
  }

  if (Array.isArray(value)) {
    return (
      <JsonCollapsible
        keyName={keyName}
        defaultExpanded={defaultExpanded}
        emptyLabel="[]"
        collapsedLabel={`[${value.length} items]`}
        isEmpty={value.length === 0}
      >
        {value.map((item, idx) => (
          // eslint-disable-next-line react/no-array-index-key -- JSON array items have no unique ID
          <div key={idx}>
            <JsonNode value={item} keyName={String(idx)} />
          </div>
        ))}
      </JsonCollapsible>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <JsonCollapsible
        keyName={keyName}
        defaultExpanded={defaultExpanded}
        emptyLabel="{}"
        collapsedLabel={`{...${entries.length} keys}`}
        isEmpty={entries.length === 0}
      >
        {entries.map(([key, val]) => (
          <div key={key}>
            <JsonNode value={val} keyName={key} />
          </div>
        ))}
      </JsonCollapsible>
    );
  }

  return (
    <JsonPrimitive keyName={keyName}>
      <span className="text-muted-foreground">{String(value)}</span>
    </JsonPrimitive>
  );
};

const JsonPrimitive = ({
  keyName,
  children,
}: {
  keyName?: string;
  children: React.ReactNode;
}) => (
  <span>
    {keyName !== undefined && <KeyLabel name={keyName} />}
    {children}
  </span>
);

const JsonCollapsible = ({
  keyName,
  defaultExpanded = false,
  emptyLabel,
  collapsedLabel,
  isEmpty,
  children,
}: {
  keyName?: string;
  defaultExpanded?: boolean;
  emptyLabel: string;
  collapsedLabel: string;
  isEmpty: boolean;
  children: React.ReactNode;
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const toggle = useCallback(() => setExpanded((prev) => !prev), []);

  if (isEmpty) {
    return (
      <span>
        {keyName !== undefined && <KeyLabel name={keyName} />}
        <span className="text-muted-foreground">{emptyLabel}</span>
      </span>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-0.5 hover:text-foreground"
      >
        {expanded ? (
          <ChevronDown className="size-3" />
        ) : (
          <ChevronRight className="size-3" />
        )}
        {keyName !== undefined && <KeyLabel name={keyName} />}
        {!expanded && (
          <span className="text-muted-foreground">{collapsedLabel}</span>
        )}
      </button>
      {expanded && (
        <div className="ml-4 border-l border-border pl-2">{children}</div>
      )}
    </div>
  );
};

const KeyLabel = ({ name }: { name: string }) => (
  <span className="text-json-key">{name}: </span>
);
