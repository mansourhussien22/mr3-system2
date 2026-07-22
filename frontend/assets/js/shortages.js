(function () {
  function addShortage(product, requiredQuantity, notes) {
    if (!product) return null;
    const existing = MR3DB.all("shortages").find((s) => s.productId === product.id && s.status !== "resolved");
    if (existing) {
      return MR3DB.update("shortages", existing.id, {
        currentStock: product.stockQuantity,
        minimumStock: product.minimumStockQuantity,
        requiredQuantity: MR3Utils.parseNumber(existing.requiredQuantity) + MR3Utils.parseNumber(requiredQuantity || 1),
        notes: notes || existing.notes,
        updatedAt: MR3Utils.now()
      });
    }
    const number = MR3DB.counter("shortages", "SH");
    const row = MR3DB.insert("shortages", {
      number,
      productId: product.id,
      productName: MR3App.productName(product),
      code: product.code,
      currentStock: product.stockQuantity,
      minimumStock: product.minimumStockQuantity,
      requiredQuantity: MR3Utils.parseNumber(requiredQuantity || Math.max(1, product.minimumStockQuantity - product.stockQuantity)),
      status: "pending",
      notes: notes || "",
      userId: MR3App.user().id,
      userName: MR3App.user().name,
      createdAt: MR3Utils.now(),
      updatedAt: MR3Utils.now()
    });
    MR3DB.insert("movements", {
      productId: product.id,
      date: MR3Utils.today(),
      type: "shortage",
      reference: number,
      quantityIn: 0,
      quantityOut: 0,
      balanceAfter: product.stockQuantity,
      unitType: product.unitType,
      unitPrice: 0,
      userId: MR3App.user().id,
      userName: MR3App.user().name,
      notes: notes || ""
    });
    return row;
  }

  function openForm(row) {
    const isEdit = Boolean(row);
    if (!MR3App.require(isEdit ? "shortages.update" : "shortages.create")) return;
    const products = MR3DB.all("products").filter((product) => product.isActive && !product.isDeleted && product.status !== "deleted");
    MR3Utils.formModal({
      title: isEdit ? MR3I18n.t("common.edit") : MR3I18n.t("common.add"),
      fields: [
        { name: "productId", label: MR3I18n.t("invoice.product"), type: "select", options: products.map((p) => ({ value: p.id, label: `${MR3App.productName(p)} - ${p.code}` })), required: true, disabled: isEdit },
        { name: "requiredQuantity", label: MR3I18n.t("shortage.required"), type: "number", min: 1, step: "1", required: true },
        { name: "status", label: MR3I18n.t("common.status"), type: "select", options: ["pending", "ordered", "resolved"].map((s) => ({ value: s, label: MR3I18n.t(`shortage.${s}`) })) },
        { name: "notes", label: MR3I18n.t("common.notes"), type: "textarea", wide: true }
      ],
      values: { status: "pending", ...row },
      onSubmit(data) {
        const product = MR3DB.get("products", data.productId || row.productId);
        if (isEdit) {
          MR3DB.update("shortages", row.id, {
            ...data,
            productId: product.id,
            productName: MR3App.productName(product),
            code: product.code,
            currentStock: product.stockQuantity,
            minimumStock: product.minimumStockQuantity,
            requiredQuantity: MR3Utils.parseNumber(data.requiredQuantity)
          });
        } else {
          addShortage(product, data.requiredQuantity, data.notes);
        }
        MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.saved"));
        MR3App.render();
      }
    });
  }

  async function deleteRow(id) {
    if (!MR3App.require("shortages.delete")) return;
    if (!(await MR3Utils.confirm(MR3I18n.t("messages.confirmDelete")))) return;
    MR3DB.remove("shortages", id);
    MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.deleted"));
    MR3App.render();
  }

  function setStatus(id, status) {
    if (!MR3App.require("shortages.update")) return;
    MR3DB.update("shortages", id, { status });
    MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.saved"));
    MR3App.render();
  }

  function renderTable(rows) {
    if (!rows.length) return MR3Utils.empty(MR3I18n.t("messages.noData"), MR3I18n.t("messages.noDataHint"));
    return `<div class="table-wrap"><table class="data-table">
      <thead><tr>
        <th>${MR3I18n.t("invoice.number")}</th>
        <th>${MR3I18n.t("invoice.product")}</th>
        <th>${MR3I18n.t("product.code")}</th>
        <th>${MR3I18n.t("product.stock")}</th>
        <th>${MR3I18n.t("product.minStock")}</th>
        <th>${MR3I18n.t("shortage.required")}</th>
        <th>${MR3I18n.t("common.status")}</th>
        <th>${MR3I18n.t("common.actions")}</th>
      </tr></thead>
      <tbody>${rows
        .map((row) => `<tr data-id="${row.id}">
          <td>${MR3Utils.escape(row.number)}</td>
          <td>${MR3Utils.escape(row.productName)}</td>
          <td>${MR3Utils.escape(row.code)}</td>
          <td>${row.currentStock}</td>
          <td>${row.minimumStock}</td>
          <td>${row.requiredQuantity}</td>
          <td>${MR3Utils.badge(MR3I18n.t(`shortage.${row.status}`), row.status === "resolved" ? "success" : row.status === "ordered" ? "info" : "warning")}</td>
          <td><div class="table-actions">
            ${MR3App.can("shortages.update") ? MR3Utils.actionButton("edit", "edit", MR3I18n.t("common.edit")) : ""}
            ${MR3App.can("shortages.update") ? MR3Utils.actionButton("ordered", "cart", MR3I18n.t("shortage.ordered"), "icon-button warning-button") : ""}
            ${MR3App.can("shortages.update") ? MR3Utils.actionButton("resolved", "check", MR3I18n.t("shortage.resolved"), "icon-button success-button") : ""}
            ${MR3App.can("shortages.delete") ? MR3Utils.actionButton("delete", "trash", MR3I18n.t("common.delete"), "icon-button danger-button") : ""}
          </div></td>
        </tr>`)
        .join("")}</tbody>
    </table></div>`;
  }

  window.MR3Shortages = { addShortage };
  window.MR3Pages.shortages = {
    render(root) {
      const tools = MR3App.can("shortages.create") ? `<button id="addShortage" class="primary-button">${MR3Utils.icon("plus")}${MR3I18n.t("common.add")}</button>` : "";
      root.innerHTML =
        MR3App.pageHeader("nav.shortages", "", tools) +
        `<section class="panel"><div class="panel-body">${renderTable(MR3DB.all("shortages"))}</div></section>`;
      root.querySelector("#addShortage")?.addEventListener("click", () => openForm());
      MR3App.bindTableActions(root, {
        edit: (id) => openForm(MR3DB.get("shortages", id)),
        ordered: (id) => setStatus(id, "ordered"),
        resolved: (id) => setStatus(id, "resolved"),
        delete: deleteRow
      });
    }
  };
})();
