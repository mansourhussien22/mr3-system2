(function () {
  function fields(customer) {
    return [
      { name: "code", label: MR3I18n.t("customer.code"), required: true, readonly: !MR3App.can("settings.manage") },
      { name: "name", label: MR3I18n.t("common.name"), required: true },
      { name: "phone", label: MR3I18n.t("common.phone") },
      { name: "address", label: MR3I18n.t("common.address"), wide: true },
      { name: "openingBalance", label: MR3I18n.t("common.openingBalance"), type: "number", min: 0, step: "0.01" },
      { name: "creditLimit", label: MR3I18n.t("common.creditLimit"), type: "number", min: 0, step: "0.01" },
      { name: "notes", label: MR3I18n.t("common.notes"), type: "textarea", wide: true }
    ];
  }

  function openForm(customer) {
    const isEdit = Boolean(customer);
    if (!MR3App.require(isEdit ? "customers.update" : "customers.create")) return;
    MR3Utils.formModal({
      title: isEdit ? MR3I18n.t("common.edit") : MR3I18n.t("common.add"),
      fields: fields(customer),
      values: { code: customer?.code || MR3DB.nextCode("customerCodes", "CUST", 6), creditLimit: 0, ...customer },
      onSubmit(data) {
        if (MR3DB.all("customers").some((row) => row.id !== customer?.id && row.code === data.code)) throw new Error(MR3I18n.t("messages.duplicateCode"));
        const patch = { ...data, openingBalance: MR3Utils.parseNumber(data.openingBalance), creditLimit: MR3Utils.parseNumber(data.creditLimit), balance: isEdit ? customer.balance : MR3Utils.parseNumber(data.openingBalance), updatedAt: MR3Utils.now() };
        if (isEdit) MR3DB.update("customers", customer.id, patch);
        else MR3DB.insert("customers", { ...patch, createdAt: MR3Utils.now() });
        MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.saved"));
        MR3App.render();
      }
    });
  }

  function statementRows(customer) {
    const rows = [[customer.createdAt?.slice(0, 10) || "", MR3I18n.t("common.openingBalance"), "OPEN", customer.openingBalance || 0, ""]];
    MR3DB.all("salesInvoices").filter((i) => i.customerId === customer.id && i.status !== "deleted").forEach((invoice) => rows.push([invoice.date, MR3I18n.t("nav.sales"), invoice.number, invoice.finalTotal, invoice.notes || ""]));
    MR3DB.all("payments").filter((p) => p.entityType === "customer" && p.entityId === customer.id).forEach((payment) => rows.push([payment.date, payment.direction === "IN" ? MR3I18n.t("payment.receive") : MR3I18n.t("common.refund"), payment.number, payment.direction === "IN" ? -payment.amount : payment.amount, payment.notes || ""]));
    MR3DB.all("salesReturns").filter((r) => {
      const invoice = MR3DB.get("salesInvoices", r.invoiceId);
      return invoice?.customerId === customer.id;
    }).forEach((ret) => rows.push([ret.date, MR3I18n.t("nav.salesReturns"), ret.number, -ret.total, ret.notes || ""]));
    return rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  }

  function openStatement(customer) {
    const rows = statementRows(customer);
    const body = MR3Print.table([MR3I18n.t("common.date"), MR3I18n.t("movement.type"), MR3I18n.t("movement.reference"), MR3I18n.t("common.amount"), MR3I18n.t("common.notes")], rows.map((r) => [r[0], r[1], r[2], MR3Utils.money(r[3]), r[4]])) + `<h3 style="text-align:end">${MR3I18n.t("common.balance")}: ${MR3Utils.money(customer.balance)}</h3>`;
    const footer = `<button class="ghost-button" data-close-modal>${MR3I18n.t("common.close")}</button><button id="printStatement" class="primary-button">${MR3Utils.icon("print")}${MR3I18n.t("common.print")}</button>`;
    const modal = MR3Utils.modal({ title: MR3I18n.t("customer.statement"), body, footer });
    modal.querySelector("#printStatement").addEventListener("click", () => MR3Print.statement(MR3I18n.t("customer.statement"), customer, rows.map((r) => [r[0], r[1], r[2], MR3Utils.money(r[3]), r[4]]), customer.balance));
  }

  function openCustomerPayment(customer, mode) {
    if (!MR3App.require("payments.create")) return;
    const isReceive = mode !== "pay";
    MR3Utils.formModal({
      title: MR3I18n.t(isReceive ? "payment.receive" : "payment.payCustomer"),
      fields: [
        { name: "amount", label: MR3I18n.t("common.amount"), type: "number", min: 0.01, step: "0.01", required: true },
        { name: "paymentMethod", label: MR3I18n.t("common.paymentMethod"), type: "select", options: MR3Seed.PAYMENT_METHODS.map((method) => ({ value: method, label: MR3I18n.t(`pay.${method}`) })) },
        { name: "date", label: MR3I18n.t("common.date"), type: "date", value: MR3Utils.today(), required: true },
        { name: "notes", label: MR3I18n.t("common.notes"), type: "textarea", wide: true }
      ],
      values: { date: MR3Utils.today(), amount: Math.max(0, isReceive ? MR3Utils.parseNumber(customer.balance) : -MR3Utils.parseNumber(customer.balance)) },
      onSubmit(data) {
        const amount = MR3Utils.parseNumber(data.amount);
        if (amount <= 0) throw new Error(MR3I18n.t("messages.positiveNumber"));
        const before = MR3Utils.parseNumber(customer.balance);
        const after = isReceive ? before - amount : before + amount;
        MR3DB.insert("payments", {
          number: MR3DB.counter("payments", "PAY"),
          entityType: "customer",
          entityId: customer.id,
          entityName: customer.name,
          direction: isReceive ? "IN" : "OUT",
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
        MR3DB.update("customers", customer.id, { balance: after });
        MR3DB.audit({ action: isReceive ? "customer.collection" : "customer.payment", entityType: "customer", entityId: customer.id, oldValue: { balance: before }, newValue: { balance: after }, reason: data.notes || "" });
        MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.saved"));
        MR3App.render();
      }
    });
  }

  async function deleteCustomer(id) {
    if (!MR3App.require("customers.delete")) return;
    if (id === "cus_walkin") return;
    if (!(await MR3Utils.confirm(MR3I18n.t("messages.confirmDelete")))) return;
    MR3DB.update("customers", id, { isDeleted: true, status: "deleted", deletedAt: MR3Utils.now(), deletedBy: MR3App.user().id });
    MR3DB.audit({ action: "customer.delete", entityType: "customer", entityId: id, reason: "Soft delete" });
    MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.deleted"));
    MR3App.render();
  }

  function table(rows) {
    if (!rows.length) return MR3Utils.empty(MR3I18n.t("messages.noData"), MR3I18n.t("messages.noDataHint"));
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>${MR3I18n.t("customer.code")}</th><th>${MR3I18n.t("common.name")}</th><th>${MR3I18n.t("common.phone")}</th><th>${MR3I18n.t("common.balance")}</th><th>${MR3I18n.t("common.creditLimit")}</th><th>${MR3I18n.t("common.actions")}</th></tr></thead><tbody>
      ${rows.map((customer) => `<tr data-id="${customer.id}"><td>${MR3Utils.escape(customer.code || "")}</td><td>${MR3Utils.escape(customer.name)}</td><td>${MR3Utils.escape(customer.phone || "")}</td><td>${MR3Utils.money(customer.balance)}</td><td>${MR3Utils.money(customer.creditLimit || 0)}</td><td><div class="table-actions">
        ${MR3Utils.actionButton("statement", "invoice", MR3I18n.t("customer.statement"))}
        ${MR3App.can("payments.create") && customer.id !== "cus_walkin" ? MR3Utils.actionButton("collect", "wallet", MR3I18n.t("payment.receive"), "icon-button success-button") : ""}
        ${MR3App.can("payments.create") && customer.id !== "cus_walkin" ? MR3Utils.actionButton("pay", "wallet", MR3I18n.t("payment.payCustomer"), "icon-button warning-button") : ""}
        ${MR3App.can("customers.update") && customer.id !== "cus_walkin" ? MR3Utils.actionButton("edit", "edit", MR3I18n.t("common.edit")) : ""}
        ${MR3App.can("customers.delete") && customer.id !== "cus_walkin" ? MR3Utils.actionButton("delete", "trash", MR3I18n.t("common.delete"), "icon-button danger-button") : ""}
      </div></td></tr>`).join("")}
    </tbody></table></div>`;
  }

  window.MR3Pages.customers = {
    render(root) {
      const tools = MR3App.can("customers.create") ? `<button id="addCustomer" class="primary-button">${MR3Utils.icon("plus")}${MR3I18n.t("common.add")}</button>` : "";
      root.innerHTML = MR3App.pageHeader("nav.customers", "", tools) + `<section class="panel"><div class="panel-body"><label class="field"><span>${MR3I18n.t("common.search")}</span><input id="customerSearch" class="search-input" /></label><div id="customerTable" style="margin-top:14px"></div></div></section>`;
      const refresh = () => {
        const query = root.querySelector("#customerSearch").value;
        const rows = MR3DB.all("customers").filter((c) => !c.isDeleted && c.status !== "deleted" && MR3Utils.textMatch(c, query, ["code", "name", "phone", "address"]));
        root.querySelector("#customerTable").innerHTML = table(rows);
        MR3App.bindTableActions(root.querySelector("#customerTable"), { edit: (id) => openForm(MR3DB.get("customers", id)), delete: deleteCustomer, statement: (id) => openStatement(MR3DB.get("customers", id)), collect: (id) => openCustomerPayment(MR3DB.get("customers", id), "receive"), pay: (id) => openCustomerPayment(MR3DB.get("customers", id), "pay") });
      };
      root.querySelector("#addCustomer")?.addEventListener("click", () => openForm());
      root.querySelector("#customerSearch").addEventListener("input", refresh);
      refresh();
    }
  };
})();
