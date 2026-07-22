(function () {
  function header(title) {
    const settings = MR3DB.getSettings();
    const business = MR3I18n.isArabic() ? settings.businessNameAr : settings.businessNameEn;
    return `
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:14px">
        <div>
          <h1>MR3 System</h1>
          <h2>${MR3Utils.escape(business)}</h2>
          <p>${MR3Utils.escape(settings.phone)} - ${MR3Utils.escape(settings.address)}</p>
        </div>
        <div style="text-align:end">
          <h2>${MR3Utils.escape(title)}</h2>
          <p>${MR3Utils.dateTime(new Date().toISOString())}</p>
        </div>
      </div>`;
  }

  function table(headers, rows) {
    return `<table><thead><tr>${headers.map((h) => `<th>${MR3Utils.escape(h)}</th>`).join("")}</tr></thead><tbody>${rows
      .map((row) => `<tr>${row.map((cell) => `<td>${MR3Utils.escape(cell)}</td>`).join("")}</tr>`)
      .join("")}</tbody></table>`;
  }

  function printHtml(title, body, receipt) {
    const host = MR3Utils.$("#printHost");
    host.innerHTML = `<section class="print-document ${receipt ? "receipt-paper" : ""}" dir="${document.documentElement.dir}">${header(title)}${body}<p style="margin-top:16px;text-align:center">${MR3Utils.escape(MR3DB.getSettings().receiptFooter)}</p></section>`;
    MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.printReady"));
    setTimeout(() => window.print(), 100);
  }

  function invoice(title, invoice, type, receipt) {
    const partyLabel = type === "purchase" ? MR3I18n.t("invoice.supplier") : MR3I18n.t("invoice.customer");
    const party = type === "purchase" ? invoice.supplierName : invoice.customerName || MR3I18n.t("invoice.walkIn");
    const rows = (invoice.items || []).map((item) => [
      item.productName,
      MR3I18n.t(`unit.${item.unitType}`),
      item.quantity,
      MR3Utils.money(item.unitPrice),
      MR3Utils.money(item.discountValue || 0),
      MR3Utils.money(item.total)
    ]);
    const body = `
      <p><strong>${MR3I18n.t("invoice.number")}:</strong> ${MR3Utils.escape(invoice.number)}</p>
      <p><strong>${MR3I18n.t("common.date")}:</strong> ${MR3Utils.escape(invoice.date)}</p>
      <p><strong>${partyLabel}:</strong> ${MR3Utils.escape(party)}</p>
      <p><strong>${MR3I18n.t("common.user")}:</strong> ${MR3Utils.escape(invoice.userName || "")}</p>
      ${table([MR3I18n.t("invoice.product"), MR3I18n.t("common.unit"), MR3I18n.t("common.quantity"), MR3I18n.t("common.price"), MR3I18n.t("common.discount"), MR3I18n.t("common.total")], rows)}
      <div style="margin-top:14px;text-align:end">
        <p>${MR3I18n.t("common.subtotal")}: ${MR3Utils.money(invoice.subtotal)}</p>
        <p>${MR3I18n.t("common.discount")}: ${MR3Utils.money(invoice.discountValue || 0)}</p>
        <h3>${MR3I18n.t("common.finalTotal")}: ${MR3Utils.money(invoice.finalTotal)}</h3>
        <p>${MR3I18n.t("common.paid")}: ${MR3Utils.money(invoice.paidAmount)}</p>
        <p>${MR3I18n.t("common.remaining")}: ${MR3Utils.money(invoice.remainingAmount)}</p>
        <p>${MR3I18n.t("common.paymentMethod")}: ${MR3I18n.t(`pay.${invoice.paymentMethod}`)}</p>
      </div>`;
    printHtml(title, body, receipt);
  }

  function statement(title, owner, rows, balance) {
    const body = `
      <p><strong>${MR3I18n.t("common.name")}:</strong> ${MR3Utils.escape(owner.name)}</p>
      ${table([MR3I18n.t("common.date"), MR3I18n.t("movement.type"), MR3I18n.t("movement.reference"), MR3I18n.t("common.amount"), MR3I18n.t("common.notes")], rows)}
      <h3 style="text-align:end">${MR3I18n.t("common.balance")}: ${MR3Utils.money(balance)}</h3>`;
    printHtml(title, body, false);
  }

  function simple(title, headers, rows) {
    printHtml(title, table(headers, rows), false);
  }

  window.MR3Print = { printHtml, invoice, statement, simple, table };
})();
