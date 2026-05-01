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

interface WelcomeStateProps {
  onAdd: () => void;
}

const WelcomeState = ({ onAdd }: WelcomeStateProps) => (
  <motion.div
    animate={{ opacity: 1 }}
    className="relative isolate w-full max-w-md"
    exit={{ opacity: 0 }}
    initial={{ opacity: 0 }}
    transition={{ duration: 0.2, ease: "easeOut" }}
  >
    <div
      aria-hidden
      className="
        pointer-events-none absolute top-6 left-1/2 -z-10 size-64
        -translate-x-1/2 rounded-full bg-primary/25 blur-3xl
      "
    />
    <Empty className="gap-5 p-0">
      <EmptyMedia
        className="
          mb-2 size-16 rounded-2xl bg-primary/10 text-primary ring-1
          ring-primary/20 ring-inset
          [&_svg:not([class*='size-'])]:size-7
        "
        variant="icon"
      >
        <Database />
      </EmptyMedia>
      <EmptyHeader className="gap-2">
        <EmptyTitle as="h1" className="text-3xl leading-[1.05] tracking-tight">
          Welcome to oh-my-query
        </EmptyTitle>
        <EmptyDescription className="text-base/relaxed">
          A quiet home for your databases, with an AI that knows your schema.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="mt-2">
        <Button autoFocus onClick={onAdd} size="lg">
          <Plus />
          Add your first connection
        </Button>
      </EmptyContent>
    </Empty>
  </motion.div>
);

export { WelcomeState };
