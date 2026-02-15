# Invoice Template Builder - Complete Block Specification

## Architecture Overview

Your builder should support three categories of blocks:

1. **Data Blocks** - Dynamic content populated from invoice data
2. **Layout Blocks** - Structure and organization
3. **Design Blocks** - Static decorative and functional elements

---

## 1. DATA BLOCKS

### 1.1 Company/Sender Block

**Purpose:** Display business information

**Data Properties:**

* `dataSource`: "sender" (fixed)
* `fields`: Array of selected fields
  * Available: logo, companyName, contactName, email, phone, website, address, taxId, registrationNumber

**Layout Properties:**

* `alignment`: left | center | right
* `spacing`: number (gap between fields)
* `layout`: vertical | horizontal | grid

**Typography Properties (per field):**

* `fontFamily`: string
* `fontSize`: number
* `fontWeight`: 100-900
* `lineHeight`: number
* `color`: hex/rgba
* `letterSpacing`: number
* `textTransform`: none | uppercase | lowercase | capitalize

**Design Properties:**

* `logoWidth`: number
* `logoHeight`: number
* `logoPosition`: above | left | right | background
* `backgroundColor`: hex/rgba
* `padding`: {top, right, bottom, left}
* `border`: {width, color, style, radius}
* `shadow`: {x, y, blur, spread, color}

**Conditional Display:**

* `showIf`: condition (e.g., logo exists)
* `hideEmpty`: boolean

---

### 1.2 Customer/Recipient Block

**Purpose:** Display customer/client information

**Data Properties:**

* `dataSource`: "recipient" (fixed)
* `fields`: Array of selected fields
  * Available: companyName, contactName, email, phone, address, taxId, customFields

**Properties:** (Same structure as Company Block)

* Layout Properties
* Typography Properties
* Design Properties
* Conditional Display

**Additional:**

* `labelPrefix`: "Bill To:", "Customer:", "Client:", custom
* `labelStyle`: {...typography properties}

---

### 1.3 Invoice Details Block

**Purpose:** Display invoice metadata

**Data Properties:**

* `fields`: Array of field objects
  ```
  {  key: "invoiceNumber" | "date" | "dueDate" | "poNumber" | "terms" | "customField",  label: string,  format: string (for dates/numbers)}
  ```
* `dateFormat`: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD" | custom

**Layout Properties:**

* `layout`: table | list | grid | inline
* `columns`: number (for grid)
* `labelPosition`: left | top | inline
* `alignment`: left | center | right
* `spacing`: number

**Typography Properties:**

* `labelStyle`: {...typography properties}
* `valueStyle`: {...typography properties}

**Design Properties:**

* `dividerStyle`: none | line | dotted | dashed | custom
* `dividerColor`: hex/rgba
* `backgroundColor`: hex/rgba
* `padding`: {top, right, bottom, left}
* `border`: {width, color, style, radius}
* `rowHoverEffect`: boolean
* `alternateRowBackground`: hex/rgba

---

### 1.4 Line Items Table

**Purpose:** Display itemized list of products/services

**Data Properties:**

* `columns`: Array of column objects
  ```
  {  key: "description" | "quantity" | "rate" | "amount" | "tax" | "discount" | "customField",  label: string,  width: number | "auto" | percentage,  alignment: "left" | "center" | "right",  format: "text" | "number" | "currency" | "percentage"}
  ```
* `currencyFormat`: {symbol, position: "before" | "after", decimals: number}
* `numberFormat`: {decimals, thousandsSeparator, decimalSeparator}

**Layout Properties:**

* `headerPosition`: top | none | floating
* `showFooter`: boolean
* `rowHeight`: "auto" | number
* `columnGap`: number
* `zebra`: boolean (alternating rows)

**Typography Properties:**

* `headerStyle`: {...typography properties}
* `rowStyle`: {...typography properties}
* `footerStyle`: {...typography properties}
* `firstColumnStyle`: {...typography properties} (for emphasis)

**Design Properties:**

* `headerBackground`: hex/rgba
* `rowBackground`: hex/rgba
* `alternateRowBackground`: hex/rgba
* `footerBackground`: hex/rgba
* `borderStyle`: "none" | "rows" | "columns" | "all" | "outer"
* `borderColor`: hex/rgba
* `borderWidth`: number
* `cellPadding`: {top, right, bottom, left}
* `rowHoverEffect`: boolean
* `shadow`: {x, y, blur, spread, color}

**Advanced:**

* `groupBy`: field key (for subtotals)
* `showSubtotals`: boolean
* `subtotalLabel`: string
* `condensedView`: boolean (for long lists)
* `maxRows`: number (before page break)

---

### 1.5 Totals Block

**Purpose:** Display calculation summary

**Data Properties:**

* `items`: Array of total items
  ```
  {  key: "subtotal" | "tax" | "discount" | "shipping" | "total" | "amountPaid" | "amountDue" | "customField",  label: string,  style: "normal" | "emphasized" | "highlighted",  showCurrency: boolean}
  ```
* `currencyFormat`: {symbol, position, decimals}

**Layout Properties:**

* `alignment`: left | right
* `labelWidth`: number | "auto"
* `valueWidth`: number | "auto"
* `spacing`: number (between rows)
* `orientation`: vertical | horizontal

**Typography Properties:**

* `labelStyle`: {...typography properties}
* `valueStyle`: {...typography properties}
* `totalStyle`: {...typography properties} (for emphasized total)

**Design Properties:**

* `backgroundColor`: hex/rgba
* `padding`: {top, right, bottom, left}
* `border`: {width, color, style, radius}
* `dividers`: boolean
* `dividerColor`: hex/rgba
* `highlightRow`: {key: "total", background: hex/rgba, border: {...}}
* `shadow`: {x, y, blur, spread, color}

---

### 1.6 Payment Terms Block

**Purpose:** Display payment instructions and terms

**Data Properties:**

* `dataSource`: "paymentTerms" | "customText"
* `content`: rich text content
* `showBankDetails`: boolean
* `bankFields`: [accountNumber, routingNumber, swiftCode, iban, etc.]
* `showPaymentMethods`: boolean
* `paymentMethods`: [card, bank, check, paypal, etc.]

**Properties:**

* Typography Properties
* Design Properties
* Conditional Display

---

### 1.7 Notes/Terms Block

**Purpose:** Display additional information

**Data Properties:**

* `dataSource`: "notes" | "terms" | "customText"
* `content`: rich text content
* `title`: string
* `showTitle`: boolean

**Typography Properties:**

* `titleStyle`: {...typography properties}
* `contentStyle`: {...typography properties}

**Design Properties:**

* `backgroundColor`: hex/rgba
* `padding`: {top, right, bottom, left}
* `border`: {width, color, style, radius}
* `maxHeight`: number (with scroll)

---

## 2. LAYOUT BLOCKS

### 2.1 Container Block

**Purpose:** Group and organize elements

**Layout Properties:**

* `direction`: row | column
* `justifyContent`: flex-start | center | flex-end | space-between | space-around | space-evenly
* `alignItems`: flex-start | center | flex-end | stretch
* `gap`: number
* `wrap`: wrap | nowrap
* `width`: number | percentage | "full" | "auto"
* `height`: number | "auto"
* `maxWidth`: number
* `minHeight`: number

**Design Properties:**

* `backgroundColor`: hex/rgba
* `padding`: {top, right, bottom, left}
* `margin`: {top, right, bottom, left}
* `border`: {width, color, style, radius}
* `shadow`: {x, y, blur, spread, color}
* `overflow`: visible | hidden | scroll | auto

**Advanced:**

* `breakpoint`: {mobile, tablet, desktop} settings
* `backgroundImage`: url
* `backgroundSize`: cover | contain | custom
* `backgroundPosition`: string
* `clipPath`: string (for custom shapes)

---

### 2.2 Columns Block

**Purpose:** Multi-column layouts

**Layout Properties:**

* `columnCount`: number (2-12)
* `columns`: Array of column objects
  ```
  {  width: number | percentage | "auto" | "fr",  minWidth: number,  alignment: "left" | "center" | "right"}
  ```
* `gap`: number
* `verticalAlign`: top | center | bottom | stretch

**Design Properties:**

* `divider`: boolean
* `dividerColor`: hex/rgba
* `dividerWidth`: number
* `dividerStyle`: solid | dashed | dotted
* `padding`: {top, right, bottom, left}
* `backgroundColor`: hex/rgba

**Advanced:**

* `responsiveStack`: boolean (stack on mobile)
* `stackBreakpoint`: number

---

### 2.3 Spacer Block

**Purpose:** Add vertical/horizontal spacing

**Properties:**

* `height`: number (for vertical)
* `width`: number (for horizontal)
* `responsive`: {mobile, tablet, desktop} values
* `showDivider`: boolean
* `dividerStyle`: {...}

---

### 2.4 Page Break Block

**Purpose:** Control pagination for print/PDF

**Properties:**

* `type`: "always" | "avoid" | "auto"
* `showInEditor`: boolean
* `style`: line | dashed | none

---

## 3. DESIGN BLOCKS

### 3.1 Text Block

**Purpose:** Static or templated text content

**Data Properties:**

* `content`: rich text or template string
* `variables`: support for {{variables}}
* `contentType`: "static" | "dynamic"

**Typography Properties:**

* `fontFamily`: string
* `fontSize`: number
* `fontWeight`: 100-900
* `lineHeight`: number
* `color`: hex/rgba
* `letterSpacing`: number
* `textTransform`: none | uppercase | lowercase | capitalize
* `textDecoration`: none | underline | line-through
* `textAlign`: left | center | right | justify
* `textIndent`: number
* `wordSpacing`: number

**Design Properties:**

* `backgroundColor`: hex/rgba
* `padding`: {top, right, bottom, left}
* `margin`: {top, right, bottom, left}
* `border`: {width, color, style, radius}
* `shadow`: text shadow {x, y, blur, color}
* `width`: number | percentage | "auto"
* `maxWidth`: number

**Rich Text Features:**

* `allowBold`: boolean
* `allowItalic`: boolean
* `allowUnderline`: boolean
* `allowLinks`: boolean
* `allowLists`: boolean
* `allowAlignment`: boolean

---

### 3.2 Image Block

**Purpose:** Static images (logos, decorations)

**Data Properties:**

* `source`: url | upload | dataField
* `alt`: string
* `title`: string

**Layout Properties:**

* `width`: number | percentage | "auto"
* `height`: number | "auto"
* `aspectRatio`: "preserve" | number
* `objectFit`: contain | cover | fill | none | scale-down
* `objectPosition`: string (e.g., "center", "top left")

**Design Properties:**

* `border`: {width, color, style, radius}
* `shadow`: {x, y, blur, spread, color}
* `opacity`: 0-1
* `filter`: {blur, brightness, contrast, grayscale, etc.}
* `padding`: {top, right, bottom, left}
* `margin`: {top, right, bottom, left}

**Advanced:**

* `link`: url
* `overlay`: {color: hex/rgba, opacity: 0-1}
* `shape`: rectangle | circle | custom (clip-path)

---

### 3.3 Divider Block

**Purpose:** Visual separation

**Design Properties:**

* `style`: solid | dashed | dotted | double | groove | ridge
* `width`: number | percentage
* `thickness`: number
* `color`: hex/rgba
* `alignment`: left | center | right
* `margin`: {top, bottom}
* `pattern`: line | wave | zigzag | dots | custom

**Advanced:**

* `gradient`: {start: color, end: color, angle: number}
* `shadow`: {x, y, blur, color}

---

### 3.4 Shape Block

**Purpose:** Decorative geometric elements

**Data Properties:**

* `shape`: rectangle | circle | triangle | polygon | custom
* `points`: number (for polygon)

**Layout Properties:**

* `width`: number
* `height`: number
* `rotation`: number (degrees)
* `position`: absolute | relative

**Design Properties:**

* `fillColor`: hex/rgba
* `borderColor`: hex/rgba
* `borderWidth`: number
* `borderStyle`: solid | dashed | dotted
* `borderRadius`: number (for rectangles)
* `opacity`: 0-1
* `shadow`: {x, y, blur, spread, color}
* `gradient`: {type: linear | radial, colors: [], angle: number}

---

### 3.5 QR Code Block

**Purpose:** Payment or reference QR codes

**Data Properties:**

* `content`: static | dynamic (from invoice data)
* `dataType`: url | text | vcard | payment | custom
* `paymentInfo`: {amount, recipient, reference}

**Layout Properties:**

* `size`: number
* `alignment`: left | center | right

**Design Properties:**

* `foregroundColor`: hex
* `backgroundColor`: hex
* `errorCorrection`: low | medium | high | ultra
* `margin`: number
* `border`: {width, color, style, radius}
* `logo`: {show: boolean, image: url, size: number}

**Advanced:**

* `quietZone`: number
* `moduleShape`: square | circle | rounded

---

### 3.6 Barcode Block

**Purpose:** Invoice number as barcode

**Data Properties:**

* `dataSource`: invoiceNumber | custom
* `format`: CODE128 | CODE39 | EAN13 | UPC | QR

**Layout Properties:**

* `width`: number
* `height`: number
* `alignment`: left | center | right

**Design Properties:**

* `color`: hex
* `backgroundColor`: hex
* `showText`: boolean
* `textPosition`: top | bottom
* `textStyle`: {...typography properties}
* `margin`: {top, right, bottom, left}

---

### 3.7 Signature Block

**Purpose:** Digital or placeholder for physical signature

**Data Properties:**

* `type`: "placeholder" | "image" | "drawn"
* `signatureImage`: url (if type is image)
* `signatureName`: string
* `signatureTitle`: string
* `date`: boolean (show signature date)

**Layout Properties:**

* `width`: number
* `height`: number
* `alignment`: left | center | right

**Design Properties:**

* `borderBottom`: {width, color, style} (signature line)
* `placeholderText`: string
* `placeholderStyle`: {...typography properties}
* `labelPosition`: above | below | inline
* `labelStyle`: {...typography properties}
* `padding`: {top, right, bottom, left}

---

### 3.8 Stamp Block

**Purpose:** "PAID", "OVERDUE", etc. stamps

**Data Properties:**

* `text`: string
* `type`: paid | overdue | draft | void | custom
* `conditional`: {show: boolean, condition: string}

**Design Properties:**

* `shape`: rectangle | circle | badge | custom
* `rotation`: number
* `size`: number
* `fontFamily`: string
* `fontSize`: number
* `fontWeight`: 100-900
* `textColor`: hex/rgba
* `backgroundColor`: hex/rgba
* `border`: {width, color, style}
* `opacity`: 0-1
* `position`: absolute positioning {top, right, bottom, left}

**Advanced:**

* `effect`: stamped | embossed | flat
* `pattern`: diagonal-lines | dots | none

---

### 3.9 Table Block (Static)

**Purpose:** Custom tables beyond line items

**Data Properties:**

* `rows`: number
* `columns`: number
* `content`: 2D array of cell data
* `dataType`: static | repeating

**Layout Properties:**

* `columnWidths`: array of widths
* `rowHeights`: "auto" | array of heights
* `headerRow`: boolean
* `footerRow`: boolean

**Typography Properties:**

* `headerStyle`: {...typography properties}
* `cellStyle`: {...typography properties}
* `footerStyle`: {...typography properties}

**Design Properties:**

* `borderStyle`: "none" | "rows" | "columns" | "all" | "outer"
* `borderColor`: hex/rgba
* `borderWidth`: number
* `cellPadding`: {top, right, bottom, left}
* `headerBackground`: hex/rgba
* `rowBackground`: hex/rgba
* `alternateRowBackground`: hex/rgba
* `zebra`: boolean

---

### 3.10 Icon Block

**Purpose:** Decorative or functional icons

**Data Properties:**

* `icon`: icon name/identifier
* `library`: "fontawesome" | "material" | "custom" | upload

**Layout Properties:**

* `size`: number
* `alignment`: left | center | right

**Design Properties:**

* `color`: hex/rgba
* `backgroundColor`: hex/rgba
* `padding`: number
* `border`: {width, color, style, radius}
* `shape`: none | circle | square | rounded
* `rotation`: number
* `flip`: none | horizontal | vertical | both

**Advanced:**

* `effect`: none | shadow | glow | outline
* `link`: url
* `tooltip`: string

---

## 4. GLOBAL PROPERTIES (Template Level)

### 4.1 Page Settings

```
{
  size: "A4" | "Letter" | "Legal" | "Custom",
  orientation: "portrait" | "landscape",
  margins: {top, right, bottom, left},
  padding: {top, right, bottom, left},
  backgroundColor: hex/rgba,
  backgroundImage: url,
  backgroundOpacity: 0-1
}
```

### 4.2 Theme/Brand Settings

```
{
  primaryColor: hex/rgba,
  secondaryColor: hex/rgba,
  accentColor: hex/rgba,
  textColor: hex/rgba,
  mutedColor: hex/rgba,
  errorColor: hex/rgba,
  successColor: hex/rgba,
  
  primaryFont: string,
  secondaryFont: string,
  monoFont: string,
  
  spacing: {xs, sm, md, lg, xl},
  borderRadius: {sm, md, lg},
  shadowPresets: {...}
}
```

### 4.3 Header/Footer (Repeating Elements)

```
{
  header: {
    enabled: boolean,
    height: number,
    blocks: [...],
    showOnFirstPage: boolean,
    showOnAllPages: boolean
  },
  footer: {
    enabled: boolean,
    height: number,
    blocks: [...],
    showOnFirstPage: boolean,
    showOnAllPages: boolean,
    pageNumbers: {
      enabled: boolean,
      format: "Page {page} of {total}",
      position: "left" | "center" | "right",
      style: {...typography}
    }
  }
}
```

---

## 5. SHARED PROPERTY SYSTEMS

### 5.1 Responsive Design

Every block should support:

```
{
  responsive: {
    mobile: {
      // override any property
      display: "none" | "block" | "flex",
      fontSize: number,
      padding: {...},
      ...
    },
    tablet: {...},
    desktop: {...}
  },
  breakpoints: {
    mobile: 320-768,
    tablet: 769-1024,
    desktop: 1025+
  }
}
```

### 5.2 Conditional Logic

```
{
  conditional: {
    show: boolean,
    condition: {
      field: string,
      operator: "equals" | "not-equals" | "contains" | "greater-than" | "less-than" | "is-empty" | "is-not-empty",
      value: any
    },
    andOr: "and" | "or",
    conditions: [...] // for multiple conditions
  }
}
```

### 5.3 Animation/Transitions (for digital invoices)

```
{
  animation: {
    type: "fade" | "slide" | "scale" | "none",
    duration: number,
    delay: number,
    easing: string
  },
  hover: {
    transform: string,
    backgroundColor: hex/rgba,
    color: hex/rgba,
    shadow: {...},
    transition: {duration, easing}
  }
}
```

### 5.4 Accessibility

```
{
  accessibility: {
    ariaLabel: string,
    ariaDescription: string,
    role: string,
    tabIndex: number,
    focusOutline: {width, color, style, offset}
  }
}
```

### 5.5 Export Options

```
{
  export: {
    print: {
      showInPrint: boolean,
      pageBreak: "auto" | "before" | "after" | "avoid"
    },
    pdf: {
      vectorize: boolean,
      compressImages: boolean,
      embedFonts: boolean
    },
    html: {
      inlineStyles: boolean
    }
  }
}
```

---

## 6. INTERACTION & BEHAVIOR

### 6.1 Block-Level Behaviors

```
{
  draggable: boolean,
  resizable: boolean,
  deletable: boolean,
  duplicatable: boolean,
  lockAspectRatio: boolean,
  
  zIndex: number,
  position: "relative" | "absolute" | "fixed" | "sticky",
  
  transform: {
    translateX: number,
    translateY: number,
    rotate: number,
    scale: number
  }
}
```

### 6.2 Data Binding

```
{
  binding: {
    source: "invoice" | "customer" | "company" | "items" | "custom",
    field: string,
    transform: "uppercase" | "lowercase" | "capitalize" | "currency" | "date" | "custom",
    fallback: string,
    prefix: string,
    suffix: string
  }
}
```

### 6.3 Validation & Errors

```
{
  validation: {
    required: boolean,
    maxLength: number,
    minValue: number,
    maxValue: number,
    pattern: regex,
    custom: function
  },
  errorStyle: {
    borderColor: hex/rgba,
    backgroundColor: hex/rgba,
    showIcon: boolean
  }
}
```

---

## 7. ADVANCED FEATURES

### 7.1 Multi-Language Support

```
{
  localization: {
    field: string,
    translations: {
      en: string,
      es: string,
      fr: string,
      ...
    },
    autoDetect: boolean,
    fallbackLanguage: string
  }
}
```

### 7.2 Variable/Dynamic Content System

Support for template variables:

* `{{invoice.number}}`
* `{{customer.name}}`
* `{{today}}`
* `{{items.count}}`
* `{{total.words}}` (amount in words)
* Custom expressions: `{{total * 0.1}}` for calculations

### 7.3 Custom CSS/Styling

```
{
  customCSS: {
    enabled: boolean,
    classes: string,
    inlineStyles: object,
    important: boolean
  }
}
```

### 7.4 Block Templates/Presets

Allow saving configured blocks as reusable templates:

```
{
  preset: {
    name: string,
    category: string,
    thumbnail: url,
    isPublic: boolean,
    configuration: {...all block properties}
  }
}
```

---

## 8. IMPLEMENTATION RECOMMENDATIONS

### 8.1 Data Structure

```javascript
{
  template: {
    id: string,
    name: string,
    version: number,
    settings: {...globalSettings},
    blocks: [
      {
        id: string,
        type: string,
        properties: {...},
        children: [...] // for nested blocks
      }
    ]
  }
}
```

### 8.2 Property Inheritance

* Children inherit container properties
* Global theme properties cascade down
* Explicit properties override inherited ones

### 8.3 Performance Considerations

* Lazy load heavy blocks (images, QR codes)
* Virtualize long line item tables
* Debounce live preview updates
* Cache rendered blocks

### 8.4 Version Control

* Track template versions
* Allow rollback
* Export/import templates
* Share templates between users

---

## 9. USER EXPERIENCE FEATURES

### 9.1 Smart Defaults

Pre-configure sensible defaults for each block based on common invoice patterns.

### 9.2 Suggestions/AI Assistant

* Suggest layouts based on industry
* Auto-format based on region (US vs EU vs Asia)
* Recommend optimal block arrangements

### 9.3 Validation & Warnings

* Warn if essential elements missing (invoice #, date, totals)
* Flag accessibility issues
* Check print margins
* Validate required legal elements by jurisdiction

### 9.4 Preview Modes

* Desktop preview
* Mobile preview
* Print preview
* PDF preview
* With sample data
* With real data

---

This specification provides a complete foundation for building a professional invoice template builder. The key is maintaining consistency across all blocks while allowing maximum flexibility for users to create unique, branded invoices that meet their specific needs.
