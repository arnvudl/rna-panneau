# Billboard status override — Design

**Context:** Part of the V2 scope (see `docs/superpowers/plans/2026-08-21-v2-panneaux-clients-contrats.md`). `Billboard` status (`AVAILABLE` / `RENTED` / `EXPIRING_SOON` / `EXPIRED` / `MAINTENANCE`) is currently always computed by `deriveBillboardStatus` (`src/lib/status.ts`) from `damaged` and active `Contract` rows — there is no stored status column today.

**Problem:** The client is importing their real billboard inventory without a digitized contract history (no `Contract` rows exist for legacy billboards). Purely automatic derivation would show every legacy billboard as `AVAILABLE`, even when it's actually rented under a paper contract that hasn't been entered into the system yet. An admin needs to be able to set the correct status by hand for these billboards, while new contracts created going forward through the app should keep driving the status automatically, exactly as today.

**Decision (hybrid override):**

- Add a nullable `Billboard.statusOverride` column, using a new Prisma enum `BillboardStatus` (`AVAILABLE`, `RENTED`, `EXPIRING_SOON`, `EXPIRED`, `MAINTENANCE`) mirroring the existing TS union in `src/lib/status.ts`. Default `null`.
- `deriveBillboardStatus` checks `statusOverride` first: if set, that value is returned as-is (contracts and `damaged` are ignored). If `null`, behavior is unchanged — fully automatic, exactly as it works today.
- The billboard detail page gets a "Statut" select, restricted to ADMIN/DEV (same tier as the existing `city`/`dimension`/`sides` restricted fields in `PATCH /api/billboards/[id]`), offering the 5 status values plus an "Automatique" option that clears the override back to `null`.
- Rejected alternative: making status a fully manual field (no automatic derivation at all). Rejected because it would require manually updating status for every future contract lifecycle event, throwing away working automation — the hybrid keeps automation for anything the app itself manages and only requires a manual step for legacy data that predates the app.

**Scope:** Schema + `deriveBillboardStatus` + one restricted PATCH field + one UI control. No approval-flow change (ADMIN/DEV can set this directly, same as other restricted fields) — this is a data-correction tool, not a business action.

**Out of scope:** Backfilling `statusOverride` values for existing seed/import data — that's a data-entry task for the client during rollout, not something this change automates.
