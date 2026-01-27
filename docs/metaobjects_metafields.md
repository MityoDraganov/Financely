Perfect, this is a **core architectural piece** for Financely, so I’ll keep it  **clean, opinionated, and PRD-ready** , not fluffy.

Below is a  **two-layer deliverable** :

1. **Conspect** – short, LLM-optimized conceptual explanation (the “why / what”)
2. **PRD** – concrete product & engineering spec (the “how / where / rules”)

This is written assuming:

* **Multi-tenant orgs**
* **Template-driven system**
* **AI usage**
* **Strong inspiration from Shopify metafields/metaobjects** , but adapted to SaaS reality

---

# 1. CONSPECT

### Financely Metaobjects & Metafields

### What they are (conceptual)

In Financely, **Metafields** and **Metaobjects** form a **flexible, schema-light data layer** that allows records (products, invoices, templates, workflows, etc.) to store **custom, structured, future-proof data** without changing core schemas.

They enable:

* Customization without migrations
* AI-readable context
* Template reusability
* Feature extensibility without tech debt

---

### Metafields (per-record, atomic extensions)

A **metafield** is a  **typed key–value field attached to a single record** .

Think:

> “Extra attributes this specific record needs, but the core model shouldn’t care about.”

Examples:

* Product → `nutrition_table`
* Invoice → `legal_note_footer`
* Proposal → `pricing_strategy`
* Workflow → `retry_policy`

**Key idea**
Metafields are  **record-scoped** ,  **typed** , and  **optional** .

---

### Metaobjects (reusable structured objects)

A **metaobject** is a **first-class structured object** that can be:

* Reused across records
* Referenced by metafields
* Queried independently
* Managed like content

Think:

> “Structured content models that live outside core business entities.”

Examples:

* `TaxRule`
* `BrandBlock`
* `LegalClause`
* `PaymentTerms`
* `ProductBadge`
* `PricingTable`

**Key idea**
Metaobjects are  **shared structures** , not owned by one record.

---

### Relationship between them

* **Metafields can reference Metaobjects**
* Metaobjects are **not embedded copies**
* Changes to a Metaobject propagate everywhere it’s referenced

> This mirrors Shopify’s strongest pattern — and is critical for Financely templates + AI.

---

### Why Financely needs this

Without Metaobjects & Metafields:

* Every customization becomes a schema change
* Templates become brittle
* AI has no structured context
* Marketplace templates cannot be portable
* White-labeling becomes impossible at scale

With them:

* Templates become data-driven
* Marketplace assets become reusable
* AI can reason over structured content
* Features ship faster without migrations

---

# 2. PRD – Financely Metaobjects & Metafields

## 2.1 Goals

### Primary goals

* Allow **safe extensibility** of core entities
* Enable **template-driven rendering**
* Support **AI interpretation & generation**
* Power **Marketplace assets**
* Avoid schema explosion

### Non-goals

* Not a replacement for core fields
* Not a free-form JSON dump
* Not user-defined database tables

---

## 2.2 Core Concepts

### Metafield

| Property         | Description                                           |
| ---------------- | ----------------------------------------------------- |
| `id`           | Unique                                                |
| `ownerType`    | product, invoice, proposal, template, workflow, etc   |
| `ownerId`      | Record ID                                             |
| `namespace`    | Logical grouping (`billing`,`branding`,`legal`) |
| `key`          | Field identifier                                      |
| `type`         | string, number, boolean, json, reference              |
| `value`        | Stored value                                          |
| `definitionId` | Link to metafield definition                          |
| `visibility`   | internal, template, ai                                |
| `createdBy`    | system / user / ai                                    |

---

### Metafield Definition

Defines  **what a metafield is** , not its value.

| Property            | Description               |
| ------------------- | ------------------------- |
| `namespace`       | Group                     |
| `key`             | Unique key                |
| `type`            | Enforced type             |
| `allowedTargets`  | Which entities can use it |
| `validationRules` | Length, range, regex      |
| `aiDescription`   | Semantic meaning for LLMs |
| `uiConfig`        | Input type, labels        |
| `isSystem`        | Locked or editable        |

---

### Metaobject

| Property           | Description                     |
| ------------------ | ------------------------------- |
| `id`             | Unique                          |
| `type`           | e.g.`TaxRule`,`LegalClause` |
| `fields`         | Structured field set            |
| `organizationId` | Owner                           |
| `visibility`     | org / marketplace / system      |
| `version`        | For safe updates                |
| `createdBy`      | system / user                   |

---

### Metaobject Definition

| Property              | Description                       |
| --------------------- | --------------------------------- |
| `type`              | Unique name                       |
| `schema`            | Field definitions                 |
| `allowedReferences` | Which metafields can reference it |
| `aiDescription`     | What this object represents       |
| `uiSchema`          | Editor layout                     |
| `isSystem`          | Locked or extendable              |

---

## 2.3 Supported Field Types

### Metafield types

* `string`
* `number`
* `boolean`
* `enum`
* `rich_text`
* `json`
* `metaobject_reference`
* `metaobject_list`

### Metaobject field types

* Primitive fields
* Nested groups
* Local enums
* Optional AI hints per field

---

## 2.4 Where They Are Used (Critical)

### Products

* Nutrition tables
* Compliance info
* Pricing breakdowns
* Badges & labels

### Invoices

* Legal clauses
* Tax logic
* Footer blocks
* Payment terms

### Proposals

* Offer structures
* Discount logic
* Presentation blocks

### Templates (email, invoice, proposal)

* Dynamic placeholders
* Conditional rendering
* Branding elements
* Legal text injection

### Workflows

* Retry strategies
* Timeouts
* Notification content
* External system mappings

### Marketplace

* Portable templates
* Reusable content blocks
* Versioned assets

---

## 2.5 Rendering & Resolution Rules

### Resolution order

1. Record metafield
2. Referenced metaobject
3. Organization defaults
4. System fallback

### Template usage

Templates never access raw data:

* They access **resolved metafield values**
* Metaobjects are expanded at render time
* AI sees the resolved semantic structure

---

## 2.6 AI Integration (Very Important)

### Why AI needs this

* Predictable structure
* Semantic descriptions
* Safe generation boundaries

### AI uses:

* `aiDescription` from definitions
* Resolved metafield graph
* Metaobject schemas

### AI is allowed to:

* Suggest metafield values
* Create metaobject instances
* Propose new definitions (admin-approved)

---

## 2.7 Permissions & Safety

| Role   | Capabilities          |
| ------ | --------------------- |
| Owner  | Create definitions    |
| Admin  | Manage instances      |
| Editor | Fill values           |
| Viewer | Read only             |
| AI     | Scoped write (opt-in) |

System definitions are:

* Versioned
* Non-destructive
* Backward compatible

---

## 2.8 Storage & Architecture Notes

* Metafields stored **separately from core records**
* Indexed by `(ownerType, ownerId)`
* Metaobjects stored by `(type, organizationId)`
* References are **by ID, not copied**

Firestore-friendly, migration-safe.

---

## 2.9 Success Metrics

* Zero schema migrations for new customization
* Templates portable across orgs
* AI prompt size reduced
* Marketplace assets reusable without editing

---

## Final Mental Model (One-liner)

> **Core models store facts.
> Metafields store context.
> Metaobjects store meaning.**

If you want, next I can:

* Convert this into a **Cursor-ready implementation prompt**
* Design the **admin UI for managing definitions**
* Map this **1:1 to Firestore collections**
* Show **example real objects** (invoice, product, workflow)

Just tell me where you want to go next 👀
