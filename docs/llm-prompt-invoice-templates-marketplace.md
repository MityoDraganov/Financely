# LLM Prompt: Build Invoice Templates for the Marketplace

Use this prompt with an AI to generate invoice templates that can be published to the Financely template marketplace. The AI must output valid **TemplateData** JSON (and optionally marketplace listing metadata).

---

## Your task

Generate one or more **invoice templates** suitable for the template marketplace. Each template must:

1. Be a valid **TemplateData** object (see schema below).
2. Comply with the **required fields** for the chosen region (US, EU, CA, AU, or UK).
3. Fit entirely within the **fixed canvas**: **794px × 1123px** (A4 at 96 DPI).
4. Use **Currency** elements for all monetary values (never Input for money).
5. Include a **productTableConfig** that maps product fields to the items table columns.

Templates are **generic** (no real company data): use placeholder text like "Company Name", "Customer Name", "INV-001". Marketplace users will replace these when they use the template.

---

## Output format

Return **TemplateData** as JSON. Optionally also return marketplace metadata (title, shortDescription, tags, category) for the listing.

### TemplateData schema

```json
{
  "orgId": "<placeholder-or-empty>",
  "name": "Template display name",
  "description": "Optional longer description",
  "pageSize": "A4",
  "brand": {
    "fonts": ["Inter"],
    "colors": { "primary": "#111827", "secondary": "#6b7280", "accent": "#2563eb" },
    "margins": { "top": 40, "right": 40, "bottom": 40, "left": 40 }
  },
  "elements": [ /* array of TemplateElement */ ],
  "status": "draft",
  "compliance": {
    "region": "US",
    "requiredFields": [ "invoiceNumber", "invoiceDate", "seller.name", "seller.address", "customer.name", "items", "total" ],
    "autoFooter": true,
    "complianceValidated": false
  },
  "productTableConfig": {
    "itemsBinding": "items",
    "columnMappings": [ /* see below */ ],
    "autoQuantity": false,
    "defaultQuantity": 1,
    "autoConvertCurrency": true,
    "defaultCurrency": "USD"
  }
}
```

---

## Canvas rules (mandatory)

- **Canvas size**: width = **794**, height = **1123** (A4).
- For **every** element:  
  - `x >= 0`, `y >= 0`  
  - `x + width <= 794`  
  - `y + height <= 1123`
- Recommended margins: 40–60px from edges.  
- Table max width example: if `x = 40`, then `width <= 754` (794 - 40 - 40).

### Layout zones (recommended positions)

Use these ranges so blocks stay inside the canvas and don’t overlap. All coordinates in pixels. Always enforce: `x + width ≤ 794` and `y + height ≤ 1123`.

| Zone | x | y | Max width | Max height / notes |
|------|---|---|-----------|--------------------|
| **Header** (logo, title) | 40–60 | 40–100 | 714 | End by ~y 150 |
| **Seller / From** | 40–60 | 150–250 | ~350 | — |
| **Customer / Bill to** | 400–450 or 40–60 | 150–250 | ~350 | — |
| **Invoice details** (number, date) | 400–450 | 40–150 | 344 (794 − 450) | — |
| **Items table** | 40–60 | 350–450 | **714** (794 − 40 − 40) | Ensure `x + width ≤ 794` |
| **Totals** (subtotal, tax, total) | 500–550 | 600–700 | 244 (794 − 550) | Ensure `x + width ≤ 794` |
| **Footer** (notes, terms) | 40–60 | 950–1050 | 714 | Ensure `y + height ≤ 1123` |

- Margins: keep 40–60px from left/right/top/bottom.
- Spacing: 20–40px between sections, 10–15px between related elements.
- Table: if table `x = 40`, use `width ≤ 714`. Always check `table.x + table.width ≤ 794`.

---

## Element types and usage

| Type     | Use for |
|----------|---------|
| **text** | Labels, headers, static text. Use `binding` for dynamic data (e.g. `seller.name`). |
| **image** | Logo; use `binding` e.g. `seller.logoUrl` or leave `src` as placeholder. |
| **table** | Line items only. **Must** have `itemsBinding: "items"` and columns with bindings like `description`, `quantity`, `unitPrice`, `total`. Price columns **must** be `type: "currency"` with `currency` set. |
| **currency** | All monetary values: total, subtotal, taxTotal, vatTotal, etc. Use `mode: "formula"` and `formula` for calculated fields. |
| **input** | Only for dates (`variant: "date"`) or non-monetary text. **Never** for amounts. |
| **box** | Sections, borders. |
| **line** | Separators; require `x2`, `y2`. |

### Element base (all types)

- `id`: unique string (e.g. `el-invoice-number`, `el-table-items`).
- `type`: one of `"text" | "image" | "table" | "box" | "line" | "input" | "currency"`.
- `x`, `y`, `width`, `height`: numbers; must respect canvas bounds.
- `rotation`, `zIndex`, `visible`: optional (default 0, 0, true).

### Text element

- `text`: default or label text.
- `binding`: optional (e.g. `invoiceNumber`, `seller.name`).
- `typography`: `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`, `color`, `align`, `uppercase`, `lowercase`.
- `format`: `{ "kind": "none" | "currency" | "date", "currency"?: "USD", "dateFormat"?: "YYYY-MM-DD" }`.

### Table element

- `itemsBinding`: **must** be `"items"`.
- `columns`: array of `{ id, header, width, align, type, binding, format?, currency?, calc?, showTotal? }`.
- Price columns: `type: "currency"`, set `currency` (e.g. `"USD"`, `"EUR"`).
- For line total column use `calc`, e.g. `"=quantity * unitPrice"`.

### Currency element

- `binding`: e.g. `total`, `subtotal`, `vatTotal`.
- `currency`: ISO code (USD, EUR, CAD, AUD, GBP by region).
- `mode`: `"independent" | "linked" | "formula"`.
- For calculated fields use `mode: "formula"` and set `formula` (e.g. `"=SUM(items[*].total)"`).

---

## Region-specific required fields

**US**  
Required bindings: `invoiceNumber`, `invoiceDate`, `seller.name`, `seller.address`, `customer.name`, `items`, `total`.  
Currency: USD.

**EU**  
Required bindings: `invoiceNumber`, `invoiceDate`, `supplier.name`, `supplier.address`, `supplier.vatId`, `customer.name`, `customer.address`, `items`, `netAmount`, `vatTotal`, `grossTotal`, `currency`.  
Currency: EUR.

**CA**  
Required bindings: `invoiceNumber`, `invoiceDate`, `seller.name`, `customer.name`, `items`, `total`.  
Currency: CAD.

**AU**  
Required bindings: `invoiceNumber`, `invoiceDate`, `seller.name`, `customer.name`, `items`, `total`.  
Currency: AUD.

**UK**  
Required bindings: `invoiceNumber`, `invoiceDate`, `supplier.name`, `supplier.address`, `supplier.vatId`, `customer.name`, `customer.address`, `items`, `netAmount`, `vatTotal`, `grossTotal`, `currency`.  
Currency: GBP.

You **must** include an element (text, input, or currency as appropriate) for each required binding. Use dot notation for nested data (e.g. `seller.name`, `seller.address`).

---

## Formulas

- Start with `=`.
- **Table column** (e.g. line total): `calc: "=quantity * unitPrice"` (match your column bindings).
- **Subtotal**: `=SUM(items[*].total)` (or your total column binding).
- **VAT/tax** (e.g. EU 20%): `=IF(netAmount > 0, netAmount * 0.20, 0)` (use your actual subtotal/net binding).
- **Total/gross**: `=IF(subtotal > 0, subtotal, IF(netAmount > 0, netAmount, 0)) + IF(vatTotal > 0, vatTotal, IF(taxTotal > 0, taxTotal, 0))` (adapt to your bindings).

Use the **exact** bindings you define in the template (e.g. if your table total column is `lineTotal`, use `SUM(items[*].lineTotal)`).

---

## productTableConfig (required)

Map product entity fields to the items table columns you created.

**Product fields**: `name`, `description`, `price`, `currency`, `sku`, `barcode`, `category`, `taxRate`, `cost`.

Example:

```json
{
  "itemsBinding": "items",
  "columnMappings": [
    { "columnBinding": "description", "productField": "description", "transform": "none", "lockOnProductSelect": true },
    { "columnBinding": "unitPrice", "productField": "price", "transform": "currency_convert", "targetCurrency": "USD", "lockOnProductSelect": true },
    { "columnBinding": "sku", "productField": "sku", "transform": "none", "lockOnProductSelect": true }
  ],
  "autoQuantity": false,
  "defaultQuantity": 1,
  "autoConvertCurrency": true,
  "defaultCurrency": "USD"
}
```

Use your **actual** column bindings and the template’s default currency.

---

## Marketplace listing (optional)

If you also want ready-to-use listing copy, add:

- **title**: Short marketplace title (e.g. "Modern US Invoice").
- **shortDescription**: One line for cards.
- **tags**: e.g. `["invoice", "US", "modern", "business"]`.
- **category**: e.g. `"Business"` or `"Invoicing"`.

---

## Validation checklist before output

1. Every element: `x + width <= 794`, `y + height <= 1123`.
2. All monetary fields use **currency** elements; no monetary **input** elements.
3. Items table has `itemsBinding: "items"`; price columns are `type: "currency"` with `currency` set.
4. Calculated table columns have `calc`; calculated totals use currency elements with `mode: "formula"` and `formula`.
5. Every region required binding has at least one element with that `binding`.
6. `productTableConfig` matches the table columns and includes required column bindings.
7. Template is generic (placeholders only, no real company/customer data).

---

## Example request to the AI

You can pass a request like:

"Using the rules in [this document], generate one invoice template for the **US** region, **modern** style, with a logo placeholder. Return the TemplateData as JSON and optional marketplace title, shortDescription, and tags."

Or:

"Generate **three** marketplace invoice templates: one US (minimal), one EU (professional), one UK (classic). For each, output TemplateData JSON and marketplace metadata (title, shortDescription, tags)."

The AI should respond with valid TemplateData (and optional metadata) that can be imported into the designer and published to the marketplace.
