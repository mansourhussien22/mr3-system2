(function () {
  function returnedQty(collection, invoiceId, productId) {
    return MR3DB.all(collection)
      .filter((ret) => ret.invoiceId === invoiceId && ret.status !== "deleted")
      .flatMap((ret) => ret.items || [])
      .filter((item) => item.productId === productId)
      .reduce((total, item) => total + MR3Utils.parseNumber(item.quantity), 0);
  }

  function builder(mode) {
    const isSale = mode === "sales";
    const invoices = MR3DB.all(isSale ? "salesInvoices" : "purchaseInvoices").filter((invoice) => invoice.status !== "deleted");
    return `<section class="panel"><div class="panel-header"><h3>${MR3I18n.t(isSale ? "nav.salesReturns" : "nav.purchaseReturns")}</h3></div><div class="panel-body">
      <div class="filters">
        <label class="field"><span>${MR3I18n.t("invoice.number")}</span><select id="returnInvoice">${MR3Utils.optionsHtml(invoices, "", (invoice) => `${invoice.number} - ${isSale ? invoice.customerName : invoice.supplierName}`)}</select></label>
        <label class="field"><span>${MR3I18n.t("common.paymentMethod")}</span><select id="returnPayment">${MR3App.paymentOptions("cash")}</select></label>
        <label class="field wide"><span>${MR3I18n.t("common.notes")}</span><input id="returnNotes" /></label>
      </div>
      <div id="returnLines"></div>
      ${MR3App.can(isSale ? "salesReturns.create" : "purchaseReturns.create") ? `<button id="saveReturn" class="success-button">${MR3Utils.icon("save")}${MR3I18n.t("common.save")}</button>` : ""}
    </div></section>`;
  }

  function linesTable(invoice, mode) {
    if (!invoice) return MR3Utils.empty(MR3I18n.t("messages.noData"), MR3I18n.t("messages.noDataHint"));
    const collection = mode === "sales" ? "salesReturns" : "purchaseReturns";
    return `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>${MR3I18n.t("invoice.product")}</th><th>${MR3I18n.t("common.unit")}</th><th>${MR3I18n.t("common.quantity")}</th><th>${MR3I18n.t("common.price")}</th><th>${MR3I18n.t("common.total")}</th><th>${MR3I18n.t("common.quantity")}</th></tr></thead>
      <tbody>${invoice.items
        .map((item, index) => {
          const already = returnedQty(collection, invoice.id, item.productId);
          const max = Math.max(0, MR3Utils.parseNumber(item.quantity) - already);
          return `<tr data-index="${index}"><td>${MR3Utils.escape(item.productName)}</td><td>${MR3I18n.t(`unit.${item.unitType}`)}</td><td>${item.quantity} <span class="muted">(${max})</span></td><td>${MR3Utils.money(item.unitPrice)}</td><td>${MR3Utils.money(item.total)}</td><td><input class="returnQty" type="number" min="0" max="${max}" step="1" value="0" /></td></tr>`;
        })
        .join("")}</tbody>
    </table></div>`;
  }

  function listTable(mode) {
    const rows = MR3DB.all(mode === "sales" ? "salesReturns" : "purchaseReturns").filter((ret) => ret.status !== "deleted");
    if (!rows.length) return MR3Utils.empty(MR3I18n.t("messages.noData"), MR3I18n.t("messages.noDataHint"));
    return `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>${MR3I18n.t("invoice.number")}</th><th>${MR3I18n.t("common.date")}</th><th>${MR3I18n.t("movement.reference")}</th><th>${MR3I18n.t("common.total")}</th><th>${MR3I18n.t("common.actions")}</th></tr></thead>
      <tbody>${rows.map((ret) => `<tr data-id="${ret.id}"><td>${ret.number}</td><td>${ret.date}</td><td>${ret.invoiceNumber}</td><td>${MR3Utils.money(ret.total)}</td><td>${MR3Utils.actionButton("print", "print", MR3I18n.t("common.print"))}</td></tr>`).join("")}</tbody>
    </table></div>`;
  }

  function printReturn(ret, mode) {
    const rows = ret.items.map((item) => [item.productName, MR3I18n.t(`unit.${item.unitType}`), item.quantity, MR3Utils.money(item.unitPrice), MR3Utils.money(item.total)]);
    MR3Print.printHtml(MR3I18n.t(mode === "sales" ? "nav.salesReturns" : "nav.purchaseReturns"), `
      <p><strong>${MR3I18n.t("invoice.number")}:</strong> ${ret.number}</p>
      <p><strong>${MR3I18n.t("movement.reference")}:</strong> ${ret.invoiceNumber}</p>
      ${MR3Print.table([MR3I18n.t("invoice.product"), MR3I18n.t("common.unit"), MR3I18n.t("common.quantity"), MR3I18n.t("common.price"), MR3I18n.t("common.total")], rows)}
      <h3 style="text-align:end">${MR3I18n.t("common.total")}: ${MR3Utils.money(ret.total)}</h3>`, false);
  }

  function save(mode, root) {
    const isSale = mode === "sales";
    if (!MR3App.require(isSale ? "salesReturns.create" : "purchaseReturns.create")) return;
    const invoice = MR3DB.get(isSale ? "salesInvoices" : "purchaseInvoices", root.querySelector("#returnInvoice").value);
    if (!invoice) throw new Error(MR3I18n.t("messages.noData"));
    const rows = Array.from(root.querySelectorAll("#returnLines tbody tr"));
    const items = rows
      .map((row) => {
        const item = invoice.items[Number(row.dataset.index)];
        const quantity = MR3Utils.parseNumber(row.querySelector(".returnQty").value);
        return { ...item, quantity, total: quantity * MR3Utils.parseNumber(item.unitPrice) };
      })
      .filter((item) => item.quantity > 0);
    if (!items.length) throw new Error(MR3I18n.t("messages.emptyInvoice"));
    rows.forEach((row) => {
      const input = row.querySelector(".returnQty");
      if (MR3Utils.parseNumber(input.value) > MR3Utils.parseNumber(input.max)) throw new Error(MR3I18n.t("messages.stockNotEnough"));
    });
    if (!isSale) {
      items.forEach((item) => {
        const product = MR3DB.get("products", item.productId);
        if (product.stockQuantity < item.quantity) throw new Error(MR3I18n.t("messages.stockNotEnough"));
      });
    }
    const total = items.reduce((sum, item) => sum + item.total, 0);
    const number = MR3DB.counter(isSale ? "salesReturns" : "purchaseReturns", isSale ? "SR" : "PR");
    const ret = MR3DB.insert(isSale ? "salesReturns" : "purchaseReturns", {
      number,
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      date: MR3Utils.today(),
      items,
      total,
      paymentMethod: root.querySelector("#returnPayment").value,
      userId: MR3App.user().id,
      userName: MR3App.user().name,
      notes: root.querySelector("#returnNotes").value,
      createdAt: MR3Utils.now(),
      status: "active"
    });
    items.forEach((item) => {
      MR3Inventory.changeStock({ productId: item.productId, quantity: item.quantity, direction: isSale ? "in" : "out", type: isSale ? "salesReturn" : "purchaseReturn", reference: number, unitType: item.unitType, unitPrice: item.unitPrice, notes: ret.notes });
    });
    if (isSale && invoice.customerId !== "cus_walkin") {
      const customer = MR3DB.get("customers", invoice.customerId);
      MR3DB.update("customers", customer.id, { balance: Math.max(0, MR3Utils.parseNumber(customer.balance) - total) });
      MR3DB.insert("payments", { number: MR3DB.counter("payments", "PAY"), entityType: "customer", entityId: customer.id, entityName: customer.name, direction: "OUT", amount: total, paymentMethod: ret.paymentMethod, date: ret.date, notes: number, userId: MR3App.user().id, userName: MR3App.user().name, createdAt: MR3Utils.now() });
    }
    if (!isSale) {
      const supplier = MR3DB.get("suppliers", invoice.supplierId);
      MR3DB.update("suppliers", supplier.id, { balance: Math.max(0, MR3Utils.parseNumber(supplier.balance) - total) });
      MR3DB.insert("payments", { number: MR3DB.counter("payments", "PAY"), entityType: "supplier", entityId: supplier.id, entityName: supplier.name, direction: "IN", amount: total, paymentMethod: ret.paymentMethod, date: ret.date, notes: number, userId: MR3App.user().id, userName: MR3App.user().name, createdAt: MR3Utils.now() });
    }
    MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.saved"));
    printReturn(ret, mode);
    MR3App.render();
  }

  function renderMode(root, mode) {
    const isSale = mode === "sales";
    root.innerHTML =
      MR3App.pageHeader(isSale ? "nav.salesReturns" : "nav.purchaseReturns", "page.returnsHint") +
      builder(mode) +
      `<section class="panel"><div class="panel-header"><h3>${MR3I18n.t("common.details")}</h3></div><div class="panel-body">${listTable(mode)}</div></section>`;
    const renderLines = () => {
      const invoice = MR3DB.get(isSale ? "salesInvoices" : "purchaseInvoices", root.querySelector("#returnInvoice").value);
      root.querySelector("#returnLines").innerHTML = linesTable(invoice, mode);
    };
    root.querySelector("#returnInvoice")?.addEventListener("change", renderLines);
    root.querySelector("#saveReturn")?.addEventListener("click", () => {
      try {
        save(mode, root);
      } catch (error) {
        MR3Utils.toast("error", MR3I18n.t("messages.failed"), error.message);
      }
    });
    MR3App.bindTableActions(root, { print: (id) => printReturn(MR3DB.get(isSale ? "salesReturns" : "purchaseReturns", id), mode) });
    renderLines();
  }

  window.MR3Pages.salesReturns = { render: (root) => renderMode(root, "sales") };
  window.MR3Pages.purchaseReturns = { render: (root) => renderMode(root, "purchases") };
})();
