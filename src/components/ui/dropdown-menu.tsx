"use client"

import * as React from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"

import { cn } from "@/lib/utils"
import { ChevronRightIcon, CheckIcon } from "lucide-react"

// Menu.Root and Menu.SubmenuRoot are context providers with no DOM element of
// their own, so there is nothing for a ref to attach to and they stay plain
// function components.
function DropdownMenu({ ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

const DropdownMenuPortal = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.Portal>,
  MenuPrimitive.Portal.Props
>(function DropdownMenuPortal({ ...props }, ref) {
  return (
    <MenuPrimitive.Portal
      ref={ref}
      data-slot="dropdown-menu-portal"
      {...props}
    />
  )
})
DropdownMenuPortal.displayName = "DropdownMenuPortal"

const DropdownMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  MenuPrimitive.Trigger.Props
>(function DropdownMenuTrigger({ ...props }, ref) {
  return (
    <MenuPrimitive.Trigger
      ref={ref}
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  )
})
DropdownMenuTrigger.displayName = "DropdownMenuTrigger"

// The ref targets the popup rather than the Portal/Positioner wrappers, which
// are layout plumbing; the popup is the menu surface itself.
const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.Popup>,
  MenuPrimitive.Popup.Props &
    Pick<
      MenuPrimitive.Positioner.Props,
      "align" | "alignOffset" | "side" | "sideOffset"
    >
>(function DropdownMenuContent(
  {
    align = "start",
    alignOffset = 0,
    side = "bottom",
    sideOffset = 4,
    className,
    ...props
  },
  ref
) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          ref={ref}
          data-slot="dropdown-menu-content"
          className={cn("z-50 max-h-[var(--available-height)] w-[var(--anchor-width)] min-w-[8rem] origin-[var(--transform-origin)] overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:overflow-hidden data-closed:fade-out-0 data-closed:zoom-out-95", className )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
})
DropdownMenuContent.displayName = "DropdownMenuContent"

const DropdownMenuGroup = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.Group>,
  MenuPrimitive.Group.Props
>(function DropdownMenuGroup({ ...props }, ref) {
  return (
    <MenuPrimitive.Group ref={ref} data-slot="dropdown-menu-group" {...props} />
  )
})
DropdownMenuGroup.displayName = "DropdownMenuGroup"

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.GroupLabel>,
  MenuPrimitive.GroupLabel.Props & {
    inset?: boolean
  }
>(function DropdownMenuLabel({ className, inset, ...props }, ref) {
  return (
    <MenuPrimitive.GroupLabel
      ref={ref}
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-1.5 py-1 text-xs font-medium text-muted-foreground data-inset:pl-7",
        className
      )}
      {...props}
    />
  )
})
DropdownMenuLabel.displayName = "DropdownMenuLabel"

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.Item>,
  MenuPrimitive.Item.Props & {
    inset?: boolean
    variant?: "default" | "destructive"
  }
>(function DropdownMenuItem(
  { className, inset, variant = "default", ...props },
  ref
) {
  return (
    <MenuPrimitive.Item
      ref={ref}
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "group/dropdown-menu-item relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:[&_*]:text-accent-foreground data-inset:pl-7 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[variant=destructive]:[&>svg]:text-destructive",
        className
      )}
      {...props}
    />
  )
})
DropdownMenuItem.displayName = "DropdownMenuItem"

function DropdownMenuSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
  return <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />
}

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.SubmenuTrigger>,
  MenuPrimitive.SubmenuTrigger.Props & {
    inset?: boolean
  }
>(function DropdownMenuSubTrigger(
  { className, inset, children, ...props },
  ref
) {
  return (
    <MenuPrimitive.SubmenuTrigger
      ref={ref}
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:[&_*]:text-accent-foreground data-inset:pl-7 data-popup-open:bg-accent data-popup-open:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto" />
    </MenuPrimitive.SubmenuTrigger>
  )
})
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger"

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuContent>
>(function DropdownMenuSubContent(
  {
    align = "start",
    alignOffset = -3,
    side = "right",
    sideOffset = 0,
    className,
    ...props
  },
  ref
) {
  return (
    <DropdownMenuContent
      ref={ref}
      data-slot="dropdown-menu-sub-content"
      className={cn("w-auto min-w-[96px] rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", className )}
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  )
})
DropdownMenuSubContent.displayName = "DropdownMenuSubContent"

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.CheckboxItem>,
  MenuPrimitive.CheckboxItem.Props & {
    inset?: boolean
  }
>(function DropdownMenuCheckboxItem(
  { className, children, checked, inset, ...props },
  ref
) {
  return (
    <MenuPrimitive.CheckboxItem
      ref={ref}
      data-slot="dropdown-menu-checkbox-item"
      data-inset={inset}
      className={cn(
        "relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground focus:[&_*]:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      checked={checked}
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-checkbox-item-indicator"
      >
        <MenuPrimitive.CheckboxItemIndicator>
          <CheckIcon
          />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  )
})
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem"

const DropdownMenuRadioGroup = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.RadioGroup>,
  MenuPrimitive.RadioGroup.Props
>(function DropdownMenuRadioGroup({ ...props }, ref) {
  return (
    <MenuPrimitive.RadioGroup
      ref={ref}
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  )
})
DropdownMenuRadioGroup.displayName = "DropdownMenuRadioGroup"

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.RadioItem>,
  MenuPrimitive.RadioItem.Props & {
    inset?: boolean
  }
>(function DropdownMenuRadioItem(
  { className, children, inset, ...props },
  ref
) {
  return (
    <MenuPrimitive.RadioItem
      ref={ref}
      data-slot="dropdown-menu-radio-item"
      data-inset={inset}
      className={cn(
        "relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground focus:[&_*]:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        <MenuPrimitive.RadioItemIndicator>
          <CheckIcon
          />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  )
})
DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem"

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof MenuPrimitive.Separator>,
  MenuPrimitive.Separator.Props
>(function DropdownMenuSeparator({ className, ...props }, ref) {
  return (
    <MenuPrimitive.Separator
      ref={ref}
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
})
DropdownMenuSeparator.displayName = "DropdownMenuSeparator"

const DropdownMenuShortcut = React.forwardRef<
  HTMLSpanElement,
  React.ComponentProps<"span">
>(function DropdownMenuShortcut({ className, ...props }, ref) {
  return (
    <span
      ref={ref}
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground",
        className
      )}
      {...props}
    />
  )
})
DropdownMenuShortcut.displayName = "DropdownMenuShortcut"

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
