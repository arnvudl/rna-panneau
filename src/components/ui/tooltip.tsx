"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { cn } from "@/lib/utils"

// Tooltip.Provider and Tooltip.Root render no DOM element of their own (they
// are context providers), so there is nothing for a ref to attach to and they
// stay plain function components.
function TooltipProvider({
  delay = 0,
  ...props
}: TooltipPrimitive.Provider.Props) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      {...props}
    />
  )
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

const TooltipTrigger = React.forwardRef<
  HTMLButtonElement,
  TooltipPrimitive.Trigger.Props
>(function TooltipTrigger({ ...props }, ref) {
  return (
    <TooltipPrimitive.Trigger
      ref={ref}
      data-slot="tooltip-trigger"
      {...props}
    />
  )
})
TooltipTrigger.displayName = "TooltipTrigger"

// The ref targets the popup, which is the element consumers measure or focus;
// the Portal/Positioner wrappers around it are layout plumbing.
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Popup>,
  TooltipPrimitive.Popup.Props &
    Pick<
      TooltipPrimitive.Positioner.Props,
      "align" | "alignOffset" | "side" | "sideOffset"
    >
>(function TooltipContent(
  {
    className,
    side = "top",
    sideOffset = 4,
    align = "center",
    alignOffset = 0,
    children,
    ...props
  },
  ref
) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <TooltipPrimitive.Popup
          ref={ref}
          data-slot="tooltip-content"
          className={cn(
            "z-50 inline-flex w-fit max-w-xs origin-[var(--transform-origin)] items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background has-data-[slot=kbd]:pr-1.5 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 [&_[data-slot=kbd]]:relative [&_[data-slot=kbd]]:isolate [&_[data-slot=kbd]]:z-50 [&_[data-slot=kbd]]:rounded-sm data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground data-[side=bottom]:top-1 data-[side=inline-end]:!top-1/2 data-[side=inline-end]:-left-1 data-[side=inline-end]:-translate-y-1/2 data-[side=inline-start]:!top-1/2 data-[side=inline-start]:-right-1 data-[side=inline-start]:-translate-y-1/2 data-[side=left]:!top-1/2 data-[side=left]:-right-1 data-[side=left]:-translate-y-1/2 data-[side=right]:!top-1/2 data-[side=right]:-left-1 data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5" />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
})
TooltipContent.displayName = "TooltipContent"

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
