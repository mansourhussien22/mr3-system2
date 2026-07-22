(function () {
  function openForm(expense) {
    const isEdit = Boolean(expense);
    if (!MR3App.require(isEdit ? "expenses.update" : "expenses.create")) return;
    MR3Utils.formModal({
      title: isEdit ? MR3I18n.t("common.edit") : MR3I18n.t("expense.add"),
      fields: [
        { name: "title", label: MR3I18n.t("common.title"), required: true },
        { name: "amount", label: MR3I18n.t("common.amount"), type: "number", min: 0.01, step: "0.01", required: true },
        { name: "paymentMethod", label: MR3I18n.t("common.paymentMethod"), type: "select", options: MR3Seed.PAYMENT_METHODS.map((m) => ({ value: m, label: MR3I18n.t(`pay.${m}`) })) },
        { name: "date", label: MR3I18n.t("common.date"), type: "date", value: MR3Utils.today(), required: true },
        { name: "notes", label: MR3I18n.t("common.notes"), type: "textarea", wide: true }
      ],
      values: { date: MR3Utils.today(), paymentMethod: "cash", ...expense },
      onSubmit(data) {
        const amount = MR3Utils.parseNumber(data.amount);
        if (amount <= 0) throw new Error(MR3I18n.t("messages.positiveNumber"));
        if (isEdit) MR3DB.update("expenses", expense.id, { ...data, amount });
        else MR3DB.insert("expenses", { ...data, amount, number: MR3DB.counter("expenses", "EXP"), userId: MR3App.user().id, userName: MR3App.user().name, createdAt: MR3Utils.now(), updatedAt: MR3Utils.now() });
        MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.saved"));
        MR3App.render();
      }
    });
  }

  async function deleteExpense(id) {
    if (!MR3App.require("expenses.delete")) return;
    if (!(await MR3Utils.confirm(MR3I18n.t("messages.confirmDelete")))) return;
    MR3DB.remove("expenses", id);
    MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.deleted"));
    MR3App.render();
  }

  function table(rows) {
    if (!rows.length) return MR3Utils.empty(MR3I18n.t("messages.noData"), MR3I18n.t("messages.noDataHint"));
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>${MR3I18n.t("invoice.number")}</th><th>${MR3I18n.t("common.date")}</th><th>${MR3I18n.t("common.title")}</th><th>${MR3I18n.t("common.amount")}</th><th>${MR3I18n.t("common.paymentMethod")}</th><th>${MR3I18n.t("common.actions")}</th></tr></thead><tbody>
      ${rows.map((expense) => `<tr data-id="${expense.id}"><td>${expense.number}</td><td>${expense.date}</td><td>${MR3Utils.escape(expense.title)}</td><td>${MR3Utils.money(expense.amount)}</td><td>${MR3I18n.t(`pay.${expense.paymentMethod}`)}</td><td><div class="table-actions">
        ${MR3App.can("expenses.update") ? MR3Utils.actionButton("edit", "edit", MR3I18n.t("common.edit")) : ""}
        ${MR3App.can("expenses.delete") ? MR3Utils.actionButton("delete", "trash", MR3I18n.t("common.delete"), "icon-button danger-button") : ""}
      </div></td></tr>`).join("")}
    </tbody></table></div>`;
  }

  window.MR3Pages.expenses = {
    render(root) {
      const tools = MR3App.can("expenses.create") ? `<button id="addExpense" class="primary-button">${MR3Utils.icon("plus")}${MR3I18n.t("expense.add")}</button>` : "";
      root.innerHTML = MR3App.pageHeader("nav.expenses", "", tools) + `<section class="panel"><div class="panel-body">${table(MR3DB.all("expenses"))}</div></section>`;
      root.querySelector("#addExpense")?.addEventListener("click", () => openForm());
      MR3App.bindTableActions(root, { edit: (id) => openForm(MR3DB.get("expenses", id)), delete: deleteExpense });
    }
  };
})();
