(function () {
  const reasons = ["countDifference", "expiredProduct", "damagedProduct", "missingStock", "manualCorrection"];

  function reasonOptions(value) {
    return MR3Utils.optionsHtml(reasons.map((reason) => ({ value: reason, label: MR3I18n.t(`audit.reason.${reason}`) })), value || reasons[0]);
  }

  function reduceAnyBatches(product, quantity) {
    let remaining = Math.abs(MR3Utils.parseNumber(quantity));
    MR3DB.all("stockBatches")
      .filter((batch) => batch.productId === product.id && MR3Utils.parseNumber(batch.quantityRemaining) > 0)
      .sort((a, b) => String(a.expiryDate || "9999-12-31").localeCompare(String(b.expiryDate || "9999-12-31")))
      .forEach((batch) => {
        if (remaining <= 0) return;
        const take = Math.min(MR3Utils.parseNumber(batch.quantityRemaining), remaining);
        remaining -= take;
        MR3DB.update("stockBatches", batch.id, { quantityRemaining: MR3Utils.parseNumber(batch.quantityRemaining) - take });
      });
  }

  function applyAudit(product, data) {
    const oldQuantity = MR3Utils.parseNumber(product.stockQuantity);
    const newQuantity = MR3Utils.parseNumber(data.newQuantity);
    if (newQuantity < 0) throw new Error(MR3I18n.t("messages.stockNegativeBlocked"));

    const newExpiry = data.newExpiryDate || product.expiryDate || "";
    const nextActive = String(data.productStatus) === "active";
    if (newQuantity > 0 && nextActive && MR3Production.requiresExpiry(product)) {
      MR3Production.validateExpiry({ ...product, expiryDate: newExpiry });
    }

    const diff = newQuantity - oldQuantity;
    const number = MR3DB.counter("adjustments", "ADJ");
    const oldValue = {
      stockQuantity: product.stockQuantity,
      expiryDate: product.expiryDate || "",
      isActive: product.isActive
    };
    const newValue = {
      stockQuantity: newQuantity,
      expiryDate: newExpiry,
      isActive: nextActive
    };

    if (diff > 0) {
      MR3Production.receiveBatch({
        productId: product.id,
        quantity: diff,
        unitType: product.unitType,
        expiryDate: newExpiry,
        purchaseCost: product.purchasePrice,
        reference: number
      });
      MR3Production.checkAvailability(product.id);
    } else if (diff < 0) {
      reduceAnyBatches(product, Math.abs(diff));
    }

    MR3DB.update("products", product.id, {
      stockQuantity: newQuantity,
      expiryDate: newExpiry,
      isActive: nextActive,
      updatedAt: MR3Utils.now()
    });

    MR3DB.insert("movements", {
      productId: product.id,
      date: MR3Utils.today(),
      type: "stocktaking",
      reference: number,
      quantityIn: diff > 0 ? diff : 0,
      quantityOut: diff < 0 ? Math.abs(diff) : 0,
      stockQuantityChange: diff,
      balanceAfter: newQuantity,
      unitType: product.unitType,
      unitPrice: product.purchasePrice,
      userId: MR3App.user().id,
      userName: MR3App.user().name,
      notes: `${MR3I18n.t(`audit.reason.${data.reason}`)}${data.notes ? " - " + data.notes : ""}`
    });

    MR3DB.insert("inventoryAudits", {
      number,
      productId: product.id,
      productCode: product.code,
      productName: MR3App.productName(product),
      oldQuantity,
      newQuantity,
      difference: diff,
      oldExpiry: product.expiryDate || "",
      newExpiry,
      oldStatus: product.isActive ? "active" : "inactive",
      newStatus: nextActive ? "active" : "inactive",
      reason: data.reason,
      notes: data.notes || "",
      userId: MR3App.user().id,
      userName: MR3App.user().name,
      date: MR3Utils.today(),
      createdAt: MR3Utils.now()
    });

    MR3DB.audit({
      action: "inventory.audit",
      entityType: "product",
      entityId: product.id,
      reference: number,
      oldValue,
      newValue,
      reason: `${MR3I18n.t(`audit.reason.${data.reason}`)}${data.notes ? " - " + data.notes : ""}`
    });
  }

  function openAuditForm(product) {
    if (!MR3App.require("inventory.audit")) return;
    MR3Utils.formModal({
      title: MR3I18n.t("nav.inventoryAudit"),
      fields: [
        { name: "newQuantity", label: MR3I18n.t("audit.newQuantity"), type: "number", min: 0, step: "1", required: true },
        { name: "newExpiryDate", label: MR3I18n.t("audit.newExpiry"), type: "date" },
        { name: "productStatus", label: MR3I18n.t("common.status"), type: "select", options: [{ value: "active", label: MR3I18n.t("common.active") }, { value: "inactive", label: MR3I18n.t("common.inactive") }] },
        { name: "reason", label: MR3I18n.t("inventory.reason"), type: "select", options: reasons.map((reason) => ({ value: reason, label: MR3I18n.t(`audit.reason.${reason}`) })), required: true },
        { name: "notes", label: MR3I18n.t("common.notes"), type: "textarea", wide: true }
      ],
      values: {
        newQuantity: product.stockQuantity || 0,
        newExpiryDate: product.expiryDate || "",
        productStatus: product.isActive ? "active" : "inactive",
        reason: "countDifference"
      },
      onSubmit(data) {
        applyAudit(product, data);
        MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.saved"));
        MR3App.render();
      }
    });
  }

  function productTable(rows) {
    if (!rows.length) return MR3Utils.empty(MR3I18n.t("messages.noData"), MR3I18n.t("messages.noDataHint"));
    return `<div class="table-wrap"><table class="data-table"><thead><tr>
      <th>${MR3I18n.t("product.code")}</th>
      <th>${MR3I18n.t("common.name")}</th>
      <th>${MR3I18n.t("product.barcode")}</th>
      <th>${MR3I18n.t("product.stock")}</th>
      <th>${MR3I18n.t("product.expiry")}</th>
      <th>${MR3I18n.t("common.status")}</th>
      <th>${MR3I18n.t("common.actions")}</th>
    </tr></thead><tbody>${rows
      .map((product) => `<tr data-id="${product.id}">
        <td>${MR3Utils.escape(product.code)}</td>
        <td><strong>${MR3Utils.escape(MR3App.productName(product))}</strong></td>
        <td>${MR3Utils.escape(product.barcode || "")}</td>
        <td>${MR3Utils.badge(product.stockQuantity, product.stockQuantity <= product.minimumStockQuantity ? "warning" : "success")}</td>
        <td>${MR3Utils.date(product.expiryDate)}</td>
        <td>${MR3Utils.badge(product.isActive ? MR3I18n.t("common.active") : MR3I18n.t("common.inactive"), product.isActive ? "success" : "danger")}</td>
        <td>${MR3Utils.actionButton("audit", "edit", MR3I18n.t("nav.inventoryAudit"), "icon-button success-button")}</td>
      </tr>`)
      .join("")}</tbody></table></div>`;
  }

  function auditHistory() {
    const rows = MR3DB.all("inventoryAudits").sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 25);
    if (!rows.length) return MR3Utils.empty(MR3I18n.t("audit.noHistory"), "");
    return `<div class="table-wrap"><table class="data-table"><thead><tr>
      <th>${MR3I18n.t("invoice.number")}</th>
      <th>${MR3I18n.t("common.date")}</th>
      <th>${MR3I18n.t("invoice.product")}</th>
      <th>${MR3I18n.t("audit.oldQuantity")}</th>
      <th>${MR3I18n.t("audit.newQuantity")}</th>
      <th>${MR3I18n.t("audit.difference")}</th>
      <th>${MR3I18n.t("inventory.reason")}</th>
      <th>${MR3I18n.t("common.user")}</th>
    </tr></thead><tbody>${rows
      .map((row) => `<tr>
        <td>${row.number}</td>
        <td>${row.date}</td>
        <td>${MR3Utils.escape(row.productName)}</td>
        <td>${row.oldQuantity}</td>
        <td>${row.newQuantity}</td>
        <td>${MR3Utils.badge(row.difference, row.difference < 0 ? "warning" : "success")}</td>
        <td>${MR3I18n.t(`audit.reason.${row.reason}`)}</td>
        <td>${MR3Utils.escape(row.userName || "")}</td>
      </tr>`)
      .join("")}</tbody></table></div>`;
  }

  function usefulProductSuggestions() {
    const counts = {};
    MR3DB.all("movements").forEach((movement) => {
      counts[movement.productId] = (counts[movement.productId] || 0) + 1;
    });
    return MR3DB.all("products")
      .filter((product) => !product.isDeleted && product.status !== "deleted")
      .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || String(a.code).localeCompare(String(b.code)))
      .slice(0, 12)
      .map((product) => `<option value="${MR3Utils.escape(product.code)}" label="${MR3Utils.escape(`${product.code} - ${MR3App.productName(product)}${product.barcode ? " - " + product.barcode : ""}`)}"></option>`)
      .join("");
  }

  function productMatches(product, query) {
    const q = MR3Utils.normalize(query);
    if (!q) return true;
    const code = MR3Utils.normalize(product.code);
    const barcode = MR3Utils.normalize(product.barcode);
    if (code === q || code.includes(q) || barcode === q || barcode.includes(q)) return true;
    return MR3Utils.textMatch(product, query, ["nameAr", "nameEn", "scientificName", "tradeName"]);
  }

  function auditReportRows(root) {
    const query = root?.querySelector("#auditSearch")?.value || "";
    const reason = root?.querySelector("#auditReasonPreview")?.value || "";
    const q = MR3Utils.normalize(query);
    return MR3DB.all("inventoryAudits")
      .filter((row) => {
        if (reason && row.reason !== reason) return false;
        if (!q) return true;
        const exactCode = MR3Utils.normalize(row.productCode) === q;
        if (exactCode) return true;
        return MR3Utils.normalize(`${row.productCode} ${row.productName} ${row.number}`).includes(q);
      })
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  function auditReportData(root) {
    return auditReportRows(root).map((row) => [
      row.number,
      row.date,
      row.productCode || "",
      row.productName,
      row.oldQuantity,
      row.newQuantity,
      row.difference,
      row.oldExpiry || "",
      row.newExpiry || "",
      MR3I18n.t(`audit.reason.${row.reason}`),
      row.userName || "",
      row.notes || ""
    ]);
  }

  function renderAuditReport(root) {
    const rows = auditReportRows(root);
    const total = rows.length;
    const increases = rows.filter((row) => MR3Utils.parseNumber(row.difference) > 0).length;
    const decreases = rows.filter((row) => MR3Utils.parseNumber(row.difference) < 0).length;
    const net = rows.reduce((sum, row) => sum + MR3Utils.parseNumber(row.difference), 0);
    const table = rows.length
      ? `<div class="table-wrap"><table class="data-table"><thead><tr>
          <th>${MR3I18n.t("invoice.number")}</th>
          <th>${MR3I18n.t("common.date")}</th>
          <th>${MR3I18n.t("product.code")}</th>
          <th>${MR3I18n.t("invoice.product")}</th>
          <th>${MR3I18n.t("audit.oldQuantity")}</th>
          <th>${MR3I18n.t("audit.newQuantity")}</th>
          <th>${MR3I18n.t("audit.difference")}</th>
          <th>${MR3I18n.t("audit.oldExpiry")}</th>
          <th>${MR3I18n.t("audit.newExpiry")}</th>
          <th>${MR3I18n.t("inventory.reason")}</th>
          <th>${MR3I18n.t("common.user")}</th>
        </tr></thead><tbody>${rows
          .map((row) => `<tr>
            <td>${MR3Utils.escape(row.number)}</td>
            <td>${MR3Utils.escape(row.date)}</td>
            <td>${MR3Utils.escape(row.productCode || "")}</td>
            <td>${MR3Utils.escape(row.productName)}</td>
            <td>${row.oldQuantity}</td>
            <td>${row.newQuantity}</td>
            <td>${MR3Utils.badge(row.difference, row.difference < 0 ? "warning" : "success")}</td>
            <td>${MR3Utils.date(row.oldExpiry)}</td>
            <td>${MR3Utils.date(row.newExpiry)}</td>
            <td>${MR3I18n.t(`audit.reason.${row.reason}`)}</td>
            <td>${MR3Utils.escape(row.userName || "")}</td>
          </tr>`)
          .join("")}</tbody></table></div>`
      : MR3Utils.empty(MR3I18n.t("messages.noData"), MR3I18n.t("messages.noDataHint"));
    root.querySelector("#auditReport").innerHTML = `
      <div class="stats-grid compact">
        <article class="stat-card"><span class="stat-icon blue">${MR3Utils.icon("chart")}</span><div><p>${MR3I18n.t("audit.reportTotal")}</p><strong>${total}</strong></div></article>
        <article class="stat-card"><span class="stat-icon green">${MR3Utils.icon("plus")}</span><div><p>${MR3I18n.t("audit.reportIncrease")}</p><strong>${increases}</strong></div></article>
        <article class="stat-card"><span class="stat-icon orange">${MR3Utils.icon("wallet")}</span><div><p>${MR3I18n.t("audit.reportDecrease")}</p><strong>${decreases}</strong></div></article>
        <article class="stat-card"><span class="stat-icon violet">${MR3Utils.icon("box")}</span><div><p>${MR3I18n.t("audit.reportNet")}</p><strong>${net}</strong></div></article>
      </div>
      ${table}`;
  }

  window.MR3Pages.inventoryAudit = {
    render(root) {
      const tools = `<button id="exportAuditReport" class="ghost-button">${MR3Utils.icon("download")}${MR3I18n.t("common.export")}</button><button id="printAuditReport" class="primary-button">${MR3Utils.icon("print")}${MR3I18n.t("common.print")}</button>`;
      root.innerHTML = MR3App.pageHeader("nav.inventoryAudit", "page.inventoryAuditHint", tools) + `
        <section class="panel"><div class="panel-body">
          <div class="filters">
            <label class="field"><span>${MR3I18n.t("common.search")}</span><input id="auditSearch" class="search-input" list="auditProductSuggestions" placeholder="${MR3I18n.t("audit.searchPlaceholder")}" /></label>
            <label class="field"><span>${MR3I18n.t("inventory.reason")}</span><select id="auditReasonPreview"><option value="">${MR3I18n.t("common.all")}</option>${reasonOptions("")}</select></label>
            <datalist id="auditProductSuggestions">${usefulProductSuggestions()}</datalist>
          </div>
          <div id="auditProductTable"></div>
        </div></section>
        <section class="panel"><div class="panel-header"><h3>${MR3I18n.t("audit.reportTitle")}</h3></div><div class="panel-body"><div id="auditReport"></div></div></section>
        <section class="panel"><div class="panel-header"><h3>${MR3I18n.t("audit.history")}</h3></div><div class="panel-body">${auditHistory()}</div></section>`;
      const refresh = () => {
        const query = root.querySelector("#auditSearch").value;
        const q = MR3Utils.normalize(query);
        const products = MR3DB.all("products").filter((product) => !product.isDeleted && product.status !== "deleted");
        const exactCodeRows = q ? products.filter((product) => MR3Utils.normalize(product.code) === q) : [];
        const rows = exactCodeRows.length ? exactCodeRows : products.filter((product) => productMatches(product, query));
        root.querySelector("#auditProductTable").innerHTML = productTable(rows);
        MR3App.bindTableActions(root.querySelector("#auditProductTable"), { audit: (id) => openAuditForm(MR3DB.get("products", id)) });
        renderAuditReport(root);
      };
      root.querySelector("#auditSearch").addEventListener("input", refresh);
      root.querySelector("#auditReasonPreview").addEventListener("input", refresh);
      root.querySelector("#exportAuditReport").addEventListener("click", () => {
        MR3Utils.downloadCsv("mr3-inventory-audit-report.csv", [[MR3I18n.t("invoice.number"), MR3I18n.t("common.date"), MR3I18n.t("product.code"), MR3I18n.t("invoice.product"), MR3I18n.t("audit.oldQuantity"), MR3I18n.t("audit.newQuantity"), MR3I18n.t("audit.difference"), MR3I18n.t("audit.oldExpiry"), MR3I18n.t("audit.newExpiry"), MR3I18n.t("inventory.reason"), MR3I18n.t("common.user"), MR3I18n.t("common.notes")], ...auditReportData(root)]);
      });
      root.querySelector("#printAuditReport").addEventListener("click", () => {
        MR3Print.simple(MR3I18n.t("audit.reportTitle"), [MR3I18n.t("invoice.number"), MR3I18n.t("common.date"), MR3I18n.t("product.code"), MR3I18n.t("invoice.product"), MR3I18n.t("audit.oldQuantity"), MR3I18n.t("audit.newQuantity"), MR3I18n.t("audit.difference"), MR3I18n.t("inventory.reason"), MR3I18n.t("common.user")], auditReportData(root).map((row) => [row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[9], row[10]]));
      });
      refresh();
    }
  };
})();
