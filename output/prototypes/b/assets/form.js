(function () {
  "use strict";
  var validateLead = function validateLead(data = {}) {
  const errors = [];
  const LIMITS = { name: 80, company: 120, phone: 32, email: 120, city: 80, volume: 80, message: 2000, product: 80, channel: 40 };
  const str = (v) => (typeof v === "string" ? v.trim() : "");
  const values = {};
  for (const key of Object.keys(LIMITS)) values[key] = str(data[key]);
  const tooLong = Object.keys(LIMITS).filter((k) => values[k].length > LIMITS[k]);
  if (tooLong.length) errors.push("too_long");
  if (!values.name) errors.push("required");

  const digits = values.phone.replace(/\D/g, "");
  if (!values.phone || !/^[+0-9()\-\s]+$/.test(values.phone) || digits.length < 7 || digits.length > 15) {
    errors.push("phone");
  }
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email)) errors.push("email");

  const kind = data.kind === "dealer" ? "dealer" : "inquiry";
  const CHANNELS = ["pet_shop", "wholesale", "distributor", "grooming", "other"];
  if (kind === "dealer") {
    if (!values.company) errors.push("required");
    if (!CHANNELS.includes(values.channel)) errors.push("required");
  }
  if (data.consent !== true) errors.push("consent");
  if (str(data.website)) errors.push("spam");

  return { ok: errors.length === 0, kind, errors: [...new Set(errors)], values, tooLong };
};
  var MSG_ATTR = {
    required: "msgRequired",
    phone: "msgPhone",
    email: "msgEmail",
    too_long: "msgTooLong",
    rate: "msgRate",
    network: "msgNetwork",
    server: "msgServer",
    consent: "msgConsent"
  };

  function message(form, code) {
    var attr = MSG_ATTR[code];
    return (attr && form.dataset[attr]) || "";
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return "r" + Date.now().toString(36) + Math.random().toString(16).slice(2, 10);
  }

  function showError(form, codes) {
    var status = form.querySelector(".form-status");
    status.hidden = false;
    status.dataset.state = "error";
    status.textContent = message(form, codes[0]) || message(form, "server");
    var first = codes[0];
    if (first === "consent") {
      var box = form.elements.consent;
      if (box && box.focus) box.focus();
    } else if (["name", "company", "phone", "email", "channel"].indexOf(first) >= 0) {
      var el = form.elements[first];
      if (el && el.focus) el.focus();
    }
  }

  function showSuccess(form, data) {
    form.dataset.done = "1";
    var status = form.querySelector(".form-status");
    status.hidden = false;
    status.dataset.state = "success";
    status.textContent = "";
    var p = document.createElement("p");
    p.textContent = form.dataset.success || "";
    var extra = document.createElement("p");
    extra.className = "form-note";
    extra.textContent = form.dataset.msgSuccessExtra || "";
    var ref = document.createElement("p");
    ref.className = "form-ref";
    ref.textContent = (form.dataset.msgReceived || "Ref") + ": " + String(data.ref || "").slice(0, 40);
    status.appendChild(p);
    status.appendChild(extra);
    status.appendChild(ref);
    form.classList.add("is-done");
  }

  function init(form) {
    var status = form.querySelector(".form-status");
    var submit = form.querySelector('button[type="submit"]');
    var label = submit ? submit.textContent : "";
    var utm = form.querySelector('input[name="utm"]');
    if (utm) utm.value = (new URLSearchParams(location.search).get("utm") || "").slice(0, 120);
    var requestId = null;
    var busy = false;

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (busy || form.dataset.done) return;
      var raw = Object.fromEntries(new FormData(form));
      raw.consent = !!(form.elements.consent && form.elements.consent.checked);
      raw.kind = form.dataset.kind;
      var check = validateLead(raw);
      if (!check.ok) {
        showError(form, check.errors);
        return;
      }
      if (!requestId) requestId = makeId();
      busy = true;
      if (submit) {
        submit.disabled = true;
        submit.textContent = form.dataset.msgSending || "…";
      }
      status.hidden = false;
      status.dataset.state = "pending";
      status.textContent = form.dataset.msgSending || "…";

      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, 8000);
      var payload = Object.assign({}, raw, { request_id: requestId, ts: new Date().toISOString() });
      delete payload.website;

      fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Request-Id": requestId },
        body: JSON.stringify(payload),
        signal: controller.signal
      })
        .then(function (res) {
          clearTimeout(timer);
          return res.json().catch(function () { return {}; }).then(function (data) {
            return { res: res, data: data };
          });
        })
        .then(function (out) {
          if (out.res.ok && out.data.ok) {
            showSuccess(form, out.data);
          } else if (out.res.status === 429) {
            showError(form, ["rate"]);
          } else if (out.res.status === 400 && Array.isArray(out.data.errors)) {
            showError(form, out.data.errors);
          } else {
            showError(form, ["server"]);
          }
        })
        .catch(function () {
          clearTimeout(timer);
          showError(form, ["network"]);
        })
        .finally(function () {
          busy = false;
          if (submit && !form.dataset.done) {
            submit.disabled = false;
            submit.textContent = label;
          }
        });
    });

    form.addEventListener("input", function () {
      if (status.dataset.state === "error") {
        status.hidden = true;
        delete status.dataset.state;
      }
    });
  }

  document.querySelectorAll("form[data-lead-form]").forEach(init);
})();
