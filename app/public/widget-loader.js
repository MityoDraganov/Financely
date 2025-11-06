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

  // Widget styles
  const widgetStyles = `
    .financely-widget-container {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      box-sizing: border-box;
    }
    .financely-widget-button {
      position: fixed;
      z-index: 9999;
      border: none;
      border-radius: 50px;
      padding: 16px 24px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .financely-widget-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
    }
    .financely-widget-button.bottom-right {
      bottom: 24px;
      right: 24px;
    }
    .financely-widget-button.bottom-left {
      bottom: 24px;
      left: 24px;
    }
    .financely-widget-button.top-right {
      top: 24px;
      right: 24px;
    }
    .financely-widget-button.top-left {
      top: 24px;
      left: 24px;
    }
    .financely-widget-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: financely-fade-in 0.2s ease;
    }
    .financely-widget-modal-content {
      background: white;
      border-radius: 12px;
      max-width: 500px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: financely-slide-up 0.3s ease;
    }
    .financely-widget-header {
      padding: 24px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .financely-widget-title {
      font-size: 20px;
      font-weight: 600;
      margin: 0;
      color: #111827;
    }
    .financely-widget-close {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #6b7280;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      transition: background 0.2s;
    }
    .financely-widget-close:hover {
      background: #f3f4f6;
    }
    .financely-widget-body {
      padding: 24px;
    }
    .financely-widget-description {
      color: #6b7280;
      font-size: 14px;
      margin-bottom: 20px;
    }
    .financely-widget-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .financely-widget-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .financely-widget-label {
      font-size: 14px;
      font-weight: 500;
      color: #374151;
    }
    .financely-widget-input,
    .financely-widget-textarea {
      padding: 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      transition: border-color 0.2s;
    }
    .financely-widget-input:focus,
    .financely-widget-textarea:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    .financely-widget-textarea {
      min-height: 100px;
      resize: vertical;
    }
    .financely-widget-submit {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      margin-top: 8px;
    }
    .financely-widget-submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .financely-widget-message {
      padding: 12px;
      border-radius: 8px;
      margin-top: 16px;
      font-size: 14px;
    }
    .financely-widget-message.success {
      background: #d1fae5;
      color: #065f46;
      border: 1px solid #a7f3d0;
    }
    .financely-widget-message.error {
      background: #fee2e2;
      color: #991b1b;
      border: 1px solid #fecaca;
    }
    .financely-widget-inline {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
      padding: 24px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .financely-widget-inline-title {
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 8px 0;
      color: #111827;
    }
    .financely-widget-inline-description {
      color: #6b7280;
      font-size: 14px;
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

  // Inject styles
  function injectStyles() {
    if (document.getElementById('financely-widget-styles')) return;
    const style = document.createElement('style');
    style.id = 'financely-widget-styles';
    style.textContent = widgetStyles;
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
  function createWidgetButton(widgetType, widgetConfig, branding) {
    const button = document.createElement('button');
    button.className = `financely-widget-button ${widgetConfig.position || 'bottom-right'}`;
    button.style.backgroundColor = branding.colors.primary;
    button.style.color = 'white';
    button.textContent = widgetConfig.title || 'Contact Us';
    button.onclick = () => openWidget(widgetType, widgetConfig, branding);
    return button;
  }

  // Open widget modal
  function openWidget(widgetType, widgetConfig, branding) {
    const modal = document.createElement('div');
    modal.className = 'financely-widget-modal';
    modal.onclick = (e) => {
      if (e.target === modal) closeWidget(modal);
    };

    const content = document.createElement('div');
    content.className = 'financely-widget-modal-content';

    const header = document.createElement('div');
    header.className = 'financely-widget-header';
    
    const title = document.createElement('h2');
    title.className = 'financely-widget-title';
    title.textContent = widgetConfig.title || 'Contact Us';

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
      desc.textContent = widgetConfig.description;
      body.appendChild(desc);
    }

    const form = createWidgetForm(widgetType, widgetConfig, branding);
    body.appendChild(form);

    content.appendChild(header);
    content.appendChild(body);
    modal.appendChild(content);
    document.body.appendChild(modal);
  }

  // Create widget form
  function createWidgetForm(widgetType, widgetConfig, branding) {
    const form = document.createElement('form');
    form.className = 'financely-widget-form';
    form.onsubmit = async (e) => {
      e.preventDefault();
      await submitForm(widgetType, form, widgetConfig);
    };

    if (widgetType === 'contactForm' && widgetConfig.fields) {
      widgetConfig.fields.forEach(field => {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'financely-widget-field';

        const label = document.createElement('label');
        label.className = 'financely-widget-label';
        label.textContent = field.label + (field.required ? ' *' : '');
        label.setAttribute('for', field.name);

        let input;
        if (field.type === 'textarea') {
          input = document.createElement('textarea');
          input.className = 'financely-widget-textarea';
        } else {
          input = document.createElement('input');
          input.className = 'financely-widget-input';
          input.type = field.type;
        }
        input.id = field.name;
        input.name = field.name;
        input.required = field.required;

        fieldDiv.appendChild(label);
        fieldDiv.appendChild(input);
        form.appendChild(fieldDiv);
      });
    } else {
      // Default fields for invoice/quote requests
      const nameField = createFormField('name', 'Name', 'text', true);
      const emailField = createFormField('email', 'Email', 'email', true);
      const messageField = createFormField('message', 'Message', 'textarea', false);
      form.appendChild(nameField);
      form.appendChild(emailField);
      form.appendChild(messageField);
    }

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'financely-widget-submit';
    submitBtn.style.backgroundColor = branding.colors.primary;
    submitBtn.style.color = 'white';
    submitBtn.textContent = widgetConfig.submitButtonText || 'Submit';
    form.appendChild(submitBtn);

    return form;
  }

  function createFormField(name, label, type, required) {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'financely-widget-field';

    const labelEl = document.createElement('label');
    labelEl.className = 'financely-widget-label';
    labelEl.textContent = label + (required ? ' *' : '');
    labelEl.setAttribute('for', name);

    let input;
    if (type === 'textarea') {
      input = document.createElement('textarea');
      input.className = 'financely-widget-textarea';
    } else {
      input = document.createElement('input');
      input.className = 'financely-widget-input';
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
  async function submitForm(widgetType, form, widgetConfig) {
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    // Remove existing messages
    const existingMessage = form.querySelector('.financely-widget-message');
    if (existingMessage) existingMessage.remove();

    try {
      const formData = new FormData(form);
      const data = {};
      for (const [key, value] of formData.entries()) {
        data[key] = value;
      }

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
      message.textContent = widgetConfig.successMessage || 'Thank you! We\'ll get back to you soon.';
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
      message.textContent = error.message || 'An error occurred. Please try again.';
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
  function createInlineWidget(widgetType, widgetConfig, branding) {
    const placeholder = document.querySelector(`[data-financely-widget="${widgetType}"]`);
    if (!placeholder) {
      console.warn(`Financely Widget: Placeholder element with data-financely-widget="${widgetType}" not found`);
      return;
    }

    const container = document.createElement('div');
    container.className = 'financely-widget-inline';

    const title = document.createElement('h2');
    title.className = 'financely-widget-inline-title';
    title.textContent = widgetConfig.title || 'Contact Us';
    container.appendChild(title);

    if (widgetConfig.description) {
      const desc = document.createElement('p');
      desc.className = 'financely-widget-inline-description';
      desc.textContent = widgetConfig.description;
      container.appendChild(desc);
    }

    const form = createWidgetForm(widgetType, widgetConfig, branding);
    container.appendChild(form);

    // Replace placeholder with the form
    placeholder.parentNode.replaceChild(container, placeholder);
  }

  // Initialize widgets
  async function init() {
    injectStyles();
    const widgetConfig = await loadConfig();
    
    if (!widgetConfig || !widgetConfig.widgets.enabled) {
      return;
    }

    const { widgets, branding } = widgetConfig;

    // Create contact form widget
    if (widgets.contactForm && widgets.contactForm.enabled) {
      const displayMode = widgets.contactForm.displayMode || 'floating';
      if (displayMode === 'inline') {
        createInlineWidget('contactForm', widgets.contactForm, branding);
      } else {
        const button = createWidgetButton('contactForm', widgets.contactForm, branding);
        document.body.appendChild(button);
      }
    }

    // Create invoice request widget
    if (widgets.invoiceRequest && widgets.invoiceRequest.enabled) {
      const button = createWidgetButton('invoiceRequest', widgets.invoiceRequest, branding);
      document.body.appendChild(button);
    }

    // Create quote request widget
    if (widgets.quoteRequest && widgets.quoteRequest.enabled) {
      const button = createWidgetButton('quoteRequest', widgets.quoteRequest, branding);
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

