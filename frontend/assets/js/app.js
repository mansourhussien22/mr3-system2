(function () {
  const pages = [
    { id: "home", key: "nav.home", icon: "dashboard", permission: "dashboard.view" },
    { id: "sales", key: "nav.saleInvoice", icon: "cart", permission: "sales.view" },
    { id: "salesPending", key: "nav.salesPending", icon: "invoice", permission: "sales.view" },
    { id: "salesInvoiceReport", key: "nav.salesInvoicesReport", icon: "chart", permission: "reports.view" },
    { id: "salesReturnsReport", key: "nav.salesReturnsReport", icon: "chart", permission: "reports.view" },
    { id: "salesItemsReport", key: "nav.salesItemsReport", icon: "chart", permission: "reports.view" },
    { id: "salesCustomersReport", key: "nav.salesCustomersReport", icon: "chart", permission: "reports.view" },
    { id: "purchases", key: "nav.purchaseInvoice", icon: "invoice", permission: "purchases.view" },
    { id: "purchasePending", key: "nav.purchasePending", icon: "invoice", permission: "purchases.view" },
    { id: "purchaseReturns", key: "nav.purchaseReturn", icon: "refresh", permission: "purchaseReturns.view" },
    { id: "purchaseDetailedReport", key: "nav.purchaseDetailedReport", icon: "chart", permission: "reports.view" },
    { id: "supplierReturnsReport", key: "nav.supplierReturnsReport", icon: "chart", permission: "reports.view" },
    { id: "salesReturns", key: "nav.salesReturns", icon: "refresh", permission: "salesReturns.view", hidden: true },
    { id: "products", key: "nav.products", icon: "pill", permission: "products.view" },
    { id: "categories", key: "nav.categories", icon: "layers", permission: "categories.view" },
    { id: "inventory", key: "nav.inventory", icon: "box", permission: "inventory.view" },
    { id: "inventoryAudit", key: "nav.inventoryAudit", icon: "edit", permission: "inventory.audit" },
    { id: "movements", key: "nav.movements", icon: "chart", permission: "inventory.movement" },
    { id: "shortages", key: "nav.shortages", icon: "alert", permission: "shortages.view" },
    { id: "customerService", key: "nav.customerService", icon: "users", permission: "customerService.view" },
    { id: "reservations", key: "nav.reservations", icon: "box", permission: "reservations.view" },
    { id: "customers", key: "nav.customers", icon: "users", permission: "customers.view" },
    { id: "suppliers", key: "nav.suppliers", icon: "truck", permission: "suppliers.view" },
    { id: "payments", key: "nav.payments", icon: "wallet", permission: "payments.view" },
    { id: "treasury", key: "nav.treasury", icon: "wallet", permission: "treasury.view" },
    { id: "notifications", key: "nav.notifications", icon: "alert", permission: "notifications.view" },
    { id: "expenses", key: "nav.expenses", icon: "invoice", permission: "expenses.view" },
    { id: "reports", key: "nav.reports", icon: "chart", permission: "reports.view" },
    { id: "profile", key: "nav.profile", icon: "user", permission: null },
    { id: "users", key: "nav.users", icon: "user", permission: "users.manage" },
    { id: "settings", key: "nav.settings", icon: "settings", permission: "settings.manage" }
  ];

  const navTree = [
    { id: "home", key: "nav.home", icon: "dashboard", permission: "dashboard.view" },
    {
      id: "salesGroup",
      key: "nav.salesMain",
      icon: "cart",
      permission: "sales.view",
      children: [
        { id: "sales", key: "nav.saleInvoice", permission: "sales.view" },
        { id: "salesPending", key: "nav.salesPending", permission: "sales.view" },
        {
          id: "salesReportsGroup",
          key: "nav.salesReports",
          permission: "reports.view",
          children: [
            { id: "salesInvoiceReport", key: "nav.salesInvoicesReport", permission: "reports.view" },
            { id: "salesReturnsReport", key: "nav.salesReturnsReport", permission: "reports.view" },
            { id: "salesItemsReport", key: "nav.salesItemsReport", permission: "reports.view" },
            { id: "salesCustomersReport", key: "nav.salesCustomersReport", permission: "reports.view" }
          ]
        }
      ]
    },
    {
      id: "purchasesGroup",
      key: "nav.purchasesMain",
      icon: "truck",
      permission: "purchases.view",
      children: [
        { id: "purchases", key: "nav.purchaseInvoice", permission: "purchases.view" },
        { id: "purchasePending", key: "nav.purchasePending", permission: "purchases.view" },
        { id: "purchaseReturns", key: "nav.purchaseReturn", permission: "purchaseReturns.view" },
        {
          id: "purchaseReportsGroup",
          key: "nav.purchaseReports",
          permission: "reports.view",
          children: [
            { id: "purchaseDetailedReport", key: "nav.purchaseDetailedReport", permission: "reports.view" },
            { id: "supplierReturnsReport", key: "nav.supplierReturnsReport", permission: "reports.view" }
          ]
        }
      ]
    },
    { id: "products", key: "nav.products", icon: "pill", permission: "products.view" },
    { id: "categories", key: "nav.categories", icon: "layers", permission: "categories.view" },
    { id: "inventory", key: "nav.inventory", icon: "box", permission: "inventory.view" },
    { id: "inventoryAudit", key: "nav.inventoryAudit", icon: "edit", permission: "inventory.audit" },
    { id: "movements", key: "nav.movements", icon: "chart", permission: "inventory.movement" },
    { id: "shortages", key: "nav.shortages", icon: "alert", permission: "shortages.view" },
    { id: "customerService", key: "nav.customerService", icon: "users", permission: "customerService.view" },
    { id: "reservations", key: "nav.reservations", icon: "box", permission: "reservations.view" },
    { id: "customers", key: "nav.customers", icon: "users", permission: "customers.view" },
    { id: "suppliers", key: "nav.suppliers", icon: "truck", permission: "suppliers.view" },
    { id: "payments", key: "nav.payments", icon: "wallet", permission: "payments.view" },
    { id: "treasury", key: "nav.treasury", icon: "wallet", permission: "treasury.view" },
    { id: "notifications", key: "nav.notifications", icon: "alert", permission: "notifications.view" },
    { id: "expenses", key: "nav.expenses", icon: "invoice", permission: "expenses.view" },
    { id: "reports", key: "nav.reports", icon: "chart", permission: "reports.view" },
    { id: "profile", key: "nav.profile", icon: "user", permission: null },
    { id: "users", key: "nav.users", icon: "user", permission: "users.manage" },
    { id: "settings", key: "nav.settings", icon: "settings", permission: "settings.manage" }
  ];

  const state = { user: null, page: "home", transition: 0 };

  function normalizePageId(id) {
    return id === "dashboard" ? "home" : id;
  }

  function can(permission) {
    if (!permission) return true;
    return MR3Permissions.has(state.user, permission);
  }

  function require(permission) {
    if (!permission) return true;
    return MR3Permissions.require(permission);
  }

  function userInitials(user) {
    return String(user?.name || user?.username || "MR")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  function topProfileHtml(user) {
    const avatar = user?.avatar
      ? `<img src="${MR3Utils.escape(user.avatar)}" alt="${MR3Utils.escape(user.name || "")}" />`
      : `<span>${MR3Utils.escape(userInitials(user))}</span>`;
    return `${avatar}<strong>${MR3Utils.escape(user?.name || user?.username || "")}</strong>`;
  }

  function allowedPages() {
    return pages.filter((page) => !page.hidden && can(page.permission));
  }

  function pageMeta(id) {
    const normalized = normalizePageId(id);
    return pages.find((page) => page.id === normalized) || pages[0];
  }

  function hasVisibleChildren(item) {
    return (item.children || []).some((child) => can(child.permission) && (!child.children || hasVisibleChildren(child)));
  }

  function itemVisible(item) {
    return can(item.permission) && (!item.children || hasVisibleChildren(item));
  }

  function itemHasPage(item, pageId) {
    if (item.id === pageId) return true;
    return (item.children || []).some((child) => itemHasPage(child, pageId));
  }

  function renderSideItem(item, level) {
    if (!itemVisible(item)) return "";
    if (item.children) {
      const open = itemHasPage(item, state.page) ? " open" : "";
      return `<details class="nav-group level-${level || 0}"${open}>
        <summary>${MR3Utils.icon(item.icon || "layers")}<span>${MR3I18n.t(item.key)}</span></summary>
        <div class="nav-group-body">${item.children.map((child) => renderSideItem(child, (level || 0) + 1)).join("")}</div>
      </details>`;
    }
    return `<button type="button" class="side-link ${item.id === state.page ? "active" : ""}" data-page="${item.id}">
      ${MR3Utils.icon(item.icon || "invoice")}
      <span>${MR3I18n.t(item.key)}</span>
    </button>`;
  }

  function buildNav() {
    const nav = MR3Utils.$("#sideNav");
    nav.innerHTML = navTree.map((item) => renderSideItem(item, 0)).join("");
    nav.querySelectorAll("[data-page]").forEach((button) => {
      button.addEventListener("click", () => {
        navigate(button.dataset.page);
        closeMobileMenu();
      });
    });
  }

  function navigate(id) {
    const target = normalizePageId(id);
    const meta = pageMeta(target);
    if (!can(meta.permission)) {
      MR3Utils.toast("error", MR3I18n.t("messages.failed"), MR3I18n.t("messages.permissionDenied"));
      return;
    }
    if (target === state.page) {
      closeMobileMenu();
      return;
    }
    state.page = target;
    if (location.hash !== `#${target}`) history.replaceState(null, "", `#${target}`);
    renderWithLoading();
  }

  function render() {
    const meta = pageMeta(state.page);
    MR3I18n.apply(MR3I18n.current());
    MR3Utils.$("#pageTitle").textContent = MR3I18n.t(meta.key);
    MR3Utils.$("#currentSection").textContent = "MR3 System";
    MR3Utils.$("#businessNameMini").textContent = MR3I18n.isArabic() ? MR3DB.getSettings().businessNameAr : MR3DB.getSettings().businessNameEn;
    MR3Utils.$("#languageSwitcher").value = MR3I18n.current();
    MR3Utils.$("#logoutButtonSide").innerHTML = `${MR3Utils.icon("logout")}<span>${MR3I18n.t("nav.logout")}</span>`;
    MR3Utils.$("#logoutButtonTop").innerHTML = `${MR3Utils.icon("logout")}<span>${MR3I18n.t("nav.logout")}</span>`;
    const topProfile = MR3Utils.$("#profileButtonTop");
    if (topProfile) topProfile.innerHTML = topProfileHtml(state.user);
    buildNav();
    const renderer = window.MR3Pages && window.MR3Pages[state.page];
    const content = MR3Utils.$("#appContent");
    if (!renderer || typeof renderer.render !== "function") {
      content.innerHTML = MR3Utils.empty(MR3I18n.t("messages.noData"), "Page module is not available.");
      return;
    }
    renderer.render(content);
    MR3Theme.refresh();
    content.classList.remove("is-transitioning");
  }

  function renderWithLoading() {
    const token = ++state.transition;
    const content = MR3Utils.$("#appContent");
    content?.classList.add("is-transitioning");
    MR3Utils.appLoading(true, MR3I18n.t("messages.loadingPage"), MR3I18n.t("messages.waitMoment"));
    window.setTimeout(() => {
      if (token !== state.transition) return;
      render();
      requestAnimationFrame(() => content?.classList.remove("is-transitioning"));
      MR3Utils.appLoading(false);
    }, 220);
  }

  function openMobileMenu() {
    MR3Utils.$("#sidebar").classList.add("open");
    MR3Utils.$("#mobileScrim").classList.add("active");
  }

  function closeMobileMenu() {
    MR3Utils.$("#sidebar").classList.remove("open");
    MR3Utils.$("#mobileScrim").classList.remove("active");
  }

  function unitOptions(value) {
    return MR3Utils.optionsHtml(MR3Seed.UNIT_TYPES.map((unit) => ({ value: unit, label: MR3I18n.t(`unit.${unit}`) })), value);
  }

  function paymentOptions(value) {
    return MR3Utils.optionsHtml(MR3Seed.PAYMENT_METHODS.map((method) => ({ value: method, label: MR3I18n.t(`pay.${method}`) })), value);
  }

  function categoryName(id) {
    return MR3I18n.name(MR3DB.get("categories", id)) || "-";
  }

  function supplierName(id) {
    const supplier = MR3DB.get("suppliers", id);
    return supplier ? supplier.name : "-";
  }

  function customerName(id) {
    const customer = MR3DB.get("customers", id);
    return customer ? customer.name : MR3I18n.t("invoice.walkIn");
  }

  function productName(product) {
    return MR3I18n.name(product);
  }

  function productPrice(product, unitType, mode) {
    if (!product) return 0;
    if (mode === "purchase") return MR3Utils.parseNumber(product.purchasePrice);
    if (unitType === "box") return MR3Utils.parseNumber(product.boxPrice);
    if (unitType === "strip") return MR3Utils.parseNumber(product.stripPrice);
    if (unitType === "tablet") return MR3Utils.parseNumber(product.tabletPrice);
    if (unitType !== product.unitType) return 0;
    return MR3Utils.parseNumber(product.salePrice);
  }

  function saleUnitsForProduct(product) {
    if (!product) return [];
    const units = [];
    const add = (unit, price) => {
      if (MR3Utils.parseNumber(price) > 0 && !units.some((item) => item.value === unit)) {
        units.push({ value: unit, label: MR3I18n.t(`unit.${unit}`) });
      }
    };
    if (["box", "strip", "tablet"].includes(product.unitType)) {
      add("box", product.boxPrice);
      add("strip", product.stripPrice);
      add("tablet", product.tabletPrice);
      if (!units.length) add(product.unitType, product.salePrice);
      return units;
    }
    add(product.unitType, product.salePrice);
    return units;
  }

  function saleUnitOptions(product, value) {
    return MR3Utils.optionsHtml(saleUnitsForProduct(product), value);
  }

  function pageHeader(titleKey, hintKey, tools) {
    return `
      <div class="page-header">
        <div>
          <h2>${MR3I18n.t(titleKey)}</h2>
          <p>${hintKey ? MR3I18n.t(hintKey) : ""}</p>
        </div>
        <div class="page-tools">${tools || ""}</div>
      </div>`;
  }

  function bindTableActions(root, handlers) {
    root.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.action;
        const id = button.closest("[data-id]")?.dataset.id || button.dataset.id;
        if (handlers[action]) handlers[action](id, button);
      });
    });
  }

  function init() {
    state.user = MR3Auth.requireAuth();
    if (!state.user) return;
    const hash = normalizePageId(location.hash.replace("#", ""));
    const fallback = allowedPages()[0]?.id || "home";
    state.page = pages.some((page) => page.id === hash && can(page.permission)) ? hash : fallback;
    if (location.hash && location.hash !== `#${state.page}`) history.replaceState(null, "", `#${state.page}`);
    MR3Utils.$("#menuToggle").innerHTML = MR3Utils.icon("menu");
    MR3Utils.$("#menuToggle").addEventListener("click", openMobileMenu);
    MR3Utils.$("#mobileScrim").addEventListener("click", closeMobileMenu);
    MR3Utils.$("#logoutButtonSide").addEventListener("click", MR3Auth.logout);
    MR3Utils.$("#logoutButtonTop").addEventListener("click", MR3Auth.logout);
    MR3Utils.$("#profileButtonTop").addEventListener("click", () => navigate("profile"));
    MR3Utils.$("#languageSwitcher").addEventListener("change", (event) => {
      MR3I18n.apply(event.target.value);
      MR3Theme.refresh();
      renderWithLoading();
    });
    window.addEventListener("hashchange", () => {
      const id = normalizePageId(location.hash.replace("#", ""));
      if (id) navigate(id);
    });
    render();
  }

  function refreshUser() {
    if (!state.user) return null;
    state.user = MR3DB.get("users", state.user.id) || state.user;
    return state.user;
  }

  window.MR3Pages = {};
  window.MR3App = {
    init,
    render,
    navigate,
    can,
    require,
    user: () => state.user,
    refreshUser,
    pages,
    navTree,
    unitOptions,
    paymentOptions,
    categoryName,
    supplierName,
    customerName,
    productName,
    productPrice,
    saleUnitsForProduct,
    saleUnitOptions,
    pageHeader,
    bindTableActions
  };
})();
