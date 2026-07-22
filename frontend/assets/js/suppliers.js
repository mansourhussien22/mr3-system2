(function () {
  function openForm(supplier) {
    const isEdit = Boolean(supplier);
    if (!MR3App.require(isEdit ? "suppliers.update" : "suppliers.create")) return;
    MR3Utils.formModal({
      title: isEdit ? MR3I18n.t("common.edit") : MR3I18n.t("common.add"),
      fields: [
        { name: "code", label: MR3I18n.t("invoice.supplierCode"), required: true, readonly: !MR3App.can("settings.manage") },
        { name: "name", label: MR3I18n.t("common.name"), required: true },
        { name: "phone", label: MR3I18n.t("common.phone") },
        { name: "companyName", label: MR3I18n.t("supplier.companyName") },
        { name: "address", label: MR3I18n.t("common.address"), wide: true },
        { name: "openingBalance", label: MR3I18n.t("common.openingBalance"), type: "number", min: 0, step: "0.01" },
        { name: "creditLimit", label: MR3I18n.t("common.creditLimit"), type: "number", min: 0, step: "0.01" },
        { name: "notes", label: MR3I18n.t("common.notes"), type: "textarea", wide: true }
      ],
      values: { code: supplier?.code || MR3DB.nextCode("supplierCodes", "SUP", 6), creditLimit: 0, ...supplier },
      onSubmit(data) {
        if (MR3DB.all("suppliers").some((row) => row.id !== supplier?.id && row.code === data.code)) throw new Error(MR3I18n.t("messages.duplicateCode"));
        const patch = { ...data, openingBalance: MR3Utils.parseNumber(data.openingBalance), creditLimit: MR3Utils.parseNumber(data.creditLimit), balance: isEdit ? supplier.balance : MR3Utils.parseNumber(data.openingBalance), updatedAt: MR3Utils.now() };
        if (isEdit) MR3DB.update("suppliers", supplier.id, patch);
        else MR3DB.insert("suppliers", { ...patch, createdAt: MR3Utils.now() });
        MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.saved"));
        MR3App.render();
      }
    });
  }

  function statementRows(supplier) {
    const rows = [[supplier.createdAt?.slice(0, 10) || "", MR3I18n.t("common.openingBalance"), "OPEN", supplier.openingBalance || 0, ""]];
    MR3DB.all("purchaseInvoices").filter((i) => i.supplierId === supplier.id && i.status !== "deleted").forEach((invoice) => rows.push([invoice.date, MR3I18n.t("nav.purchases"), invoice.number, invoice.finalTotal, invoice.notes || ""]));
    MR3DB.all("payments").filter((p) => p.entityType === "supplier" && p.entityId === supplier.id).forEach((payment) => rows.push([payment.date, payment.direction === "OUT" ? MR3I18n.t("payment.paySupplier") : MR3I18n.t("common.refund"), payment.number, payment.direction === "OUT" ? -payment.amount : payment.amount, payment.notes || ""]));
    MR3DB.all("purchaseReturns").filter((r) => {
      const invoice = MR3DB.get("purchaseInvoices", r.invoiceId);
      return invoice?.supplierId === supplier.id;
    }).forEach((ret) => rows.push([ret.date, MR3I18n.t("nav.purchaseReturns"), ret.number, -ret.total, ret.notes || ""]));
    return rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  }

  function openStatement(supplier) {
    const rows = statementRows(supplier);
    const printable = rows.map((r) => [r[0], r[1], r[2], MR3Utils.money(r[3]), r[4]]);
    const body = MR3Print.table([MR3I18n.t("common.date"), MR3I18n.t("movement.type"), MR3I18n.t("movement.reference"), MR3I18n.t("common.amount"), MR3I18n.t("common.notes")], printable) + `<h3 style="text-align:end">${MR3I18n.t("common.balance")}: ${MR3Utils.money(supplier.balance)}</h3>`;
    const footer = `<button class="ghost-button" data-close-modal>${MR3I18n.t("common.close")}</button><button id="printStatement" class="primary-button">${MR3Utils.icon("print")}${MR3I18n.t("common.print")}</button>`;
    const modal = MR3Utils.modal({ title: MR3I18n.t("supplier.statement"), body, footer });
    modal.querySelector("#printStatement").addEventListener("click", () => MR3Print.statement(MR3I18n.t("supplier.statement"), supplier, printable, supplier.balance));
  }

  function openSupplierPayment(supplier, mode) {
    if (!MR3App.require("payments.create")) return;
    const isPay = mode === "pay";
    MR3Utils.formModal({
      title: MR3I18n.t(isPay ? "payment.paySupplier" : "payment.receiveSupplier"),
      fields: [
        { name: "amount", label: MR3I18n.t("common.amount"), type: "number", min: 0.01, step: "0.01", required: true },
        { name: "paymentMethod", label: MR3I18n.t("common.paymentMethod"), type: "select", options: MR3Seed.PAYMENT_METHODS.map((method) => ({ value: method, label: MR3I18n.t(`pay.${method}`) })) },
        { name: "date", label: MR3I18n.t("common.date"), type: "date", value: MR3Utils.today(), required: true },
        { name: "notes", label: MR3I18n.t("common.notes"), type: "textarea", wide: true }
      ],
      values: { date: MR3Utils.today(), amount: Math.max(0, isPay ? MR3Utils.parseNumber(supplier.balance) : -MR3Utils.parseNumber(supplier.balance)) },
      onSubmit(data) {
        const amount = MR3Utils.parseNumber(data.amount);
        if (amount <= 0) throw new Error(MR3I18n.t("messages.positiveNumber"));
        const before = MR3Utils.parseNumber(supplier.balance);
        const after = isPay ? before - amount : before + amount;
        MR3DB.insert("payments", {
          number: MR3DB.counter("payments", "PAY"),
          entityType: "supplier",
          entityId: supplier.id,
          entityName: supplier.name,
          direction: isPay ? "OUT" : "IN",
          amount,
          paymentMethod: data.paymentMethod,
          date: data.date,
          notes: data.notes,
          balanceBefore: before,
          balanceAfter: after,
          userId: MR3App.user().id,
          userName: MR3App.user().name,
          createdAt: MR3Utils.now()
        });
        MR3DB.update("suppliers", supplier.id, { balance: after });
        MR3DB.audit({ action: isPay ? "supplier.payment" : "supplier.collection", entityType: "supplier", entityId: supplier.id, oldValue: { balance: before }, newValue: { balance: after }, reason: data.notes || "" });
        MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.saved"));
        MR3App.render();
      }
    });
  }

  async function deleteSupplier(id) {
    if (!MR3App.require("suppliers.delete")) return;
    if (!(await MR3Utils.confirm(MR3I18n.t("messages.confirmDelete")))) return;
    MR3DB.update("suppliers", id, { isDeleted: true, status: "deleted", deletedAt: MR3Utils.now(), deletedBy: MR3App.user().id });
    MR3DB.audit({ action: "supplier.delete", entityType: "supplier", entityId: id, reason: "Soft delete" });
    MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.deleted"));
    MR3App.render();
  }

  function table(rows) {
    if (!rows.length) return MR3Utils.empty(MR3I18n.t("messages.noData"), MR3I18n.t("messages.noDataHint"));
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>${MR3I18n.t("invoice.supplierCode")}</th><th>${MR3I18n.t("common.name")}</th><th>${MR3I18n.t("supplier.companyName")}</th><th>${MR3I18n.t("common.phone")}</th><th>${MR3I18n.t("common.balance")}</th><th>${MR3I18n.t("common.creditLimit")}</th><th>${MR3I18n.t("common.actions")}</th></tr></thead><tbody>
      ${rows.map((supplier) => `<tr data-id="${supplier.id}"><td>${MR3Utils.escape(supplier.code || "")}</td><td>${MR3Utils.escape(supplier.name)}</td><td>${MR3Utils.escape(supplier.companyName || "")}</td><td>${MR3Utils.escape(supplier.phone || "")}</td><td>${MR3Utils.money(supplier.balance)}</td><td>${MR3Utils.money(supplier.creditLimit || 0)}</td><td><div class="table-actions">
        ${MR3Utils.actionButton("statement", "invoice", MR3I18n.t("supplier.statement"))}
        ${MR3App.can("payments.create") ? MR3Utils.actionButton("pay", "wallet", MR3I18n.t("payment.paySupplier"), "icon-button warning-button") : ""}
        ${MR3App.can("payments.create") ? MR3Utils.actionButton("collect", "plus", MR3I18n.t("payment.receiveSupplier"), "icon-button success-button") : ""}
        ${MR3App.can("suppliers.update") ? MR3Utils.actionButton("edit", "edit", MR3I18n.t("common.edit")) : ""}
        ${MR3App.can("suppliers.delete") ? MR3Utils.actionButton("delete", "trash", MR3I18n.t("common.delete"), "icon-button danger-button") : ""}
      </div></td></tr>`).join("")}
    </tbody></table></div>`;
  }

  window.MR3Pages.suppliers = {
    render(root) {
      const tools = MR3App.can("suppliers.create") ? `<button id="addSupplier" class="primary-button">${MR3Utils.icon("plus")}${MR3I18n.t("common.add")}</button>` : "";
      root.innerHTML = MR3App.pageHeader("nav.suppliers", "", tools) + `<section class="panel"><div class="panel-body"><label class="field"><span>${MR3I18n.t("common.search")}</span><input id="supplierSearch" class="search-input" /></label><div id="supplierTable" style="margin-top:14px"></div></div></section>`;
      const refresh = () => {
        const query = root.querySelector("#supplierSearch").value;
        const rows = MR3DB.all("suppliers").filter((s) => !s.isDeleted && s.status !== "deleted" && MR3Utils.textMatch(s, query, ["code", "name", "companyName", "phone", "address"]));
        root.querySelector("#supplierTable").innerHTML = table(rows);
        MR3App.bindTableActions(root.querySelector("#supplierTable"), { edit: (id) => openForm(MR3DB.get("suppliers", id)), delete: deleteSupplier, statement: (id) => openStatement(MR3DB.get("suppliers", id)), pay: (id) => openSupplierPayment(MR3DB.get("suppliers", id), "pay"), collect: (id) => openSupplierPayment(MR3DB.get("suppliers", id), "collect") });
      };
      root.querySelector("#addSupplier")?.addEventListener("click", () => openForm());
      root.querySelector("#supplierSearch").addEventListener("input", refresh);
      refresh();
    }
  };
})();
