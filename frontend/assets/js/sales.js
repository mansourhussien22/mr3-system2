(function () {
  function invoiceRows() {
    return MR3DB.all("salesInvoices").filter((invoice) => invoice.status !== "deleted");
  }

  function calc(lines, discountPercent, discountValueInput) {
    const subtotal = lines.reduce((total, line) => total + MR3Utils.parseNumber(line.total), 0);
    const percentValue = subtotal * Math.min(100, Math.max(0, MR3Utils.parseNumber(discountPercent))) / 100;
    const fixedValue = Math.max(0, MR3Utils.parseNumber(discountValueInput));
    const discountValue = Math.min(subtotal, percentValue + fixedValue);
    return { subtotal, discountValue, finalTotal: Math.max(0, subtotal - discountValue) };
  }

  function build(root) {
    const products = MR3DB.all("products").filter((p) => p.isActive && !p.isDeleted && p.status !== "deleted");
    const customers = MR3DB.all("customers").filter((customer) => !customer.isDeleted && customer.status !== "deleted");
    return `
      <div class="invoice-builder invoice-workspace">
        <section class="panel invoice-main-panel">
          <div class="panel-header"><h3>${MR3I18n.t("nav.saleInvoice")}</h3></div>
          <div class="panel-body">
            <div class="invoice-strip">
              <label class="field"><span>${MR3I18n.t("invoice.customerName")}</span><select id="saleCustomer"><option value="">${MR3I18n.t("invoice.walkIn")}</option>${MR3Utils.optionsHtml(customers.filter((c) => c.id !== "cus_walkin"), "")}</select></label>
              <label class="field"><span>${MR3I18n.t("common.paymentMethod")}</span><select id="salePayment">${MR3App.paymentOptions("cash")}</select></label>
              <label class="field"><span>${MR3I18n.t("common.paid")}</span><input id="salePaid" type="number" min="0" step="0.01" value="0" /></label>
              <label class="checkbox-line"><input id="saleCredit" type="checkbox" /><span>${MR3I18n.t("invoice.creditSale")}</span></label>
            </div>
            <div class="line-editor">
              <label class="field"><span>${MR3I18n.t("invoice.product")}</span><select id="saleProduct">${MR3Utils.optionsHtml(products, "", (p) => `${MR3App.productName(p)} - ${p.code}`)}</select></label>
              <label class="field"><span>${MR3I18n.t("common.unit")}</span><select id="saleUnit"></select></label>
              <label class="field"><span>${MR3I18n.t("common.quantity")}</span><input id="saleQty" type="number" min="1" step="1" value="1" /></label>
              <label class="field"><span>${MR3I18n.t("common.price")}</span><input id="salePrice" type="number" min="0" step="0.01" /></label>
              <button id="addSaleLine" class="primary-button" type="button">${MR3Utils.icon("plus")}${MR3I18n.t("invoice.addLine")}</button>
            </div>
            <div id="saleLineTable" style="margin-top:14px"></div>
          </div>
        </section>
        <aside class="panel invoice-summary-panel">
          <div class="panel-header"><h3>${MR3I18n.t("common.total")}</h3></div>
          <div class="panel-body">
            <div class="invoice-summary-grid">
              <label class="field"><span>${MR3I18n.t("common.subtotal")}</span><input id="saleSubtotalView" disabled value="0" /></label>
              <label class="field"><span>${MR3I18n.t("invoice.discountPercentShort")}</span><input id="saleDiscountPercent" type="number" min="0" max="100" step="0.01" value="0" /></label>
              <label class="field"><span>${MR3I18n.t("invoice.discountValueShort")}</span><input id="saleDiscountValue" type="number" min="0" step="0.01" value="0" /></label>
              <label class="field"><span>${MR3I18n.t("common.finalTotal")}</span><input id="saleFinalView" disabled value="0" /></label>
              <label class="field"><span>${MR3I18n.t("common.remaining")}</span><input id="saleRemainingView" disabled value="0" /></label>
            </div>
            <div class="invoice-action-row">
              ${MR3App.can("sales.create") ? `<button id="holdSale" class="warning-button full" type="button">${MR3Utils.icon("invoice")}${MR3I18n.t("invoice.hold")}</button><button id="saveSale" class="success-button full" type="button">${MR3Utils.icon("save")}${MR3I18n.t("invoice.saveSale")}</button>` : ""}
            </div>
            <label class="field invoice-notes-field"><span>${MR3I18n.t("common.notes")}</span><textarea id="saleNotes" rows="2"></textarea></label>
            <div id="saleTotals" class="hidden"></div>
          </div>
        </aside>
      </div>`;
  }

  function lineTable(lines) {
    if (!lines.length) return MR3Utils.empty(MR3I18n.t("messages.noData"), MR3I18n.t("messages.emptyInvoice"));
    return `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>${MR3I18n.t("invoice.product")}</th><th>${MR3I18n.t("common.unit")}</th><th>${MR3I18n.t("common.quantity")}</th><th>${MR3I18n.t("common.price")}</th><th>${MR3I18n.t("common.total")}</th><th>${MR3I18n.t("common.actions")}</th></tr></thead>
      <tbody>${lines
        .map((line, index) => `<tr data-index="${index}"><td>${MR3Utils.escape(line.productName)}</td><td>${MR3I18n.t(`unit.${line.unitType}`)}</td><td>${line.quantity}</td><td>${MR3Utils.money(line.unitPrice)}</td><td>${MR3Utils.money(line.total)}</td><td>${MR3Utils.actionButton("removeLine", "trash", MR3I18n.t("common.delete"), "icon-button danger-button")}</td></tr>`)
        .join("")}</tbody>
    </table></div>`;
  }

  function totalsHtml(totals, paid) {
    const remaining = Math.max(0, totals.finalTotal - MR3Utils.parseNumber(paid));
    const overpaid = Math.max(0, MR3Utils.parseNumber(paid) - totals.finalTotal);
    return `<div class="total-row"><span>${MR3I18n.t("common.subtotal")}</span><strong>${MR3Utils.money(totals.subtotal)}</strong></div>
      <div class="total-row"><span>${MR3I18n.t("common.discount")}</span><strong>${MR3Utils.money(totals.discountValue)}</strong></div>
      <div class="total-row grand"><span>${MR3I18n.t("common.finalTotal")}</span><strong>${MR3Utils.money(totals.finalTotal)}</strong></div>
      <div class="total-row"><span>${MR3I18n.t("common.remaining")}</span><strong>${MR3Utils.money(remaining)}</strong></div>
      ${overpaid > 0 ? `<div class="total-row"><span>${MR3I18n.t("common.overpaid")}</span><strong>${MR3Utils.money(overpaid)}</strong></div>` : ""}`;
  }

  function listTable() {
    const rows = invoiceRows();
    if (!rows.length) return MR3Utils.empty(MR3I18n.t("messages.noData"), MR3I18n.t("messages.noDataHint"));
    return `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>${MR3I18n.t("invoice.number")}</th><th>${MR3I18n.t("common.date")}</th><th>${MR3I18n.t("invoice.customer")}</th><th>${MR3I18n.t("common.finalTotal")}</th><th>${MR3I18n.t("common.paid")}</th><th>${MR3I18n.t("common.actions")}</th></tr></thead>
      <tbody>${rows
        .map((invoice) => `<tr data-id="${invoice.id}">
          <td>${invoice.number}</td><td>${invoice.date}</td><td>${MR3Utils.escape(invoice.customerName)}</td><td>${MR3Utils.money(invoice.finalTotal)}</td><td>${MR3Utils.money(invoice.paidAmount)}</td>
          <td><div class="table-actions">
            ${MR3Utils.actionButton("details", "eye", MR3I18n.t("common.details"))}
            ${MR3Utils.actionButton("receipt", "print", MR3I18n.t("invoice.receipt"))}
            ${MR3Utils.actionButton("print", "print", MR3I18n.t("invoice.fullInvoice"), "icon-button secondary-button")}
            ${MR3App.can("sales.delete") ? MR3Utils.actionButton("delete", "trash", MR3I18n.t("common.delete"), "icon-button danger-button") : ""}
          </div></td>
        </tr>`)
        .join("")}</tbody></table></div>`;
  }

  function details(invoice) {
    const rows = invoice.items.map((item) => [item.productName, MR3I18n.t(`unit.${item.unitType}`), item.quantity, MR3Utils.money(item.unitPrice), MR3Utils.money(item.total)]);
    const body = `
      <div class="profile-line"><span>${MR3I18n.t("invoice.number")}</span><strong>${invoice.number}</strong></div>
      <div class="profile-line"><span>${MR3I18n.t("invoice.customer")}</span><strong>${MR3Utils.escape(invoice.customerName)}</strong></div>
      ${MR3Print.table([MR3I18n.t("invoice.product"), MR3I18n.t("common.unit"), MR3I18n.t("common.quantity"), MR3I18n.t("common.price"), MR3I18n.t("common.total")], rows)}
      ${totalsHtml(invoice, invoice.paidAmount)}`;
    const footer = `<button class="ghost-button" data-close-modal>${MR3I18n.t("common.close")}</button><button class="primary-button" id="printInvoice">${MR3Utils.icon("print")}${MR3I18n.t("common.print")}</button>`;
    const modal = MR3Utils.modal({ title: MR3I18n.t("nav.sales"), body, footer });
    modal.querySelector("#printInvoice").addEventListener("click", () => MR3Print.invoice(MR3I18n.t("nav.sales"), invoice, "sale", false));
  }

  async function deleteInvoice(id) {
    if (!MR3App.require("sales.delete")) return;
    const invoice = MR3DB.get("salesInvoices", id);
    if (!invoice || invoice.status === "deleted") return;
    if (!(await MR3Utils.confirm(MR3I18n.t("messages.confirmDelete")))) return;
    invoice.items.forEach((item) => {
      MR3Inventory.changeStock({ productId: item.productId, quantity: item.quantity, direction: "in", type: "adjustment", reference: `VOID-${invoice.number}`, unitType: item.unitType, unitPrice: item.unitPrice, notes: "Deleted sales invoice" });
    });
    MR3DB.update("salesInvoices", id, { status: "deleted" });
    MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.deleted"));
    MR3App.render();
  }

  async function saveSale(lines, root) {
    if (!MR3App.require("sales.create")) return;
    if (!lines.length) throw new Error(MR3I18n.t("messages.emptyInvoice"));
    const totals = calc(lines, root.querySelector("#saleDiscountPercent").value, root.querySelector("#saleDiscountValue").value);
    const paid = MR3Utils.parseNumber(root.querySelector("#salePaid").value);
    const credit = root.querySelector("#saleCredit").checked;
    if (paid < 0) throw new Error(MR3I18n.t("messages.paymentMismatch"));
    if (!credit && paid + 0.01 < totals.finalTotal) throw new Error(MR3I18n.t("messages.paymentMismatch"));
    const remainingAmount = Math.max(0, totals.finalTotal - paid);
    const overpaidAmount = Math.max(0, paid - totals.finalTotal);
    for (const line of lines) {
      const product = MR3DB.get("products", line.productId);
      if (!product || MR3Production.availableUnits(product, line.unitType) < line.quantity) throw new Error(MR3I18n.t("messages.stockNotEnough"));
    }
    const number = MR3DB.counter("sales", "SI");
    const customerId = root.querySelector("#saleCustomer").value || "cus_walkin";
    const customer = MR3DB.get("customers", customerId);
    const invoice = MR3DB.insert("salesInvoices", {
      number,
      customerId,
      customerName: customer?.name || MR3I18n.t("invoice.walkIn"),
      date: MR3Utils.today(),
      items: lines,
      subtotal: totals.subtotal,
      discountType: "mixed",
      discountInput: MR3Utils.parseNumber(root.querySelector("#saleDiscountValue").value),
      discountPercent: MR3Utils.parseNumber(root.querySelector("#saleDiscountPercent").value),
      discountValue: totals.discountValue,
      finalTotal: totals.finalTotal,
      paidAmount: paid,
      remainingAmount,
      overpaidAmount,
      isCredit: credit,
      paymentMethod: root.querySelector("#salePayment").value,
      userId: MR3App.user().id,
      userName: MR3App.user().name,
      notes: root.querySelector("#saleNotes").value,
      createdAt: MR3Utils.now(),
      status: "active"
    });
    for (const line of lines) {
      MR3Inventory.changeStock({ productId: line.productId, quantity: line.quantity, direction: "out", type: "sale", reference: number, unitType: line.unitType, unitPrice: line.unitPrice, notes: invoice.notes });
      const product = MR3DB.get("products", line.productId);
      if (product.stockQuantity <= 0 || product.stockQuantity <= product.minimumStockQuantity) {
        if (await MR3Utils.confirm(MR3I18n.t("messages.lastQuantity"))) {
          MR3Shortages.addShortage(product, Math.max(1, product.minimumStockQuantity - product.stockQuantity), `After ${number}`);
        }
      }
    }
    if (customerId !== "cus_walkin" && (invoice.remainingAmount > 0 || invoice.overpaidAmount > 0)) {
      MR3DB.update("customers", customerId, { balance: MR3Utils.parseNumber(customer.balance) + invoice.remainingAmount - invoice.overpaidAmount });
    }
    if (paid > 0) {
      MR3DB.insert("payments", { number: MR3DB.counter("payments", "PAY"), entityType: "customer", entityId: customerId, entityName: invoice.customerName, direction: "IN", amount: paid, paymentMethod: invoice.paymentMethod, date: invoice.date, notes: number, userId: MR3App.user().id, userName: MR3App.user().name, createdAt: MR3Utils.now() });
    }
    MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.saved"));
    MR3Print.invoice(MR3I18n.t("invoice.receipt"), invoice, "sale", true);
    MR3App.render();
  }

  function holdSale(lines, root) {
    if (!MR3App.require("sales.create")) return;
    if (!lines.length) throw new Error(MR3I18n.t("messages.emptyInvoice"));
    const totals = calc(lines, root.querySelector("#saleDiscountPercent").value, root.querySelector("#saleDiscountValue").value);
    const customerId = root.querySelector("#saleCustomer").value || "cus_walkin";
    const customer = MR3DB.get("customers", customerId);
    MR3DB.insert("heldSalesInvoices", {
      number: MR3DB.counter("heldSales", "HSI"),
      customerId,
      customerName: customer?.name || MR3I18n.t("invoice.walkIn"),
      paymentMethod: root.querySelector("#salePayment").value,
      paidAmount: MR3Utils.parseNumber(root.querySelector("#salePaid").value),
      isCredit: root.querySelector("#saleCredit").checked,
      discountPercent: MR3Utils.parseNumber(root.querySelector("#saleDiscountPercent").value),
      discountValueInput: MR3Utils.parseNumber(root.querySelector("#saleDiscountValue").value),
      discountValue: totals.discountValue,
      subtotal: totals.subtotal,
      finalTotal: totals.finalTotal,
      notes: root.querySelector("#saleNotes").value,
      items: lines.map((line) => ({ ...line })),
      userId: MR3App.user().id,
      userName: MR3App.user().name,
      heldAt: MR3Utils.now(),
      createdAt: MR3Utils.now()
    });
    MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.invoiceHeld"));
    MR3App.render();
  }

  window.MR3Pages.sales = {
    render(root) {
      let lines = [];
      root.innerHTML =
        MR3App.pageHeader("nav.saleInvoice", "page.salesHint") +
        build(root) +
        `<section class="panel"><div class="panel-header"><h3>${MR3I18n.t("common.details")}</h3></div><div class="panel-body">${listTable()}</div></section>`;
      const productInput = root.querySelector("#saleProduct");
      const unitInput = root.querySelector("#saleUnit");
      const priceInput = root.querySelector("#salePrice");
      const refreshPrice = () => {
        const product = MR3DB.get("products", productInput.value);
        const allowed = MR3App.saleUnitsForProduct(product);
        unitInput.innerHTML = MR3Utils.optionsHtml(allowed, allowed[0]?.value || "");
        unitInput.disabled = allowed.length === 0;
        priceInput.value = allowed.length ? MR3App.productPrice(product, unitInput.value, "sale") : "";
      };
      const refreshTotals = () => {
        const totals = calc(lines, root.querySelector("#saleDiscountPercent").value, root.querySelector("#saleDiscountValue").value);
        root.querySelector("#saleLineTable").innerHTML = lineTable(lines);
        root.querySelector("#saleTotals").innerHTML = totalsHtml(totals, root.querySelector("#salePaid").value);
        root.querySelector("#saleSubtotalView").value = MR3Utils.money(totals.subtotal);
        root.querySelector("#saleFinalView").value = MR3Utils.money(totals.finalTotal);
        root.querySelector("#saleRemainingView").value = MR3Utils.money(Math.max(0, totals.finalTotal - MR3Utils.parseNumber(root.querySelector("#salePaid").value)));
        root.querySelectorAll("[data-action='removeLine']").forEach((button) => {
          button.addEventListener("click", () => {
            lines.splice(Number(button.closest("[data-index]").dataset.index), 1);
            refreshTotals();
          });
        });
      };
      const loadHeldSale = () => {
        const heldId = sessionStorage.getItem("mr3-resume-sale");
        if (!heldId) return;
        sessionStorage.removeItem("mr3-resume-sale");
        const held = MR3DB.get("heldSalesInvoices", heldId);
        if (!held) return;
        lines = (held.items || []).map((line) => ({ ...line }));
        root.querySelector("#saleCustomer").value = held.customerId === "cus_walkin" ? "" : held.customerId;
        root.querySelector("#salePayment").value = held.paymentMethod || "cash";
        root.querySelector("#salePaid").value = held.paidAmount || 0;
        root.querySelector("#saleCredit").checked = Boolean(held.isCredit);
        root.querySelector("#saleDiscountPercent").value = held.discountPercent || 0;
        root.querySelector("#saleDiscountValue").value = held.discountValueInput || 0;
        root.querySelector("#saleNotes").value = held.notes || "";
        MR3DB.remove("heldSalesInvoices", heldId);
        MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.invoiceResumed"));
      };
      productInput.addEventListener("change", refreshPrice);
      unitInput.addEventListener("change", () => {
        const product = MR3DB.get("products", productInput.value);
        priceInput.value = MR3App.productPrice(product, unitInput.value, "sale");
      });
      const addSaleLine = () => {
        const product = MR3DB.get("products", productInput.value);
        const quantity = MR3Utils.parseNumber(root.querySelector("#saleQty").value);
        const price = MR3Utils.parseNumber(priceInput.value);
        const allowedUnits = MR3App.saleUnitsForProduct(product).map((unit) => unit.value);
        if (!product || quantity <= 0 || price < 0) {
          MR3Utils.toast("error", MR3I18n.t("messages.failed"), MR3I18n.t("messages.positiveNumber"));
          return;
        }
        if (!allowedUnits.includes(unitInput.value) || price <= 0) {
          MR3Utils.toast("error", MR3I18n.t("messages.failed"), MR3I18n.t("messages.unitUnavailable"));
          return;
        }
        if (quantity > MR3Production.availableUnits(product, unitInput.value)) {
          MR3Utils.toast("error", MR3I18n.t("messages.failed"), MR3I18n.t("messages.stockNotEnough"));
          return;
        }
        lines.push({ productId: product.id, productName: MR3App.productName(product), unitType: unitInput.value, quantity, unitPrice: price, discountValue: 0, total: quantity * price });
        root.querySelector("#saleQty").value = 1;
        refreshTotals();
      };
      root.querySelector("#addSaleLine").addEventListener("click", addSaleLine);
      root.addEventListener("keydown", (event) => {
        if (event.key === "Insert") {
          event.preventDefault();
          addSaleLine();
        }
      });
      ["saleDiscountPercent", "saleDiscountValue", "salePaid"].forEach((id) => root.querySelector(`#${id}`).addEventListener("input", refreshTotals));
      root.querySelector("#saveSale")?.addEventListener("click", async (event) => {
        const button = event.currentTarget;
        MR3Utils.setButtonLoading(button, true);
        try {
          await saveSale(lines, root);
        } catch (error) {
          MR3Utils.setButtonLoading(button, false);
          MR3Utils.toast("error", MR3I18n.t("messages.failed"), error.message);
        }
      });
      root.querySelector("#holdSale")?.addEventListener("click", (event) => {
        const button = event.currentTarget;
        MR3Utils.setButtonLoading(button, true);
        try {
          holdSale(lines, root);
        } catch (error) {
          MR3Utils.setButtonLoading(button, false);
          MR3Utils.toast("error", MR3I18n.t("messages.failed"), error.message);
        }
      });
      MR3App.bindTableActions(root, {
        details: (id) => details(MR3DB.get("salesInvoices", id)),
        receipt: (id) => MR3Print.invoice(MR3I18n.t("invoice.receipt"), MR3DB.get("salesInvoices", id), "sale", true),
        print: (id) => MR3Print.invoice(MR3I18n.t("nav.sales"), MR3DB.get("salesInvoices", id), "sale", false),
        delete: deleteInvoice
      });
      refreshPrice();
      loadHeldSale();
      refreshTotals();
    }
  };

  window.MR3Pages.salesPending = {
    render(root) {
      const rows = MR3DB.all("heldSalesInvoices").sort((a, b) => String(b.heldAt).localeCompare(String(a.heldAt)));
      const table = rows.length
        ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>${MR3I18n.t("invoice.number")}</th><th>${MR3I18n.t("invoice.heldAt")}</th><th>${MR3I18n.t("invoice.customer")}</th><th>${MR3I18n.t("common.finalTotal")}</th><th>${MR3I18n.t("common.user")}</th><th>${MR3I18n.t("common.actions")}</th></tr></thead><tbody>
          ${rows.map((invoice) => `<tr data-id="${invoice.id}"><td>${invoice.number}</td><td>${MR3Utils.dateTime(invoice.heldAt)}</td><td>${MR3Utils.escape(invoice.customerName)}</td><td>${MR3Utils.money(invoice.finalTotal)}</td><td>${MR3Utils.escape(invoice.userName || "")}</td><td><div class="table-actions">${MR3Utils.actionButton("resume", "edit", MR3I18n.t("invoice.resume"), "icon-button success-button")}${MR3Utils.actionButton("delete", "trash", MR3I18n.t("common.delete"), "icon-button danger-button")}</div></td></tr>`).join("")}
        </tbody></table></div>`
        : MR3Utils.empty(MR3I18n.t("invoice.noHeld"), "");
      root.innerHTML = MR3App.pageHeader("nav.salesPending", "") + `<section class="panel"><div class="panel-body">${table}</div></section>`;
      MR3App.bindTableActions(root, {
        resume: (id) => {
          sessionStorage.setItem("mr3-resume-sale", id);
          MR3App.navigate("sales");
        },
        delete: async (id) => {
          if (!(await MR3Utils.confirm(MR3I18n.t("messages.confirmDelete")))) return;
          MR3DB.remove("heldSalesInvoices", id);
          MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.deleted"));
          MR3App.render();
        }
      });
    }
  };
})();
