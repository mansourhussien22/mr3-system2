(function () {
  const iconPaths = {
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="m3 3 18 18"/><path d="M10.6 10.6A3 3 0 0 0 13.4 13.4"/><path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c6.5 0 10 8 10 8a18.6 18.6 0 0 1-3.1 4.4"/><path d="M6.1 6.1C3.5 8 2 12 2 12s3.5 8 10 8c1.7 0 3.2-.4 4.5-1"/>',
    moon: '<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.7 6.7 0 0 0 9.8 9.8Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
    logout: '<path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 19V5a2 2 0 0 0-2-2h-6"/>',
    dashboard: '<path d="M3 13h8V3H3v10Z"/><path d="M13 21h8V11h-8v10Z"/><path d="M13 3v6h8V3h-8Z"/><path d="M3 21h8v-6H3v6Z"/>',
    invoice: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
    cart: '<path d="M6 6h15l-2 8H8L6 3H3"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
    box: '<path d="M21 8 12 3 3 8l9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    pill: '<path d="M10.5 20.5 20.5 10.5a5 5 0 0 0-7-7L3.5 13.5a5 5 0 0 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
    user: '<path d="M20 21a8 8 0 1 0-16 0"/><circle cx="12" cy="7" r="4"/>',
    truck: '<path d="M10 17H6a3 3 0 1 1-6 0h2"/><path d="M17 17h-7"/><path d="M22 17h-2a3 3 0 1 1-6 0"/><path d="M2 17V5h12v12"/><path d="M14 8h4l4 4v5"/>',
    wallet: '<path d="M21 8V7a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h16v8H5a3 3 0 0 1-3-3V8"/><path d="M17 14h.01"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 16v-5"/><path d="M12 16V7"/><path d="M17 16v-8"/>',
    settings: '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.6 1Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
    print: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
    refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2"/><path d="M3 12A9 9 0 0 1 18.5 5.8"/><path d="M18 2v4h4"/><path d="M6 22v-4H2"/>',
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    check: '<path d="m20 6-11 11-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    calendar: '<path d="M8 2v4M16 2v4"/><path d="M3 10h18"/><path d="M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/>'
  };

  function svg(name, title) {
    const path = iconPaths[name] || iconPaths.alert;
    const label = title ? `<title>${escapeHtml(title)}</title>` : "";
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="${title ? "false" : "true"}">${label}${path}</svg>`;
  }

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $all(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function uid(prefix) {
    return `${prefix || "id"}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function now() {
    return new Date().toISOString();
  }

  function parseNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback || 0;
  }

  function money(value) {
    const currency = window.MR3DB?.getSettings?.().currency || "EGP";
    const lang = document.documentElement.lang || "en";
    const locale = lang === "ar" ? "ar-EG" : undefined;
    const label = lang === "ar" && currency === "EGP" ? "جنيه" : currency;
    return `${parseNumber(value).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${label}`;
  }

  function date(value) {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return escapeHtml(value);
    return parsed.toLocaleDateString(document.documentElement.lang || "en");
  }

  function dateTime(value) {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return escapeHtml(value);
    return parsed.toLocaleString(document.documentElement.lang || "en");
  }

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function textMatch(row, query, fields) {
    const q = normalize(query);
    if (!q) return true;
    return fields.some((field) => normalize(row[field]).includes(q));
  }

  function inDateRange(value, from, to) {
    const d = value ? String(value).slice(0, 10) : "";
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }

  function t(key, params) {
    return window.MR3I18n ? window.MR3I18n.t(key, params) : key;
  }

  function toast(type, title, message) {
    const host = $("#toastHost");
    if (!host) return;
    const node = document.createElement("div");
    node.className = `toast ${type || "info"}`;
    node.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message || "")}</span>`;
    host.appendChild(node);
    setTimeout(() => node.remove(), 3600);
  }

  function appLoading(show, title, message) {
    const id = "appLoader";
    let node = document.getElementById(id);
    if (show) {
      if (!node) {
        node = document.createElement("div");
        node.id = id;
        node.className = "app-loader";
        document.body.appendChild(node);
      }
      node.innerHTML = `
        <div class="app-loader-card" role="status" aria-live="polite">
          <span class="loader-ring"></span>
          <strong>${escapeHtml(title || t("common.loading"))}</strong>
          <span>${escapeHtml(message || t("messages.waitMoment"))}</span>
        </div>`;
      const token = Date.now().toString();
      node.dataset.loadingToken = token;
      requestAnimationFrame(() => {
        if (node.isConnected && node.dataset.loadingToken === token) node.classList.add("active");
      });
      return;
    }
    if (!node) return;
    node.dataset.loadingToken = "";
    node.classList.remove("active");
    node.remove();
  }

  function setButtonLoading(button, loading, label) {
    if (!button) return;
    if (loading) {
      if (!button.dataset.originalHtml) {
        button.dataset.originalHtml = button.innerHTML;
        button.dataset.originalDisabled = button.disabled ? "true" : "false";
      }
      button.disabled = true;
      button.classList.add("is-busy");
      button.innerHTML = `<span class="mini-loader"></span><span>${escapeHtml(label || t("messages.processing"))}</span>`;
      return;
    }
    button.classList.remove("is-busy");
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      button.disabled = button.dataset.originalDisabled === "true";
      delete button.dataset.originalHtml;
      delete button.dataset.originalDisabled;
    } else {
      button.disabled = false;
    }
  }

  function closeModal() {
    const host = $("#modalHost");
    if (!host) return;
    host.classList.remove("active");
    host.innerHTML = "";
  }

  function modal(options) {
    const host = $("#modalHost");
    if (!host) return null;
    const size = options.size === "small" ? " small" : "";
    host.innerHTML = `
      <article class="modal${size}" role="dialog" aria-modal="true">
        <header class="modal-header">
          <h3>${escapeHtml(options.title || "")}</h3>
          <button class="icon-button" type="button" data-close-modal title="${escapeHtml(t("common.close"))}">${svg("x")}</button>
        </header>
        <div class="modal-content">${options.body || ""}</div>
        ${options.footer ? `<footer class="modal-footer">${options.footer}</footer>` : ""}
      </article>`;
    host.classList.add("active");
    host.onclick = (event) => {
      if (event.target === host || event.target.closest("[data-close-modal]")) {
        event.preventDefault();
        closeModal();
      }
    };
    return host.querySelector(".modal");
  }

  function confirm(message, title) {
    return new Promise((resolve) => {
      const footer = `
        <button class="ghost-button" type="button" data-confirm-no>${escapeHtml(t("common.cancel"))}</button>
        <button class="danger-button" type="button" data-confirm-yes>${escapeHtml(t("common.confirm"))}</button>`;
      const root = modal({ title: title || t("common.confirmAction"), body: `<p>${escapeHtml(message)}</p>`, footer, size: "small" });
      root.querySelector("[data-confirm-no]").addEventListener("click", () => {
        closeModal();
        resolve(false);
      });
      root.querySelector("[data-confirm-yes]").addEventListener("click", () => {
        closeModal();
        resolve(true);
      });
    });
  }

  function fieldHtml(field, value) {
    const id = `field_${field.name}_${Math.random().toString(36).slice(2, 6)}`;
    const required = field.required ? " required" : "";
    const disabled = field.disabled ? " disabled" : "";
    const readonly = field.readonly ? " readonly" : "";
    const wide = field.wide ? " wide" : "";
    const val = value ?? field.value ?? "";
    let control = "";
    if (field.type === "textarea") {
      control = `<textarea id="${id}" name="${field.name}"${required}${disabled} rows="${field.rows || 3}">${escapeHtml(val)}</textarea>`;
    } else if (field.type === "select") {
      const opts = (field.options || [])
        .map((opt) => {
          const optionValue = typeof opt === "object" ? opt.value : opt;
          const optionLabel = typeof opt === "object" ? opt.label : opt;
          return `<option value="${escapeHtml(optionValue)}"${String(optionValue) === String(val) ? " selected" : ""}>${escapeHtml(optionLabel)}</option>`;
        })
        .join("");
      control = `<select id="${id}" name="${field.name}"${required}${disabled}>${opts}</select>`;
    } else {
      const min = field.min !== undefined ? ` min="${field.min}"` : "";
      const step = field.step !== undefined ? ` step="${field.step}"` : "";
      control = `<input id="${id}" name="${field.name}" type="${field.type || "text"}" value="${escapeHtml(val)}"${required}${disabled}${readonly}${min}${step} />`;
    }
    return `<label class="field${wide}"><span>${escapeHtml(field.label)}</span>${control}</label>`;
  }

  function formModal(options) {
    const values = options.values || {};
    const fields = (options.fields || []).map((field) => fieldHtml(field, values[field.name])).join("");
    const footer = `
      <button class="ghost-button" type="button" data-close-modal>${escapeHtml(t("common.cancel"))}</button>
      <button class="primary-button" type="submit" form="mr3ModalForm">${svg("save")}${escapeHtml(options.submitLabel || t("common.save"))}</button>`;
    const root = modal({
      title: options.title,
      body: `<form id="mr3ModalForm" class="modal-form form-grid ${options.three ? "three" : ""}" novalidate>${fields}</form>`,
      footer,
      size: options.size
    });
    const form = root.querySelector("form");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const submitButton = root.querySelector('[type="submit"][form="mr3ModalForm"]');
      setButtonLoading(submitButton, true);
      const data = Object.fromEntries(new FormData(form).entries());
      try {
        const result = await options.onSubmit(data, form);
        if (result !== false) closeModal();
        else setButtonLoading(submitButton, false);
      } catch (error) {
        setButtonLoading(submitButton, false);
        toast("error", t("messages.failed"), error.message || String(error));
      }
    });
  }

  function empty(title, message) {
    return `<div class="empty-state"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(message || "")}</span></div>`;
  }

  function badge(label, type) {
    return `<span class="badge ${type || ""}">${escapeHtml(label)}</span>`;
  }

  function actionButton(action, iconName, title, className) {
    return `<button class="${className || "icon-button"}" type="button" data-action="${escapeHtml(action)}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">${svg(iconName)}</button>`;
  }

  function optionsHtml(items, value, labeler) {
    return items
      .map((item) => {
        const optionValue = typeof item === "object" ? item.id ?? item.value : item;
        const label = labeler ? labeler(item) : typeof item === "object" ? item.name || item.label || optionValue : item;
        return `<option value="${escapeHtml(optionValue)}"${String(optionValue) === String(value) ? " selected" : ""}>${escapeHtml(label)}</option>`;
      })
      .join("");
  }

  function downloadCsv(filename, rows) {
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function drawCanvasChart(canvas, config) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width || 560));
    const height = Math.max(220, Math.floor(rect.height || 230));
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.clearRect(0, 0, width, height);
    ctx.font = '14px "Times New Roman", Times, serif';
    const cssVars = getComputedStyle(document.documentElement);
    const chartInk = cssVars.getPropertyValue("--chart-ink").trim() || "#132124";
    const chartLine = cssVars.getPropertyValue("--chart-line").trim() || "#d9e4e6";
    ctx.fillStyle = chartInk;
    const labels = config.data.labels || [];
    const dataset = (config.data.datasets || [])[0] || { data: [] };
    const values = dataset.data.map((v) => parseNumber(v));
    const max = Math.max(1, ...values);
    const colors = dataset.backgroundColor || ["#0f8b8d", "#246bfe", "#12805c", "#d88600", "#7257c9"];
    if (config.type === "doughnut" || config.type === "pie") {
      const cx = width * 0.32;
      const cy = height * 0.48;
      const radius = Math.min(width, height) * 0.26;
      const total = values.reduce((a, b) => a + b, 0) || 1;
      let start = -Math.PI / 2;
      values.forEach((value, index) => {
        const end = start + (value / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, start, end);
        ctx.closePath();
        ctx.fillStyle = colors[index % colors.length];
        ctx.fill();
        start = end;
      });
      labels.forEach((label, index) => {
        const y = 34 + index * 28;
        ctx.fillStyle = colors[index % colors.length];
        ctx.fillRect(width * 0.62, y - 11, 14, 14);
        ctx.fillStyle = chartInk;
        ctx.fillText(`${label}: ${values[index] || 0}`, width * 0.62 + 22, y);
      });
      return;
    }
    const pad = 34;
    const plotW = width - pad * 2;
    const plotH = height - pad * 2;
    ctx.strokeStyle = chartLine;
    ctx.beginPath();
    ctx.moveTo(pad, pad);
    ctx.lineTo(pad, height - pad);
    ctx.lineTo(width - pad, height - pad);
    ctx.stroke();
    const barW = plotW / Math.max(1, values.length) - 10;
    values.forEach((value, index) => {
      const x = pad + index * (plotW / Math.max(1, values.length)) + 5;
      const barH = (value / max) * (plotH - 12);
      const y = height - pad - barH;
      ctx.fillStyle = colors[index % colors.length];
      if (config.type === "line") {
        return;
      }
      ctx.fillRect(x, y, Math.max(8, barW), barH);
      ctx.fillStyle = chartInk;
      ctx.fillText(String(value), x, Math.max(18, y - 6));
      ctx.save();
      ctx.translate(x + Math.max(8, barW) / 2, height - 10);
      ctx.rotate(-0.45);
      ctx.fillText(String(labels[index] || ""), 0, 0);
      ctx.restore();
    });
    if (config.type === "line") {
      ctx.strokeStyle = colors[0];
      ctx.lineWidth = 3;
      ctx.beginPath();
      values.forEach((value, index) => {
        const x = pad + index * (plotW / Math.max(1, values.length - 1 || 1));
        const y = height - pad - (value / max) * (plotH - 12);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        ctx.fillStyle = colors[0];
        ctx.fillRect(x - 3, y - 3, 6, 6);
      });
      ctx.stroke();
      labels.forEach((label, index) => {
        const x = pad + index * (plotW / Math.max(1, values.length - 1 || 1));
        ctx.fillStyle = chartInk;
        ctx.fillText(String(label || ""), x - 12, height - 10);
      });
    }
  }

  function ChartLite(ctx, config) {
    this.canvas = ctx.canvas || ctx;
    this.config = config;
    drawCanvasChart(this.canvas, config);
  }
  ChartLite.prototype.destroy = function () {
    const ctx = this.canvas.getContext("2d");
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  };

  window.Chart = window.Chart || ChartLite;
  window.MR3Utils = {
    $,
    $all,
    escape: escapeHtml,
    uid,
    today,
    now,
    parseNumber,
    money,
    date,
    dateTime,
    normalize,
    textMatch,
    inDateRange,
    t,
    toast,
    appLoading,
    setButtonLoading,
    modal,
    closeModal,
    confirm,
    formModal,
    empty,
    badge,
    icon: svg,
    actionButton,
    optionsHtml,
    downloadCsv,
    drawCanvasChart
  };
})();
