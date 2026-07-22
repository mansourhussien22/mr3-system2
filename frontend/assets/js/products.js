(function () {
  function productFields(product) {
    const categoryOptions = MR3DB.all("categories").map((c) => ({ value: c.id, label: MR3I18n.name(c) }));
    const supplierOptions = MR3DB.all("suppliers").map((s) => ({ value: s.id, label: s.name }));
    const codeReadonly = !MR3App.can("settings.manage");
    return [
      { name: "code", label: MR3I18n.t("product.code"), required: true, readonly: codeReadonly },
      { name: "barcode", label: MR3I18n.t("product.barcode"), readonly: codeReadonly },
      { name: "nameAr", label: MR3I18n.t("product.nameAr"), required: true },
      { name: "nameEn", label: MR3I18n.t("product.nameEn"), required: true },
      { name: "scientificName", label: MR3I18n.t("product.scientificName") },
      { name: "tradeName", label: MR3I18n.t("product.tradeName") },
      { name: "manufacturer", label: MR3I18n.t("product.manufacturer") },
      { name: "categoryId", label: MR3I18n.t("product.category"), type: "select", options: categoryOptions, required: true },
      { name: "supplierId", label: MR3I18n.t("product.supplier"), type: "select", options: supplierOptions },
      { name: "dosageForm", label: MR3I18n.t("product.dosageForm") },
      { name: "strength", label: MR3I18n.t("product.strength") },
      { name: "unitType", label: MR3I18n.t("product.unitType"), type: "select", options: MR3Seed.UNIT_TYPES.map((u) => ({ value: u, label: MR3I18n.t(`unit.${u}`) })), required: true },
      { name: "stripsPerBox", label: MR3I18n.t("product.stripsPerBox"), type: "number", min: 1, step: "1" },
      { name: "tabletsPerStrip", label: MR3I18n.t("product.tabletsPerStrip"), type: "number", min: 1, step: "1" },
      { name: "purchasePrice", label: MR3I18n.t("product.purchasePrice"), type: "number", min: 0, step: "0.01" },
      { name: "salePrice", label: MR3I18n.t("product.salePrice"), type: "number", min: 0, step: "0.01" },
      { name: "boxPrice", label: MR3I18n.t("product.boxPrice"), type: "number", min: 0, step: "0.01" },
      { name: "stripPrice", label: MR3I18n.t("product.stripPrice"), type: "number", min: 0, step: "0.01" },
      { name: "tabletPrice", label: MR3I18n.t("product.tabletPrice"), type: "number", min: 0, step: "0.01" },
      { name: "stockQuantity", label: MR3I18n.t("product.stock"), type: "number", min: 0, step: "1" },
      { name: "minimumStockQuantity", label: MR3I18n.t("product.minStock"), type: "number", min: 0, step: "1" },
      { name: "requiresExpiryTracking", label: MR3I18n.t("product.requiresExpiryTracking"), type: "select", options: [{ value: "true", label: MR3I18n.t("common.yes") }, { value: "false", label: MR3I18n.t("common.no") }] },
      { name: "expiryDate", label: MR3I18n.t("product.expiry"), type: "date" },
      { name: "storageConditions", label: MR3I18n.t("product.storageConditions"), wide: true },
      { name: "image", label: MR3I18n.t("product.image") },
      { name: "notes", label: MR3I18n.t("common.notes"), type: "textarea", wide: true },
      { name: "isActive", label: MR3I18n.t("common.status"), type: "select", options: [{ value: "true", label: MR3I18n.t("common.active") }, { value: "false", label: MR3I18n.t("common.inactive") }] }
    ];
  }

  function normalizeProduct(data, existing) {
    return {
      ...existing,
      ...data,
      code: data.code || existing.code || MR3DB.nextNumberCode("productCodes"),
      barcode: data.barcode || existing.barcode || MR3DB.nextBarcode(),
      isActive: String(data.isActive) !== "false",
      requiresExpiryTracking: String(data.requiresExpiryTracking) !== "false",
      purchasePrice: MR3Utils.parseNumber(data.purchasePrice),
      salePrice: MR3Utils.parseNumber(data.salePrice),
      boxPrice: MR3Utils.parseNumber(data.boxPrice),
      stripPrice: MR3Utils.parseNumber(data.stripPrice),
      tabletPrice: MR3Utils.parseNumber(data.tabletPrice),
      stockQuantity: MR3Utils.parseNumber(data.stockQuantity),
      minimumStockQuantity: MR3Utils.parseNumber(data.minimumStockQuantity),
      unitConversions: {
        stripsPerBox: Math.max(1, MR3Utils.parseNumber(data.stripsPerBox, existing.unitConversions?.stripsPerBox || 10)),
        tabletsPerStrip: Math.max(1, MR3Utils.parseNumber(data.tabletsPerStrip, existing.unitConversions?.tabletsPerStrip || 10))
      },
      updatedAt: MR3Utils.now()
    };
  }

  function duplicateExists(data, id) {
    return MR3DB.all("products").some((product) => {
      if (product.id === id) return false;
      return product.code === data.code || (data.barcode && product.barcode === data.barcode);
    });
  }

  function openProductForm(product) {
    const isEdit = Boolean(product);
    if (!MR3App.require(isEdit ? "products.update" : "products.create")) return;
    MR3Utils.formModal({
      title: isEdit ? MR3I18n.t("common.edit") : MR3I18n.t("common.add"),
      fields: productFields(product),
      values: {
        isActive: "true",
        requiresExpiryTracking: "true",
        stripsPerBox: 10,
        tabletsPerStrip: 10,
        code: product?.code || MR3DB.previewNumberCode("productCodes"),
        barcode: product?.barcode || MR3DB.nextBarcode(),
        ...product,
        requiresExpiryTracking: product ? String(product.requiresExpiryTracking !== false) : "true",
        stripsPerBox: product?.unitConversions?.stripsPerBox || 10,
        tabletsPerStrip: product?.unitConversions?.tabletsPerStrip || 10,
        isActive: product ? String(product.isActive) : "true"
      },
      three: true,
      onSubmit(data) {
        const normalized = normalizeProduct(data, product || {});
        if (!/^\d+$/.test(String(normalized.code || ""))) throw new Error(MR3I18n.t("messages.numericProductCode"));
        MR3Production.validateExpiry(normalized);
        if (duplicateExists(normalized, product?.id)) throw new Error(MR3I18n.t("messages.duplicateCode"));
        if (isEdit) {
          MR3DB.claimNumberCode("productCodes", normalized.code);
          MR3DB.update("products", product.id, normalized);
          MR3DB.audit({ action: "product.update", entityType: "product", entityId: product.id, oldValue: product, newValue: normalized });
        } else {
          MR3DB.claimNumberCode("productCodes", normalized.code);
          const created = MR3DB.insert("products", { ...normalized, createdAt: MR3Utils.now(), storeId: MR3DB.getSettings().storeId || "store_main" });
          if (created.stockQuantity > 0) {
            MR3Production.receiveBatch({ productId: created.id, quantity: created.stockQuantity, unitType: created.unitType, expiryDate: created.expiryDate, purchaseCost: created.purchasePrice, reference: "Opening" });
            MR3DB.insert("movements", {
              productId: created.id,
              date: MR3Utils.today(),
              type: "adjustment",
              reference: "Opening",
              quantityIn: created.stockQuantity,
              quantityOut: 0,
              balanceAfter: created.stockQuantity,
              unitType: created.unitType,
              unitPrice: created.purchasePrice,
              userId: MR3App.user().id,
              userName: MR3App.user().name,
              notes: "Opening stock"
            });
          }
          MR3DB.audit({ action: "product.create", entityType: "product", entityId: created.id, newValue: created });
        }
        MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.saved"));
        MR3App.render();
      }
    });
  }

  async function deleteProduct(id) {
    if (!MR3App.require("products.delete")) return;
    if (!(await MR3Utils.confirm(MR3I18n.t("messages.confirmDelete")))) return;
    MR3DB.update("products", id, { isDeleted: true, status: "deleted", isActive: false, deletedAt: MR3Utils.now(), deletedBy: MR3App.user().id });
    MR3DB.audit({ action: "product.delete", entityType: "product", entityId: id, reason: "Soft delete" });
    MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.deleted"));
    MR3App.render();
  }

  function filteredProducts(root) {
    const query = root.querySelector("#productSearch")?.value || "";
    const category = root.querySelector("#productCategoryFilter")?.value || "";
    const stock = root.querySelector("#productStockFilter")?.value || "";
    const expiry = root.querySelector("#productExpiryFilter")?.value || "";
    const today = MR3Utils.today();
    const near = new Date();
    near.setDate(near.getDate() + 60);
    const nearStr = near.toISOString().slice(0, 10);
    return MR3DB.all("products").filter((product) => {
      if (product.isDeleted || product.status === "deleted") return false;
      if (!MR3Utils.textMatch(product, query, ["nameAr", "nameEn", "code", "barcode"])) return false;
      if (category && product.categoryId !== category) return false;
      if (stock === "low" && product.stockQuantity > product.minimumStockQuantity) return false;
      if (expiry === "expired" && (!product.expiryDate || product.expiryDate >= today)) return false;
      if (expiry === "near" && (!product.expiryDate || product.expiryDate < today || product.expiryDate > nearStr)) return false;
      return true;
    });
  }

  function status(product) {
    if (!product.isActive) return MR3Utils.badge(MR3I18n.t("common.inactive"), "danger");
    if (product.stockQuantity <= product.minimumStockQuantity) return MR3Utils.badge(MR3I18n.t("nav.shortages"), "warning");
    return MR3Utils.badge(MR3I18n.t("common.active"), "success");
  }

  function renderTable(products) {
    if (!products.length) return MR3Utils.empty(MR3I18n.t("messages.noData"), MR3I18n.t("messages.noDataHint"));
    return `<div class="table-wrap"><table class="data-table">
      <thead><tr>
        <th>${MR3I18n.t("product.code")}</th>
        <th>${MR3I18n.t("common.name")}</th>
        <th>${MR3I18n.t("product.category")}</th>
        <th>${MR3I18n.t("product.unitType")}</th>
        <th>${MR3I18n.t("product.salePrice")}</th>
        <th>${MR3I18n.t("product.stock")}</th>
        <th>${MR3I18n.t("product.expiry")}</th>
        <th>${MR3I18n.t("common.status")}</th>
        <th>${MR3I18n.t("common.actions")}</th>
      </tr></thead>
      <tbody>${products
        .map(
          (product) => `<tr data-id="${product.id}">
            <td>${MR3Utils.escape(product.code)}</td>
            <td><strong>${MR3Utils.escape(MR3App.productName(product))}</strong><br><span class="muted">${MR3Utils.escape(product.barcode || "")}</span></td>
            <td>${MR3Utils.escape(MR3App.categoryName(product.categoryId))}</td>
            <td>${MR3I18n.t(`unit.${product.unitType}`)}</td>
            <td>${MR3Utils.money(product.salePrice)}</td>
            <td>${product.stockQuantity} / ${product.minimumStockQuantity}</td>
            <td>${MR3Utils.date(product.expiryDate)}</td>
            <td>${status(product)}</td>
            <td><div class="table-actions">
              ${MR3Utils.actionButton("card", "box", MR3I18n.t("product.card"))}
              ${MR3App.can("products.update") ? MR3Utils.actionButton("edit", "edit", MR3I18n.t("common.edit")) : ""}
              ${MR3App.can("products.delete") ? MR3Utils.actionButton("delete", "trash", MR3I18n.t("common.delete"), "icon-button danger-button") : ""}
            </div></td>
          </tr>`
        )
        .join("")}</tbody>
    </table></div>`;
  }

  function movementStats(product) {
    const movements = MR3DB.all("movements").filter((m) => m.productId === product.id);
    const byType = (type, field) => movements.filter((m) => m.type === type).reduce((total, m) => total + MR3Utils.parseNumber(m[field]), 0);
    const last = (type) => movements.filter((m) => m.type === type).map((m) => m.date).sort().pop() || "-";
    return {
      totalSold: byType("sale", "quantityOut"),
      totalPurchased: byType("purchase", "quantityIn"),
      salesReturns: byType("salesReturn", "quantityIn"),
      purchaseReturns: byType("purchaseReturn", "quantityOut"),
      lastSale: last("sale"),
      lastPurchase: last("purchase"),
      movements
    };
  }

  function productCard(id) {
    const product = MR3DB.get("products", id);
    if (!product) return;
    const stats = movementStats(product);
    const rows = stats.movements
      .map(
        (m) => `<tr>
          <td>${MR3Utils.escape(m.date)}</td>
          <td>${MR3I18n.t(`op.${m.type}`)}</td>
          <td>${MR3Utils.escape(m.reference)}</td>
          <td>${m.quantityIn}</td>
          <td>${m.quantityOut}</td>
          <td>${m.balanceAfter}</td>
          <td>${MR3Utils.escape(m.userName || "")}</td>
        </tr>`
      )
      .join("");
    const body = `
      <div class="grid-section">
        <section>
          <div class="profile-line"><span>${MR3I18n.t("common.name")}</span><strong>${MR3Utils.escape(MR3App.productName(product))}</strong></div>
          <div class="profile-line"><span>${MR3I18n.t("product.code")}</span><strong>${MR3Utils.escape(product.code)}</strong></div>
          <div class="profile-line"><span>${MR3I18n.t("product.barcode")}</span><strong>${MR3Utils.escape(product.barcode || "-")}</strong></div>
          <div class="profile-line"><span>${MR3I18n.t("product.category")}</span><strong>${MR3Utils.escape(MR3App.categoryName(product.categoryId))}</strong></div>
          <div class="profile-line"><span>${MR3I18n.t("product.unitType")}</span><strong>${MR3I18n.t(`unit.${product.unitType}`)}</strong></div>
          <div class="profile-line"><span>${MR3I18n.t("product.expiry")}</span><strong>${MR3Utils.date(product.expiryDate)}</strong></div>
        </section>
        <section>
          <div class="profile-line"><span>${MR3I18n.t("product.stock")}</span><strong>${product.stockQuantity}</strong></div>
          <div class="profile-line"><span>${MR3I18n.t("product.minStock")}</span><strong>${product.minimumStockQuantity}</strong></div>
          <div class="profile-line"><span>${MR3I18n.t("product.purchasePrice")}</span><strong>${MR3Utils.money(product.purchasePrice)}</strong></div>
          <div class="profile-line"><span>${MR3I18n.t("product.boxPrice")}</span><strong>${MR3Utils.money(product.boxPrice)}</strong></div>
          <div class="profile-line"><span>${MR3I18n.t("product.stripPrice")}</span><strong>${MR3Utils.money(product.stripPrice)}</strong></div>
          <div class="profile-line"><span>${MR3I18n.t("product.tabletPrice")}</span><strong>${MR3Utils.money(product.tabletPrice)}</strong></div>
        </section>
      </div>
      <div class="stats-grid" style="margin-top:16px">
        ${[
          ["product.totalSold", stats.totalSold],
          ["product.totalPurchased", stats.totalPurchased],
          ["product.totalSalesReturns", stats.salesReturns],
          ["product.totalPurchaseReturns", stats.purchaseReturns],
          ["product.lastSale", stats.lastSale],
          ["product.lastPurchase", stats.lastPurchase]
        ]
          .map(([label, value]) => `<article class="stat-card"><div><p>${MR3I18n.t(label)}</p><strong>${value}</strong></div></article>`)
          .join("")}
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>${MR3I18n.t("common.date")}</th><th>${MR3I18n.t("movement.type")}</th><th>${MR3I18n.t("movement.reference")}</th><th>${MR3I18n.t("movement.in")}</th><th>${MR3I18n.t("movement.out")}</th><th>${MR3I18n.t("movement.balanceAfter")}</th><th>${MR3I18n.t("common.user")}</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="7">${MR3I18n.t("messages.noData")}</td></tr>`}</tbody>
      </table></div>`;
    const footer = `
      <button class="ghost-button" type="button" data-close-modal>${MR3I18n.t("common.close")}</button>
      ${MR3App.can("products.update") ? `<button class="secondary-button" type="button" id="cardEdit">${MR3Utils.icon("edit")}${MR3I18n.t("common.edit")}</button>` : ""}
      <button class="primary-button" type="button" id="cardPrint">${MR3Utils.icon("print")}${MR3I18n.t("common.print")}</button>`;
    const modal = MR3Utils.modal({ title: MR3I18n.t("product.card"), body, footer });
    modal.querySelector("#cardEdit")?.addEventListener("click", () => {
      MR3Utils.closeModal();
      openProductForm(product);
    });
    modal.querySelector("#cardPrint")?.addEventListener("click", () => {
      MR3Print.printHtml(MR3I18n.t("product.card"), body, false);
    });
  }

  function renderFilters() {
    return `<div class="filters">
      <label class="field"><span>${MR3I18n.t("common.search")}</span><input id="productSearch" class="search-input" placeholder="${MR3I18n.t("common.search")}" /></label>
      <label class="field"><span>${MR3I18n.t("product.category")}</span><select id="productCategoryFilter"><option value="">${MR3I18n.t("common.all")}</option>${MR3Utils.optionsHtml(MR3DB.all("categories"), "", (c) => MR3I18n.name(c))}</select></label>
      <label class="field"><span>${MR3I18n.t("product.stock")}</span><select id="productStockFilter"><option value="">${MR3I18n.t("common.all")}</option><option value="low">${MR3I18n.t("nav.shortages")}</option></select></label>
      <label class="field"><span>${MR3I18n.t("product.expiry")}</span><select id="productExpiryFilter"><option value="">${MR3I18n.t("common.all")}</option><option value="expired">${MR3I18n.t("dashboard.expired")}</option><option value="near">${MR3I18n.t("dashboard.nearExpiry")}</option></select></label>
    </div>`;
  }

  window.MR3Pages.products = {
    render(root) {
      const tools = MR3App.can("products.create") ? `<button class="primary-button" id="addProduct">${MR3Utils.icon("plus")}${MR3I18n.t("common.add")}</button>` : "";
      root.innerHTML =
        MR3App.pageHeader("nav.products", "page.productsHint", tools) +
        `<section class="panel"><div class="panel-body">${renderFilters()}<div id="productsTable"></div></div></section>`;
      const refresh = () => {
        root.querySelector("#productsTable").innerHTML = renderTable(filteredProducts(root));
        MR3App.bindTableActions(root.querySelector("#productsTable"), {
          edit: (id) => openProductForm(MR3DB.get("products", id)),
          delete: deleteProduct,
          card: productCard
        });
      };
      root.querySelector("#addProduct")?.addEventListener("click", () => openProductForm());
      ["productSearch", "productCategoryFilter", "productStockFilter", "productExpiryFilter"].forEach((id) => root.querySelector(`#${id}`).addEventListener("input", refresh));
      refresh();
    },
    productCard,
    openProductForm
  };
})();
