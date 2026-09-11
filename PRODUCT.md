# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Internal operations team at RNA (a billboard/outdoor-advertising regie in Madagascar), currently 2–3 people total, across four roles: Dirigeant/Admin (full access, audit logs, rights management), Commercial (clients, contracts, renewal quotes), Technicien (print tracking, installs, maintenance), Comptable (invoicing, payment tracking, financial reports). Desktop-only usage — no mobile/responsive requirement.

## Product Purpose

Single source of truth for billboard-park operations, replacing a scattered mix of tools. Covers billboard/face inventory, client CRM, contracts, invoicing, and payment/contract-expiration alerting. The concrete business problem it exists to solve: clients sometimes keep a billboard posted past contract end without notifying RNA or paying, and RNA loses revenue because nobody follows up in time. Timely payment relance and contract-expiration follow-up is the most urgent job, not a secondary reporting nicety.

## Positioning

Purpose-built for outdoor-advertising regies, not a generic CRM/ERP retrofitted to the domain. Models the vertical's real concepts directly — individual billboard faces (not just billboards), the external BAT (bon à tirer) email-validation step before printing, per-face tariffs, and a Contrat/BC (bon de commande) distinction — rather than forcing them into generic deal/opportunity records.

## Operating Context

Core workflow: BC signé → contrat created in system → BAT sent to client by email (this step is external/manual; the system only records the send date for audit, it does not manage the email exchange itself) → print launch once validated → install → invoice generated manually by a user (deliberately not automatic) and exported as PDF → payment tracked, with an alert if unpaid past J-15 → contract-end alert before expiry (J-30 to J-45, exact lead time configurable). Roughly 500 billboards currently in the park.

## Capabilities and Constraints

- No 2FA in V2 (small team, explicitly out of scope for now).
- Role-based permissions, granular; optional geographic (region/district) restriction per user.
- Audit logging is mandatory for sensitive actions: delete, invoice edits, payment relance, contract state changes.
- NIF, STAT, RCS, and Carte Fiscale are encrypted at rest.
- Standard VAT rate is 20%.
- Desktop-only; no mobile/tablet layout requirement.

## Brand Commitments

Name: "RNA Panneau". Existing logo and a navy-blue primary color are already in production use across the current app (login page, nav) — treat as an established, not-yet-formalized identity to build on, not a blank slate.

## Evidence on Hand

No real customer names, testimonials, or case studies should be used in any surface. Client names currently appearing in dev/seed data (e.g. "Orange Money", "LFL farm shop") are placeholder test fixtures, not real references — do not treat them as evidence or reuse them as if they were real.

## Product Principles

1. Single source of truth over scattered tools — every workflow this product owns should make a separate spreadsheet/tool for that job unnecessary.
2. Preventing revenue leakage is the top business priority: payment relance and contract-expiration follow-up must be impossible to miss, not buried in a general-purpose list.
3. Manual control over automation for financial actions — invoice generation is deliberately a manual, deliberate act by a user, not triggered automatically by contract events.
4. Model the vertical's real objects (faces, BAT, per-face tariffs) rather than generic CRM/ERP abstractions.
5. The codebase is written with eventual resale/adaptation to other ad regies in mind, but this is a code/architecture concern, not a design one — visual design and page selection are expected to be customized per future client, so don't invest in generic multi-tenant theming now; keep today's design coherent and specific to RNA.

## Accessibility & Inclusion

No accessibility standard has been mandated; small, fixed internal team on desktop is the only confirmed constraint.
