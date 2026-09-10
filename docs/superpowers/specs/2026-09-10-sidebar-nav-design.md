# Sidebar Navigation — Design

**Date:** 2026-09-10
**Status:** Approved

## Problem

The current top navbar (`src/components/layout/Nav.tsx`) shows every link as full text in a single horizontal row. As more sections get added (Contrats in this sprint, more to come), it doesn't scale, and the user wants a more compact, modern layout: a collapsible icon sidebar with breadcrumbs replacing the navbar's role of "where am I."

## Goals

- Replace the top navbar with a left sidebar, collapsible between icon-only and icon+label modes.
- Desktop-only — no responsive/mobile handling needed (this app is PC-only, confirmed).
- Replace "where am I" wayfinding with per-page breadcrumbs instead of a persistent top bar.
- Remove the page footer.

## Non-goals

- Mobile/responsive sidebar behavior.
- Changing what pages exist or their routes — this is a navigation-chrome change only.

## Design

### Component: `Sidebar.tsx`

Replaces `src/components/layout/Nav.tsx` (delete the old file, or repurpose it — implementer's call, but the public export should be a `Sidebar` component). Client component, using `usePathname()`/`useSession()` as `Nav.tsx` does today.

**State:** a `collapsed: boolean` persisted to `localStorage` (key: `rna-sidebar-collapsed`), **defaulting to `true` (collapsed/icon-only)** for first-time visitors (no stored value). A toggle button switches it instantly, no confirmation needed. Follow this codebase's existing pattern for reading `localStorage` safely (wrap in try/catch per this project's general defensive-storage conventions, or check if a similar pattern already exists elsewhere in the app, e.g. any theme-preference storage) to avoid SSR/hydration mismatches — render collapsed on first paint, sync from storage in a `useEffect`.

**Structure (top → bottom):**
1. Logo (small, links to `/dashboard`) + a collapse/expand toggle button (chevron icon, flips direction based on state).
2. Main nav links: Tableau de bord (`LayoutDashboard`), Vue Globale — Carte + Table (`Map`), Carte interactive (`Globe`), Inventaire (`Package`), Clients (`Users`), Contrats (`FileText`). (Réglages moves to the bottom group below — see note.)
3. A visual divider.
4. A separate bottom group, same icon/label/tooltip behavior as the main group: Notifications (`Bell`, keeping `NotificationBell`'s existing unread-count badge — adapt that component's rendering to fit inline in the rail instead of its current floating top-right position), Réglages (`Settings`, permission-gated exactly as `Nav.tsx` does today via `getPermission(..., 'view_settings')` — this is the "Paramètres" item from the requirements; confirmed via grep there is no separate `/settings`-adjacent route or label called "Paramètres" in the codebase, so it is the same destination as today's "Réglages" link, just relocated to this group, not duplicated), Mon Compte.
5. **Mon Compte** is a dropdown trigger (reuse `src/components/ui/dropdown-menu.tsx`), not a navigation link. Opening it shows the current user's email/role (from session) and a "Se déconnecter" item that calls the existing `signOut({ callbackUrl: '/login' })` logic currently in `Nav.tsx`.

**Collapsed vs. expanded rendering:** icon always visible; label is hidden and shown as a hover tooltip when collapsed, shown inline next to the icon when expanded. Use a simple, accessible tooltip — check whether this codebase already has a tooltip primitive (search `src/components/ui/`); if not, a minimal one is acceptable scope for this task (don't over-build a generic tooltip system beyond what the sidebar needs).

**Active state:** highlight the current route's link, following whatever visual treatment (background/accent bar) is idiomatic for the rest of this app's active-state styling — check how active states are done elsewhere in this design system (e.g. the old `Nav.tsx`'s underline approach doesn't translate to a vertical rail; a left accent bar or background tint is more typical for sidebars) and pick one, consistent with the app's existing color tokens.

### Layout change: `src/app/layout.tsx`

Current structure:
```
<div class="flex min-h-screen flex-col">
  <Nav />
  <main class="flex-1">{children}</main>
  <Footer />
</div>
```

New structure: horizontal split — full-height `Sidebar` on the left, content column (breadcrumbs + `main`) on the right. `Footer` is removed entirely (component can be deleted if nothing else references it — check for other usages first).

### Breadcrumbs: `Breadcrumbs.tsx`

New reusable component in `src/components/layout/`. Rendered at the top of the content area on pages where it's meaningful:
- List pages: 2 levels, e.g. `Accueil > Clients`.
- Detail pages: 3 levels, e.g. `Accueil > Clients > Orange` (using the entity's display name, not its id).

**Applied to:** Dashboard, Clients (list + detail), Contrats, Inventaire/`/database` (+ billboard detail), Réglages/settings.
**Not applied to:** `/map` and `/map/full` (full-canvas map views — a breadcrumb strip would eat into map space without adding value there).

Each non-final segment is a clickable link back to that level; the final segment is plain text (current page).

## Testing

- Component tests for `Sidebar.tsx`: collapsed/expanded rendering toggles labels correctly, active-link highlighting matches `pathname`, `Réglages` link hidden for a role without `view_settings` permission (mirror the existing coverage pattern for `Nav.tsx` if any exists — check `src/components/layout/` for a `Nav.test.tsx`).
- Component tests for `Breadcrumbs.tsx`: renders correct segments for a couple of representative pages/props shapes.
- `localStorage` persistence: mock storage, verify default (collapsed) on empty storage, verify toggle writes and is read back.

## Open implementation details (left to the implementer, not ambiguous enough to block design approval)

- Exact pixel widths for collapsed/expanded states, and transition animation — should feel consistent with this app's existing spacing/transition conventions (check `tailwind-merge`/`class-variance-authority` usage elsewhere for how other transitions are done).
