(function () {
  const reports = [
    ["sales", "report.sales"],
    ["purchases", "report.purchases"],
    ["profit", "report.profit"],
    ["expenses", "report.expenses"],
    ["inventory", "report.inventory"],
    ["topSelling", "report.topSelling"],
    ["customerBalances", "report.customerBalances"],
    ["supplierBalances", "report.supplierBalances"],
    ["paymentMethods", "report.paymentMethods"],
    ["shortages", "report.shortages"],
    ["expiry", "report.expiry"]
  ];

  function range(root) {
    return { from: root.querySelector("#reportFrom").value, to: root.querySelector("#reportTo").value };
  }

  function rowsFor(type, r) {
    if (type === "sales") return MR3DB.all("salesInvoices").filter((i) => i.status !== "deleted" && MR3Utils.inDateRange(i.date, r.from, r.to)).map((i) => [i.date, i.number, i.customerName, MR3Utils.money(i.finalTotal), MR3Utils.money(i.paidAmount), MR3Utils.money(i.remainingAmount)]);
    if (type === "purchases") return MR3DB.all("purchaseInvoices").filter((i) => i.status !== "deleted" && MR3Utils.inDateRange(i.date, r.from, r.to)).map((i) => [i.date, i.number, i.supplierName, MR3Utils.money(i.finalTotal), MR3Utils.money(i.paidAmount), MR3Utils.money(i.remainingAmount)]);
    if (type === "purchaseDetailed") {
      return MR3DB.all("purchaseInvoices").filter((i) => i.status !== "deleted" && MR3Utils.inDateRange(i.date, r.from, r.to)).flatMap((invoice) =>
        (invoice.items || []).map((item) => [invoice.date, invoice.number, invoice.supplierName, item.productName, item.quantity, MR3Utils.money(item.unitPrice), MR3Utils.money(item.discountValue || 0), MR3Utils.money(item.total)])
      );
    }
    if (type === "salesReturns") return MR3DB.all("salesReturns").filter((ret) => ret.status !== "deleted" && MR3Utils.inDateRange(ret.date, r.from, r.to)).map((ret) => [ret.date, ret.number, ret.invoiceNumber, MR3Utils.money(ret.total), ret.userName || ""]);
    if (type === "supplierReturns") {
      return MR3DB.all("purchaseReturns").filter((ret) => ret.status !== "deleted" && MR3Utils.inDateRange(ret.date, r.from, r.to)).map((ret) => {
        const invoice = MR3DB.get("purchaseInvoices", ret.invoiceId);
        return [ret.date, ret.number, ret.invoiceNumber, invoice?.supplierName || "", MR3Utils.money(ret.total), ret.userName || ""];
      });
    }
    if (type === "expenses") return MR3DB.all("expenses").filter((e) => MR3Utils.inDateRange(e.date, r.from, r.to)).map((e) => [e.date, e.number, e.title, MR3Utils.money(e.amount), MR3I18n.t(`pay.${e.paymentMethod}`)]);
    if (type === "inventory") return MR3DB.all("products").map((p) => [p.code, MR3App.productName(p), MR3App.categoryName(p.categoryId), p.stockQuantity, p.minimumStockQuantity, MR3Utils.date(p.expiryDate)]);
    if (type === "topSelling") {
      const totals = {};
      MR3DB.all("salesInvoices").filter((i) => i.status !== "deleted" && MR3Utils.inDateRange(i.date, r.from, r.to)).forEach((invoice) => (invoice.items || []).forEach((item) => {
        totals[item.productId] = (totals[item.productId] || 0) + MR3Utils.parseNumber(item.quantity);
      }));
      return Object.entries(totals).map(([id, qty]) => [MR3App.productName(MR3DB.get("products", id)), qty]).sort((a, b) => b[1] - a[1]);
    }
    if (type === "customerBalances") return MR3DB.all("customers").filter((c) => c.id !== "cus_walkin").map((c) => [c.name, c.phone || "", MR3Utils.money(c.balance)]);
    if (type === "salesCustomers") {
      const totals = {};
      MR3DB.all("salesInvoices").filter((i) => i.status !== "deleted" && MR3Utils.inDateRange(i.date, r.from, r.to)).forEach((invoice) => {
        totals[invoice.customerName] = (totals[invoice.customerName] || 0) + MR3Utils.parseNumber(invoice.finalTotal);
      });
      return Object.entries(totals).map(([customer, total]) => [customer, MR3Utils.money(total)]).sort((a, b) => MR3Utils.parseNumber(b[1]) - MR3Utils.parseNumber(a[1]));
    }
    if (type === "supplierBalances") return MR3DB.all("suppliers").map((s) => [s.name, s.phone || "", MR3Utils.money(s.balance)]);
    if (type === "paymentMethods") {
      const totals = {};
      MR3DB.all("payments").filter((p) => MR3Utils.inDateRange(p.date, r.from, r.to)).forEach((p) => {
        const label = MR3I18n.t(`pay.${p.paymentMethod}`);
        totals[label] = (totals[label] || 0) + MR3Utils.parseNumber(p.amount);
      });
      return Object.entries(totals).map(([method, total]) => [method, MR3Utils.money(total)]);
    }
    if (type === "shortages") return MR3DB.all("shortages").map((s) => [s.number, s.productName, s.code, s.currentStock, s.requiredQuantity, MR3I18n.t(`shortage.${s.status}`)]);
    if (type === "expiry") return MR3DB.all("products").filter((p) => p.expiryDate).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)).map((p) => [p.code, MR3App.productName(p), MR3Utils.date(p.expiryDate), p.stockQuantity]);
    if (type === "profit") {
      const sales = MR3DB.all("salesInvoices").filter((i) => i.status !== "deleted" && MR3Utils.inDateRange(i.date, r.from, r.to));
      const revenue = sales.reduce((sum, i) => sum + MR3Utils.parseNumber(i.finalTotal), 0);
      const cost = sales.flatMap((i) => i.items || []).reduce((sum, item) => sum + MR3Utils.parseNumber(item.quantity) * MR3Utils.parseNumber(MR3DB.get("products", item.productId)?.purchasePrice), 0);
      const expenses = MR3DB.all("expenses").filter((e) => MR3Utils.inDateRange(e.date, r.from, r.to)).reduce((sum, e) => sum + MR3Utils.parseNumber(e.amount), 0);
      return [[MR3I18n.t("report.salesRevenue"), MR3Utils.money(revenue)], [MR3I18n.t("report.estimatedCost"), MR3Utils.money(cost)], [MR3I18n.t("report.expenses"), MR3Utils.money(expenses)], [MR3I18n.t("report.netProfitEstimate"), MR3Utils.money(revenue - cost - expenses)]];
    }
    return [];
  }

  function invoiceRows(type, r) {
    const collection = type === "purchases" ? "purchaseInvoices" : "salesInvoices";
    return MR3DB.all(collection).filter((invoice) => invoice.status !== "deleted" && MR3Utils.inDateRange(invoice.date, r.from, r.to));
  }

  function invoiceKind(type) {
    return type === "purchases" ? "purchase" : "sale";
  }

  function invoiceParty(invoice, type) {
    if (type === "purchases") return invoice.supplierName || MR3App.supplierName(invoice.supplierId);
    return invoice.customerName || MR3App.customerName(invoice.customerId);
  }

  function invoiceDetails(invoice, type) {
    if (!invoice) return;
    const rows = (invoice.items || []).map((item) => [
      item.productName,
      MR3I18n.t(`unit.${item.unitType}`),
      item.quantity,
      MR3Utils.money(item.unitPrice),
      MR3Utils.money(item.discountValue || 0),
      MR3Utils.money(item.total)
    ]);
    const body = `
      <div class="grid-section">
        <section>
          <div class="profile-line"><span>${MR3I18n.t("invoice.number")}</span><strong>${MR3Utils.escape(invoice.number)}</strong></div>
          <div class="profile-line"><span>${MR3I18n.t("common.date")}</span><strong>${MR3Utils.escape(invoice.date)}</strong></div>
          <div class="profile-line"><span>${MR3I18n.t(type === "purchases" ? "invoice.supplier" : "invoice.customer")}</span><strong>${MR3Utils.escape(invoiceParty(invoice, type))}</strong></div>
          <div class="profile-line"><span>${MR3I18n.t("common.paymentMethod")}</span><strong>${MR3I18n.t(`pay.${invoice.paymentMethod}`)}</strong></div>
        </section>
        <section>
          <div class="profile-line"><span>${MR3I18n.t("common.subtotal")}</span><strong>${MR3Utils.money(invoice.subtotal)}</strong></div>
          <div class="profile-line"><span>${MR3I18n.t("common.discount")}</span><strong>${MR3Utils.money(invoice.discountValue || 0)}</strong></div>
          <div class="profile-line"><span>${MR3I18n.t("common.finalTotal")}</span><strong>${MR3Utils.money(invoice.finalTotal)}</strong></div>
          <div class="profile-line"><span>${MR3I18n.t("common.remaining")}</span><strong>${MR3Utils.money(invoice.remainingAmount)}</strong></div>
        </section>
      </div>
      ${MR3Print.table([MR3I18n.t("invoice.product"), MR3I18n.t("common.unit"), MR3I18n.t("common.quantity"), MR3I18n.t("common.price"), MR3I18n.t("common.discount"), MR3I18n.t("common.total")], rows)}
      <p class="muted">${MR3Utils.escape(invoice.notes || "")}</p>`;
    const footer = `<button class="ghost-button" data-close-modal>${MR3I18n.t("common.close")}</button><button id="printInvoiceFromReport" class="primary-button">${MR3Utils.icon("print")}${MR3I18n.t("common.print")}</button>`;
    const modal = MR3Utils.modal({ title: `${MR3I18n.t(type === "purchases" ? "nav.purchases" : "nav.sales")} ${invoice.number}`, body, footer });
    modal.querySelector("#printInvoiceFromReport").addEventListener("click", () => MR3Print.invoice(MR3I18n.t(type === "purchases" ? "nav.purchases" : "nav.sales"), invoice, invoiceKind(type), false));
  }

  function editableLineRows(invoice, type) {
    return `<div class="table-wrap"><table class="data-table"><thead><tr>
      <th>${MR3I18n.t("invoice.product")}</th>
      <th>${MR3I18n.t("common.unit")}</th>
      <th>${MR3I18n.t("common.quantity")}</th>
      <th>${MR3I18n.t("common.price")}</th>
      <th>${MR3I18n.t("invoice.discountValueShort")}</th>
      ${type === "purchases" ? `<th>${MR3I18n.t("product.expiry")}</th>` : ""}
    </tr></thead><tbody>${(invoice.items || [])
      .map((item, index) => `<tr data-line-index="${index}">
        <td>${MR3Utils.escape(item.productName)}</td>
        <td>${MR3I18n.t(`unit.${item.unitType}`)}</td>
        <td><input name="qty_${index}" type="number" min="0.01" step="0.01" value="${MR3Utils.escape(item.quantity)}" /></td>
        <td><input name="price_${index}" type="number" min="0" step="0.01" value="${MR3Utils.escape(item.unitPrice)}" /></td>
        <td><input name="discount_${index}" type="number" min="0" step="0.01" value="${MR3Utils.escape(item.discountValue || 0)}" /></td>
        ${type === "purchases" ? `<td><input name="expiry_${index}" type="date" value="${MR3Utils.escape(item.expiryDate || "")}" /></td>` : ""}
      </tr>`)
      .join("")}</tbody></table></div>`;
  }

  function balanceImpact(invoice, type) {
    if (type === "purchases") return MR3Utils.parseNumber(invoice.remainingAmount);
    return MR3Utils.parseNumber(invoice.remainingAmount) - MR3Utils.parseNumber(invoice.overpaidAmount);
  }

  function updatePartyBalance(invoice, next, type) {
    if (type === "purchases") {
      const oldSupplier = MR3DB.get("suppliers", invoice.supplierId);
      if (oldSupplier) MR3DB.update("suppliers", oldSupplier.id, { balance: MR3Utils.parseNumber(oldSupplier.balance) - balanceImpact(invoice, type) });
      const newSupplier = MR3DB.get("suppliers", next.supplierId);
      if (newSupplier) MR3DB.update("suppliers", newSupplier.id, { balance: MR3Utils.parseNumber(newSupplier.balance) + balanceImpact(next, type) });
      return;
    }
    if (invoice.customerId !== "cus_walkin") {
      const oldCustomer = MR3DB.get("customers", invoice.customerId);
      if (oldCustomer) MR3DB.update("customers", oldCustomer.id, { balance: MR3Utils.parseNumber(oldCustomer.balance) - balanceImpact(invoice, type) });
    }
    if (next.customerId !== "cus_walkin") {
      const newCustomer = MR3DB.get("customers", next.customerId);
      if (newCustomer) MR3DB.update("customers", newCustomer.id, { balance: MR3Utils.parseNumber(newCustomer.balance) + balanceImpact(next, type) });
    }
  }

  function applyStockDiff(invoice, nextItems, type) {
    const oldItems = invoice.items || [];
    nextItems.forEach((item, index) => {
      const old = oldItems[index] || item;
      const diff = MR3Utils.parseNumber(item.quantity) - MR3Utils.parseNumber(old.quantity);
      if (Math.abs(diff) < 0.000001) return;
      if (type === "purchases") {
        MR3Inventory.changeStock({
          productId: item.productId,
          quantity: Math.abs(diff),
          direction: diff > 0 ? "in" : "out",
          type: "purchaseEdit",
          reference: `EDIT-${invoice.number}`,
          unitType: item.unitType,
          unitPrice: item.unitPrice,
          purchaseCost: item.unitPrice,
          expiryDate: item.expiryDate,
          notes: "Invoice edit from reports"
        });
      } else {
        MR3Inventory.changeStock({
          productId: item.productId,
          quantity: Math.abs(diff),
          direction: diff > 0 ? "out" : "in",
          type: "saleEdit",
          reference: `EDIT-${invoice.number}`,
          unitType: item.unitType,
          unitPrice: item.unitPrice,
          notes: "Invoice edit from reports"
        });
      }
    });
  }

  function openInvoiceEdit(invoice, type, root) {
    if (!invoice) return;
    const isPurchase = type === "purchases";
    const partyOptions = isPurchase
      ? MR3DB.all("suppliers").filter((s) => !s.isDeleted && s.status !== "deleted").map((s) => ({ value: s.id, label: `${s.code || ""} - ${s.name}` }))
      : [{ value: "cus_walkin", label: MR3I18n.t("invoice.walkIn") }].concat(MR3DB.all("customers").filter((c) => c.id !== "cus_walkin" && !c.isDeleted && c.status !== "deleted").map((c) => ({ value: c.id, label: `${c.code || ""} - ${c.name}` })));
    const body = `<form id="invoiceReportEditForm" class="modal-form form-grid" novalidate>
      <label class="field"><span>${MR3I18n.t("common.date")}</span><input name="date" type="date" value="${MR3Utils.escape(invoice.date)}" required /></label>
      <label class="field"><span>${MR3I18n.t(isPurchase ? "invoice.supplier" : "invoice.customer")}</span><select name="partyId">${MR3Utils.optionsHtml(partyOptions, isPurchase ? invoice.supplierId : invoice.customerId)}</select></label>
      <label class="field"><span>${MR3I18n.t("common.paymentMethod")}</span><select name="paymentMethod">${MR3App.paymentOptions(invoice.paymentMethod)}</select></label>
      <label class="field"><span>${MR3I18n.t("common.paid")}</span><input name="paidAmount" type="number" min="0" step="0.01" value="${MR3Utils.escape(invoice.paidAmount || 0)}" /></label>
      <label class="field wide"><span>${MR3I18n.t("common.notes")}</span><textarea name="notes" rows="2">${MR3Utils.escape(invoice.notes || "")}</textarea></label>
      <div class="wide">${editableLineRows(invoice, type)}</div>
    </form>`;
    const footer = `<button class="ghost-button" data-close-modal>${MR3I18n.t("common.cancel")}</button><button class="primary-button" type="submit" form="invoiceReportEditForm">${MR3Utils.icon("save")}${MR3I18n.t("common.save")}</button>`;
    const modal = MR3Utils.modal({ title: `${MR3I18n.t("common.edit")} ${invoice.number}`, body, footer });
    modal.querySelector("form").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = Object.fromEntries(new FormData(form).entries());
      const items = (invoice.items || []).map((item, index) => {
        const quantity = MR3Utils.parseNumber(data[`qty_${index}`]);
        const unitPrice = MR3Utils.parseNumber(data[`price_${index}`]);
        const discountValue = Math.min(quantity * unitPrice, MR3Utils.parseNumber(data[`discount_${index}`]));
        const next = { ...item, quantity, unitPrice, discountValue, total: Math.max(0, quantity * unitPrice - discountValue) };
        if (isPurchase) next.expiryDate = data[`expiry_${index}`] || "";
        return next;
      });
      if (!items.length || items.some((item) => item.quantity <= 0 || item.unitPrice < 0)) {
        MR3Utils.toast("error", MR3I18n.t("messages.failed"), MR3I18n.t("messages.positiveNumber"));
        return;
      }
      const subtotal = items.reduce((total, item) => total + MR3Utils.parseNumber(item.quantity) * MR3Utils.parseNumber(item.unitPrice), 0);
      const discountValue = items.reduce((total, item) => total + MR3Utils.parseNumber(item.discountValue), 0);
      const finalTotal = Math.max(0, subtotal - discountValue);
      const paidAmount = MR3Utils.parseNumber(data.paidAmount);
      if (paidAmount < 0 || (isPurchase && paidAmount > finalTotal)) {
        MR3Utils.toast("error", MR3I18n.t("messages.failed"), MR3I18n.t("messages.paymentMismatch"));
        return;
      }
      const party = isPurchase ? MR3DB.get("suppliers", data.partyId) : MR3DB.get("customers", data.partyId || "cus_walkin");
      const next = {
        ...invoice,
        date: data.date,
        supplierId: isPurchase ? party.id : invoice.supplierId,
        supplierName: isPurchase ? party.name : invoice.supplierName,
        customerId: isPurchase ? invoice.customerId : party?.id || "cus_walkin",
        customerName: isPurchase ? invoice.customerName : party?.name || MR3I18n.t("invoice.walkIn"),
        paymentMethod: data.paymentMethod,
        paidAmount,
        subtotal,
        discountValue,
        finalTotal,
        remainingAmount: Math.max(0, finalTotal - paidAmount),
        overpaidAmount: Math.max(0, paidAmount - finalTotal),
        items,
        notes: data.notes,
        updatedAt: MR3Utils.now()
      };
      try {
        applyStockDiff(invoice, items, type);
        updatePartyBalance(invoice, next, type);
        MR3DB.update(isPurchase ? "purchaseInvoices" : "salesInvoices", invoice.id, next);
        MR3DB.audit({ action: `${invoiceKind(type)}.invoice.edit`, entityType: isPurchase ? "purchaseInvoice" : "salesInvoice", entityId: invoice.id, reference: invoice.number, oldValue: invoice, newValue: next });
        MR3Utils.closeModal();
        MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.saved"));
        renderReport(root, type);
      } catch (error) {
        MR3Utils.toast("error", MR3I18n.t("messages.failed"), error.message);
      }
    });
  }

  function renderInvoiceReport(root, type) {
    const rows = invoiceRows(type, range(root));
    if (!rows.length) {
      root.querySelector("#reportOutput").innerHTML = MR3Utils.empty(MR3I18n.t("messages.noData"), MR3I18n.t("messages.noDataHint"));
      return rowsFor(type, range(root));
    }
    const partyHeader = MR3I18n.t(type === "purchases" ? "invoice.supplier" : "invoice.customer");
    root.querySelector("#reportOutput").innerHTML = `<div class="table-wrap"><table class="data-table"><thead><tr>
      <th>${MR3I18n.t("common.date")}</th><th>${MR3I18n.t("invoice.number")}</th><th>${partyHeader}</th><th>${MR3I18n.t("common.finalTotal")}</th><th>${MR3I18n.t("common.paid")}</th><th>${MR3I18n.t("common.remaining")}</th><th>${MR3I18n.t("common.actions")}</th>
    </tr></thead><tbody>${rows.map((invoice) => `<tr data-id="${invoice.id}">
      <td>${invoice.date}</td><td>${invoice.number}</td><td>${MR3Utils.escape(invoiceParty(invoice, type))}</td><td>${MR3Utils.money(invoice.finalTotal)}</td><td>${MR3Utils.money(invoice.paidAmount)}</td><td>${MR3Utils.money(invoice.remainingAmount)}</td>
      <td><div class="table-actions">${MR3Utils.actionButton("view", "eye", MR3I18n.t("common.details"))}${MR3Utils.actionButton("edit", "edit", MR3I18n.t("common.edit"), "icon-button success-button")}${MR3Utils.actionButton("print", "print", MR3I18n.t("common.print"))}</div></td>
    </tr>`).join("")}</tbody></table></div>`;
    MR3App.bindTableActions(root.querySelector("#reportOutput"), {
      view: (id) => invoiceDetails(MR3DB.get(type === "purchases" ? "purchaseInvoices" : "salesInvoices", id), type),
      edit: (id) => openInvoiceEdit(MR3DB.get(type === "purchases" ? "purchaseInvoices" : "salesInvoices", id), type, root),
      print: (id) => MR3Print.invoice(MR3I18n.t(type === "purchases" ? "nav.purchases" : "nav.sales"), MR3DB.get(type === "purchases" ? "purchaseInvoices" : "salesInvoices", id), invoiceKind(type), false)
    });
    return rowsFor(type, range(root));
  }

  function renderPurchaseDetailedReport(root) {
    const r = range(root);
    const invoices = invoiceRows("purchases", r);
    const detailRows = invoices.flatMap((invoice) => (invoice.items || []).map((item) => ({ invoice, item })));
    if (!detailRows.length) {
      root.querySelector("#reportOutput").innerHTML = MR3Utils.empty(MR3I18n.t("messages.noData"), MR3I18n.t("messages.noDataHint"));
      return rowsFor("purchaseDetailed", r);
    }
    root.querySelector("#reportOutput").innerHTML = `<div class="table-wrap"><table class="data-table"><thead><tr>
      ${headers("purchaseDetailed").map((h) => `<th>${h}</th>`).join("")}<th>${MR3I18n.t("common.actions")}</th>
    </tr></thead><tbody>${detailRows.map(({ invoice, item }) => `<tr data-id="${invoice.id}">
      <td>${invoice.date}</td><td>${invoice.number}</td><td>${MR3Utils.escape(invoice.supplierName)}</td><td>${MR3Utils.escape(item.productName)}</td><td>${item.quantity}</td><td>${MR3Utils.money(item.unitPrice)}</td><td>${MR3Utils.money(item.discountValue || 0)}</td><td>${MR3Utils.money(item.total)}</td>
      <td><div class="table-actions">${MR3Utils.actionButton("view", "eye", MR3I18n.t("common.details"))}${MR3Utils.actionButton("edit", "edit", MR3I18n.t("common.edit"), "icon-button success-button")}</div></td>
    </tr>`).join("")}</tbody></table></div>`;
    MR3App.bindTableActions(root.querySelector("#reportOutput"), {
      view: (id) => invoiceDetails(MR3DB.get("purchaseInvoices", id), "purchases"),
      edit: (id) => openInvoiceEdit(MR3DB.get("purchaseInvoices", id), "purchases", root)
    });
    return rowsFor("purchaseDetailed", r);
  }

  function headers(type) {
    const simple = [MR3I18n.t("common.date"), MR3I18n.t("invoice.number"), MR3I18n.t("common.name"), MR3I18n.t("common.finalTotal"), MR3I18n.t("common.paid"), MR3I18n.t("common.remaining")];
    const map = {
      sales: simple,
      purchases: simple,
      purchaseDetailed: [MR3I18n.t("common.date"), MR3I18n.t("invoice.number"), MR3I18n.t("invoice.supplier"), MR3I18n.t("invoice.product"), MR3I18n.t("common.quantity"), MR3I18n.t("product.purchasePrice"), MR3I18n.t("invoice.discountValueShort"), MR3I18n.t("invoice.lineTotal")],
      salesReturns: [MR3I18n.t("common.date"), MR3I18n.t("invoice.number"), MR3I18n.t("movement.reference"), MR3I18n.t("common.total"), MR3I18n.t("common.user")],
      supplierReturns: [MR3I18n.t("common.date"), MR3I18n.t("invoice.number"), MR3I18n.t("movement.reference"), MR3I18n.t("invoice.supplier"), MR3I18n.t("common.total"), MR3I18n.t("common.user")],
      expenses: [MR3I18n.t("common.date"), MR3I18n.t("invoice.number"), MR3I18n.t("common.title"), MR3I18n.t("common.amount"), MR3I18n.t("common.paymentMethod")],
      inventory: [MR3I18n.t("product.code"), MR3I18n.t("common.name"), MR3I18n.t("product.category"), MR3I18n.t("product.stock"), MR3I18n.t("product.minStock"), MR3I18n.t("product.expiry")],
      topSelling: [MR3I18n.t("invoice.product"), MR3I18n.t("common.quantity")],
      customerBalances: [MR3I18n.t("common.name"), MR3I18n.t("common.phone"), MR3I18n.t("common.balance")],
      salesCustomers: [MR3I18n.t("invoice.customer"), MR3I18n.t("common.total")],
      supplierBalances: [MR3I18n.t("common.name"), MR3I18n.t("common.phone"), MR3I18n.t("common.balance")],
      paymentMethods: [MR3I18n.t("common.paymentMethod"), MR3I18n.t("common.total")],
      shortages: [MR3I18n.t("invoice.number"), MR3I18n.t("invoice.product"), MR3I18n.t("product.code"), MR3I18n.t("product.stock"), MR3I18n.t("shortage.required"), MR3I18n.t("common.status")],
      expiry: [MR3I18n.t("product.code"), MR3I18n.t("common.name"), MR3I18n.t("product.expiry"), MR3I18n.t("product.stock")],
      profit: [MR3I18n.t("common.title"), MR3I18n.t("common.amount")]
    };
    return map[type] || simple;
  }

  function renderSpecific(root, type, titleKey) {
    root.innerHTML = MR3App.pageHeader(titleKey, "page.reportsHint", `<button id="printReport" class="primary-button">${MR3Utils.icon("print")}${MR3I18n.t("common.print")}</button><button id="exportReport" class="ghost-button">${MR3Utils.icon("download")}${MR3I18n.t("common.export")}</button>`) + `
      <section class="panel"><div class="panel-body">
        <div class="filters">
          <label class="field"><span>${MR3I18n.t("common.from")}</span><input id="reportFrom" type="date" /></label>
          <label class="field"><span>${MR3I18n.t("common.to")}</span><input id="reportTo" type="date" /></label>
        </div>
        <div id="reportOutput"></div>
      </div></section>`;
    const refresh = () => renderReport(root, type);
    root.querySelectorAll("#reportFrom,#reportTo").forEach((input) => input.addEventListener("input", refresh));
    root.querySelector("#printReport").addEventListener("click", () => MR3Print.simple(MR3I18n.t(titleKey), headers(type), refresh()));
    root.querySelector("#exportReport").addEventListener("click", () => MR3Utils.downloadCsv(`mr3-${type}.csv`, [headers(type), ...refresh()]));
    refresh();
  }

  function renderReport(root, type) {
    if (type === "sales" || type === "purchases") return renderInvoiceReport(root, type);
    if (type === "purchaseDetailed") return renderPurchaseDetailedReport(root);
    const data = rowsFor(type, range(root));
    const table = data.length ? `<div class="table-wrap"><table class="data-table"><thead><tr>${headers(type).map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${data.map((row) => `<tr>${row.map((cell) => `<td>${MR3Utils.escape(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : MR3Utils.empty(MR3I18n.t("messages.noData"), MR3I18n.t("messages.noDataHint"));
    root.querySelector("#reportOutput").innerHTML = table;
    return data;
  }

  window.MR3Pages.reports = {
    render(root) {
      let current = "sales";
      root.innerHTML = MR3App.pageHeader("nav.reports", "page.reportsHint", `<button id="printReport" class="primary-button">${MR3Utils.icon("print")}${MR3I18n.t("common.print")}</button><button id="exportReport" class="ghost-button">${MR3Utils.icon("download")}${MR3I18n.t("common.export")}</button>`) + `
        <section class="panel"><div class="panel-body">
          <div class="tabs">${reports.map(([id, key]) => `<button class="tab-button ${id === current ? "active" : ""}" data-report="${id}">${MR3I18n.t(key)}</button>`).join("")}</div>
          <div class="filters">
            <label class="field"><span>${MR3I18n.t("common.from")}</span><input id="reportFrom" type="date" /></label>
            <label class="field"><span>${MR3I18n.t("common.to")}</span><input id="reportTo" type="date" /></label>
          </div>
          <div id="reportOutput"></div>
        </div></section>`;
      const refresh = () => renderReport(root, current);
      root.querySelectorAll("[data-report]").forEach((button) => button.addEventListener("click", () => {
        current = button.dataset.report;
        root.querySelectorAll("[data-report]").forEach((b) => b.classList.toggle("active", b === button));
        refresh();
      }));
      root.querySelectorAll("#reportFrom,#reportTo").forEach((input) => input.addEventListener("input", refresh));
      root.querySelector("#printReport").addEventListener("click", () => MR3Print.simple(MR3I18n.t(reports.find(([id]) => id === current)[1]), headers(current), refresh()));
      root.querySelector("#exportReport").addEventListener("click", () => MR3Utils.downloadCsv(`mr3-${current}.csv`, [headers(current), ...refresh()]));
      refresh();
    }
  };
  window.MR3Pages.salesInvoiceReport = { render: (root) => renderSpecific(root, "sales", "nav.salesInvoicesReport") };
  window.MR3Pages.salesReturnsReport = { render: (root) => renderSpecific(root, "salesReturns", "nav.salesReturnsReport") };
  window.MR3Pages.salesItemsReport = { render: (root) => renderSpecific(root, "topSelling", "nav.salesItemsReport") };
  window.MR3Pages.salesCustomersReport = { render: (root) => renderSpecific(root, "salesCustomers", "nav.salesCustomersReport") };
  window.MR3Pages.purchaseDetailedReport = { render: (root) => renderSpecific(root, "purchaseDetailed", "nav.purchaseDetailedReport") };
  window.MR3Pages.supplierReturnsReport = { render: (root) => renderSpecific(root, "supplierReturns", "nav.supplierReturnsReport") };
})();
