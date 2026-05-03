import type { VariantProps } from "class-variance-authority";

import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="empty" className={cn(`
          flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4
          rounded-xl border-dashed p-6 text-center text-balance
        `, className)} {...props} />;
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-header"
      className={cn("flex max-w-sm flex-col items-center gap-1", className)}
      {...props}
    />
  );
}

const emptyMediaVariants = cva(
  `
    mb-2 flex shrink-0 items-center justify-center
    [&_svg]:pointer-events-none [&_svg]:shrink-0
  `,
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "bg-transparent",
        icon: `
          flex size-8 shrink-0 items-center justify-center rounded-md bg-muted
          text-foreground
          [&_svg:not([class*='size-'])]:size-4
        `,
      },
    },
  }
);

function EmptyMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div
      data-slot="empty-icon"
      data-variant={variant}
      className={cn(emptyMediaVariants({ className, variant }))}
      {...props}
    />
  );
}

type EmptyTitleTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "div";

function EmptyTitle({
  as: Component = "div",
  className,
  ...props
}: React.ComponentProps<"div"> & { as?: EmptyTitleTag }) {
  return (
    <Component
      data-slot="empty-title"
      className={cn("text-sm font-medium tracking-tight", className)}
      {...props}
    />
  );
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <div data-slot="empty-description" className={cn(`
          text-xs/relaxed text-muted-foreground
          [&>a]:underline [&>a]:underline-offset-4
          [&>a:hover]:text-primary
        `, className)} {...props} />;
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="empty-content" className={cn(`
          flex w-full max-w-sm min-w-0 flex-col items-center gap-2
          text-xs/relaxed text-balance
        `, className)} {...props} />;
}

export {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
};
