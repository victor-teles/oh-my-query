"use client";

import type { VariantProps } from "class-variance-authority";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(`
          group/tabs flex gap-2
          data-horizontal:flex-col
        `, className)}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  `
    group/tabs-list inline-flex w-fit items-center justify-center rounded-lg
    p-[3px] text-muted-foreground
    group-data-horizontal/tabs:h-7
    group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col
    data-[variant=line]:rounded-none
  `,
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
        segment: `
          gap-0 rounded-none bg-muted/30 p-0
          group-data-horizontal/tabs:h-auto
        `,
      },
    },
  }
);

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return <TabsPrimitive.Tab data-slot="tabs-trigger" className={cn(`
          relative inline-flex h-[calc(100%-1px)] flex-1 items-center
          justify-center gap-1.5 rounded-md border border-transparent px-1.5
          py-0.5 text-xs font-medium whitespace-nowrap text-foreground/60
          transition-all duration-150 ease-out outline-none
          group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start
          group-data-vertical/tabs:py-[calc(--spacing(1.25))]
          hover:text-foreground
          focus-visible:border-ring focus-visible:ring-2
          focus-visible:ring-ring/50
          disabled:pointer-events-none disabled:opacity-50
          aria-disabled:pointer-events-none aria-disabled:opacity-50
          dark:text-muted-foreground
          dark:hover:text-foreground
          [&_svg]:pointer-events-none [&_svg]:shrink-0
          [&_svg:not([class*='size-'])]:size-3.5
        `, `
          group-data-[variant=line]/tabs-list:bg-transparent
          group-data-[variant=line]/tabs-list:data-active:bg-transparent
          dark:group-data-[variant=line]/tabs-list:data-active:border-transparent
          dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent
        `, `
          data-active:bg-background data-active:text-foreground
          dark:data-active:border-input dark:data-active:bg-input/30
          dark:data-active:text-foreground
        `, `
          after:absolute after:bg-foreground after:opacity-0
          after:transition-opacity
          group-data-horizontal/tabs:after:inset-x-0
          group-data-horizontal/tabs:after:bottom-[-5px]
          group-data-horizontal/tabs:after:h-0.5
          group-data-vertical/tabs:after:inset-y-0
          group-data-vertical/tabs:after:-right-1
          group-data-vertical/tabs:after:w-0.5
          group-data-[variant=line]/tabs-list:data-active:after:opacity-100
        `, `
          group-data-[variant=segment]/tabs-list:rounded-sm
          group-data-[variant=segment]/tabs-list:border-transparent
          group-data-[variant=segment]/tabs-list:bg-transparent
          group-data-[variant=segment]/tabs-list:px-3
          group-data-[variant=segment]/tabs-list:py-1.5
          group-data-[variant=segment]/tabs-list:text-xs
          group-data-[variant=segment]/tabs-list:text-muted-foreground
          group-data-[variant=segment]/tabs-list:after:hidden
          group-data-[variant=segment]/tabs-list:hover:text-foreground/80
          group-data-[variant=segment]/tabs-list:data-active:bg-background
          group-data-[variant=segment]/tabs-list:data-active:text-foreground
          group-data-[variant=segment]/tabs-list:data-active:shadow-sm
        `, className)} {...props} />;
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-xs/relaxed outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
