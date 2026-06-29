(function () {
  'use strict';

  var googleAdsId = 'AW-18036940841';
  var googleAnalyticsId = 'G-DMKQ5TY77T';
  var googleTagSrc = 'https://www.googletagmanager.com/gtag/js?id=' + googleAdsId;
  var vercelInsightsSrc = '/_vercel/insights/script.js';
  var loaded = false;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };

  function appendScript(src, options) {
    if (document.querySelector('script[src="' + src + '"]')) {
      return;
    }

    var script = document.createElement('script');
    script.src = src;

    if (options && options.async) {
      script.async = true;
    }

    if (options && options.defer) {
      script.defer = true;
    }

    document.head.appendChild(script);
  }

  function loadAnalytics() {
    if (loaded) {
      return;
    }

    loaded = true;
    appendScript(googleTagSrc, { async: true });
    window.gtag('js', new Date());
    window.gtag('config', googleAdsId);
    window.gtag('config', googleAnalyticsId);
    appendScript(vercelInsightsSrc, { defer: true });
    removeListeners();
  }

  function scheduleLoad() {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(loadAnalytics, { timeout: 3000 });
      return;
    }

    window.setTimeout(loadAnalytics, 2500);
  }

  function removeListeners() {
    events.forEach(function (eventName) {
      window.removeEventListener(eventName, loadAnalytics, listenerOptions);
    });
    document.removeEventListener('visibilitychange', loadOnHide);
  }

  function loadOnHide() {
    if (document.visibilityState === 'hidden') {
      loadAnalytics();
    }
  }

  var events = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
  var listenerOptions = { once: true, passive: true };

  events.forEach(function (eventName) {
    window.addEventListener(eventName, loadAnalytics, listenerOptions);
  });
  document.addEventListener('visibilitychange', loadOnHide);

  scheduleLoad();
})();
