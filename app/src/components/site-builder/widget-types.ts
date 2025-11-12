export type WidgetPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left" | "center";
export type WidgetDisplayMode = "floating" | "inline";
export type WidgetFieldType = "text" | "email" | "tel" | "textarea" | "number" | "select" | "checkbox" | "date";

export interface WidgetStyling {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  errorColor: string;
  successColor: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  padding: string;
  gap: string;
  borderRadius: string;
  buttonPadding: string;
  buttonBorderRadius: string;
  buttonFontWeight: string;
  modalBackdropOpacity: string;
  modalBorderRadius: string;
  modalMaxWidth: string;
  shadow: string;
}

export interface WidgetLocalization {
  defaultLanguage: "en"; // Always English
  languages: Record<string, Record<string, string>>; // language code -> translations
}

export interface BuiltInField {
  enabled: boolean;
  required: boolean;
  label: string;
}

export interface BuiltInFields {
  name: BuiltInField;
  email: BuiltInField;
  phone: BuiltInField;
  company: BuiltInField;
  message: BuiltInField;
}

export interface CustomField {
  id: string;
  name: string;
  label: string;
  type: WidgetFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
  validation?: { min?: number; max?: number; pattern?: string };
  order: number;
}

export interface ContactFormConfig {
  enabled: boolean;
  title: string;
  description: string;
  submitButtonText: string;
  successMessage: string;
  position: WidgetPosition;
  displayMode: WidgetDisplayMode;
}

export interface InvoiceRequestConfig {
  enabled: boolean;
  title: string;
  description: string;
  submitButtonText: string;
  successMessage: string;
  position: WidgetPosition;
}

export interface QuoteRequestConfig {
  enabled: boolean;
  title: string;
  description: string;
  submitButtonText: string;
  successMessage: string;
  position: WidgetPosition;
}
