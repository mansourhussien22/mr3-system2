(function () {
  function fields(category) {
    return [
      { name: "nameAr", label: MR3I18n.t("category.nameAr"), required: true, value: category?.nameAr || "" },
      { name: "nameEn", label: MR3I18n.t("category.nameEn"), required: true, value: category?.nameEn || "" },
      { name: "icon", label: MR3I18n.t("category.icon"), value: category?.icon || "pill" },
      { name: "notes", label: MR3I18n.t("common.notes"), type: "textarea", wide: true, value: category?.notes || "" }
    ];
  }

  function openForm(category) {
    const isEdit = Boolean(category);
    if (!MR3App.require(isEdit ? "categories.update" : "categories.create")) return;
    MR3Utils.formModal({
      title: isEdit ? MR3I18n.t("common.edit") : MR3I18n.t("common.add"),
      fields: fields(category),
      values: category,
      onSubmit(data) {
        if (isEdit) MR3DB.update("categories", category.id, data);
        else MR3DB.insert("categories", { ...data, createdAt: MR3Utils.now(), updatedAt: MR3Utils.now() });
        MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.saved"));
        MR3App.render();
      }
    });
  }

  async function removeCategory(id) {
    if (!MR3App.require("categories.delete")) return;
    if (MR3DB.all("products").some((product) => product.categoryId === id)) {
      MR3Utils.toast("error", MR3I18n.t("messages.failed"), MR3I18n.t("messages.failed"));
      return;
    }
    if (!(await MR3Utils.confirm(MR3I18n.t("messages.confirmDelete")))) return;
    MR3DB.remove("categories", id);
    MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.deleted"));
    MR3App.render();
  }

  function table(rows) {
    if (!rows.length) return MR3Utils.empty(MR3I18n.t("messages.noData"), MR3I18n.t("messages.noDataHint"));
    return `<div class="table-wrap"><table class="data-table">
      <thead><tr>
        <th>${MR3I18n.t("category.nameAr")}</th>
        <th>${MR3I18n.t("category.nameEn")}</th>
        <th>${MR3I18n.t("common.notes")}</th>
        <th>${MR3I18n.t("common.actions")}</th>
      </tr></thead>
      <tbody>${rows
        .map(
          (category) => `<tr data-id="${category.id}">
            <td>${MR3Utils.escape(category.nameAr)}</td>
            <td>${MR3Utils.escape(category.nameEn)}</td>
            <td>${MR3Utils.escape(category.notes || "")}</td>
            <td><div class="table-actions">
              ${MR3App.can("categories.update") ? MR3Utils.actionButton("edit", "edit", MR3I18n.t("common.edit")) : ""}
              ${MR3App.can("categories.delete") ? MR3Utils.actionButton("delete", "trash", MR3I18n.t("common.delete"), "icon-button danger-button") : ""}
            </div></td>
          </tr>`
        )
        .join("")}</tbody>
    </table></div>`;
  }

  window.MR3Pages.categories = {
    render(root) {
      const tools = MR3App.can("categories.create") ? `<button class="primary-button" id="addCategory">${MR3Utils.icon("plus")}${MR3I18n.t("common.add")}</button>` : "";
      root.innerHTML =
        MR3App.pageHeader("nav.categories", "", tools) +
        `<section class="panel"><div class="panel-body">${table(MR3DB.all("categories"))}</div></section>`;
      root.querySelector("#addCategory")?.addEventListener("click", () => openForm());
      MR3App.bindTableActions(root, {
        edit: (id) => openForm(MR3DB.get("categories", id)),
        delete: removeCategory
      });
    }
  };
})();
