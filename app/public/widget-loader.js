/**
 * Financely Widget Loader
 * Embeds customizable widgets into any website
 * 
 * Usage:
 * <script src="https://your-domain.com/widget-loader.js" data-org-id="YOUR_ORG_ID" data-api-url="https://us-central1-YOUR_PROJECT.cloudfunctions.net"></script>
 */

(function() {
  'use strict';

  // Configuration
  const config = {
    orgId: null,
    apiUrl: null,
    widgetConfig: null,
  };

  // Get configuration from script tag
  const currentScript = document.currentScript || document.querySelector('script[data-org-id]');
  if (currentScript) {
    config.orgId = currentScript.getAttribute('data-org-id');
    config.apiUrl = currentScript.getAttribute('data-api-url') || 
      currentScript.getAttribute('data-api-base-url') ||
      'https://us-central1-YOUR_PROJECT.cloudfunctions.net';
  }

  if (!config.orgId) {
    console.error('Financely Widget: data-org-id attribute is required');
    return;
  }

  // Generate dynamic styles from configuration for a specific widget
  function generateStyles(widgetType, styling) {
    const defaultStyling = {
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

    const s = styling || defaultStyling;
    const widgetClass = `.financely-widget-${widgetType}`;

    return `
    ${widgetClass} .financely-widget-container {
      font-family: ${s.fontFamily};
      box-sizing: border-box;
    }
    ${widgetClass}.financely-widget-button,
    ${widgetClass} .financely-widget-button {
      position: fixed;
      z-index: 9999;
      border: none;
      border-radius: 50px;
      padding: ${s.buttonPadding};
      font-size: ${s.fontSize};
      font-weight: ${s.buttonFontWeight};
      font-family: ${s.fontFamily};
      cursor: pointer;
      box-shadow: ${s.shadow};
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
      background-color: ${s.primaryColor};
      color: ${s.backgroundColor};
    }
    .financely-widget-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
      opacity: 0.9;
    }
    ${widgetClass}.financely-widget-button.bottom-right,
    ${widgetClass} .financely-widget-button.bottom-right {
      bottom: 24px;
      right: 24px;
    }
    ${widgetClass}.financely-widget-button.bottom-left,
    ${widgetClass} .financely-widget-button.bottom-left {
      bottom: 24px;
      left: 24px;
    }
    ${widgetClass}.financely-widget-button.top-right,
    ${widgetClass} .financely-widget-button.top-right {
      top: 24px;
      right: 24px;
    }
    ${widgetClass}.financely-widget-button.top-left,
    ${widgetClass} .financely-widget-button.top-left {
      top: 24px;
      left: 24px;
    }
    ${widgetClass}.financely-widget-modal,
    ${widgetClass} .financely-widget-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, ${s.modalBackdropOpacity});
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: financely-fade-in 0.2s ease;
    }
    ${widgetClass} .financely-widget-modal-content {
      background: ${s.backgroundColor};
      border-radius: ${s.modalBorderRadius};
      max-width: ${s.modalMaxWidth};
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: financely-slide-up 0.3s ease;
    }
    ${widgetClass} .financely-widget-header {
      padding: ${s.padding};
      border-bottom: 1px solid ${s.borderColor};
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    ${widgetClass} .financely-widget-title {
      font-size: 20px;
      font-weight: ${s.buttonFontWeight};
      font-family: ${s.fontFamily};
      margin: 0;
      color: ${s.textColor};
    }
    ${widgetClass} .financely-widget-close {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: ${s.secondaryColor};
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: ${s.borderRadius};
      transition: background 0.2s;
    }
    ${widgetClass} .financely-widget-close:hover {
      background: ${s.borderColor};
    }
    ${widgetClass} .financely-widget-body {
      padding: ${s.padding};
    }
    ${widgetClass} .financely-widget-description {
      color: ${s.secondaryColor};
      font-size: ${s.fontSize};
      font-family: ${s.fontFamily};
      margin-bottom: 20px;
    }
    ${widgetClass} .financely-widget-form {
      display: flex;
      flex-direction: column;
      gap: ${s.gap};
    }
    ${widgetClass} .financely-widget-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    ${widgetClass} .financely-widget-label {
      font-size: ${s.fontSize};
      font-weight: ${s.fontWeight};
      font-family: ${s.fontFamily};
      color: ${s.textColor};
    }
    ${widgetClass} .financely-widget-input,
    ${widgetClass} .financely-widget-textarea,
    ${widgetClass} .financely-widget-select {
      padding: ${s.padding};
      border: 1px solid ${s.borderColor};
      border-radius: ${s.borderRadius};
      font-size: ${s.fontSize};
      font-family: ${s.fontFamily};
      font-weight: ${s.fontWeight};
      color: ${s.textColor};
      background: ${s.backgroundColor};
      transition: border-color 0.2s;
    }
    ${widgetClass} .financely-widget-input:focus,
    ${widgetClass} .financely-widget-textarea:focus,
    ${widgetClass} .financely-widget-select:focus {
      outline: none;
      border-color: ${s.primaryColor};
      box-shadow: 0 0 0 3px ${s.primaryColor}20;
    }
    ${widgetClass} .financely-widget-checkbox {
      width: 18px;
      height: 18px;
      cursor: pointer;
      accent-color: ${s.primaryColor};
    }
    ${widgetClass} .financely-widget-checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }
    ${widgetClass} .financely-widget-textarea {
      min-height: 100px;
      resize: vertical;
    }
    ${widgetClass} .financely-widget-submit {
      padding: ${s.buttonPadding};
      border: none;
      border-radius: ${s.buttonBorderRadius};
      font-size: ${s.fontSize};
      font-weight: ${s.buttonFontWeight};
      font-family: ${s.fontFamily};
      cursor: pointer;
      transition: all 0.2s;
      margin-top: 8px;
      background-color: ${s.primaryColor};
      color: ${s.backgroundColor};
    }
    ${widgetClass} .financely-widget-submit:hover {
      opacity: 0.9;
    }
    ${widgetClass} .financely-widget-submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    ${widgetClass} .financely-widget-message {
      padding: ${s.padding};
      border-radius: ${s.borderRadius};
      margin-top: ${s.gap};
      font-size: ${s.fontSize};
      font-family: ${s.fontFamily};
    }
    ${widgetClass} .financely-widget-message.success {
      background: ${s.successColor}20;
      color: ${s.successColor};
      border: 1px solid ${s.successColor};
    }
    ${widgetClass} .financely-widget-message.error {
      background: ${s.errorColor}20;
      color: ${s.errorColor};
      border: 1px solid ${s.errorColor};
    }
    ${widgetClass}.financely-widget-inline,
    ${widgetClass} .financely-widget-inline {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
      padding: ${s.padding};
      background: ${s.backgroundColor};
      border-radius: ${s.modalBorderRadius};
      box-shadow: ${s.shadow};
    }
    ${widgetClass} .financely-widget-inline-title {
      font-size: 24px;
      font-weight: ${s.buttonFontWeight};
      font-family: ${s.fontFamily};
      margin: 0 0 8px 0;
      color: ${s.textColor};
    }
    ${widgetClass} .financely-widget-inline-description {
      color: ${s.secondaryColor};
      font-size: ${s.fontSize};
      font-family: ${s.fontFamily};
      margin-bottom: 24px;
    }
    @keyframes financely-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes financely-slide-up {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
  }

  // Translation helper
  function translate(key, translations, defaultValue) {
    if (!translations) return defaultValue;
    return translations[key] || defaultValue;
  }

  // Inject styles for a specific widget
  function injectWidgetStyles(widgetType, styling) {
    const styleId = `financely-widget-styles-${widgetType}`;
    const existingStyle = document.getElementById(styleId);
    const styleContent = generateStyles(widgetType, styling);
    
    if (existingStyle) {
      existingStyle.textContent = styleContent;
      return;
    }
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = styleContent;
    document.head.appendChild(style);
  }

  // Load widget configuration
  async function loadConfig() {
    try {
      const response = await fetch(`${config.apiUrl}/getWidgetConfig?organizationId=${config.orgId}`);
      if (!response.ok) {
        throw new Error(`Failed to load widget config: ${response.status}`);
      }
      const data = await response.json();
      config.widgetConfig = data;
      return data;
    } catch (error) {
      console.error('Financely Widget: Failed to load configuration', error);
      return null;
    }
  }

  // Create widget button
  function createWidgetButton(widgetType, widgetConfig, branding, styling, translations) {
    // Inject widget-specific styles
    injectWidgetStyles(widgetType, styling);
    
    const button = document.createElement('button');
    button.className = `financely-widget-button financely-widget-${widgetType} ${widgetConfig.position || 'bottom-right'}`;
    
    // Use styling if available, otherwise fall back to branding
    const primaryColor = styling?.primaryColor || branding.colors.primary;
    const bgColor = styling?.backgroundColor || '#ffffff';
    
    button.style.backgroundColor = primaryColor;
    button.style.color = bgColor;
    button.textContent = translate('contactUs', translations, widgetConfig.title || 'Contact Us');
    button.onclick = () => openWidget(widgetType, widgetConfig, branding, styling, translations);
    return button;
  }

  // Open widget modal
  function openWidget(widgetType, widgetConfig, branding, styling, translations) {
    // Ensure widget-specific styles are injected
    injectWidgetStyles(widgetType, styling);
    
    const modal = document.createElement('div');
    modal.className = `financely-widget-modal financely-widget-${widgetType}`;
    modal.onclick = (e) => {
      if (e.target === modal) closeWidget(modal);
    };

    // Wrap content in widget-specific container for CSS scoping
    const widgetContainer = document.createElement('div');
    widgetContainer.className = `financely-widget-${widgetType}`;

    const content = document.createElement('div');
    content.className = 'financely-widget-modal-content';

    const header = document.createElement('div');
    header.className = 'financely-widget-header';
    
    const title = document.createElement('h2');
    title.className = 'financely-widget-title';
    title.textContent = translate('contactUs', translations, widgetConfig.title || 'Contact Us');

    const closeBtn = document.createElement('button');
    closeBtn.className = 'financely-widget-close';
    closeBtn.innerHTML = '×';
    closeBtn.onclick = () => closeWidget(modal);

    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'financely-widget-body';

    if (widgetConfig.description) {
      const desc = document.createElement('p');
      desc.className = 'financely-widget-description';
      desc.textContent = translate('description', translations, widgetConfig.description);
      body.appendChild(desc);
    }

    const form = createWidgetForm(widgetType, widgetConfig, branding, styling, translations);
    body.appendChild(form);

    content.appendChild(header);
    content.appendChild(body);
    widgetContainer.appendChild(content);
    modal.appendChild(widgetContainer);
    document.body.appendChild(modal);
  }

  // Create widget form
  function createWidgetForm(widgetType, widgetConfig, branding, styling, translations) {
    const form = document.createElement('form');
    form.className = `financely-widget-form financely-widget-${widgetType}`;
    form.onsubmit = async (e) => {
      e.preventDefault();
      await submitForm(widgetType, form, widgetConfig, translations);
    };

    if (widgetType === 'contactForm') {
      // Build fields from builtInFields and customFields
      const allFields = [];
      
      // Add built-in fields if enabled
      if (widgetConfig.builtInFields) {
        const builtInFieldMap = {
          name: { name: 'name', type: 'text' },
          email: { name: 'email', type: 'email' },
          phone: { name: 'phone', type: 'tel' },
          company: { name: 'company', type: 'text' },
          message: { name: 'message', type: 'textarea' },
        };
        
        Object.entries(widgetConfig.builtInFields).forEach(([key, config]) => {
          if (config && config.enabled) {
            allFields.push({
              ...builtInFieldMap[key],
              label: translate(`${key}Label`, translations, config.label || key),
              required: config.required || false,
              placeholder: translate(`${key}Placeholder`, translations, ''),
              order: 0,
            });
          }
        });
      }
      
      // Add custom fields
      if (widgetConfig.customFields && Array.isArray(widgetConfig.customFields)) {
        widgetConfig.customFields.forEach(field => {
          allFields.push({
            name: field.name,
            type: field.type,
            label: translate(`${field.name}Label`, translations, field.label),
            required: field.required || false,
            placeholder: translate(`${field.name}Placeholder`, translations, field.placeholder || ''),
            options: field.options,
            validation: field.validation,
            order: field.order || 0,
          });
        });
      }
      
      // Sort by order
      allFields.sort((a, b) => (a.order || 0) - (b.order || 0));
      
      // Create form fields
      allFields.forEach(field => {
        const fieldElement = createFormFieldElement(field, translations, widgetType);
        form.appendChild(fieldElement);
      });
    } else {
      // Default fields for invoice/quote requests
      const nameLabel = translate('name', translations, 'Name');
      const emailLabel = translate('email', translations, 'Email');
      const messageLabel = translate('message', translations, 'Message');
      const nameField = createFormField('name', nameLabel, 'text', true, widgetType);
      const emailField = createFormField('email', emailLabel, 'email', true, widgetType);
      const messageField = createFormField('message', messageLabel, 'textarea', false, widgetType);
      form.appendChild(nameField);
      form.appendChild(emailField);
      form.appendChild(messageField);
    }

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = `financely-widget-submit financely-widget-${widgetType}`;
    
    // Use styling if available
    const primaryColor = styling?.primaryColor || branding.colors.primary;
    const bgColor = styling?.backgroundColor || '#ffffff';
    
    submitBtn.style.backgroundColor = primaryColor;
    submitBtn.style.color = bgColor;
    submitBtn.textContent = translate('submitButton', translations, widgetConfig.submitButtonText || 'Submit');
    form.appendChild(submitBtn);

    return form;
  }

  // Create form field element with support for all field types
  function createFormFieldElement(field, translations, widgetType) {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = `financely-widget-field financely-widget-${widgetType}`;

    const label = document.createElement('label');
    label.className = `financely-widget-label financely-widget-${widgetType}`;
    const requiredText = translate('required', translations, '*');
    label.textContent = field.label + (field.required ? ' ' + requiredText : '');
    label.setAttribute('for', field.name);

    let input;
    if (field.type === 'textarea') {
      input = document.createElement('textarea');
      input.className = `financely-widget-textarea financely-widget-${widgetType}`;
      input.rows = 4;
    } else if (field.type === 'select') {
      input = document.createElement('select');
      input.className = `financely-widget-select financely-widget-${widgetType}`;
      if (field.options && Array.isArray(field.options)) {
        field.options.forEach(option => {
          const optionEl = document.createElement('option');
          optionEl.value = option;
          optionEl.textContent = translate(`${field.name}_${option}`, translations, option);
          input.appendChild(optionEl);
        });
      }
    } else if (field.type === 'checkbox') {
      input = document.createElement('input');
      input.className = `financely-widget-checkbox financely-widget-${widgetType}`;
      input.type = 'checkbox';
      input.value = 'true';
      // For checkboxes, wrap label and input together
      const checkboxWrapper = document.createElement('div');
      checkboxWrapper.className = `financely-widget-checkbox-label financely-widget-${widgetType}`;
      label.className = `financely-widget-label financely-widget-${widgetType}`;
      label.style.cursor = 'pointer';
      checkboxWrapper.appendChild(input);
      checkboxWrapper.appendChild(label);
      fieldDiv.innerHTML = '';
      fieldDiv.appendChild(checkboxWrapper);
      return fieldDiv;
    } else if (field.type === 'number') {
      input = document.createElement('input');
      input.className = `financely-widget-input financely-widget-${widgetType}`;
      input.type = 'number';
      if (field.validation) {
        if (field.validation.min !== undefined) input.min = field.validation.min;
        if (field.validation.max !== undefined) input.max = field.validation.max;
      }
    } else if (field.type === 'date') {
      input = document.createElement('input');
      input.className = `financely-widget-input financely-widget-${widgetType}`;
      input.type = 'date';
    } else {
      input = document.createElement('input');
      input.className = `financely-widget-input financely-widget-${widgetType}`;
      input.type = field.type || 'text';
      if (field.validation && field.validation.pattern) {
        input.pattern = field.validation.pattern;
      }
    }
    
    input.id = field.name;
    input.name = field.name;
    input.required = field.required || false;
    if (field.placeholder) {
      input.placeholder = field.placeholder;
    }

    fieldDiv.appendChild(label);
    fieldDiv.appendChild(input);
    return fieldDiv;
  }

  function createFormField(name, label, type, required, widgetType) {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = `financely-widget-field financely-widget-${widgetType}`;

    const labelEl = document.createElement('label');
    labelEl.className = `financely-widget-label financely-widget-${widgetType}`;
    labelEl.textContent = label + (required ? ' *' : '');
    labelEl.setAttribute('for', name);

    let input;
    if (type === 'textarea') {
      input = document.createElement('textarea');
      input.className = `financely-widget-textarea financely-widget-${widgetType}`;
    } else {
      input = document.createElement('input');
      input.className = `financely-widget-input financely-widget-${widgetType}`;
      input.type = type;
    }
    input.id = name;
    input.name = name;
    input.required = required;

    fieldDiv.appendChild(labelEl);
    fieldDiv.appendChild(input);
    return fieldDiv;
  }

  // Submit form
  async function submitForm(widgetType, form, widgetConfig, translations) {
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = translate('submitting', translations, 'Submitting...');

    // Remove existing messages
    const existingMessage = form.querySelector('.financely-widget-message');
    if (existingMessage) existingMessage.remove();

    try {
      const formData = new FormData(form);
      const data = {};
      
      // First, collect all form fields including unchecked checkboxes
      const allInputs = form.querySelectorAll('input, textarea, select');
      allInputs.forEach(input => {
        const name = input.name;
        if (!name) return;
        
        if (input.type === 'checkbox') {
          data[name] = input.checked ? 'true' : 'false';
        } else {
          data[name] = input.value || '';
        }
      });

      const response = await fetch(`${config.apiUrl}/submitWidgetForm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: config.orgId,
          widgetType: widgetType,
          data: data,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit form');
      }

      // Show success message
      const message = document.createElement('div');
      message.className = 'financely-widget-message success';
      const successMsg = translate('successMessage', translations, widgetConfig.successMessage || 'Thank you! We\'ll get back to you soon.');
      message.textContent = successMsg;
      form.appendChild(message);

      // Reset form
      form.reset();

      // Close modal after 2 seconds (only if in modal, not inline)
      const modal = form.closest('.financely-widget-modal');
      if (modal) {
        setTimeout(() => {
          closeWidget(modal);
        }, 2000);
      }
    } catch (error) {
      const message = document.createElement('div');
      message.className = 'financely-widget-message error';
      const errorMsg = translate('errorMessage', translations, error.message || 'An error occurred. Please try again.');
      message.textContent = errorMsg;
      form.appendChild(message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  // Close widget
  function closeWidget(modal) {
    modal.style.animation = 'financely-fade-out 0.2s ease';
    setTimeout(() => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    }, 200);
  }

  // Create inline widget form
  function createInlineWidget(widgetType, widgetConfig, branding, styling, translations) {
    // Inject widget-specific styles
    injectWidgetStyles(widgetType, styling);
    
    const placeholder = document.querySelector(`[data-financely-widget="${widgetType}"]`);
    if (!placeholder) {
      console.warn(`Financely Widget: Placeholder element with data-financely-widget="${widgetType}" not found`);
      return;
    }

    const container = document.createElement('div');
    container.className = `financely-widget-inline financely-widget-${widgetType}`;

    const title = document.createElement('h2');
    title.className = `financely-widget-inline-title financely-widget-${widgetType}`;
    title.textContent = translate('contactUs', translations, widgetConfig.title || 'Contact Us');
    container.appendChild(title);

    if (widgetConfig.description) {
      const desc = document.createElement('p');
      desc.className = `financely-widget-inline-description financely-widget-${widgetType}`;
      desc.textContent = translate('description', translations, widgetConfig.description);
      container.appendChild(desc);
    }

    const form = createWidgetForm(widgetType, widgetConfig, branding, styling, translations);
    container.appendChild(form);

    // Replace placeholder with the form
    placeholder.parentNode.replaceChild(container, placeholder);
  }

  // Build default styling from organization branding
  function buildDefaultStyling(branding) {
    const brandColors = branding?.colors || {};
    return {
      // Colors from organization branding
      primaryColor: brandColors.primary || "#2563eb",
      secondaryColor: brandColors.secondary || "#6b7280",
      backgroundColor: "#ffffff",
      textColor: "#111827",
      borderColor: "#d1d5db",
      errorColor: "#ef4444",
      successColor: brandColors.accent || "#10b981",
      // Typography
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      fontSize: "14px",
      fontWeight: "400",
      // Spacing
      padding: "12px",
      gap: "16px",
      borderRadius: "8px",
      // Button styling
      buttonPadding: "12px 24px",
      buttonBorderRadius: "8px",
      buttonFontWeight: "600",
      // Modal/Container styling
      modalBackdropOpacity: "0.5",
      modalBorderRadius: "12px",
      modalMaxWidth: "500px",
      // Shadow
      shadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    };
  }

  // Merge widget-specific styling with branding defaults
  function mergeStyling(brandingDefaults, widgetSpecificStyling) {
    if (!widgetSpecificStyling) {
      return brandingDefaults;
    }
    // Merge widget-specific styling over branding defaults
    return {
      ...brandingDefaults,
      ...widgetSpecificStyling,
    };
  }

  // Initialize widgets
  async function init() {
    const widgetConfig = await loadConfig();
    
    if (!widgetConfig || !widgetConfig.widgets.enabled) {
      return;
    }

    const { widgets, branding } = widgetConfig;

    // Build default styling from organization branding
    const brandingDefaultStyling = buildDefaultStyling(branding);

    // Create contact form widget with widget-specific styling and localization
    if (widgets.contactForm && widgets.contactForm.enabled) {
      const contactFormStyling = mergeStyling(brandingDefaultStyling, widgets.contactForm.styling);
      const contactFormLocalization = widgets.contactForm.localization || { language: 'en', translations: {} };
      const contactFormTranslations = contactFormLocalization.translations || {};
      
      const displayMode = widgets.contactForm.displayMode || 'floating';
      if (displayMode === 'inline') {
        createInlineWidget('contactForm', widgets.contactForm, branding, contactFormStyling, contactFormTranslations);
      } else {
        const button = createWidgetButton('contactForm', widgets.contactForm, branding, contactFormStyling, contactFormTranslations);
        document.body.appendChild(button);
      }
    }

    // Create invoice request widget with widget-specific styling and localization
    if (widgets.invoiceRequest && widgets.invoiceRequest.enabled) {
      const invoiceRequestStyling = mergeStyling(brandingDefaultStyling, widgets.invoiceRequest.styling);
      const invoiceRequestLocalization = widgets.invoiceRequest.localization || { language: 'en', translations: {} };
      const invoiceRequestTranslations = invoiceRequestLocalization.translations || {};
      
      const button = createWidgetButton('invoiceRequest', widgets.invoiceRequest, branding, invoiceRequestStyling, invoiceRequestTranslations);
      document.body.appendChild(button);
    }

    // Create quote request widget with widget-specific styling and localization
    if (widgets.quoteRequest && widgets.quoteRequest.enabled) {
      const quoteRequestStyling = mergeStyling(brandingDefaultStyling, widgets.quoteRequest.styling);
      const quoteRequestLocalization = widgets.quoteRequest.localization || { language: 'en', translations: {} };
      const quoteRequestTranslations = quoteRequestLocalization.translations || {};
      
      const button = createWidgetButton('quoteRequest', widgets.quoteRequest, branding, quoteRequestStyling, quoteRequestTranslations);
      document.body.appendChild(button);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

