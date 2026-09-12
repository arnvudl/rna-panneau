import * as React from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&>svg]:pointer-events-none [&>svg]:!size-3",
  {
    variants: {
      variant: {
        // Not navy. A badge is a status label, never the primary action of a
        // screen, so filling one with Control Navy burns the accent on
        // decoration (DESIGN.md, The Rare Navy Rule). The neutral default is
        // Dormant Slate — the vocabulary's own "nothing to report" color.
        default: "bg-status-dormant-bg text-status-dormant-text",
        secondary: "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        outline: "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost: "hover:bg-muted hover:text-muted-foreground",
        link: "text-primary underline-offset-4 hover:underline",

        // Status variants — bg/text pairs only, no border: DESIGN.md specifies
        // a two-color pair per meaning, and the extra `border-*-200` ring made
        // the pill read as a bordered chip rather than a flat status label.
        // Every value here resolves to the vocabulary vars in globals.css.
        available: "bg-status-ok-bg text-status-ok-text",
        rented: "bg-status-progress-bg text-status-progress-text",
        expiring: "bg-status-watch-bg text-status-watch-text",
        maintenance: "bg-status-dormant-bg text-status-dormant-text",
        destructive: "bg-status-danger-bg text-status-danger-text",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Badge = React.forwardRef<
  HTMLElement,
  Omit<useRender.ComponentProps<"span">, "ref"> &
    VariantProps<typeof badgeVariants>
>(function Badge({ className, variant = "default", render, ...props }, ref) {
  return useRender({
    defaultTagName: "span",
    ref,
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
})
Badge.displayName = "Badge"

export { Badge, badgeVariants }
