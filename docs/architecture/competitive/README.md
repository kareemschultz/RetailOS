# Competitive Intelligence & Feature Parity Program

Per charter §41. **Before architecting any major module**, research the leading products in that domain — to match capability and learn workflows/data-models/permissions/reporting/automation/edge-cases/integrations, **not** to copy UI. Record findings in `docs/architecture/competitive/<module>.md` using the template below.

> **Scope decision (Phase 0):** this program + the template are created now; the **per-module matrices are filled just-in-time** when each module is architected (§41 "before building it"). Required before building: Inventory, POS, Accounting, CRM, Ecommerce, Procurement, Warehousing, Assets, HR.

## Reference products by domain

- **ERP:** Odoo, ERPNext, NetSuite, SAP Business One, Dynamics 365 Business Central, Acumatica.
- **Retail POS:** Lightspeed Retail, Shopify POS, Square for Retail, Vend, Revel, Clover, Toast.
- **Inventory / warehousing:** Cin7, Fishbowl, Zoho Inventory, inFlow, Finale.
- **Accounting:** QuickBooks Online, Xero, Zoho Books, Sage.
- **CRM:** HubSpot, Zoho CRM, Salesforce, Pipedrive.
- **Ecommerce:** Shopify, WooCommerce, BigCommerce.
- **HR:** BambooHR, Deel, Rippling.

## Method (per module)

1. Identify the leading competitors for the module.
2. Capture each one's major features, unique features, strengths, weaknesses, missing opportunities — from **official docs and feature/pricing pages** (live web research; cite sources).
3. Produce the feature matrix + parity checklist + enhancement list.
4. Classify each feature: **P0** mandatory parity · **P1** strongly recommended · **P2** nice to have · **P3** future innovation.

The goal is **parity plus** better UX, offline support, white-labeling, Caribbean localization, and multi-deployment flexibility — not a clone.

## Matrix template (`competitive/<module>.md`)

```markdown
# <Module> — Competitive Analysis

- Date: YYYY-MM-DD · Sources: <official doc/pricing URLs>

## Feature matrix
| Feature | Odoo | ERPNext | NetSuite | Lightspeed | … | RetailOS (Supported/Planned/Not planned) | Priority (P0–P3) |
|---|---|---|---|---|---|---|---|

## Parity checklist (P0/P1)
- [ ] …

## RetailOS enhancements (differentiators)
- Offline-first / Edge Hub; white-label; Caribbean localization (multi-currency, bonded, GRA fiscal); multi-deployment.

## Migration-in requirements (§42)
How customers migrate from this competitor (data export/import mapping).
```
