(function () {
  function invoices() {
    return MR3DB.all("purchaseInvoices").filter((invoice) => invoice.status !== "deleted");
  }

  function calc(lines) {
    const subtotal = lines.reduce((total, line) => total + MR3Utils.parseNumber(line.subtotal), 0);
    const discountValue = lines.reduce((total, line) => total + MR3Utils.parseNumber(line.discountValue), 0);
    return { subtotal, discountValue, finalTotal: Math.max(0, subtotal - discountValue) };
  }

  function lineTable(lines) {
    if (!lines.length) return MR3Utils.empty(MR3I18n.t("messages.noData"), MR3I18n.t("messages.emptyInvoice"));
    return `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>${MR3I18n.t("invoice.product")}</th><th>${MR3I18n.t("product.expiry")}</th><th>${MR3I18n.t("common.quantity")}</th><th>${MR3I18n.t("product.purchasePrice")}</th><th>${MR3I18n.t("product.salePrice")}</th><th>${MR3I18n.t("invoice.discountValueShort")}</th><th>${MR3I18n.t("invoice.lineTotal")}</th><th>${MR3I18n.t("common.actions")}</th></tr></thead>
      <tbody>${lines
        .map((line, index) => `<tr data-index="${index}"><td>${MR3Utils.escape(line.productName)}<br><span class="muted">${MR3I18n.t(`unit.${line.unitType}`)}</span></td><td>${MR3Utils.date(line.expiryDate)}</td><td>${line.quantity}</td><td>${MR3Utils.money(line.unitPrice)}</td><td>${MR3Utils.money(line.salePrice)}</td><td>${MR3Utils.money(line.discountValue)}</td><td>${MR3Utils.money(line.total)}</td><td>${MR3Utils.actionButton("removeLine", "trash", MR3I18n.t("common.delete"), "icon-button danger-button")}</td></tr>`)
        .join("")}</tbody></table></div>`;
  }

  function totalsHtml(totals, paid) {
    const remaining = Math.max(0, totals.finalTotal - MR3Utils.parseNumber(paid));
    return `<div class="total-row"><span>${MR3I18n.t("common.subtotal")}</span><strong>${MR3Utils.money(totals.subtotal)}</strong></div>
      <div class="total-row"><span>${MR3I18n.t("common.discount")}</span><strong>${MR3Utils.money(totals.discountValue)}</strong></div>
      <div class="total-row grand"><span>${MR3I18n.t("common.finalTotal")}</span><strong>${MR3Utils.money(totals.finalTotal)}</strong></div>
      <div class="total-row"><span>${MR3I18n.t("common.remaining")}</span><strong>${MR3Utils.money(remaining)}</strong></div>`;
  }

  function builder() {
    const products = MR3DB.all("products").filter((p) => p.isActive && !p.isDeleted && p.status !== "deleted");
    const suppliers = MR3DB.all("suppliers").filter((supplier) => !supplier.isDeleted && supplier.status !== "deleted");
    return `<div class="invoice-builder invoice-workspace">
      <section class="panel invoice-main-panel"><div class="panel-header"><h3>${MR3I18n.t("nav.purchaseInvoice")}</h3></div><div class="panel-body">
        <div class="invoice-strip">
          <label class="field"><span>${MR3I18n.t("invoice.supplierCode")}</span><select id="purchaseSupplier">${MR3Utils.optionsHtml(suppliers, "", (s) => `${s.code || ""} - ${s.name}`)}</select></label>
          <label class="field"><span>${MR3I18n.t("invoice.supplierName")}</span><input id="purchaseSupplierName" disabled /></label>
          <label class="field"><span>${MR3I18n.t("common.paymentMethod")}</span><select id="purchasePayment">${MR3App.paymentOptions("cash")}</select></label>
          <label class="field"><span>${MR3I18n.t("common.paid")}</span><input id="purchasePaid" type="number" min="0" step="0.01" value="0" /></label>
        </div>
        <div class="line-editor purchase-line" style="margin-top:14px">
          <label class="field"><span>${MR3I18n.t("invoice.product")}</span><select id="purchaseProduct">${MR3Utils.optionsHtml(products, "", (p) => `${MR3App.productName(p)} - ${p.code}`)}</select></label>
          <label class="field"><span>${MR3I18n.t("common.quantity")}</span><input id="purchaseQty" type="number" min="1" step="1" value="1" /></label>
          <label class="field"><span>${MR3I18n.t("product.expiry")}</span><input id="purchaseExpiry" type="date" /></label>
          <label class="field"><span>${MR3I18n.t("product.purchasePrice")}</span><input id="purchasePrice" type="number" min="0" step="0.01" /></label>
          <label class="field"><span>${MR3I18n.t("product.salePrice")}</span><input id="purchaseSalePrice" type="number" min="0" step="0.01" /></label>
          <label class="field"><span>${MR3I18n.t("invoice.discountPercentShort")}</span><input id="purchaseDiscountPercent" type="number" min="0" max="100" step="0.01" value="0" /></label>
          <label class="field"><span>${MR3I18n.t("invoice.discountValueShort")}</span><input id="purchaseLineDiscount" type="number" min="0" step="0.01" value="0" /></label>
          <label class="field"><span>${MR3I18n.t("invoice.lineTotal")}</span><input id="purchaseLineTotal" disabled value="0" /></label>
          <button id="addPurchaseLine" class="primary-button" type="button">${MR3Utils.icon("plus")}${MR3I18n.t("invoice.addLine")}</button>
        </div>
        <div id="purchaseLineTable" style="margin-top:14px"></div>
      </div></section>
      <aside class="panel invoice-summary-panel">
        <div class="panel-header"><h3>${MR3I18n.t("common.total")}</h3></div>
        <div class="panel-body">
          <div class="invoice-summary-grid">
            <label class="field"><span>${MR3I18n.t("common.subtotal")}</span><input id="purchaseSubtotalView" disabled value="0" /></label>
            <label class="field"><span>${MR3I18n.t("invoice.discountValueShort")}</span><input id="purchaseDiscountView" disabled value="0" /></label>
            <label class="field"><span>${MR3I18n.t("common.finalTotal")}</span><input id="purchaseFinalView" disabled value="0" /></label>
            <label class="field"><span>${MR3I18n.t("common.remaining")}</span><input id="purchaseRemainingView" disabled value="0" /></label>
          </div>
          <div class="invoice-action-row">
            ${MR3App.can("purchases.create") ? `<button id="holdPurchase" class="warning-button full" type="button">${MR3Utils.icon("invoice")}${MR3I18n.t("invoice.hold")}</button><button id="savePurchase" class="success-button full" type="button">${MR3Utils.icon("save")}${MR3I18n.t("invoice.savePurchase")}</button>` : ""}
          </div>
          <label class="field invoice-notes-field"><span>${MR3I18n.t("common.notes")}</span><textarea id="purchaseNotes" rows="2"></textarea></label>
          <div id="purchaseTotals" class="hidden"></div>
        </div>
      </aside>
    </div>`;
  }

  function listTable() {
    const rows = invoices();
    if (!rows.length) return MR3Utils.empty(MR3I18n.t("messages.noData"), MR3I18n.t("messages.noDataHint"));
    return `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>${MR3I18n.t("invoice.number")}</th><th>${MR3I18n.t("common.date")}</th><th>${MR3I18n.t("invoice.supplier")}</th><th>${MR3I18n.t("common.finalTotal")}</th><th>${MR3I18n.t("common.remaining")}</th><th>${MR3I18n.t("common.actions")}</th></tr></thead>
      <tbody>${rows.map((invoice) => `<tr data-id="${invoice.id}"><td>${invoice.number}</td><td>${invoice.date}</td><td>${MR3Utils.escape(invoice.supplierName)}</td><td>${MR3Utils.money(invoice.finalTotal)}</td><td>${MR3Utils.money(invoice.remainingAmount)}</td><td><div class="table-actions">
        ${MR3Utils.actionButton("details", "eye", MR3I18n.t("common.details"))}
        ${MR3Utils.actionButton("print", "print", MR3I18n.t("common.print"))}
        ${MR3App.can("purchases.delete") ? MR3Utils.actionButton("delete", "trash", MR3I18n.t("common.delete"), "icon-button danger-button") : ""}
      </div></td></tr>`).join("")}</tbody>
    </table></div>`;
  }

  function details(invoice) {
    const rows = invoice.items.map((item) => [item.productName, MR3I18n.t(`unit.${item.unitType}`), item.quantity, MR3Utils.money(item.unitPrice), MR3Utils.money(item.total)]);
    const body = `${MR3Print.table([MR3I18n.t("invoice.product"), MR3I18n.t("common.unit"), MR3I18n.t("common.quantity"), MR3I18n.t("common.price"), MR3I18n.t("common.total")], rows)}${totalsHtml(invoice, invoice.paidAmount)}`;
    const footer = `<button class="ghost-button" data-close-modal>${MR3I18n.t("common.close")}</button><button id="printPurchase" class="primary-button">${MR3Utils.icon("print")}${MR3I18n.t("common.print")}</button>`;
    const modal = MR3Utils.modal({ title: `${MR3I18n.t("nav.purchases")} ${invoice.number}`, body, footer });
    modal.querySelector("#printPurchase").addEventListener("click", () => MR3Print.invoice(MR3I18n.t("nav.purchases"), invoice, "purchase", false));
  }

  async function deleteInvoice(id) {
    if (!MR3App.require("purchases.delete")) return;
    const invoice = MR3DB.get("purchaseInvoices", id);
    if (!(await MR3Utils.confirm(MR3I18n.t("messages.confirmDelete")))) return;
    for (const item of invoice.items) {
      MR3Inventory.changeStock({ productId: item.productId, quantity: item.quantity, direction: "out", type: "adjustment", reference: `VOID-${invoice.number}`, unitType: item.unitType, unitPrice: item.unitPrice, notes: "Deleted purchase invoice" });
    }
    if (invoice.remainingAmount > 0) {
      const supplier = MR3DB.get("suppliers", invoice.supplierId);
      MR3DB.update("suppliers", invoice.supplierId, { balance: Math.max(0, MR3Utils.parseNumber(supplier.balance) - invoice.remainingAmount) });
    }
    MR3DB.update("purchaseInvoices", id, { status: "deleted" });
    MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.deleted"));
    MR3App.render();
  }

  function savePurchase(lines, root) {
    if (!MR3App.require("purchases.create")) return;
    if (!lines.length) throw new Error(MR3I18n.t("messages.emptyInvoice"));
    const totals = calc(lines);
    const paid = MR3Utils.parseNumber(root.querySelector("#purchasePaid").value);
    if (paid < 0 || paid > totals.finalTotal) throw new Error(MR3I18n.t("messages.paymentMismatch"));
    const supplier = MR3DB.get("suppliers", root.querySelector("#purchaseSupplier").value);
    const number = MR3DB.counter("purchases", "PI");
    const invoice = MR3DB.insert("purchaseInvoices", {
      number,
      supplierId: supplier.id,
      supplierName: supplier.name,
      date: MR3Utils.today(),
      items: lines,
      subtotal: totals.subtotal,
      discountValue: totals.discountValue,
      finalTotal: totals.finalTotal,
      paidAmount: paid,
      remainingAmount: totals.finalTotal - paid,
      paymentMethod: root.querySelector("#purchasePayment").value,
      userId: MR3App.user().id,
      userName: MR3App.user().name,
      notes: root.querySelector("#purchaseNotes").value,
      createdAt: MR3Utils.now(),
      status: "received"
    });
    lines.forEach((line) => {
      MR3DB.update("products", line.productId, {
        purchasePrice: line.unitPrice,
        salePrice: line.salePrice,
        expiryDate: line.expiryDate,
        updatedAt: MR3Utils.now()
      });
      MR3Inventory.changeStock({ productId: line.productId, quantity: line.quantity, direction: "in", type: "purchase", reference: number, unitType: line.unitType, unitPrice: line.unitPrice, purchaseCost: line.unitPrice, expiryDate: line.expiryDate, notes: invoice.notes });
    });
    if (invoice.remainingAmount > 0) MR3DB.update("suppliers", supplier.id, { balance: MR3Utils.parseNumber(supplier.balance) + invoice.remainingAmount });
    if (paid > 0) MR3DB.insert("payments", { number: MR3DB.counter("payments", "PAY"), entityType: "supplier", entityId: supplier.id, entityName: supplier.name, direction: "OUT", amount: paid, paymentMethod: invoice.paymentMethod, date: invoice.date, notes: number, userId: MR3App.user().id, userName: MR3App.user().name, createdAt: MR3Utils.now() });
    MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.saved"));
    MR3Print.invoice(MR3I18n.t("nav.purchases"), invoice, "purchase", false);
    MR3App.render();
  }

  function holdPurchase(lines, root) {
    if (!MR3App.require("purchases.create")) return;
    if (!lines.length) throw new Error(MR3I18n.t("messages.emptyInvoice"));
    const supplier = MR3DB.get("suppliers", root.querySelector("#purchaseSupplier").value);
    const totals = calc(lines);
    MR3DB.insert("heldPurchaseInvoices", {
      number: MR3DB.counter("heldPurchases", "HPI"),
      supplierId: supplier.id,
      supplierCode: supplier.code || "",
      supplierName: supplier.name,
      paymentMethod: root.querySelector("#purchasePayment").value,
      paidAmount: MR3Utils.parseNumber(root.querySelector("#purchasePaid").value),
      subtotal: totals.subtotal,
      discountValue: totals.discountValue,
      finalTotal: totals.finalTotal,
      remainingAmount: Math.max(0, totals.finalTotal - MR3Utils.parseNumber(root.querySelector("#purchasePaid").value)),
      notes: root.querySelector("#purchaseNotes").value,
      items: lines.map((line) => ({ ...line })),
      userId: MR3App.user().id,
      userName: MR3App.user().name,
      heldAt: MR3Utils.now(),
      createdAt: MR3Utils.now()
    });
    MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.invoiceHeld"));
    MR3App.render();
  }

  window.MR3Pages.purchases = {
    render(root) {
      let lines = [];
      root.innerHTML = MR3App.pageHeader("nav.purchaseInvoice", "page.purchasesHint") + builder() + `<section class="panel"><div class="panel-header"><h3>${MR3I18n.t("common.details")}</h3></div><div class="panel-body">${listTable()}</div></section>`;
      const productInput = root.querySelector("#purchaseProduct");
      const priceInput = root.querySelector("#purchasePrice");
      const salePriceInput = root.querySelector("#purchaseSalePrice");
      const expiryInput = root.querySelector("#purchaseExpiry");
      const supplierInput = root.querySelector("#purchaseSupplier");
      const supplierNameInput = root.querySelector("#purchaseSupplierName");
      const discountPercentInput = root.querySelector("#purchaseDiscountPercent");
      const discountValueInput = root.querySelector("#purchaseLineDiscount");
      const lineTotalInput = root.querySelector("#purchaseLineTotal");
      const unitInput = { value: "box" };
      const refreshPrice = () => {
        const product = MR3DB.get("products", productInput.value);
        unitInput.value = product?.unitType || "box";
        priceInput.value = MR3App.productPrice(product, unitInput.value, "purchase");
        salePriceInput.value = MR3Utils.parseNumber(product?.salePrice);
        expiryInput.value = product?.expiryDate || "";
        refreshLineTotal("percent");
      };
      const refreshSupplier = () => {
        const supplier = MR3DB.get("suppliers", supplierInput.value);
        supplierNameInput.value = supplier ? supplier.name : "";
      };
      const refreshLineTotal = (source) => {
        const quantity = MR3Utils.parseNumber(root.querySelector("#purchaseQty").value);
        const price = MR3Utils.parseNumber(priceInput.value);
        const base = quantity * price;
        if (source === "percent") {
          discountValueInput.value = (base * Math.min(100, MR3Utils.parseNumber(discountPercentInput.value)) / 100).toFixed(2);
        } else if (source === "value") {
          discountPercentInput.value = base ? (MR3Utils.parseNumber(discountValueInput.value) / base * 100).toFixed(2) : "0";
        }
        const discount = Math.min(base, MR3Utils.parseNumber(discountValueInput.value));
        lineTotalInput.value = MR3Utils.money(Math.max(0, base - discount));
      };
      const refresh = () => {
        const totals = calc(lines);
        root.querySelector("#purchaseLineTable").innerHTML = lineTable(lines);
        root.querySelector("#purchaseTotals").innerHTML = totalsHtml(totals, root.querySelector("#purchasePaid").value);
        root.querySelector("#purchaseSubtotalView").value = MR3Utils.money(totals.subtotal);
        root.querySelector("#purchaseDiscountView").value = MR3Utils.money(totals.discountValue);
        root.querySelector("#purchaseFinalView").value = MR3Utils.money(totals.finalTotal);
        root.querySelector("#purchaseRemainingView").value = MR3Utils.money(Math.max(0, totals.finalTotal - MR3Utils.parseNumber(root.querySelector("#purchasePaid").value)));
        root.querySelectorAll("[data-action='removeLine']").forEach((button) => button.addEventListener("click", () => {
          lines.splice(Number(button.closest("[data-index]").dataset.index), 1);
          refresh();
        }));
      };
      const loadHeldPurchase = () => {
        const heldId = sessionStorage.getItem("mr3-resume-purchase");
        if (!heldId) return;
        sessionStorage.removeItem("mr3-resume-purchase");
        const held = MR3DB.get("heldPurchaseInvoices", heldId);
        if (!held) return;
        lines = (held.items || []).map((line) => ({ ...line }));
        root.querySelector("#purchaseSupplier").value = held.supplierId;
        root.querySelector("#purchasePayment").value = held.paymentMethod || "cash";
        root.querySelector("#purchasePaid").value = held.paidAmount || 0;
        root.querySelector("#purchaseNotes").value = held.notes || "";
        refreshSupplier();
        MR3DB.remove("heldPurchaseInvoices", heldId);
        MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.invoiceResumed"));
      };
      productInput.addEventListener("change", refreshPrice);
      supplierInput.addEventListener("change", refreshSupplier);
      ["purchaseQty", "purchasePrice"].forEach((id) => root.querySelector(`#${id}`).addEventListener("input", () => refreshLineTotal("percent")));
      discountPercentInput.addEventListener("input", () => refreshLineTotal("percent"));
      discountValueInput.addEventListener("input", () => refreshLineTotal("value"));
      const addPurchaseLine = () => {
        const product = MR3DB.get("products", productInput.value);
        const quantity = MR3Utils.parseNumber(root.querySelector("#purchaseQty").value);
        const price = MR3Utils.parseNumber(priceInput.value);
        const base = quantity * price;
        const discountValue = Math.min(base, MR3Utils.parseNumber(discountValueInput.value));
        const salePrice = MR3Utils.parseNumber(salePriceInput.value);
        if (!product || quantity <= 0 || price < 0) {
          MR3Utils.toast("error", MR3I18n.t("messages.failed"), MR3I18n.t("messages.positiveNumber"));
          return;
        }
        try {
          MR3Production.validateExpiry({ ...product, expiryDate: expiryInput.value });
        } catch (error) {
          MR3Utils.toast("error", MR3I18n.t("messages.failed"), error.message);
          return;
        }
        lines.push({ productId: product.id, productName: MR3App.productName(product), unitType: product.unitType, quantity, expiryDate: expiryInput.value, unitPrice: price, salePrice, discountPercent: MR3Utils.parseNumber(discountPercentInput.value), discountValue, subtotal: base, total: Math.max(0, base - discountValue) });
        refresh();
      };
      root.querySelector("#addPurchaseLine").addEventListener("click", addPurchaseLine);
      root.addEventListener("keydown", (event) => {
        if (event.key === "Insert") {
          event.preventDefault();
          addPurchaseLine();
        }
      });
      ["purchasePaid"].forEach((id) => root.querySelector(`#${id}`).addEventListener("input", refresh));
      root.querySelector("#savePurchase")?.addEventListener("click", (event) => {
        const button = event.currentTarget;
        MR3Utils.setButtonLoading(button, true);
        try {
          savePurchase(lines, root);
        } catch (error) {
          MR3Utils.setButtonLoading(button, false);
          MR3Utils.toast("error", MR3I18n.t("messages.failed"), error.message);
        }
      });
      root.querySelector("#holdPurchase")?.addEventListener("click", (event) => {
        const button = event.currentTarget;
        MR3Utils.setButtonLoading(button, true);
        try {
          holdPurchase(lines, root);
        } catch (error) {
          MR3Utils.setButtonLoading(button, false);
          MR3Utils.toast("error", MR3I18n.t("messages.failed"), error.message);
        }
      });
      MR3App.bindTableActions(root, {
        details: (id) => details(MR3DB.get("purchaseInvoices", id)),
        print: (id) => MR3Print.invoice(MR3I18n.t("nav.purchases"), MR3DB.get("purchaseInvoices", id), "purchase", false),
        delete: deleteInvoice
      });
      refreshPrice();
      refreshSupplier();
      loadHeldPurchase();
      refresh();
    }
  };

  window.MR3Pages.purchasePending = {
    render(root) {
      const rows = MR3DB.all("heldPurchaseInvoices").sort((a, b) => String(b.heldAt).localeCompare(String(a.heldAt)));
      const table = rows.length
        ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>${MR3I18n.t("invoice.number")}</th><th>${MR3I18n.t("invoice.heldAt")}</th><th>${MR3I18n.t("invoice.supplierCode")}</th><th>${MR3I18n.t("invoice.supplier")}</th><th>${MR3I18n.t("common.finalTotal")}</th><th>${MR3I18n.t("common.user")}</th><th>${MR3I18n.t("common.actions")}</th></tr></thead><tbody>
          ${rows.map((invoice) => `<tr data-id="${invoice.id}"><td>${invoice.number}</td><td>${MR3Utils.dateTime(invoice.heldAt)}</td><td>${MR3Utils.escape(invoice.supplierCode || "")}</td><td>${MR3Utils.escape(invoice.supplierName)}</td><td>${MR3Utils.money(invoice.finalTotal)}</td><td>${MR3Utils.escape(invoice.userName || "")}</td><td><div class="table-actions">${MR3Utils.actionButton("resume", "edit", MR3I18n.t("invoice.resume"), "icon-button success-button")}${MR3Utils.actionButton("delete", "trash", MR3I18n.t("common.delete"), "icon-button danger-button")}</div></td></tr>`).join("")}
        </tbody></table></div>`
        : MR3Utils.empty(MR3I18n.t("invoice.noHeld"), "");
      root.innerHTML = MR3App.pageHeader("nav.purchasePending", "") + `<section class="panel"><div class="panel-body">${table}</div></section>`;
      MR3App.bindTableActions(root, {
        resume: (id) => {
          sessionStorage.setItem("mr3-resume-purchase", id);
          MR3App.navigate("purchases");
        },
        delete: async (id) => {
          if (!(await MR3Utils.confirm(MR3I18n.t("messages.confirmDelete")))) return;
          MR3DB.remove("heldPurchaseInvoices", id);
          MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.deleted"));
          MR3App.render();
        }
      });
    }
  };
})();
