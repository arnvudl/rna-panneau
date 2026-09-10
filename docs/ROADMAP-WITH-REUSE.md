# RNA Panneau V2 — Roadmap with Code Reuse Strategy

> **Version:** 2.0 (Reuse-Optimized)  
> **Date:** 2026-09-10  
> **Status:** Updated with Automatic_CV + ERPNext/Frappe/Twenty patterns

---

## Executive Summary

**Goal:** Ship Option 3 UI (Hybrid: Tables + Kanban + Polish) in **2-3 months solo + Claude AI**

**Strategy:** Reuse maximum code from:
1. ✅ **Automatic_CV** (Kanban implementation, React patterns)
2. 🔄 **RNA Panneau V1** (Shadcn/ui components, API helpers, auth)
3. 📚 **ERPNext, Frappe CRM, Twenty** (workflow patterns, code examples)

**Not reinventing:** Kanban, form patterns, table layouts, PDF generation, state machine logic

---

## CODE REUSE SOURCES

### Source 1: Automatic_CV (Your Project)

**Reusable Components:**

```
✅ @dnd-kit/core setup (drag-drop foundation)
✅ KanbanBoard.jsx → ContratKanban.tsx (copy + adapt)
✅ KanbanColumn.jsx → ContratColumn.tsx (copy + adapt)
✅ KanbanCard.jsx → ContratCard.tsx (copy + adapt)
✅ Icon.jsx → Reuse as-is
✅ AuthContext pattern → Use NextAuth.js (already in V1)
✅ Toast.jsx → Use Sonner (already in V1)
✅ Dashboard.jsx structure → KPI cards pattern
```

**Adaptation Level:** Low (same React stack, just TypeScript + Shadcn instead of raw JSX)

**Install:**
```bash
npm install @dnd-kit/core @dnd-kit/utilities @dnd-kit/sortable
```

---

### Source 2: RNA Panneau V1 (Existing Codebase)

**Already Exists (Don't Rebuild):**

```
✅ src/components/ui/ (Shadcn components: button, card, dialog, input, table, etc.)
✅ src/lib/auth.ts (NextAuth.js setup + roles)
✅ src/lib/api-helpers.ts (fetch wrappers, error handling)
✅ src/lib/utils.ts (tailwind cn() utility)
✅ src/lib/prisma.ts (Prisma client singleton)
✅ src/components/layout/ (Nav, Footer, RoleGate)
✅ src/lib/pdf-photo.ts (PDF generation pattern → adapt for invoices)
✅ src/lib/notifications.ts (alert system foundation)
✅ Middleware + role-based access control
```

**Just Extend:** Add new models (Contrat, Invoice, Payment) to existing Prisma setup

---

### Source 3: ERPNext (Code Patterns Only)

**Copy These Patterns (Not Code):**

| Pattern | ERPNext Location | RNA Implementation |
|---------|------------------|-------------------|
| **State Machine** | `/erpnext/core/doctype/workflow/` | `src/lib/workflow.ts` (already in plan) |
| **Document Statuses** | Workflow state transitions | Contrat & Invoice statut enums |
| **Audit Logging** | `/erpnext/setup/doctype/audit_log/` | `src/lib/services/auditService.ts` |
| **Invoice Workflow** | `/erpnext/accounts/doctype/sales_invoice/` | `src/lib/services/invoiceService.ts` |
| **Custom Fields** | `/erpnext/core/doctype/custom_field/` | Defer to V2.1 (for MVP, use fixed schema) |
| **Hooks/Automation** | `frappe/app.py` hooks | Next.js API middleware + Bull jobs |

**Copy-Paste Ready:** No (Python ≠ Node.js, but patterns are universal)

---

### Source 4: Frappe CRM (Component Ideas)

**Inspire These:**

| Component | Frappe CRM | RNA MVP |
|-----------|-----------|---------|
| **Kanban Views** | `/crm/fcrm/doctype/crm_lead/` | Use Automatic_CV Kanban directly |
| **SLA Tracking** | `/crm/fcrm/doctype/crm_sla/` | Contrat end-date alerts (J-30) |
| **Activity Feed** | `/crm/fcrm/doctype/crm_activity/` | Defer to V2.1 |
| **Status Badges** | Color-coded workflow | Use Shadcn badge + Tailwind colors |

**Copy-Paste Ready:** No (Frappe framework specific), but component structure is good reference

---

### Source 5: Twenty (Architecture Ideas)

**Inspire This:**

| Pattern | Twenty | RNA |
|---------|--------|-----|
| **Modular Apps** | `/twenty/packages/twenty-server/src/modules/` | Blocks A-F structure (already in plan) |
| **Object Schema** | TypeScript `defineObject()` | Prisma schema (already using) |
| **GraphQL API** | `/twenty/packages/twenty-server/src/engine/` | REST API (simpler for MVP) |
| **Field Types** | Text, Currency, Relation, etc. | Prisma field types + custom validators |

**Copy-Paste Ready:** No (GraphQL architecture, not REST), but organization is solid

---

## UPDATED IMPLEMENTATION ROADMAP (Code-Reuse Optimized)

### Phase 1: Foundation & Kanban (Week 1-2)

#### Task F1: Extend Existing Auth + Add Audit Logging
**Reuse:** `src/lib/auth.ts` (V1 code)  
**Time:** ~1 hour  
**What's New:** Add `AuditLog` Prisma model + `src/lib/services/auditService.ts`

#### Task A1-A2: Database Schema (Billboards + Impressions)
**Reuse:** Existing V1 billboard schema (keep as-is)  
**Time:** ~1 hour  
**What's New:** Add `Impression` tracking fields to faces

#### Task B1-B2: Database Schema (Clients + Contrats)
**Reuse:** Existing V1 client schema (keep as-is)  
**Time:** ~2 hours  
**What's New:** Add `Contrat` + `ContratFace` models with state machine

#### Task B3: Kanban for Contrats (COPY Automatic_CV)
**Reuse:** 
```
src/components/ContratKanban.tsx ← Automatic_CV/KanbanBoard.jsx
src/components/ContratColumn.tsx ← Automatic_CV/KanbanColumn.jsx
src/components/ContratCard.tsx ← Automatic_CV/KanbanCard.jsx
```
**Time:** ~3 hours (copy + TypeScript conversion + adapt for Contrat data)  
**What's New:** Replace "candidate" → "contrat", "stage" → "statut"

#### Task B4: API Routes for Contrats (CRUD + State Transitions)
**Reuse:** `src/lib/api-helpers.ts` pattern  
**Time:** ~2 hours

---

### Phase 2: Invoicing (Week 3)

#### Task C1: Database Schema (Invoice + Lignes)
**Reuse:** Nothing new here  
**Time:** ~1 hour

#### Task C2: PDF Generation Service
**Reuse:** `src/lib/pdf-photo.ts` pattern  
**Time:** ~2 hours (adapt for invoice template)

#### Task C3: Invoice API (CRUD + Generate PDF)
**Reuse:** `src/lib/api-helpers.ts` pattern  
**Time:** ~2 hours

#### Task C4: Invoice UI
**Reuse:** 
```
src/components/table/InvoiceTable.tsx ← BillboardTable pattern
src/components/InvoiceForm.tsx ← ClientForm pattern
src/components/InvoiceDetail.tsx ← custom
```
**Time:** ~3 hours

---

### Phase 3: Alerts & Dashboard (Week 4)

#### Task D1: Alerts (DB + Service)
**Reuse:** `src/lib/notifications.ts` foundation  
**Time:** ~2 hours

#### Task D2: Background Jobs (Bull Queue)
**Reuse:** No existing code, but simple pattern  
**Time:** ~2 hours

#### Task E1: Dashboard (KPIs + Metrics)
**Reuse:** Dashboard.jsx structure from Automatic_CV (adapt)  
**Time:** ~2 hours

#### Task E2: Dashboard UI
**Reuse:** Shadcn card components  
**Time:** ~1.5 hours

---

### Phase 4: Polish & Testing (Week 5)

#### Task F2: Encryption for PII
**Reuse:** Standard crypto patterns  
**Time:** ~1 hour

#### Task F3: End-to-End Testing
**Time:** ~2 hours

#### Task F4: Railway Deployment
**Reuse:** Existing Railway setup (V1)  
**Time:** ~1 hour

---

## TOTAL TIME TO SHIP (Estimation)

### Tasks Breakdown
- **Phase 1** (Foundation + Kanban) : ~11 hours
- **Phase 2** (Invoicing) : ~8 hours
- **Phase 3** (Alerts + Dashboard) : ~7 hours
- **Phase 4** (Polish + Deploy) : ~4 hours

**Total Dev Work:** ~30 hours (solo)

### Real-World Timeline (Solo + Claude AI)

With **AI-assisted implementation** (subagent-driven):
- Parallel code review cycles reduce iteration time
- AI handles boilerplate (CRUD endpoints, tests)
- You focus on business logic + QA

**Timeline with AI:**
- **Best case** (focused, no scope creep): **2 weeks** (10-14 days)
- **Realistic case** (some iteration, refinement): **3 weeks** (21 days)
- **Safe estimate** (feedback loops, polish): **4 weeks** (28 days)

---

## DEPENDENCIES & BLOCKERS

### Must Have (Blocking)
- ✅ Prisma schema finalized (done: business-spec.md)
- ✅ Automatic_CV Kanban code accessible (yes, public GitHub)
- ✅ Existing auth + Shadcn setup in V1 (yes)
- ✅ PostgreSQL on Railway (yes)

### Nice to Have (Non-Blocking)
- Real-time WebSocket alerts (can defer to V2.1)
- Advanced dashboard charts (can defer to V2.1)
- Payment gateway integration (can defer to V2.1)
- Custom fields system (can defer to V2.1)

---

## FINAL BREAKDOWN: "What We're Building"

### What You'll Ship (MVP Option 3)

```
✅ CRM Lean
   - Client list + create/edit
   - Contact management
   - KPI cards (CA, debt, contracts)

✅ Contrats with Kanban
   - Drag-drop between statuses (draft → signed → active → ended)
   - Client + faces + tarif per contract
   - BAT tracking (send date, validation)
   - Workflow buttons (Sign, Activate, End)

✅ Facturation Intégrée
   - Invoice creation (manual)
   - Auto PDF generation + download
   - Invoice list with status (draft, générée, envoyée, payée, impayée)
   - Workflow state transitions

✅ Alertes + Relance
   - Alerts list (fin contrat J-30, paiement impayé J-15)
   - Manual relance button
   - Background job for daily checks

✅ Dashboard
   - KPI cards (occupation %, CA this month, debt, overdue invoices)
   - Invoice due list (next 7 days)
   - Billboards status summary

✅ Auth + Permissions
   - Role-based (Admin, Commercial, Comptable)
   - Audit logs for sensitive actions
   - Encryption for NIF/STAT/RCS
```

### What You're NOT Doing (Defer to V2.1)

```
❌ Advanced Dashboard (charts, analytics)
❌ Custom Fields System
❌ Real-time WebSocket alerts
❌ Activity feed (per client)
❌ Payment gateway (Stripe) integration
❌ Mobile app
❌ Bulk import from Excel
```

---

## NEXT STEPS

1. ✅ **Business Spec** — consolidated (docs/business-spec.md)
2. ✅ **Architecture Spec** — defined (docs/architecture-spec.md)
3. ✅ **Implementation Plan V1** — detailed (docs/superpowers/plans/2026-09-10-rna-v2-implementation.md)
4. 🔄 **Update Plan V2** — THIS FILE (code reuse + timeline)
5. ⏳ **Pending:** ERPNext/Frappe/Twenty findings (agent still running)
6. 📋 **Final Plan** — merge ERPNext patterns once agent completes
7. 🚀 **Execute** — subagent-driven OR inline (you decide)

---

## DECISION POINT

**Ready to:**
- A) Wait for ERPNext/Frappe/Twenty analysis, then finalize plan + launch subagent-driven?
- B) Launch now with current plan + Automatic_CV reuse?
- C) Something else?
