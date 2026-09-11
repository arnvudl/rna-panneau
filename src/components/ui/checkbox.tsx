"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// Generated with `npx shadcn@latest add checkbox`, then corrected in three
// places the CLI got wrong for this project (same class of breakage Phase 1
// fixed across the other primitives):
//  1. it emitted `import { cn } from "cn"` and installed a stray `cn` package;
//     the project's helper is `@/lib/utils` and the package was uninstalled.
//  2. `ring-3` is a Tailwind v4 spelling; on v3.4 it is `ring-[3px]`. The
//     `rounded-[4px]` is kept as an explicit arbitrary value rather than
//     swapped for `rounded-sm`, because this project derives its radius scale
//     from a 12px `--radius`, which makes `rounded-sm` 8px — enough to render
//     a 16px checkbox as a circle indistinguishable from a radio button.
//  3. the `dark:` utilities were dropped along with the rest of the app's
//     unreachable dark mode.
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border border-input bg-card transition-colors outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
      >
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
