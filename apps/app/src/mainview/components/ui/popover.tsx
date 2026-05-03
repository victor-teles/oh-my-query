import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { cn } from "@/lib/utils";

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  anchor,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    "align" | "alignOffset" | "anchor" | "side" | "sideOffset"
  >) {
  return (
    <PopoverPrimitive.Portal data-slot="popover-portal">
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="isolate z-50"
        side={side}
        sideOffset={sideOffset}
      >
        <PopoverPrimitive.Popup className={cn(`
              z-50 w-72 origin-(--transform-origin) rounded-lg bg-popover p-3
              text-xs/relaxed text-popover-foreground shadow-md ring-1
              ring-foreground/10 transition-all duration-100 ease-out
              outline-none
              focus-visible:ring-2 focus-visible:ring-ring/50
              data-[side=bottom]:slide-in-from-top-2
              data-[side=inline-end]:slide-in-from-left-2
              data-[side=inline-start]:slide-in-from-right-2
              data-[side=left]:slide-in-from-right-2
              data-[side=right]:slide-in-from-left-2
              data-[side=top]:slide-in-from-bottom-2
              data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95
              data-closed:animate-out data-closed:fade-out-0
              data-closed:zoom-out-95
            `, className)} data-slot="popover-content" {...props} />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverTrigger, PopoverContent };
