---
name: RNA Panneau
description: Centre d'opérations pour la gestion d'un parc d'affichage publicitaire
colors:
  control-navy: "#102660"
  ink: "#020817"
  paper: "#f8fafc"
  surface-white: "#ffffff"
  slate-secondary: "#e2e8f0"
  slate-text: "#64748b"
  hairline: "#e2e8f0"
  alert-red: "#ef4444"
  signal-emerald-bg: "#d1fae5"
  signal-emerald-text: "#047857"
  working-blue-bg: "#dbeafe"
  working-blue-text: "#1d4ed8"
  watch-orange-bg: "#ffedd5"
  watch-orange-text: "#c2410c"
  dormant-slate-bg: "#f1f5f9"
  dormant-slate-text: "#334155"
  danger-bg: "#fee2e2"
  danger-text: "#b91c1c"
typography:
  body:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.35
  label:
    fontFamily: "Geist Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.3
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: "6px"
  md: "10px"
  lg: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.control-navy}"
    textColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    padding: "6px 10px"
  button-primary-hover:
    backgroundColor: "{colors.control-navy}"
    textColor: "{colors.paper}"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "6px 10px"
  card:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  badge-active:
    backgroundColor: "{colors.signal-emerald-bg}"
    textColor: "{colors.signal-emerald-text}"
    rounded: "9999px"
    padding: "2px 8px"
  badge-alert:
    backgroundColor: "{colors.watch-orange-bg}"
    textColor: "{colors.watch-orange-text}"
    rounded: "9999px"
    padding: "2px 8px"
---

# Design System: RNA Panneau

## Overview

**Creative North Star: "The Control Room"**

RNA Panneau is the screen a small team stares at every day to keep a billboard park under control: which faces are occupied, which contracts are about to lapse, which invoices are unpaid. The system is not selling anything to anyone — it exists so nothing slips through. That makes the right posture a control room, not a storefront: calm, authoritative, built for fast triage rather than persuasion. Deep navy carries the authority (used sparingly — an accent for actions and identity, not a backdrop), while the real workhorse is a disciplined status-color vocabulary that lets a Comptable glance at a column of cards and immediately know what's fine and what's bleeding money.

The system is currently under-designed relative to this ambition: components exist (Card, Badge, Button, Select, Dropdown, Popover, Tooltip) but have been assembled without a consistent rhythm, several screens still show default/cramped spacing, and status colors were added incrementally without a documented vocabulary. This file exists to fix that going forward — every new surface should read as the same disciplined operations tool, not a new experiment.

**Key Characteristics:**
- Flat by default; elevation reserved for things that float above the page (menus, popovers, dialogs), never for resting content.
- One accent color (navy) used deliberately and rarely; status colors carry the day-to-day information load.
- Dense, scannable layouts — this is a tool used for hours a day by 2-3 people, not a marketing surface.

## Colors

The palette is a near-monochrome operations base (navy, ink, paper, white) plus a small, disciplined status vocabulary that must stay consistent everywhere a status is shown (Kanban columns, badges, dashboard tiles).

### Primary
- **Control Navy** (`#102660`): the one brand accent. Primary buttons, active nav state, focus rings, links. Used on a small fraction of any screen — its rarity is what makes it read as "action" rather than decoration.

### Neutral
- **Ink** (`#020817`): primary text color, near-black with a cold blue undertone.
- **Paper** (`#f8fafc`): page background — a very faint blue-white, not pure white, so white cards read as raised surfaces against it.
- **Surface White** (`#ffffff`): card and popover backgrounds.
- **Slate Secondary** (`#e2e8f0`): borders, dividers, muted backgrounds (secondary buttons, disabled states).
- **Slate Text** (`#64748b`): secondary/muted text — subtitles, timestamps, helper copy.

### Status Vocabulary (the system's real workhorse)
This is the vocabulary a Comptable or Commercial reads at a glance. It must be reused verbatim everywhere a status appears — do not invent new status colors per screen.
- **Signal Emerald** (bg `#d1fae5` / text `#047857`): things that are fine and active — an available billboard, an active contract, a paid invoice.
- **Working Blue** (bg `#dbeafe` / text `#1d4ed8`): things in motion but not yet resolved — a rented face, a signed-but-not-active contract.
- **Watch Orange** (bg `#ffedd5` / text `#c2410c`): things that need attention soon but aren't broken yet — a contract expiring, an unpaid invoice approaching its follow-up date.
- **Dormant Slate** (bg `#f1f5f9` / text `#334155`): things that are settled/closed and no longer need action — a draft not yet started, a contract that ended normally.
- **Danger Red** (bg `#fee2e2` / text `#b91c1c`): things that are actually wrong — a cancelled contract, an overdue payment past its relance deadline, a destructive action's confirmation.

### Named Rules
**The Rare Navy Rule.** Control Navy appears only on the primary action of a screen and on active-state indicators (active nav link, focused input, selected tab). It never fills a whole card or section — if navy is covering more than a button or an accent bar, it's being used wrong.

**The One Status Vocabulary Rule.** Every status badge in the product — billboard state, contract state, invoice state — must map to one of the five status colors above by *meaning* (fine / in-progress / needs-attention / settled / wrong), not by picking a color that merely looks nice next to its neighbors. A new status value gets assigned to the closest existing meaning before a sixth color is ever considered.

## Typography

**Body Font:** Geist Sans (with system-ui, sans-serif fallback)
**Label/Mono Font:** Geist Mono (with ui-monospace, monospace fallback) — reserved for contract/invoice reference numbers and monetary figures, where fixed-width digits help scanning a column of them.

**Character:** Geist Sans is a neutral, highly legible grotesque with no personality of its own — correct for an operations tool where the data is the content, not the typeface. Geist Mono's occasional use for numbers (`CT-0001`, `12 500 000 Ar`) is a small, deliberate signal that "this is a precise, countable value," distinct from prose.

### Hierarchy
- **Title** (500, 1rem/16px, 1.35 line-height): card titles, section headings within a page (e.g. a Kanban column header, a contract's numero).
- **Body** (400, 0.875rem/14px, 1.5 line-height): the default text size for nearly everything — table cells, card content, form labels' adjacent values.
- **Label** (500, 0.75rem/12px, 1.3 line-height): form field labels, badge text, column counters, timestamps.
- **Mono** (400, 0.8125rem/13px, 1.4 line-height): reference numbers and monetary amounts specifically — not a general-purpose smaller size.

### Named Rules
**The Data-Over-Decoration Rule.** There is no display/hero type scale in this system. The largest text on any screen is a page's `<h1>` at Title size or one step up; nothing here needs to shout, because nobody visits this product to be impressed by it — they visit to find a number fast.

**Print exception.** Generated PDF documents (`BillboardPdfDocument`, `ParkFullPdf`, `ParkSummaryPdf`) intentionally use Helvetica, not Geist — `@react-pdf/renderer` ships a fixed set of print-safe base fonts, and Helvetica is the standard choice for print/export documents regardless of the on-screen type system. This is a deliberate, documented exception, not a gap to fix.

## Layout

Fixed desktop-only layout (confirmed: no mobile/tablet requirement). The shell is a persistent left sidebar (collapsible between an icon-only rail and an icon+label expanded state, user-toggled, default collapsed) plus a content column that fills the remaining width. Content pages use a per-page breadcrumb at the top instead of a global top bar — there is no top navigation bar in this system. The sidebar is `sticky top-0`, not just `h-screen` — a page taller than the viewport must scroll its own content (via `PageShell`'s `fill` mode, an internal `overflow-y-auto` pane) without the sidebar ever scrolling out of view with it. A page whose content pushes the document taller than the viewport is a layout bug in this system, not an acceptable side effect of having a lot of data on one page.

Density is high by default: this is a tool used for hours a day, not a page skimmed once. Card padding is tight (16px), gaps between elements are typically 8-12px, and multi-column layouts (like the Kanban board) are expected to stretch to fill the available width on wide monitors rather than leaving dead space — fixed-pixel-width columns are a defect in this system, not a stylistic choice, given the fixed number of statuses any given board tracks.

### Named Rules
**The No Dead Space Rule.** A layout with a fixed number of columns/sections (a 5-status Kanban, a 4-tile KPI row) must stretch its columns/tiles to fill the viewport on wide screens. Horizontal scroll is only acceptable as a fallback when the viewport genuinely can't fit the minimum readable width per item, never as the default behavior on a normal desktop monitor.

## Elevation & Depth

Flat by default, elevation only for floating layers. Resting surfaces (cards, page background) use a 1px tonal ring (`ring-1 ring-foreground/10`) rather than a shadow — depth is implied by a subtle border/tint difference, not by cast shadow. Genuinely floating elements (dropdown menus, popovers, dialogs) get both the tonal ring and a real shadow, since they need to visually separate from the content behind them.

### Shadow Vocabulary
- **Floating-medium** (`shadow-md` + `ring-1 ring-foreground/10`): dropdown menus, select menus, popovers at rest.
- **Floating-high** (`shadow-lg` + `ring-1 ring-foreground/10`): larger floating surfaces (bigger dropdown panels).

### Named Rules
**The Flat-Content, Lifted-Overlay Rule.** If it's part of the page's normal reading flow (a card, a table row, a Kanban card), it gets a tonal ring only, never a shadow. If it floats above the page and can be dismissed by clicking outside it (menu, popover, dialog), it gets a shadow. A card that starts growing a hover-shadow to seem "interactive" is drifting from this system.

## Shapes

Rounded corners throughout, `12px` (`--radius`, exposed as `rounded-lg`) as the base radius for cards, buttons, and popovers; `10px`/`6px` derived steps for smaller elements (`rounded-md`/`rounded-sm`). Fully rounded (`9999px`, pill shape) for badges and status pills specifically — this is what visually distinguishes "a status label" from "a card or button" at a glance. Borders are thin (1px) and low-contrast (`border-border`, a light slate), used for structural separation (table rows, card outlines) rather than as a decorative accent.

Scrollbars follow the same restraint: thin (8px), a muted-foreground track-less thumb at 30% opacity (50% on hover), never the OS-default chunky gray bar. Defined once, globally, in `globals.css` (`scrollbar-width`/`scrollbar-color` + the `::-webkit-scrollbar*` set) — any element that scrolls picks it up automatically, nothing to opt into per component. Kept visible, never hidden entirely: a scrollable region with no scrollbar at all loses the one honest signal that there's more content below.

### Named Rules
**The No Side-Tabs Rule.** Never use a thick colored `border-l-*` bar to carry status/active-state meaning (on a card, a nav item, a table row). An automated design-quality scan (Impeccable's detector) flags this specific pattern — a solid vertical accent stripe down one edge — as the single most recognizable tell of an AI-generated interface, and a 2026-09-13 audit found it copied across 6 components (Sidebar active state, the Kanban card, the billboard table row). Carry the same meaning instead with a background tint (the status-tinted column/row background already does this) plus a small colored dot, or a text/icon color change — never a border stripe.

## Components

### Buttons
- **Shape:** 12px radius (`rounded-lg`), consistent with cards.
- **Primary:** Control Navy background, paper-white text; used once per view for the one action that matters (e.g. "+ Nouveau contrat").
- **Outline / Secondary / Ghost:** paper or slate-secondary background, ink text — used for every action that isn't the primary one. A screen with more than one navy button is a sign the hierarchy is wrong, not that a second action deserves navy.
- **Destructive:** danger-red text on a faint red-tinted background (not a solid red fill) — visible but not alarming until the user is actually about to do something irreversible (e.g. the DRAFT-only hard-delete).

### Badges (status pills)
- **Style:** fully rounded (pill), background/text pair drawn only from the five-color status vocabulary above.
- **State:** static — badges in this system describe a record's status, they are not interactive filter chips (filtering happens through the dedicated filter bar's dropdowns, not by clicking a badge).

### Cards / Containers
- **Corner Style:** 12px radius.
- **Background:** surface white on paper background.
- **Shadow Strategy:** flat (tonal ring only) — see Elevation & Depth.
- **Border:** 1px tonal ring (`ring-foreground/10`), not a hard border color.
- **Internal Padding:** 16px default, 12px in denser contexts (Kanban cards).

### Inputs / Fields
- **Style:** 1px slate border, white/paper background, 10-12px radius.
- **Focus:** border shifts to Control Navy plus a soft navy focus ring — the one place navy is allowed to appear per-field, since it's confirming "this is where you're typing," not decoration.

### Navigation (Sidebar)
- **Style:** vertical icon rail, collapsible to icon+label. Active link: a faint navy-tinted background plus navy icon/text color — no left border bar (see The No Side-Tabs Rule below). Icon+label both shown when expanded; icon only, with a hover tooltip revealing the label, when collapsed.

### Kanban Card (signature component)
The product's most-used custom component. Status is carried by the column's tinted background and a small colored dot in the column header — not by a bar on the card itself (see The No Side-Tabs Rule). Each card shows a bold numero as its title, the client name as a muted subtitle, and a compact face/date-range line below — deliberately not crammed into one wrapping badge (an earlier version did this and it read as cluttered; the current version keeps face and date as visually separate short elements). Column backgrounds carry a faint tint of their status color so the whole column reads as "the emerald column" or "the orange column" from a distance, before any individual card is read.

## Do's and Don'ts

### Do:
- **Do** reuse the five-color Status Vocabulary for any new status concept (invoice state, alert severity) by mapping it to the closest existing meaning first.
- **Do** stretch fixed-count layouts (Kanban columns, KPI tile rows) to fill the available width on desktop monitors — this system has no excuse for dead space given its usage is always desktop, often on wide monitors.
- **Do** use Control Navy sparingly — one primary action, active nav state, focus rings. Its rarity is the point.
- **Do** keep resting surfaces flat (tonal ring, no shadow); reserve shadows for floating/dismissible layers.

### Don't:
- **Don't** introduce a new status color without first checking whether it maps to an existing one of the five vocabulary meanings.
- **Don't** add hover-shadows or lift effects to cards/rows to signal "interactive" — use a background tint or border-color shift instead, consistent with the flat-by-default system.
- **Don't** combine two different pieces of information into one wrapping badge/pill (e.g. "face · date range") — give each its own short element instead, so nothing wraps mid-word on a narrow card.
- **Don't** use `font-heading` — it's referenced in one legacy component (`CardTitle`) but no such font family is actually defined in this project; it silently falls back to the body font. Either define it properly or remove the class; don't propagate it to new components.
- **Don't** use a `border-l-4`-style colored side bar to carry status or active-state meaning anywhere (see The No Side-Tabs Rule under Shapes) — it's a recognized AI-generated-UI tell, not a neutral stylistic choice.
- **Don't** use a raw pixel font-size (e.g. `text-[10px]`, `text-[11px]`) — every size must be one of the four documented steps (Title/Body/Label/Mono); an off-ramp size is a sign something should have reused Label (12px) instead of inventing a smaller one.
