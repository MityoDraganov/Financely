/**
 * Financely Analytics Loader
 * Privacy-compliant, multi-tenant analytics for organization websites
 * 
 * Usage: Injected automatically by site builder when analytics is enabled
 */

(function() {
  'use strict';

  // Configuration from injected script tag
  const config = {
    orgId: null,
    siteId: null,
    brandName: null,
    enabled: false,
    strategy: 'gtag_only',
    gtmContainerId: null,
    ga4MeasurementId: null,
    clarityProjectId: null,
    plausibleDomain: null,
    umamiScriptUrl: null,
    umamiWebsiteId: null,
    consentDefault: 'denied',
    bannerProvider: 'custom',
    enableClarity: false,
    firebaseProjectId: null,
    functionUrl: null,
  };

  // Respect Do Not Track
  if (navigator.doNotTrack === '1') {
    return;
  }

  // Get configuration from script tag
  const currentScript = document.currentScript || document.querySelector('script[data-analytics-org-id]');
  if (currentScript) {
    config.orgId = currentScript.getAttribute('data-analytics-org-id');
    config.siteId = currentScript.getAttribute('data-analytics-site-id') || '';
    config.brandName = currentScript.getAttribute('data-analytics-brand-name') || '';
    config.enabled = currentScript.getAttribute('data-analytics-enabled') === 'true';
    config.strategy = currentScript.getAttribute('data-analytics-strategy') || 'gtag_only';
    config.gtmContainerId = currentScript.getAttribute('data-analytics-gtm-id') || null;
    config.ga4MeasurementId = currentScript.getAttribute('data-analytics-ga4-id') || null;
    config.clarityProjectId = currentScript.getAttribute('data-analytics-clarity-id') || null;
    config.plausibleDomain = currentScript.getAttribute('data-analytics-plausible-domain') || null;
    config.umamiScriptUrl = currentScript.getAttribute('data-analytics-umami-url') || null;
    config.umamiWebsiteId = currentScript.getAttribute('data-analytics-umami-website-id') || null;
    config.consentDefault = currentScript.getAttribute('data-analytics-consent-default') || 'denied';
    config.bannerProvider = currentScript.getAttribute('data-analytics-banner-provider') || 'custom';
    config.enableClarity = currentScript.getAttribute('data-analytics-enable-clarity') === 'true';
    config.firebaseProjectId = currentScript.getAttribute('data-firebase-project') || null;
    config.functionUrl = currentScript.getAttribute('data-analytics-function-url') || null;
  }

  if (!config.enabled || !config.orgId) {
    return;
  }

  // Helper to get URL parameters (define before use)
  function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name) || '';
  }

  // Initialize dataLayer
  window.dataLayer = window.dataLayer || [];
  
  // Push initial dataLayer event with org/site context
  window.dataLayer.push({
    event: 'analytics_init',
    org_id: config.orgId,
    site_id: config.siteId,
    brand_name: config.brandName,
    page_path: window.location.pathname + window.location.search,
    page_title: document.title,
    referrer: document.referrer || '',
    utm_source: getUrlParameter('utm_source'),
    utm_medium: getUrlParameter('utm_medium'),
    utm_campaign: getUrlParameter('utm_campaign'),
    utm_term: getUrlParameter('utm_term'),
    utm_content: getUrlParameter('utm_content'),
  });

  // Initialize GA4 Consent Mode (must be called before loading GA4/GTM)
  function initConsentMode() {
    // Ensure dataLayer exists
    window.dataLayer = window.dataLayer || [];
    
    // Define gtag function if not already defined (needed for consent mode)
    if (typeof window.gtag === 'undefined') {
      window.gtag = function() {
        window.dataLayer.push(arguments);
      };
    }

    // Set default consent state (must be set before GA4/GTM loads)
    window.gtag('consent', 'default', {
      ad_storage: config.consentDefault === 'granted' ? 'granted' : 'denied',
      ad_user_data: config.consentDefault === 'granted' ? 'granted' : 'denied',
      ad_personalization: config.consentDefault === 'granted' ? 'granted' : 'denied',
      analytics_storage: config.consentDefault === 'granted' ? 'granted' : 'denied',
    });
  }

  // Update consent (called when user accepts/rejects)
  window.updateAnalyticsConsent = function(granted) {
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        ad_storage: granted ? 'granted' : 'denied',
        ad_user_data: granted ? 'granted' : 'denied',
        ad_personalization: granted ? 'granted' : 'denied',
        analytics_storage: granted ? 'granted' : 'denied',
      });
    }
    
    // Track consent event
    window.dataLayer.push({
      event: 'consent_update',
      consent_granted: granted,
      org_id: config.orgId,
      site_id: config.siteId,
    });
  };

  // Track page view
  function trackPageView() {
    const pagePath = window.location.pathname + window.location.search;
    const pageTitle = document.title;

    const pageViewData = {
      event: 'page_view',
      page_path: pagePath,
      page_title: pageTitle,
      org_id: config.orgId,
      site_id: config.siteId,
      brand_name: config.brandName,
    };

    window.dataLayer.push(pageViewData);

    // Also send to gtag if using gtag_only strategy (not GTM, which handles it via dataLayer)
    if (config.strategy === 'gtag_only' && typeof window.gtag === 'function' && config.ga4MeasurementId) {
      window.gtag('event', 'page_view', {
        page_path: pagePath,
        page_title: pageTitle,
        org_id: config.orgId,
        site_id: config.siteId,
      });
    }

    // Push to Clarity if enabled
    // Note: Clarity automatically tracks page views, but we can set custom metadata
    if (config.enableClarity && config.clarityProjectId) {
      try {
        // Wait a bit for Clarity to initialize, then set metadata
        // Clarity automatically tracks page views, so we just set custom data
        if (typeof window.clarity === 'function') {
          window.clarity('set', 'page_path', pagePath);
          window.clarity('set', 'page_title', pageTitle);
        } else {
          // Queue the calls if Clarity isn't ready yet
          (window.clarity = window.clarity || function() {
            (window.clarity.q = window.clarity.q || []).push(arguments);
          })('set', 'page_path', pagePath);
          window.clarity('set', 'page_title', pageTitle);
        }
      } catch (error) {
        console.warn('Financely Analytics: Failed to push to Clarity', error);
      }
    }

    // Store page view event for real-time analytics
    storeEvent('page_view', {
      page_path: pagePath,
      page_title: pageTitle,
    });
  }

  // Store event in Firestore for real-time analytics
  async function storeEvent(eventName, eventParams) {
    if (!config.orgId) return;

    try {
      // Use function URL from config if available, otherwise construct it
      let url = config.functionUrl;
      
      if (!url) {
        // Get Firebase project ID from config or infer from domain
        let projectId = config.firebaseProjectId;
        if (!projectId) {
          const hostname = window.location.hostname;
          if (hostname.includes('.web.app') || hostname.includes('.firebaseapp.com')) {
            projectId = hostname.split('.')[0];
          } else {
            // Can't determine project ID, skip storage
            return;
          }
        }
        
        // Try legacy URL format first (for v1 functions or if v2 supports it)
        url = `https://us-central1-${projectId}.cloudfunctions.net/storeAnalyticsEvent`;
      }
      
      // Try the URL, and if it fails with 404, try Cloud Run format
      // Note: Cloud Run URL format is https://{functionName}-{hash}-{region}.a.run.app
      // But we can't predict the hash, so we'll just try the legacy format

      const eventData = {
        orgId: config.orgId,
        event: eventName,
        siteId: config.siteId,
        brandName: config.brandName,
        pagePath: window.location.pathname + window.location.search,
        pageTitle: document.title,
        referrer: document.referrer || '',
        clientId: getClientId(),
        userAgent: navigator.userAgent,
        ...eventParams,
      };

      // Store via Firebase Functions endpoint
      // Use the same pattern as widget-loader.js - simple fetch with CORS handled by Firebase
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) {
        // Log error details for debugging (but don't break the page)
        console.warn('Financely Analytics: Event storage failed', {
          status: response.status,
          statusText: response.statusText,
          url: url,
          event: eventName,
        });
      } else {
        // Success - log in verbose mode only (use debug level)
        console.debug('Financely Analytics: Event stored successfully', eventName);
      }
    } catch (error) {
      // Log error but don't break the page
      console.warn('Financely Analytics: Failed to store event', {
        error: error instanceof Error ? error.message : String(error),
        event: eventName,
        orgId: config.orgId,
        projectId: config.firebaseProjectId || 'inferred',
      });
    }
  }

  // Get or create client ID (for visitor tracking)
  function getClientId() {
    let clientId = localStorage.getItem('analytics_client_id');
    if (!clientId) {
      clientId = 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('analytics_client_id', clientId);
    }
    return clientId;
  }

  // Track custom event
  window.trackAnalyticsEvent = function(eventName, eventParams) {
    const eventData = {
      event: eventName,
      org_id: config.orgId,
      site_id: config.siteId,
      brand_name: config.brandName,
      ...eventParams,
    };

    window.dataLayer.push(eventData);

    // Also send to gtag if using gtag_only strategy (not GTM, which handles it via dataLayer)
    if (config.strategy === 'gtag_only' && typeof window.gtag === 'function' && config.ga4MeasurementId) {
      window.gtag('event', eventName, eventParams);
    }

    // Push to Clarity if enabled
    if (config.enableClarity && config.clarityProjectId) {
      try {
        // Push custom event to Clarity
        if (typeof window.clarity === 'function') {
          window.clarity('event', eventName);
          // Also set event parameters as metadata
          if (eventParams && typeof eventParams === 'object') {
            Object.keys(eventParams).forEach(key => {
              if (eventParams[key] !== null && eventParams[key] !== undefined) {
                window.clarity('set', `event_${key}`, String(eventParams[key]));
              }
            });
          }
        } else {
          // Queue the calls if Clarity isn't ready yet
          (window.clarity = window.clarity || function() {
            (window.clarity.q = window.clarity.q || []).push(arguments);
          })('event', eventName);
          if (eventParams && typeof eventParams === 'object') {
            Object.keys(eventParams).forEach(key => {
              if (eventParams[key] !== null && eventParams[key] !== undefined) {
                window.clarity('set', `event_${key}`, String(eventParams[key]));
              }
            });
          }
        }
      } catch (error) {
        console.warn('Financely Analytics: Failed to push event to Clarity', error);
      }
    }

    // Store event for real-time analytics
    storeEvent(eventName, eventParams);
  };

  // Load Google Tag Manager
  function loadGTM() {
    if (!config.gtmContainerId) {
      console.warn('Financely Analytics: GTM Container ID not provided');
      return;
    }

    console.log('Financely Analytics: Loading GTM container', config.gtmContainerId);

    // GTM script
    const gtmScript = document.createElement('script');
    gtmScript.async = true;
    gtmScript.src = `https://www.googletagmanager.com/gtm.js?id=${config.gtmContainerId}`;
    gtmScript.onerror = function() {
      console.error('Financely Analytics: Failed to load GTM script', config.gtmContainerId);
    };
    gtmScript.onload = function() {
      console.log('Financely Analytics: GTM script loaded successfully', config.gtmContainerId);
      // Verify GTM is actually initialized
      setTimeout(function() {
        if (window.google_tag_manager && window.google_tag_manager[config.gtmContainerId]) {
          console.log('Financely Analytics: GTM container initialized', config.gtmContainerId);
        } else {
          console.warn('Financely Analytics: GTM script loaded but container not initialized yet', config.gtmContainerId);
        }
      }, 1000);
    };
    document.head.appendChild(gtmScript);

    // GTM noscript - wait for body to be available
    const gtmNoscript = document.createElement('noscript');
    gtmNoscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${config.gtmContainerId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
    
    // Insert noscript into body when available
    if (document.body) {
      // Use insertBefore if firstChild exists, otherwise use appendChild
      if (document.body.firstChild) {
        document.body.insertBefore(gtmNoscript, document.body.firstChild);
      } else {
        document.body.appendChild(gtmNoscript);
      }
    } else {
      // Wait for DOMContentLoaded or use document ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
          if (document.body) {
            if (document.body.firstChild) {
              document.body.insertBefore(gtmNoscript, document.body.firstChild);
            } else {
              document.body.appendChild(gtmNoscript);
            }
          }
        });
      } else {
        // DOM already loaded, try to append to documentElement as fallback
        if (document.documentElement) {
          if (document.documentElement.firstChild) {
            document.documentElement.insertBefore(gtmNoscript, document.documentElement.firstChild);
          } else {
            document.documentElement.appendChild(gtmNoscript);
          }
        }
      }
    }
  }

  // Load GA4 (gtag)
  // Official pattern: https://developers.google.com/analytics/devguides/collection/ga4
  function loadGA4() {
    if (!config.ga4MeasurementId) {
      console.warn('Financely Analytics: GA4 Measurement ID not provided');
      return;
    }

    // Ensure dataLayer and gtag are set up (consent mode should have done this, but ensure it)
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag === 'undefined') {
      window.gtag = function() {
        window.dataLayer.push(arguments);
      };
    }

    // Initialize GA4 immediately (official pattern - gtag function queues commands in dataLayer)
    // The actual gtag.js library will process these when it loads
    window.gtag('js', new Date());
    window.gtag('config', config.ga4MeasurementId, {
      anonymize_ip: true,
      send_page_view: false, // We'll track manually for SPA support
    });

    // Load gtag.js script (async)
    const gtagScript = document.createElement('script');
    gtagScript.async = true;
    gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${config.ga4MeasurementId}`;
    
    gtagScript.onerror = function() {
      console.error('Financely Analytics: Failed to load GA4 script', config.ga4MeasurementId);
    };
    
    gtagScript.onload = function() {
      console.log('Financely Analytics: GA4 script loaded successfully', config.ga4MeasurementId);
      // Verify gtag is now the real function (not just our queue)
      if (typeof window.gtag === 'function') {
        // Re-initialize to ensure config is applied after script loads
    window.gtag('config', config.ga4MeasurementId, {
      anonymize_ip: true,
          send_page_view: false,
    });
      }
    };
    
    document.head.appendChild(gtagScript);
    
    console.log('Financely Analytics: GA4 initialized (config queued)', config.ga4MeasurementId);
  }

  // Load Microsoft Clarity
  // Official pattern: https://learn.microsoft.com/en-us/clarity/setup-and-installation/install-clarity
  function loadClarity() {
    if (!config.enableClarity || !config.clarityProjectId) {
      if (config.enableClarity && !config.clarityProjectId) {
        console.warn('Financely Analytics: Clarity enabled but Project ID not provided');
      }
      return;
    }

    // Use official Microsoft Clarity implementation pattern
    // This initializes window.clarity inside the IIFE
    (function(c, l, a, r, i, t, y) {
      c[a] = c[a] || function() { (c[a].q = c[a].q || []).push(arguments) };
      t = l.createElement(r);
      t.async = 1;
      t.src = "https://www.clarity.ms/tag/" + i;
      t.onerror = function() {
        console.error('Financely Analytics: Failed to load Clarity script', i);
      };
      t.onload = function() {
        console.log('Financely Analytics: Clarity script loaded successfully', i);
        // Verify Clarity is working
        if (typeof window.clarity === 'function') {
          console.log('Financely Analytics: Clarity is ready and tracking', i);
        }
      };
      y = l.getElementsByTagName(r)[0];
      if (y && y.parentNode) {
        y.parentNode.insertBefore(t, y);
      } else {
        // Fallback: append to head if no script tag found
        // Clarity should be in <head> for best results
        l.head.appendChild(t);
      }
      console.log('Financely Analytics: Clarity initialized', i);
    })(window, document, "clarity", "script", config.clarityProjectId);
  }

  // Load Plausible
  function loadPlausible() {
    if (!config.plausibleDomain) {
      console.warn('Financely Analytics: Plausible domain not provided');
      return;
    }

    const plausibleScript = document.createElement('script');
    plausibleScript.defer = true;
    plausibleScript.setAttribute('data-domain', config.plausibleDomain);
    plausibleScript.src = 'https://plausible.io/js/script.js';
    plausibleScript.onerror = function() {
      console.error('Financely Analytics: Failed to load Plausible script', config.plausibleDomain);
    };
    plausibleScript.onload = function() {
      console.log('Financely Analytics: Plausible loaded', config.plausibleDomain);
    };
    document.head.appendChild(plausibleScript);
  }

  // Load Umami
  function loadUmami() {
    if (!config.umamiScriptUrl) {
      console.warn('Financely Analytics: Umami script URL not provided');
      return;
    }

    if (!config.umamiWebsiteId) {
      console.warn('Financely Analytics: Umami website ID not provided');
      return;
    }

    const umamiScript = document.createElement('script');
    umamiScript.async = true;
    umamiScript.defer = true;
    umamiScript.src = config.umamiScriptUrl;
    // Use the website ID from config (set in Umami dashboard)
    umamiScript.setAttribute('data-website-id', config.umamiWebsiteId);
    umamiScript.onerror = function() {
      console.error('Financely Analytics: Failed to load Umami script', config.umamiScriptUrl);
    };
    umamiScript.onload = function() {
      console.log('Financely Analytics: Umami loaded', {
        scriptUrl: config.umamiScriptUrl,
        websiteId: config.umamiWebsiteId,
      });
    };
    document.head.appendChild(umamiScript);
  }

  // Log initialization start
  console.log('Financely Analytics: Initializing analytics loader...', {
    strategy: config.strategy,
    orgId: config.orgId,
    siteId: config.siteId,
    enabled: config.enabled,
  });

  // Initialize consent mode first (must be before any GA4/GTM scripts)
  initConsentMode();
  console.log('Financely Analytics: Consent mode initialized', {
    default: config.consentDefault,
  });

  // Load analytics scripts based on strategy
  if (config.strategy === 'gtm' && config.gtmContainerId) {
    // Load GTM (which manages GA4 internally via container configuration)
    // Note: GA4 should be configured inside GTM, not loaded separately
    console.log('Financely Analytics: Using GTM strategy', {
      containerId: config.gtmContainerId,
      ga4MeasurementId: config.ga4MeasurementId || 'Not configured (should be set in GTM)',
    });
    loadGTM();
  } else if (config.strategy === 'gtag_only' && config.ga4MeasurementId) {
    // Load GA4 directly (gtag.js)
    console.log('Financely Analytics: Using gtag_only strategy', {
      measurementId: config.ga4MeasurementId,
    });
    loadGA4();
  } else if (config.strategy === 'plausible' && config.plausibleDomain) {
    // Load Plausible as primary analytics
    console.log('Financely Analytics: Using Plausible strategy', {
      domain: config.plausibleDomain,
    });
    loadPlausible();
  } else if (config.strategy === 'umami' && config.umamiScriptUrl) {
    // Load Umami as primary analytics
    console.log('Financely Analytics: Using Umami strategy', {
      scriptUrl: config.umamiScriptUrl,
    });
    loadUmami();
  } else {
    console.warn('Financely Analytics: No valid strategy configured', {
      strategy: config.strategy,
      gtmContainerId: config.gtmContainerId,
      ga4MeasurementId: config.ga4MeasurementId,
      plausibleDomain: config.plausibleDomain,
      umamiScriptUrl: config.umamiScriptUrl,
    });
  }

  // Load additional services (can be used alongside primary strategy)
  if (config.enableClarity && config.clarityProjectId) {
    console.log('Financely Analytics: Loading Clarity as additional service', {
      projectId: config.clarityProjectId,
    });
    loadClarity();
  }

  // Note: Plausible and Umami are only loaded if they're the primary strategy
  // (handled above). They're not loaded as additional services.

  // Track initial page view
  trackPageView();
  
  console.log('Financely Analytics: Initial page view tracked');

  // Track page views on navigation (for SPAs)
  let lastPath = window.location.pathname;
  const observer = new MutationObserver(function() {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      trackPageView();
    }
  });

  // Observe URL changes (for SPAs using History API)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function() {
    originalPushState.apply(history, arguments);
    setTimeout(trackPageView, 0);
  };

  history.replaceState = function() {
    originalReplaceState.apply(history, arguments);
    setTimeout(trackPageView, 0);
  };

  window.addEventListener('popstate', trackPageView);

  // Analytics Debug Helper (available in console)
  window.checkAnalytics = function() {
    const results = {
      analyticsLoader: {
        found: !!document.querySelector('script[data-analytics-org-id]'),
        script: document.querySelector('script[data-analytics-org-id]'),
      },
      dataLayer: {
        exists: !!window.dataLayer,
        length: window.dataLayer?.length || 0,
        events: window.dataLayer || [],
      },
      gtag: {
        type: typeof window.gtag,
        isFunction: typeof window.gtag === 'function',
      },
      ga4: {
        script: !!document.querySelector('script[src*="googletagmanager.com/gtag/js"]'),
        scriptElement: document.querySelector('script[src*="googletagmanager.com/gtag/js"]'),
        defined: typeof window.gtag !== 'undefined',
        measurementId: (() => {
          const script = document.querySelector('script[src*="googletagmanager.com/gtag/js"]');
          if (script) {
            const match = script.src.match(/id=([^&]+)/);
            return match ? match[1] : null;
          }
          return null;
        })(),
      },
      gtm: {
        script: !!document.querySelector('script[src*="googletagmanager.com/gtm.js"]'),
        scriptElement: document.querySelector('script[src*="googletagmanager.com/gtm.js"]'),
        noscript: !!document.querySelector('noscript iframe[src*="googletagmanager.com/ns.html"]'),
        noscriptElement: document.querySelector('noscript iframe[src*="googletagmanager.com/ns.html"]'),
        global: !!window.google_tag_manager,
        containerId: (() => {
          const script = document.querySelector('script[src*="googletagmanager.com/gtm.js"]');
          if (script) {
            const match = script.src.match(/id=([^&]+)/);
            return match ? match[1] : null;
          }
          return null;
        })(),
      },
      clarity: {
        script: !!document.querySelector('script[src*="clarity.ms/tag/"]'),
        scriptElement: document.querySelector('script[src*="clarity.ms/tag/"]'),
        global: typeof window.clarity !== 'undefined',
        projectId: (() => {
          const script = document.querySelector('script[src*="clarity.ms/tag/"]');
          if (script) {
            const match = script.src.match(/tag\/([^\/]+)/);
            return match ? match[1] : null;
          }
          return null;
        })(),
      },
      plausible: {
        script: !!document.querySelector('script[data-domain]'),
        scriptElement: document.querySelector('script[data-domain]'),
        domain: document.querySelector('script[data-domain]')?.getAttribute('data-domain') || null,
      },
      umami: {
        script: !!document.querySelector('script[data-website-id]'),
        scriptElement: document.querySelector('script[data-website-id]'),
        global: typeof window.umami !== 'undefined',
        websiteId: document.querySelector('script[data-website-id]')?.getAttribute('data-website-id') || null,
        scriptUrl: document.querySelector('script[data-website-id]')?.src || null,
      },
      config: (() => {
        const script = document.querySelector('script[data-analytics-org-id]');
        if (!script) return null;
        return {
          orgId: script.getAttribute('data-analytics-org-id'),
          siteId: script.getAttribute('data-analytics-site-id'),
          brandName: script.getAttribute('data-analytics-brand-name'),
          enabled: script.getAttribute('data-analytics-enabled'),
          strategy: script.getAttribute('data-analytics-strategy'),
          gtmContainerId: script.getAttribute('data-analytics-gtm-id'),
          ga4MeasurementId: script.getAttribute('data-analytics-ga4-id'),
          clarityProjectId: script.getAttribute('data-analytics-clarity-id'),
          plausibleDomain: script.getAttribute('data-analytics-plausible-domain'),
          umamiScriptUrl: script.getAttribute('data-analytics-umami-url'),
          umamiWebsiteId: script.getAttribute('data-analytics-umami-website-id'),
          enableClarity: script.getAttribute('data-analytics-enable-clarity'),
          consentDefault: script.getAttribute('data-analytics-consent-default'),
          bannerProvider: script.getAttribute('data-analytics-banner-provider'),
          firebaseProject: script.getAttribute('data-firebase-project'),
          functionUrl: script.getAttribute('data-analytics-function-url'),
        };
      })(),
    };

    // Print formatted report
    console.log('%c=== ANALYTICS DEBUG REPORT ===', 'font-size: 16px; font-weight: bold; color: #2563eb;');
    
    // Analytics Loader
    console.group('%cAnalytics Loader', 'font-weight: bold;');
    if (results.analyticsLoader.found) {
      console.log('✅ Analytics Loader script found');
      console.log('Config:', results.config);
    } else {
      console.log('❌ Analytics Loader script NOT found');
    }
    console.groupEnd();

    // DataLayer
    console.group('%cDataLayer', 'font-weight: bold;');
    if (results.dataLayer.exists) {
      console.log(`✅ DataLayer exists (${results.dataLayer.length} events)`);
      console.log('Recent events:', results.dataLayer.events.slice(-5));
      console.log('All events:', results.dataLayer.events);
    } else {
      console.log('❌ DataLayer NOT found');
    }
    console.groupEnd();

    // GA4
    console.group('%cGoogle Analytics 4 (GA4)', 'font-weight: bold;');
    if (results.ga4.script) {
      console.log('✅ GA4 script loaded');
      console.log('   Measurement ID:', results.ga4.measurementId);
      console.log('   Script element:', results.ga4.scriptElement);
    } else {
      console.log('❌ GA4 script NOT found');
      if (results.config?.ga4MeasurementId) {
        console.log('   ⚠️  GA4 Measurement ID is configured but script not loaded');
        if (results.config?.strategy === 'gtm') {
          console.log('   💡 Using GTM strategy - GA4 should be configured INSIDE GTM');
          console.log('   📝 Go to GTM → Tags → New → Google Analytics: GA4 Configuration');
          console.log('   📝 Enter Measurement ID:', results.config.ga4MeasurementId);
        }
      }
    }
    if (results.gtag.isFunction) {
      console.log('✅ gtag function is defined');
    } else {
      console.log('❌ gtag function NOT defined');
    }
    console.groupEnd();

    // GTM
    console.group('%cGoogle Tag Manager (GTM)', 'font-weight: bold;');
    if (results.gtm.script) {
      console.log('✅ GTM script loaded');
      console.log('   Container ID:', results.gtm.containerId);
      console.log('   Script element:', results.gtm.scriptElement);
    } else {
      console.log('❌ GTM script NOT found');
      if (results.config?.gtmContainerId) {
        console.log('   ⚠️  GTM Container ID is configured but script not loaded');
      }
    }
    if (results.gtm.noscript) {
      console.log('✅ GTM noscript iframe found');
      console.log('   Noscript element:', results.gtm.noscriptElement);
    } else {
      console.log('❌ GTM noscript iframe NOT found');
    }
    if (results.gtm.global) {
      console.log('✅ GTM global object exists');
      console.log('   google_tag_manager:', window.google_tag_manager);
    } else {
      console.log('❌ GTM global object NOT found');
    }
    console.groupEnd();

    // Clarity
    console.group('%cMicrosoft Clarity', 'font-weight: bold;');
    if (results.clarity.script) {
      console.log('✅ Clarity script loaded');
      console.log('   Project ID:', results.clarity.projectId);
      console.log('   Script element:', results.clarity.scriptElement);
    } else {
      console.log('❌ Clarity script NOT found');
      if (results.config?.enableClarity === 'true' && results.config?.clarityProjectId) {
        console.log('   ⚠️  Clarity is enabled but script not loaded');
      }
    }
    if (results.clarity.global) {
      console.log('✅ Clarity global object exists');
      // Check if Clarity is actively tracking
      if (typeof window.clarity === 'function') {
        try {
          // Try to check Clarity's internal state (if available)
          const clarityState = window.clarity;
          console.log('   Clarity function:', clarityState);
          console.log('   Clarity queue:', window.clarity.q || 'No queue (script loaded)');
          console.log('   💡 Clarity automatically tracks sessions once loaded');
          console.log('   💡 Recordings may take 2-5 minutes to appear in dashboard');
        } catch (e) {
          console.log('   (Could not inspect Clarity state)');
        }
      }
    } else {
      console.log('❌ Clarity global object NOT found');
      console.log('   ⚠️  Clarity may not be initialized correctly');
    }
    console.groupEnd();

    // Plausible
    if (results.config?.plausibleDomain) {
      console.group('%cPlausible Analytics', 'font-weight: bold;');
      if (results.plausible.script) {
        console.log('✅ Plausible script loaded');
        console.log('   Domain:', results.plausible.domain);
      } else {
        console.log('❌ Plausible script NOT found');
      }
      console.groupEnd();
    }

    // Umami
    if (results.config?.umamiScriptUrl) {
      console.group('%cUmami Analytics', 'font-weight: bold;');
      if (results.umami.script) {
        console.log('✅ Umami script loaded');
        console.log('   Website ID:', results.umami.websiteId);
        console.log('   Script URL:', results.umami.scriptUrl);
      } else {
        console.log('❌ Umami script NOT found');
      }
      if (results.umami.global) {
        console.log('✅ Umami global object exists');
      } else {
        console.log('❌ Umami global object NOT found');
      }
      console.groupEnd();
    }

    // Recommendations
    console.group('%cRecommendations', 'font-weight: bold; color: #f59e0b;');
    if (results.config?.strategy === 'gtm' && results.config?.ga4MeasurementId && !results.ga4.script) {
      console.log('💡 You have GTM strategy with GA4 Measurement ID configured.');
      console.log('   GA4 should be configured INSIDE GTM (not loaded separately).');
      console.log('   Steps:');
      console.log('   1. Go to Google Tag Manager');
      console.log('   2. Create a new Tag → Google Analytics: GA4 Configuration');
      console.log('   3. Enter Measurement ID:', results.config.ga4MeasurementId);
      console.log('   4. Set trigger to "All Pages"');
      console.log('   5. Publish the container');
    }
    if (results.config?.strategy === 'gtm' && !results.gtm.script) {
      console.log('⚠️  GTM strategy selected but GTM script not loaded.');
      console.log('   Check if analytics-loader.js is properly injected.');
    }
    if (results.config?.enableClarity === 'true' && !results.clarity.script) {
      console.log('⚠️  Clarity is enabled but script not loaded.');
      console.log('   Check if clarityProjectId is correctly configured.');
    }
    console.groupEnd();

    console.log('%c=== END REPORT ===', 'font-size: 16px; font-weight: bold; color: #2563eb;');
    
    return results;
  };

  // Final initialization log
  console.log('%c✅ Financely Analytics Loader initialized', 'color: #10b981; font-weight: bold; font-size: 14px;');
  console.log('Run checkAnalytics() in console for detailed debug information.');
  console.log('Configuration:', {
    strategy: config.strategy,
    gtmContainerId: config.gtmContainerId || 'Not set',
    ga4MeasurementId: config.ga4MeasurementId || 'Not set',
    clarityEnabled: config.enableClarity,
    clarityProjectId: config.clarityProjectId || 'Not set',
    consentDefault: config.consentDefault,
  });

  // Track common events
  document.addEventListener('click', function(e) {
    const target = e.target;
    if (target.tagName === 'A' || target.closest('a')) {
      const link = target.tagName === 'A' ? target : target.closest('a');
      if (link && link.href) {
        window.trackAnalyticsEvent('link_click', {
          link_url: link.href,
          link_text: link.textContent?.trim() || '',
        });
      }
    }
  });

  // Track form submissions
  document.addEventListener('submit', function(e) {
    const form = e.target;
    if (form.tagName === 'FORM') {
      window.trackAnalyticsEvent('form_submit', {
        form_id: form.id || '',
        form_action: form.action || '',
      });
    }
  });
})();

