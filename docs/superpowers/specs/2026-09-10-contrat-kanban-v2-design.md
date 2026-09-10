# Contrat Kanban v2 — Design

**Date:** 2026-09-10
**Status:** Approved

## Problem

Task 1.3 shipped a read-and-move-only Kanban board (`src/components/contrats/`) at `/contrats`. It's missing create/delete/filter/search, the visual design doesn't match the desired reference style (compact cards, short columns), and — critically — **drag-and-drop is completely broken for a real user** (confirmed: "rien ne se passe, la carte reste sur place").

## Root cause of the drag bug

`src/components/ui/card.tsx`'s `Card` component is a plain function component that spreads `...props` onto its root `<div>` but is **not** wrapped in `React.forwardRef`. The project runs React 18.3.1 (confirmed in `node_modules`), where refs are not auto-forwarded to function components — so `ref={...}` passed to a plain function component silently fails (no warning surfaced in this case blocks it further, the ref callback is simply never invoked with a node).

`ContratCard.tsx` (added in a prior code-review fix round) passes dnd-kit's `ref={setNodeRef}` to `<Card>`. Since the ref never attaches to a real DOM node, dnd-kit's `DndContext` never registers the card as a draggable node in its internal registry, so pointer-down never starts a drag session. This is why nothing happens on drag attempt — not an automation artifact, a real regression from that refactor.

**Note:** all 13 components in `src/components/ui/` share this same forwardRef gap (checked via grep), so the same failure mode is latent everywhere else too. Fixing all of them is out of scope for this task (flagged separately as a follow-up); this spec only fixes `Card`, since that's what's actually blocking Kanban.

## Goals

1. Fix the drag-and-drop regression (`Card` → `forwardRef`).
2. Add contrat creation (form, same fields as today's `POST /api/contrats`: client, billboard, face, dates).
3. Add contrat deletion:
   - Soft: dragging to `CANCELLED` already works (existing state machine) — no change needed.
   - Hard: available only for `DRAFT` contrats, no approval gate, audit-logged.
4. Add filtering + search: client, billboard, région, district, commune (dropdowns) + free-text search (numero or client name).
5. Visual redesign: full page-height columns with internal scroll, tinted background per status, restyled cards (bold numero, client as subtitle, face + date-range metadata, colored accent bar matching column status).

## Non-goals

- Sorting (appeared in a reference screenshot but wasn't explicitly requested — can be added later if wanted).
- An aggregate KPI strip beyond the existing per-column counts (explicitly declined).
- Fixing `forwardRef` on the other 12 `ui/` primitives (tracked separately).
- Any change to the underlying state machine, audit logging, or approval-routing logic from Tasks 1.2/1.4 — this task is UI/CRUD-surface work built on top of that, not a change to it.

## Design

### 1. Bug fix: `src/components/ui/card.tsx`

Wrap `Card` in `React.forwardRef<HTMLDivElement, React.ComponentProps<"div"> & { size?: "default" | "sm" }>`, forwarding the ref to the root `<div>`, keeping `displayName = "Card"` set. No behavior change otherwise — purely makes refs work. Verify `ContratCard.tsx`'s existing `ref={setNodeRef}` usage now actually functions (this is the acceptance test for this part: drag must work end-to-end after this fix, verified manually since dnd-kit interactions are hard to simulate in this project's automated browser tooling — flag to the user for a manual click-test before considering this task done, not just automated tests).

### 2. Create contrat

New component, e.g. `src/components/contrats/ContratCreateForm.tsx`, opened from a "+ Nouveau contrat" button on the `/contrats` page (reuse `src/components/ui/dialog.tsx` or `drawer.tsx` — check which this codebase's other create-flows use, e.g. `ClientForm`/`BillboardForm` if they exist, and match that pattern rather than introducing a third). Fields: client (select, searchable if the existing client list is large — check how other client-pickers in this app are built, e.g. in an existing form), billboard (select), face (FACE_1/FACE_2/BOTH — reuse `FACE_LABELS`), dateDebut, dateFin (optional). Submits to the existing `POST /api/contrats` — no new endpoint needed. On a 202 (requires-approval role), show the same "queued for approval" feedback pattern already established in the Kanban's PATCH handling (toast + no immediate row in the board). On success, add the new contrat into the board's local state (or refetch — implementer's call, consistent with how the existing drag-success path already updates state).

### 3. Delete contrat

**Hard delete (new):**
- New `DELETE /api/contrats/[id]` endpoint. Reject (400, clear message) any contrat whose `statut !== 'DRAFT'`. On a legal delete: capture the full row (plus its `faces`) into an `AuditLog` entry (`action: 'delete'`, `entityType: 'Contrat'`, `entityId`, `oldValues`: the full snapshot, `newValues`: omitted) inside the same transaction as the delete, then perform the delete. No approval-gate check — this is intentionally direct per the design decision (a never-activated draft is low-risk; visibility comes from the audit log, not from gating the action itself).
- UI: a delete affordance visible only on `DRAFT` cards (e.g. a small icon button on the card, or an action revealed on hover/menu — implementer's call for the exact placement, but it must be clearly scoped to draft-only, e.g. not rendered at all for other statuses rather than rendered-but-disabled), with a short inline caption/tooltip explaining "Seuls les contrats en brouillon peuvent être supprimés définitivement" (or equivalent) so the constraint is self-explanatory on the page, not just enforced silently by the API.
- Confirm-before-delete: a lightweight confirmation (e.g. a small popover or native-feeling confirm step) is expected before the irreversible action fires — don't wire the button directly to the DELETE call with no confirmation step.

**Soft delete:** already works via drag-to-CANCELLED. No change.

### 4. Filters + search

A bar above the board (search box + filter dropdowns, matching the reference layout: `[Search box] [Filter dropdowns...]`).
- Free-text search: matches `numero` or client name, client-side filter over the already-fetched contrat list (no need for a new API param — the full list is already fetched unfiltered today; simple client-side substring filtering is sufficient at this data scale, avoid over-engineering a server-side search for what's currently a small dataset).
- Client filter: dropdown of existing clients.
- Billboard filter: dropdown of existing billboards (by reference).
- Région / District / Commune filters: cascading or independent dropdowns (implementer's call on whether cascading — e.g. picking a région narrows district options — is worth the complexity now; independent dropdowns are an acceptable simpler start). These require **new** query support: extend `GET /api/contrats` to accept `regionId`/`districtId`/`communeId`, joining through the contrat's `billboard` relation (`billboard.regionId`/`districtId`/`communeId`) — add these as Prisma `where` filters via the relation, not a new client-side-only filter, since region/district/commune data isn't necessarily all loaded client-side today.
- Column counts naturally reflect whatever subset is currently filtered/searched — no separate KPI strip.

### 5. Visual redesign

- **Columns:** fixed width, full viewport height (within the content area — accounting for whatever header/breadcrumb sits above it after the sidebar-nav work), internal vertical scroll for the card list when a column overflows — the page itself must not grow taller than the viewport.
- **Column background:** a light tint per status (e.g. muted red/yellow/green/gray-family, one per `ContratStatus`) — pick tokens consistent with this app's existing color system (check `src/components/ui/badge.tsx`'s existing status-color variants — `available`/`rented`/`expiring`/`maintenance` — for the established palette approach, and extend similarly rather than inventing new ad hoc colors).
- **Column header:** status label + colored pill/dot + count badge (as today, restyled to match the new column background).
- **Card:** numero as a bold title, client name as a subtitle/description line, a small metadata pill for face + the date range (as today), plus a colored left accent bar matching the column's status color. Keep using `Card`/`Badge` from `ui/` (now fixed for refs) rather than reverting to raw divs.
- Any new shadcn primitives needed for this (e.g. `tooltip` for the delete-caption, `popover` for delete-confirmation, `command`/`combobox` for searchable selects in the create form) should be pulled in via `npx shadcn@latest add <component>` — the project's `components.json` is already configured, so use `add`, not `init` (which would overwrite that config).

## Testing

- Unit/component tests for: `ContratCreateForm` (submits correct payload, handles 202/400/409), the DELETE endpoint (rejects non-DRAFT with 400, audits + deletes a DRAFT contrat correctly, confirms no approval-gate check), the new region/district/commune query filtering on `GET /api/contrats`, and the client-side search/filter logic (pure function, testable in isolation like `handlePatchResponse`).
- The drag-and-drop fix itself cannot be meaningfully asserted by an automated test in this project's tooling (dnd-kit pointer interactions aren't reliably simulable here, confirmed during Task 1.3) — call this out explicitly when reporting done, and ask for a manual verification click-test rather than claiming it's fixed on the strength of automated tests alone.

## Open implementation details (left to implementer)

- Exact placement/trigger for the delete affordance on DRAFT cards (icon button vs. menu).
- Whether région/district/commune filters cascade or are independent.
- Whether the create form uses `dialog.tsx` or `drawer.tsx` — match whatever this codebase's existing create-forms (Client, Billboard) already use.
