(function () {
  function changeStock(options) {
    const product = MR3DB.get("products", options.productId);
    if (!product) throw new Error(MR3I18n.t("messages.noData"));
    const qty = Math.abs(MR3Utils.parseNumber(options.quantity));
    if (qty <= 0) throw new Error(MR3I18n.t("messages.positiveNumber"));
    const isOut = options.direction === "out";
    const stockQty = MR3Production.toStockQuantity(product, options.unitType || product.unitType, qty);
    let allocations = [];
    if (isOut) {
      allocations = MR3Production.consumeBatches({ productId: product.id, quantity: qty, unitType: options.unitType || product.unitType });
    } else {
      MR3Production.validateExpiry({ ...product, expiryDate: options.expiryDate || product.expiryDate || "" });
    }
    const nextStock = MR3Utils.parseNumber(product.stockQuantity) + (isOut ? -stockQty : stockQty);
    if (nextStock < 0) throw new Error(MR3I18n.t("messages.stockNotEnough"));
    MR3DB.update("products", product.id, { stockQuantity: nextStock, updatedAt: MR3Utils.now() });
    if (!isOut) {
      MR3Production.receiveBatch({
        productId: product.id,
        quantity: qty,
        unitType: options.unitType || product.unitType,
        expiryDate: options.expiryDate || product.expiryDate || "",
        purchaseCost: options.purchaseCost ?? options.unitPrice,
        reference: options.reference || "Manual"
      });
      MR3Production.checkAvailability(product.id);
    }
    const movement = MR3DB.insert("movements", {
      productId: product.id,
      date: options.date || MR3Utils.today(),
      type: options.type || "adjustment",
      reference: options.reference || "Manual",
      quantityIn: isOut ? 0 : qty,
      quantityOut: isOut ? qty : 0,
      stockQuantityChange: isOut ? -stockQty : stockQty,
      balanceAfter: nextStock,
      unitType: options.unitType || product.unitType,
      unitPrice: MR3Utils.parseNumber(options.unitPrice),
      allocations,
      userId: options.userId || MR3App.user().id,
      userName: options.userName || MR3App.user().name,
      notes: options.notes || ""
    });
    MR3DB.audit({
      action: options.type || "stockChange",
      entityType: "product",
      entityId: product.id,
      reference: options.reference || "Manual",
      oldValue: { stockQuantity: product.stockQuantity },
      newValue: { stockQuantity: nextStock },
      reason: options.notes || ""
    });
    return movement;
  }

  function openAdjust(product) {
    if (!MR3App.require("inventory.adjust")) return;
    MR3Utils.formModal({
      title: MR3I18n.t("inventory.adjust"),
      fields: [
        { name: "mode", label: MR3I18n.t("inventory.adjust"), type: "select", options: [{ value: "in", label: MR3I18n.t("inventory.addStock") }, { value: "out", label: MR3I18n.t("inventory.reduceStock") }] },
        { name: "quantity", label: MR3I18n.t("common.quantity"), type: "number", min: 1, step: "1", required: true },
        { name: "reason", label: MR3I18n.t("inventory.reason"), required: true, wide: true },
        { name: "notes", label: MR3I18n.t("common.notes"), type: "textarea", wide: true }
      ],
      onSubmit(data) {
        const number = MR3DB.counter("adjustments", "ADJ");
        changeStock({
          productId: product.id,
          quantity: data.quantity,
          direction: data.mode === "out" ? "out" : "in",
          type: "adjustment",
          reference: number,
          unitType: product.unitType,
          unitPrice: 0,
          notes: `${data.reason}${data.notes ? " - " + data.notes : ""}`
        });
        MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.saved"));
        MR3App.render();
      }
    });
  }

  function filtered(root) {
    const q = root.querySelector("#inventorySearch")?.value || "";
    const mode = root.querySelector("#inventoryFilter")?.value || "";
    const today = MR3Utils.today();
    const near = new Date();
    near.setDate(near.getDate() + 60);
    const nearStr = near.toISOString().slice(0, 10);
    return MR3DB.all("products").filter((product) => {
      if (product.isDeleted || product.status === "deleted") return false;
      if (!MR3Utils.textMatch(product, q, ["nameAr", "nameEn", "code", "barcode"])) return false;
      if (mode === "low" && product.stockQuantity > product.minimumStockQuantity) return false;
      if (mode === "expired" && (!product.expiryDate || product.expiryDate >= today)) return false;
      if (mode === "near" && (!product.expiryDate || product.expiryDate < today || product.expiryDate > nearStr)) return false;
      return true;
    });
  }

  function renderTable(rows) {
    if (!rows.length) return MR3Utils.empty(MR3I18n.t("messages.noData"), MR3I18n.t("messages.noDataHint"));
    return `<div class="table-wrap"><table class="data-table">
      <thead><tr>
        <th>${MR3I18n.t("product.code")}</th>
        <th>${MR3I18n.t("common.name")}</th>
        <th>${MR3I18n.t("product.stock")}</th>
        <th>${MR3I18n.t("product.minStock")}</th>
        <th>${MR3I18n.t("product.expiry")}</th>
        <th>${MR3I18n.t("product.supplier")}</th>
        <th>${MR3I18n.t("common.actions")}</th>
      </tr></thead>
      <tbody>${rows
        .map((product) => {
          const low = product.stockQuantity <= product.minimumStockQuantity;
          return `<tr data-id="${product.id}">
            <td>${MR3Utils.escape(product.code)}</td>
            <td><strong>${MR3Utils.escape(MR3App.productName(product))}</strong><br><span class="muted">${MR3Utils.escape(product.barcode || "")}</span></td>
            <td>${MR3Utils.badge(product.stockQuantity, low ? "warning" : "success")}</td>
            <td>${product.minimumStockQuantity}</td>
            <td>${MR3Utils.date(product.expiryDate)}</td>
            <td>${MR3Utils.escape(MR3App.supplierName(product.supplierId))}</td>
            <td><div class="table-actions">
              ${MR3App.can("inventory.adjust") ? MR3Utils.actionButton("adjust", "edit", MR3I18n.t("inventory.adjust")) : ""}
              ${MR3Utils.actionButton("movement", "chart", MR3I18n.t("nav.movements"))}
            </div></td>
          </tr>`;
        })
        .join("")}</tbody>
    </table></div>`;
  }

  window.MR3Inventory = { changeStock, openAdjust };
  window.MR3Pages.inventory = {
    render(root) {
      root.innerHTML =
        MR3App.pageHeader("nav.inventory", "page.inventoryHint") +
        `<section class="panel"><div class="panel-body">
          <div class="filters">
            <label class="field"><span>${MR3I18n.t("common.search")}</span><input id="inventorySearch" class="search-input" /></label>
            <label class="field"><span>${MR3I18n.t("common.filter")}</span><select id="inventoryFilter">
              <option value="">${MR3I18n.t("common.all")}</option>
              <option value="low">${MR3I18n.t("nav.shortages")}</option>
              <option value="expired">${MR3I18n.t("dashboard.expired")}</option>
              <option value="near">${MR3I18n.t("dashboard.nearExpiry")}</option>
            </select></label>
          </div>
          <div id="inventoryTable"></div>
        </div></section>`;
      const refresh = () => {
        root.querySelector("#inventoryTable").innerHTML = renderTable(filtered(root));
        MR3App.bindTableActions(root.querySelector("#inventoryTable"), {
          adjust: (id) => openAdjust(MR3DB.get("products", id)),
          movement: (id) => window.MR3Pages.movements?.showProduct?.(id)
        });
      };
      root.querySelector("#inventorySearch").addEventListener("input", refresh);
      root.querySelector("#inventoryFilter").addEventListener("input", refresh);
      refresh();
    }
  };
})();
