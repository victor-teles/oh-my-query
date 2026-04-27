import { Pencil, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

interface NoResultsStateProps {
  label: "rows" | "documents";
  onEditQuery?: () => void;
}

export const NoResultsState = ({ label, onEditQuery }: NoResultsStateProps) => (
  <Empty className="flex-1 p-6">
    <EmptyMedia variant="icon">
      <SearchX />
    </EmptyMedia>
    <EmptyHeader>
      <EmptyTitle as="h2">No results</EmptyTitle>
      <EmptyDescription>Your query returned no {label}.</EmptyDescription>
    </EmptyHeader>
    {onEditQuery && (
      <EmptyContent>
        <Button onClick={onEditQuery} size="sm">
          <Pencil />
          Edit query
        </Button>
      </EmptyContent>
    )}
  </Empty>
);
