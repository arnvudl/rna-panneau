import type { Config } from "tailwindcss";

// No `darkMode` key: this is a desktop-only internal tool, DESIGN.md defines a
// single light palette, and nothing in the app ever sets a `.dark` class. The
// previous `darkMode: ["class"]` paired with a block of generic grey shadcn
// defaults in globals.css that no user could ever reach; both were deleted
// rather than left as a half-built theme.
//
// The `dark:` utilities that shipped inside the generated src/components/ui/*
// primitives were deleted in the same pass, deliberately. Without an explicit
// `darkMode` key Tailwind falls back to `media`, which would have compiled
// those utilities into `prefers-color-scheme: dark` queries — so on a machine
// set to dark mode they would have started applying to a light-only palette,
// turning a previously inert class into a live half-theme.
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    // src/lib holds class strings too (status-labels.ts maps each status to its
    // bg/text/accent classes). Without this glob those classes are purged and
    // the Kanban renders with no status colours at all.
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        // The five-meaning Status Vocabulary (DESIGN.md). Values live once, in
        // src/app/globals.css; this block only exposes them to Tailwind so
        // consumers can write `bg-status-ok-bg text-status-ok-text` instead of
        // hand-picking `bg-emerald-100 text-emerald-700` per screen.
        //   ok       — fine / active            (Signal Emerald)
        //   progress — in motion, unresolved    (Working Blue)
        //   watch    — needs attention soon     (Watch Orange)
        //   dormant  — settled / closed         (Dormant Slate)
        //   danger   — actually wrong           (Danger Red)
        status: {
          ok: {
            bg: "var(--status-ok-bg)",
            text: "var(--status-ok-text)",
            tint: "var(--status-ok-tint)",
          },
          progress: {
            bg: "var(--status-progress-bg)",
            text: "var(--status-progress-text)",
            tint: "var(--status-progress-tint)",
          },
          watch: {
            bg: "var(--status-watch-bg)",
            text: "var(--status-watch-text)",
            tint: "var(--status-watch-tint)",
          },
          dormant: {
            bg: "var(--status-dormant-bg)",
            text: "var(--status-dormant-text)",
            tint: "var(--status-dormant-tint)",
          },
          danger: {
            bg: "var(--status-danger-bg)",
            text: "var(--status-danger-text)",
            tint: "var(--status-danger-tint)",
          },
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      // src/app/layout.tsx loads Geist Sans / Geist Mono through next/font/local
      // and exposes them as --font-geist-sans / --font-geist-mono. Without this
      // block `font-sans` / `font-mono` resolve to Tailwind's default system
      // stacks and the loaded fonts are never actually used.
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [
    // The shadcn/base-ui generated components in src/components/ui were emitted
    // for Tailwind v4, but this project runs Tailwind v3.4. v4 introduced a set
    // of bare / composed variants that v3.4 does not know about, so any utility
    // carrying one of them silently compiled to nothing. Rather than rewriting
    // every generated class string, register the v4 variants the primitives
    // actually use so they produce the selectors they were written for.
    function ({
      addVariant,
      matchVariant,
    }: {
      addVariant: (name: string, selector: string | string[]) => void
      matchVariant: (
        name: string,
        cb: (value: string) => string | string[]
      ) => void
    }) {
      // Bare `data-*:` variants (v4). v3.4 only supports the bracketed
      // `data-[foo=bar]:` arbitrary form.
      const bareDataVariants = [
        "active",
        "open",
        "closed",
        "disabled",
        "inset",
        "placeholder",
        "selected",
        "checked",
        "highlighted",
        "popup-open",
        // Base UI drawer transition states.
        "starting-style",
        "ending-style",
        "swiping",
        "snap-points",
        "nested-drawer-open",
        "nested-drawer-swiping",
      ]
      for (const name of bareDataVariants) {
        addVariant(`data-${name}`, `&[data-${name}]`)
      }

      // `has-data-[foo=bar]:` (v4) -> `&:has([data-foo=bar])`
      matchVariant("has-data", (value) => `&:has([data-${value}])`)

      // `in-data-[foo=bar]:` (v4) -> ancestor selector
      matchVariant("in-data", (value) => `:where([data-${value}]) &`)

      // `not-data-[foo=bar]:` (v4) -> `&:not([data-foo=bar])`
      matchVariant("not-data", (value) => `&:not([data-${value}])`)
    },
  ],
};
export default config;
