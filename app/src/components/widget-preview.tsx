import React from "react";

interface WidgetStyling {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  errorColor?: string;
  successColor?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  padding?: string;
  gap?: string;
  borderRadius?: string;
  buttonPadding?: string;
  buttonBorderRadius?: string;
  buttonFontWeight?: string;
  modalBackdropOpacity?: string;
  modalBorderRadius?: string;
  modalMaxWidth?: string;
  shadow?: string;
}

interface WidgetConfig {
  title: string;
  description?: string;
  submitButtonText: string;
  successMessage: string;
  builtInFields?: {
    name?: { enabled: boolean; required: boolean; label: string };
    email?: { enabled: boolean; required: boolean; label: string };
    phone?: { enabled: boolean; required: boolean; label: string };
    company?: { enabled: boolean; required: boolean; label: string };
    message?: { enabled: boolean; required: boolean; label: string };
  };
  customFields?: Array<{
    id: string;
    name: string;
    label: string;
    type: "text" | "email" | "tel" | "textarea" | "number" | "select" | "checkbox" | "date";
    required: boolean;
    placeholder?: string;
    options?: string[];
    order: number;
  }>;
}

interface WidgetPreviewProps {
  widgetType: "contactForm" | "invoiceRequest" | "quoteRequest";
  config: WidgetConfig;
  styling: Partial<WidgetStyling>;
}

export function WidgetPreview({ widgetType, config, styling }: WidgetPreviewProps) {
  const defaultStyling: WidgetStyling = {
    primaryColor: "#2563eb",
    secondaryColor: "#6b7280",
    backgroundColor: "#ffffff",
    textColor: "#111827",
    borderColor: "#d1d5db",
    errorColor: "#ef4444",
    successColor: "#10b981",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    fontSize: "14px",
    fontWeight: "400",
    padding: "12px",
    gap: "16px",
    borderRadius: "8px",
    buttonPadding: "12px 24px",
    buttonBorderRadius: "8px",
    buttonFontWeight: "600",
    modalBackdropOpacity: "0.5",
    modalBorderRadius: "12px",
    modalMaxWidth: "500px",
    shadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
  };

  const s = { ...defaultStyling, ...styling };

  const widgetStyles: React.CSSProperties = {
    fontFamily: s.fontFamily,
    fontSize: s.fontSize,
    color: s.textColor,
    backgroundColor: s.backgroundColor,
    padding: s.padding,
    borderRadius: s.modalBorderRadius,
    boxShadow: s.shadow,
    maxWidth: s.modalMaxWidth,
    margin: "0 auto",
  };

  const inputStyles: React.CSSProperties = {
    width: "100%",
    padding: s.padding,
    border: `1px solid ${s.borderColor}`,
    borderRadius: s.borderRadius,
    fontSize: s.fontSize,
    fontFamily: s.fontFamily,
    color: s.textColor,
    backgroundColor: s.backgroundColor,
    marginBottom: s.gap,
    boxSizing: "border-box",
  };

  const buttonStyles: React.CSSProperties = {
    padding: s.buttonPadding,
    border: "none",
    borderRadius: s.buttonBorderRadius,
    fontSize: s.fontSize,
    fontWeight: s.buttonFontWeight,
    fontFamily: s.fontFamily,
    cursor: "pointer",
    backgroundColor: s.primaryColor,
    color: s.backgroundColor,
    width: "100%",
    marginTop: s.gap,
  };

  const labelStyles: React.CSSProperties = {
    display: "block",
    marginBottom: "4px",
    fontSize: s.fontSize,
    fontFamily: s.fontFamily,
    fontWeight: s.fontWeight,
    color: s.textColor,
  };

  const titleStyles: React.CSSProperties = {
    fontSize: "24px",
    fontWeight: s.buttonFontWeight,
    fontFamily: s.fontFamily,
    margin: "0 0 8px 0",
    color: s.textColor,
  };

  const descriptionStyles: React.CSSProperties = {
    color: s.secondaryColor,
    fontSize: s.fontSize,
    fontFamily: s.fontFamily,
    marginBottom: "24px",
  };

  // Build fields for contact form
  const buildContactFormFields = () => {
    const fields: Array<{
      name: string;
      type: string;
      label: string;
      required: boolean;
      placeholder?: string;
      options?: string[];
      order: number;
    }> = [];

    // Add built-in fields
    if (config.builtInFields) {
      const builtInFieldMap: Record<string, { name: string; type: string }> = {
        name: { name: "name", type: "text" },
        email: { name: "email", type: "email" },
        phone: { name: "phone", type: "tel" },
        company: { name: "company", type: "text" },
        message: { name: "message", type: "textarea" },
      };

      Object.entries(config.builtInFields).forEach(([key, fieldConfig]) => {
        if (fieldConfig && fieldConfig.enabled) {
          fields.push({
            ...builtInFieldMap[key],
            label: fieldConfig.label || key,
            required: fieldConfig.required || false,
            placeholder: "",
            order: 0,
          });
        }
      });
    }

    // Add custom fields
    if (config.customFields && Array.isArray(config.customFields)) {
      config.customFields.forEach((field) => {
        fields.push({
          name: field.name,
          type: field.type,
          label: field.label,
          required: field.required || false,
          placeholder: field.placeholder || "",
          options: field.options,
          order: field.order || 0,
        });
      });
    }

    // Sort by order
    fields.sort((a, b) => (a.order || 0) - (b.order || 0));
    return fields;
  };

  const renderField = (field: {
    name: string;
    type: string;
    label: string;
    required: boolean;
    placeholder?: string;
    options?: string[];
  }) => {
    const fieldId = `preview-${field.name}`;

    return (
      <div key={field.name} style={{ marginBottom: s.gap }}>
        <label htmlFor={fieldId} style={labelStyles}>
          {field.label}
          {field.required && <span style={{ color: s.errorColor }}> *</span>}
        </label>
        {field.type === "textarea" ? (
          <textarea
            id={fieldId}
            name={field.name}
            required={field.required}
            placeholder={field.placeholder}
            style={{ ...inputStyles, minHeight: "100px", resize: "vertical" }}
            disabled
          />
        ) : field.type === "select" && field.options ? (
          <select
            id={fieldId}
            name={field.name}
            required={field.required}
            style={inputStyles}
            disabled
          >
            <option value="">{field.placeholder || "Select..."}</option>
            {field.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : field.type === "checkbox" ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              id={fieldId}
              name={field.name}
              type="checkbox"
              required={field.required}
              style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: s.primaryColor }}
              disabled
            />
            <label htmlFor={fieldId} style={{ ...labelStyles, marginBottom: 0, cursor: "pointer" }}>
              {field.placeholder || field.label}
            </label>
          </div>
        ) : (
          <input
            id={fieldId}
            name={field.name}
            type={field.type}
            required={field.required}
            placeholder={field.placeholder}
            style={inputStyles}
            disabled
          />
        )}
      </div>
    );
  };

  return (
    <div style={widgetStyles}>
      <h2 style={titleStyles}>{config.title}</h2>
      {config.description && <p style={descriptionStyles}>{config.description}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
        }}
        style={{ width: "100%" }}
      >
        {widgetType === "contactForm" ? (
          buildContactFormFields().map((field) => renderField(field))
        ) : (
          <>
            {renderField({
              name: "name",
              type: "text",
              label: "Name",
              required: true,
              placeholder: "",
            })}
            {renderField({
              name: "email",
              type: "email",
              label: "Email",
              required: true,
              placeholder: "",
            })}
            {renderField({
              name: "message",
              type: "textarea",
              label: "Message",
              required: false,
              placeholder: "",
            })}
          </>
        )}

        <button type="submit" style={buttonStyles} disabled>
          {config.submitButtonText || "Submit"}
        </button>
      </form>
    </div>
  );
}

