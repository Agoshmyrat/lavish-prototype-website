/**
 * Booking form — validates a table request and sends it to the Google Apps Script
 * web app, which writes it into the Google Sheet and emails the restaurant.
 *
 * Settings come from js/config.js. With no sheetEndpoint the form runs in demo mode.
 *
 * Note on delivery: browsers do not let a web page read the reply from a Google Apps
 * Script URL on another domain, so the page sends the request and cannot see the result.
 * The reliable proof of delivery is the new row in the Sheet and the email alert.
 */
(function () {
  'use strict';

  var form = document.getElementById('bookForm');
  if (!form) return;

  var cfg = window.LAVISH_CONFIG;
  if (!cfg) {
    console.error('[Lavish] js/config.js did not load. Check that the file exists and is named exactly config.js.');
    cfg = {};
  }

  var el = {
    name: document.getElementById('name'),
    party: document.getElementById('party'),
    date: document.getElementById('date'),
    time: document.getElementById('time'),
    contact: document.getElementById('contact'),
    trap: document.getElementById('faxOnly'),
    button: document.getElementById('bookBtn'),
    error: document.getElementById('formError'),
    confirm: document.getElementById('formConfirm'),
    confirmText: document.getElementById('confirmText'),
    again: document.getElementById('bookAgain')
  };
  var buttonLabel = el.button.textContent;
  var phone = cfg.phoneDisplay || '';

  function log() {
    if (!cfg.debug || !window.console) return;
    console.log.apply(console, ['[Lavish]'].concat(Array.prototype.slice.call(arguments)));
  }

  /* ---------- helpers ---------- */

  // Today in the visitor's own time zone (YYYY-MM-DD), so past dates cannot be chosen.
  function todayLocal() {
    var d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  function isEmail(value) { return /^[^\s@"']+@[^\s@"']+\.[^\s@"']{2,}$/.test(value); }
  function isPhone(value) { return /^[+\d\s().-]+$/.test(value) && value.replace(/\D/g, '').length >= 7; }

  function showError(message) { el.error.textContent = message; el.error.hidden = false; }
  function clearError() { el.error.textContent = ''; el.error.hidden = true; }

  function setBusy(busy) {
    el.button.disabled = busy;
    el.button.textContent = busy ? 'Sending\u2026' : buttonLabel;
  }

  function showConfirmation(message) {
    el.confirmText.textContent = message;
    form.hidden = true;
    el.confirm.hidden = false;
    el.confirm.focus();
  }

  /* ---------- delivery ---------- */

  function send(payload) {
    if (!cfg.sheetEndpoint) {
      log('Demo mode (no sheetEndpoint in js/config.js). Nothing was sent. Request was:', payload);
      return Promise.resolve('demo');
    }

    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, cfg.requestTimeoutMs || 15000) : null;

    log('Sending to', cfg.sheetEndpoint, payload);

    // "text/plain" + "no-cors" keeps this a simple cross-site request, which Apps Script accepts from any page.
    return fetch(cfg.sheetEndpoint, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined
    }).then(function () {
      clearTimeout(timer);
      return 'sent';
    }, function (error) {
      clearTimeout(timer);
      throw error;
    });
  }

  /* ---------- events ---------- */

  el.date.min = todayLocal();
  el.contact.addEventListener('input', function () { el.contact.setCustomValidity(''); });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    clearError();

    // Spam trap: real visitors never see this field. Pretend it worked and send nothing.
    if (el.trap.value.trim()) {
      showConfirmation('Thank you \u2014 your request has been received.');
      return;
    }

    var contact = el.contact.value.trim();
    if (!isEmail(contact) && !isPhone(contact)) {
      el.contact.setCustomValidity('Please enter a valid phone number or email address.');
      el.contact.reportValidity();
      return;
    }

    var payload = {
      name: el.name.value.trim(),
      guests: el.party.value,
      date: el.date.value,
      time: el.time.value,
      contact: contact
    };

    setBusy(true);
    send(payload).then(function (mode) {
      setBusy(false);
      var firstName = payload.name.split(/\s+/)[0];
      var message;
      if (mode === 'demo') {
        message = 'Thank you \u2014 this is a concept form and doesn\u2019t send live bookings yet. For a real reservation, please call ' + phone + '.';
      } else {
        message = 'Thank you, ' + firstName + ' \u2014 your request has been received. We\u2019ll confirm by phone or email shortly.';
        if (/^10\+/.test(payload.guests)) message += ' For groups of 10 or more, please also call us on ' + phone + '.';
      }
      showConfirmation(message);
    }).catch(function (error) {
      setBusy(false);
      log('Send failed:', error);
      showError('We couldn\u2019t send that just now. Please try again, or call us on ' + phone + '.');
    });
  });

  el.again.addEventListener('click', function () {
    form.reset();
    el.date.min = todayLocal();
    el.confirm.hidden = true;
    form.hidden = false;
    el.name.focus();
  });

  /* ---------- debug: check that the Sheet address answers ---------- */

  if (cfg.debug) {
    log('Booking form ready. Endpoint', cfg.sheetEndpoint ? 'is set.' : 'is EMPTY (demo mode).');
    if (cfg.sheetEndpoint) {
      fetch(cfg.sheetEndpoint + '?action=ping')
        .then(function (response) { return response.json(); })
        .then(function (data) { log('Endpoint reachable \u2713', data); })
        .catch(function () {
          console.warn('[Lavish] Could not read a reply from the endpoint. Submissions may still arrive \u2014 check the Sheet and the Apps Script "Executions" page. ' +
            'If nothing arrives, re-check the URL and that the deployment access is "Anyone".');
        });
    }
  }
})();
