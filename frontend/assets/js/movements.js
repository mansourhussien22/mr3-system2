(function () {
  function filtered(root, productId) {
    const q = root?.querySelector("#movementSearch")?.value || "";
    const selected = productId || "";
    const from = root?.querySelector("#movementFrom")?.value || "";
    const to = root?.querySelector("#movementTo")?.value || "";
    const products = MR3DB.all("products").filter((product) => !product.isDeleted && product.status !== "deleted");
    const normalizedQuery = MR3Utils.normalize(q);
    const exactCodeProducts = normalizedQuery ? products.filter((product) => MR3Utils.normalize(product.code) === normalizedQuery) : [];
    return MR3DB.all("movements").filter((m) => {
      const product = MR3DB.get("products", m.productId);
      if (!product) return false;
      if (selected && m.productId !== selected) return false;
      if (!MR3Utils.inDateRange(m.date, from, to)) return false;
      if (normalizedQuery) {
        if (exactCodeProducts.length) return exactCodeProducts.some((item) => item.id === m.productId);
        const row = { ...product, productName: MR3App.productName(product), reference: m.reference };
        if (!MR3Utils.textMatch(row, q, ["nameAr", "nameEn", "productName", "scientificName", "tradeName", "code", "barcode", "reference"])) return false;
      }
      return true;
    });
  }

  function usefulProductSuggestions() {
    const counts = {};
    MR3DB.all("movements").forEach((movement) => {
      counts[movement.productId] = (counts[movement.productId] || 0) + 1;
    });
    return MR3DB.all("products")
      .filter((product) => !product.isDeleted && product.status !== "deleted")
      .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || String(a.code).localeCompare(String(b.code)))
      .slice(0, 12)
      .map((product) => `<option value="${MR3Utils.escape(product.code)}" label="${MR3Utils.escape(`${product.code} - ${MR3App.productName(product)}${product.barcode ? " - " + product.barcode : ""}`)}"></option>`)
      .join("");
  }

  function movementRows(rows) {
    return rows.map((m) => {
      const product = MR3DB.get("products", m.productId);
      return [
        m.date,
        MR3App.productName(product),
        MR3I18n.t(`op.${m.type}`),
        m.reference,
        m.quantityIn,
        m.quantityOut,
        m.balanceAfter,
        MR3I18n.t(`unit.${m.unitType}`),
        MR3Utils.money(m.unitPrice),
        m.userName || "",
        m.notes || ""
      ];
    });
  }

  function renderTable(rows) {
    if (!rows.length) return MR3Utils.empty(MR3I18n.t("messages.noData"), MR3I18n.t("messages.noDataHint"));
    const headers = [
      MR3I18n.t("common.date"),
      MR3I18n.t("invoice.product"),
      MR3I18n.t("movement.type"),
      MR3I18n.t("movement.reference"),
      MR3I18n.t("movement.in"),
      MR3I18n.t("movement.out"),
      MR3I18n.t("movement.balanceAfter"),
      MR3I18n.t("common.unit"),
      MR3I18n.t("common.price"),
      MR3I18n.t("common.user"),
      MR3I18n.t("common.notes")
    ];
    return `<div class="table-wrap"><table class="data-table">
      <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${movementRows(rows)
        .map((row) => `<tr>${row.map((cell) => `<td>${MR3Utils.escape(cell)}</td>`).join("")}</tr>`)
        .join("")}</tbody>
    </table></div>`;
  }

  function filters() {
    return `<div class="filters">
      <label class="field"><span>${MR3I18n.t("common.search")}</span><input id="movementSearch" class="search-input" list="movementProductSuggestions" placeholder="${MR3I18n.t("audit.searchPlaceholder")}" /></label>
      <label class="field"><span>${MR3I18n.t("search.startDate")}</span><input id="movementFrom" type="date" /></label>
      <label class="field"><span>${MR3I18n.t("search.endDate")}</span><input id="movementTo" type="date" /></label>
      <datalist id="movementProductSuggestions">${usefulProductSuggestions()}</datalist>
    </div>`;
  }

  function showProduct(productId) {
    const product = MR3DB.get("products", productId);
    const rows = filtered(null, productId);
    const body = renderTable(rows);
    const footer = `<button class="ghost-button" type="button" data-close-modal>${MR3I18n.t("common.close")}</button><button class="primary-button" id="printMovement">${MR3Utils.icon("print")}${MR3I18n.t("common.print")}</button>`;
    const modal = MR3Utils.modal({ title: `${MR3I18n.t("nav.movements")} - ${MR3App.productName(product)}`, body, footer });
    modal.querySelector("#printMovement").addEventListener("click", () => {
      MR3Print.simple(MR3I18n.t("nav.movements"), [
        MR3I18n.t("common.date"),
        MR3I18n.t("invoice.product"),
        MR3I18n.t("movement.type"),
        MR3I18n.t("movement.reference"),
        MR3I18n.t("movement.in"),
        MR3I18n.t("movement.out"),
        MR3I18n.t("movement.balanceAfter")
      ], movementRows(rows).map((r) => r.slice(0, 7)));
    });
  }

  window.MR3Pages.movements = {
    render(root) {
      root.innerHTML =
        MR3App.pageHeader("nav.movements", "page.inventoryHint", `<button class="ghost-button" id="exportMovements">${MR3Utils.icon("download")}${MR3I18n.t("common.export")}</button><button class="primary-button" id="printMovements">${MR3Utils.icon("print")}${MR3I18n.t("common.print")}</button>`) +
        `<section class="panel"><div class="panel-body">${filters()}<div id="movementTable"></div></div></section>`;
      const refresh = () => {
        const rows = filtered(root);
        root.querySelector("#movementTable").innerHTML = renderTable(rows);
        return rows;
      };
      root.querySelectorAll("input,select").forEach((input) => input.addEventListener("input", refresh));
      root.querySelector("#exportMovements").addEventListener("click", () => {
        const rows = movementRows(refresh());
        MR3Utils.downloadCsv("mr3-item-movements.csv", [[MR3I18n.t("common.date"), MR3I18n.t("invoice.product"), MR3I18n.t("movement.type"), MR3I18n.t("movement.reference"), MR3I18n.t("movement.in"), MR3I18n.t("movement.out"), MR3I18n.t("movement.balanceAfter")], ...rows.map((r) => r.slice(0, 7))]);
      });
      root.querySelector("#printMovements").addEventListener("click", () => {
        const rows = movementRows(refresh()).map((r) => r.slice(0, 7));
        MR3Print.simple(MR3I18n.t("nav.movements"), [MR3I18n.t("common.date"), MR3I18n.t("invoice.product"), MR3I18n.t("movement.type"), MR3I18n.t("movement.reference"), MR3I18n.t("movement.in"), MR3I18n.t("movement.out"), MR3I18n.t("movement.balanceAfter")], rows);
      });
      refresh();
    },
    showProduct
  };
})();
