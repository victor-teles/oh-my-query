import { Database, Plus } from "lucide-react";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

interface NoConnectionsStateProps {
  onAdd: () => void;
}

const NoConnectionsState = ({ onAdd }: NoConnectionsStateProps) => (
  <motion.div
    animate={{ opacity: 1 }}
    className="w-full max-w-md"
    exit={{ opacity: 0 }}
    initial={{ opacity: 0 }}
    transition={{ duration: 0.2, ease: "easeOut" }}
  >
    <Empty className="p-0">
      <EmptyMedia variant="icon">
        <Database />
      </EmptyMedia>
      <EmptyHeader>
        <EmptyTitle as="h2" className="text-base">
          No connections yet
        </EmptyTitle>
        <EmptyDescription>
          Saved connections live here. You can add one anytime.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button autoFocus onClick={onAdd} size="default">
          <Plus />
          Add connection
        </Button>
      </EmptyContent>
    </Empty>
  </motion.div>
);

export { NoConnectionsState };
