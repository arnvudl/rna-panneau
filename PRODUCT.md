# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Internal operations team at RNA (a billboard/outdoor-advertising regie in Madagascar), currently fewer than 3 people (confirmed in the 2026-09-08 scoping meeting) — primarily Dirigeant/Admin and Commercial today, with Technicien and Comptable as roles the system supports for when the team grows. Desktop-only usage — no mobile/responsive requirement.

## Product Purpose

Single source of truth for billboard-park operations, replacing a scattered mix of tools. Covers billboard/face inventory, client CRM, contracts, invoicing, and payment/contract-expiration alerting. The concrete business problem it exists to solve: clients sometimes keep a billboard posted past contract end without notifying RNA or paying, and RNA loses revenue because nobody follows up in time. Timely payment relance and contract-expiration follow-up is the most urgent job, not a secondary reporting nicety.

## Positioning

Purpose-built for outdoor-advertising regies, not a generic CRM/ERP retrofitted to the domain. Models the vertical's real concepts directly — individual billboard faces (not just billboards), the external BAT (bon à tirer) email-validation step before printing, per-face tariffs, and a Contrat/BC (bon de commande) distinction — rather than forcing them into generic deal/opportunity records.

## Operating Context

Core workflow: BC signé → contrat created in system → BAT sent to client by email (this step is external/manual; the system only records the send date for audit, it does not manage the email exchange itself) → print launch once validated → install → invoice generated manually by a user (deliberately not automatic) and exported as PDF → payment tracked, with an alert if unpaid past J-15 → contract-end alert before expiry (J-30 to J-45, exact lead time configurable). Roughly 500 billboards currently in the park.

## Capabilities and Constraints

- No 2FA in V2 (small team), but the 2026-09-08 meeting was explicit that **security must be solid regardless** ("il faut sécuriser à fond") — this is a real constraint on how sensitive endpoints/data are handled, not a relaxed one, even though 2FA itself is out of scope.
- Role-based permissions, granular; admin can change other users' rights. Geographic restriction is not needed today, but sensitive/financial actions (deletion, financial data) should be independently configurable/restrictable.
- Audit logging only for sensitive actions (delete, financial actions) — confirmed explicitly, not blanket logging.
- NIF, STAT, RCS, and Carte Fiscale are encrypted at rest; Carte Fiscale is renewed annually (a recurring per-client fact, not a one-time field).
- Standard VAT rate is 20%.
- Desktop-only; no mobile/tablet layout requirement.
- Hosting/running costs must be minimal ("on est des rats" — very budget-conscious on hosting/licensing).
- Target production timeline was under one month from the 2026-09-08 meeting.

## Brand Commitments

Name: "RNA Panneau". Existing logo and a navy-blue primary color are already in production use across the current app (login page, nav) — treat as an established, not-yet-formalized identity to build on, not a blank slate.

## Evidence on Hand

No real customer names, testimonials, or case studies should be used in any surface. Client names currently appearing in dev/seed data (e.g. "Orange Money", "LFL farm shop") are placeholder test fixtures, not real references — do not treat them as evidence or reuse them as if they were real.

## Future Direction (confirmed priorities, not yet built)

From the 2026-09-08 meeting, in priority order: payment relance & contract-expiration follow-up; in-app invoicing; automation (including real AI-driven automation, aspirational); a detailed payment-tracking system; and eventually a whole-company view, not just the billboard park (financial/operational KPIs beyond occupancy). Dashboards are explicitly preferred over written reports (exportable when needed). These are durable direction, not a build queue — do not implement ahead of an explicit task; record concrete feature requests in `docs/IMPLEMENTATION-FINAL.md` when they surface during other work.

## Product Principles

1. Single source of truth over scattered tools — every workflow this product owns should make a separate spreadsheet/tool for that job unnecessary.
2. Preventing revenue leakage is the top business priority: payment relance and contract-expiration follow-up must be impossible to miss, not buried in a general-purpose list.
3. Manual control over automation for financial actions — invoice generation is deliberately a manual, deliberate act by a user, not triggered automatically by contract events.
4. Model the vertical's real objects (faces, BAT, per-face tariffs) rather than generic CRM/ERP abstractions.
5. Confirmed in the 2026-09-08 meeting: this is an **internal tool** for RNA, not built for resale. (A separate in-session remark floated eventual resale to other regies as a loose long-term possibility, framed as a code/architecture concern rather than a design one — but the formal, meeting-confirmed answer is internal-only. Don't invest in generic multi-tenant theming; keep the design coherent and specific to RNA.)

## Accessibility & Inclusion

No accessibility standard has been mandated; small, fixed internal team on desktop is the only confirmed constraint.
