(function () {
  const operations = {
    customerReceive: { entityType: "customer", direction: "IN", title: "payment.receive", buttonClass: "success-button" },
    customerPay: { entityType: "customer", direction: "OUT", title: "payment.payCustomer", buttonClass: "warning-button" },
    supplierPay: { entityType: "supplier", direction: "OUT", title: "payment.paySupplier", buttonClass: "warning-button" },
    supplierReceive: { entityType: "supplier", direction: "IN", title: "payment.receiveSupplier", buttonClass: "success-button" }
  };

  function entityTable(entityType) {
    return entityType === "customer" ? "customers" : "suppliers";
  }

  function entityLabel(entityType) {
    return entityType === "customer" ? MR3I18n.t("invoice.customer") : MR3I18n.t("invoice.supplier");
  }

  function paymentLabel(payment) {
    if (payment.entityType === "customer" && payment.direction === "IN") return MR3I18n.t("payment.receive");
    if (payment.entityType === "customer" && payment.direction === "OUT") return MR3I18n.t("payment.payCustomer");
    if (payment.entityType === "supplier" && payment.direction === "OUT") return MR3I18n.t("payment.paySupplier");
    if (payment.entityType === "supplier" && payment.direction === "IN") return MR3I18n.t("payment.receiveSupplier");
    return payment.direction;
  }

  function nextBalance(entityType, direction, before, amount) {
    if (entityType === "customer") return direction === "IN" ? before - amount : before + amount;
    return direction === "OUT" ? before - amount : before + amount;
  }

  function suggestedAmount(entityType, direction, balance) {
    const value = MR3Utils.parseNumber(balance);
    if (entityType === "customer" && direction === "IN") return Math.max(0, value);
    if (entityType === "customer" && direction === "OUT") return Math.max(0, -value);
    if (entityType === "supplier" && direction === "OUT") return Math.max(0, value);
    return Math.max(0, -value);
  }

  function openForm(operationName) {
    if (!MR3App.require("payments.create")) return;
    const operation = operations[operationName] || operations.customerReceive;
    const entities = MR3DB.all(entityTable(operation.entityType)).filter((x) => x.id !== "cus_walkin" && !x.isDeleted && x.status !== "deleted");
    MR3Utils.formModal({
      title: MR3I18n.t(operation.title),
      fields: [
        { name: "entityId", label: entityLabel(operation.entityType), type: "select", options: entities.map((x) => ({ value: x.id, label: `${x.name} - ${MR3Utils.money(x.balance)}` })), required: true },
        { name: "amount", label: MR3I18n.t("common.amount"), type: "number", min: 0.01, step: "0.01", required: true },
        { name: "paymentMethod", label: MR3I18n.t("common.paymentMethod"), type: "select", options: MR3Seed.PAYMENT_METHODS.map((m) => ({ value: m, label: MR3I18n.t(`pay.${m}`) })) },
        { name: "date", label: MR3I18n.t("common.date"), type: "date", value: MR3Utils.today(), required: true },
        { name: "notes", label: MR3I18n.t("common.notes"), type: "textarea", wide: true }
      ],
      values: { amount: suggestedAmount(operation.entityType, operation.direction, entities[0]?.balance), date: MR3Utils.today() },
      onSubmit(data) {
        const amount = MR3Utils.parseNumber(data.amount);
        if (amount <= 0) throw new Error(MR3I18n.t("messages.positiveNumber"));
        const entity = MR3DB.get(entityTable(operation.entityType), data.entityId);
        if (!entity) throw new Error(MR3I18n.t("messages.noData"));
        const before = MR3Utils.parseNumber(entity.balance);
        const after = nextBalance(operation.entityType, operation.direction, before, amount);
        const record = MR3DB.insert("payments", {
          number: MR3DB.counter("payments", "PAY"),
          entityType: operation.entityType,
          entityId: entity.id,
          entityName: entity.name,
          direction: operation.direction,
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
        MR3DB.update(entityTable(operation.entityType), entity.id, { balance: after });
        MR3DB.audit({
          action: `${operation.entityType}.${operation.direction === "IN" ? "receive" : "pay"}`,
          entityType: operation.entityType,
          entityId: entity.id,
          reference: record.number,
          oldValue: { balance: before },
          newValue: { balance: after },
          reason: data.notes || ""
        });
        MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.saved"));
        MR3App.render();
      }
    });
  }

  function table(rows) {
    if (!rows.length) return MR3Utils.empty(MR3I18n.t("messages.noData"), MR3I18n.t("messages.noDataHint"));
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>${MR3I18n.t("invoice.number")}</th><th>${MR3I18n.t("common.date")}</th><th>${MR3I18n.t("common.name")}</th><th>${MR3I18n.t("payment.direction")}</th><th>${MR3I18n.t("common.amount")}</th><th>${MR3I18n.t("common.paymentMethod")}</th><th>${MR3I18n.t("treasury.balanceBefore")}</th><th>${MR3I18n.t("treasury.balanceAfter")}</th><th>${MR3I18n.t("common.user")}</th></tr></thead><tbody>
      ${rows.map((p) => `<tr><td>${p.number}</td><td>${p.date}</td><td>${MR3Utils.escape(p.entityName)}</td><td>${MR3Utils.badge(paymentLabel(p), p.direction === "IN" ? "success" : "warning")}</td><td>${MR3Utils.money(p.amount)}</td><td>${MR3I18n.t(`pay.${p.paymentMethod}`)}</td><td>${p.balanceBefore === undefined ? "-" : MR3Utils.money(p.balanceBefore)}</td><td>${p.balanceAfter === undefined ? "-" : MR3Utils.money(p.balanceAfter)}</td><td>${MR3Utils.escape(p.userName || "")}</td></tr>`).join("")}
    </tbody></table></div>`;
  }

  window.MR3Pages.payments = {
    render(root) {
      const tools = MR3App.can("payments.create")
        ? `<button id="receivePayment" class="success-button">${MR3Utils.icon("plus")}${MR3I18n.t("payment.receive")}</button><button id="payCustomer" class="warning-button">${MR3Utils.icon("wallet")}${MR3I18n.t("payment.payCustomer")}</button><button id="paySupplier" class="warning-button">${MR3Utils.icon("wallet")}${MR3I18n.t("payment.paySupplier")}</button><button id="receiveSupplier" class="success-button">${MR3Utils.icon("plus")}${MR3I18n.t("payment.receiveSupplier")}</button>`
        : "";
      root.innerHTML = MR3App.pageHeader("nav.payments", "", tools) + `<section class="panel"><div class="panel-body">${table(MR3DB.all("payments").sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))))}</div></section>`;
      root.querySelector("#receivePayment")?.addEventListener("click", () => openForm("customerReceive"));
      root.querySelector("#payCustomer")?.addEventListener("click", () => openForm("customerPay"));
      root.querySelector("#paySupplier")?.addEventListener("click", () => openForm("supplierPay"));
      root.querySelector("#receiveSupplier")?.addEventListener("click", () => openForm("supplierReceive"));
    }
  };
})();
