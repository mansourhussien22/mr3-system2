(function () {
  function sum(rows, field) {
    return rows.reduce((total, row) => total + MR3Utils.parseNumber(row[field]), 0);
  }

  function lastDays(count) {
    return Array.from({ length: count }, (_, index) => {
      const d = new Date();
      d.setDate(d.getDate() - (count - 1 - index));
      return d.toISOString().slice(0, 10);
    });
  }

  function initials(user) {
    return String(user?.name || user?.username || "MR")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  function avatarHtml(user, className) {
    if (user?.avatar) {
      return `<img class="${className || "home-avatar"}" src="${MR3Utils.escape(user.avatar)}" alt="${MR3Utils.escape(user.name || "")}" />`;
    }
    return `<span class="${className || "home-avatar"}">${MR3Utils.escape(initials(user))}</span>`;
  }

  function dashboardMetrics() {
    const today = MR3Utils.today();
    const sales = MR3DB.all("salesInvoices").filter((item) => item.status !== "deleted" && item.date === today);
    const purchases = MR3DB.all("purchaseInvoices").filter((item) => item.status !== "deleted" && item.date === today);
    const expenses = MR3DB.all("expenses").filter((item) => item.date === today);
    const products = MR3DB.all("products").filter((product) => !product.isDeleted && product.status !== "deleted");
    const low = products.filter((p) => MR3Utils.parseNumber(p.stockQuantity) <= MR3Utils.parseNumber(p.minimumStockQuantity));
    const expired = products.filter((p) => p.expiryDate && p.expiryDate < today);
    const nearLimit = new Date();
    nearLimit.setDate(nearLimit.getDate() + 60);
    const nearExpiry = products.filter((p) => p.expiryDate && p.expiryDate >= today && p.expiryDate <= nearLimit.toISOString().slice(0, 10));
    const salesTotal = sum(sales, "finalTotal");
    const purchaseCost = sales.flatMap((invoice) => invoice.items || []).reduce((total, item) => {
      const product = MR3DB.get("products", item.productId);
      return total + MR3Utils.parseNumber(item.quantity) * MR3Utils.parseNumber(product?.purchasePrice);
    }, 0);
    return {
      today,
      sales,
      purchases,
      expenses,
      products,
      low,
      expired,
      nearExpiry,
      salesTotal,
      purchaseTotal: sum(purchases, "finalTotal"),
      expenseTotal: sum(expenses, "amount"),
      profit: salesTotal - purchaseCost - sum(expenses, "amount"),
      customerBalances: sum(MR3DB.all("customers"), "balance"),
      supplierBalances: sum(MR3DB.all("suppliers"), "balance"),
      pendingSales: MR3DB.all("heldSalesInvoices").length,
      pendingPurchases: MR3DB.all("heldPurchaseInvoices").length,
      activeShortages: MR3DB.all("shortages").filter((s) => s.status !== "resolved").length,
      pendingCustomerRequests: MR3DB.all("customerRequests").filter((request) => ["pending", "searching", "ordered"].includes(request.status)).length,
      availableCustomerRequests: MR3DB.all("customerRequests").filter((request) => request.status === "available").length,
      activeReservations: MR3DB.all("reservations").filter((reservation) => reservation.status === "active").length,
      unreadNotifications: MR3Production.unreadNotifications(),
      treasuryBalance: MR3Production.treasuryBalance()
    };
  }

  function heroButton(page, icon, labelKey) {
    const meta = MR3App.pages.find((item) => item.id === page);
    if (meta && !MR3App.can(meta.permission)) return "";
    return `<button type="button" class="home-hero-button" data-dashboard-page="${page}">
      ${MR3Utils.icon(icon)}
      <span>${MR3I18n.t(labelKey)}</span>
    </button>`;
  }

  function renderHomeHero(metrics) {
    const user = MR3App.user();
    const settings = MR3DB.getSettings();
    const dateLabel = new Date().toLocaleDateString(MR3I18n.current() === "ar" ? "ar-EG" : "en", {
      weekday: "long",
      day: "numeric",
      month: "long"
    });
    return `<section class="home-hero">
      <div class="home-hero-copy">
        <span class="home-tag">${MR3I18n.t("home.tagline")}</span>
        <h2>${MR3I18n.t("home.welcome", { name: user?.name || user?.username || "MR3" })}</h2>
        <p>${MR3I18n.t("home.subtitle")}</p>
        <div class="home-hero-actions">
          ${heroButton("sales", "cart", "dashboard.openSale")}
          ${heroButton("purchases", "invoice", "dashboard.openPurchase")}
          ${heroButton("profile", "user", "home.openProfile")}
        </div>
      </div>
      <div class="home-hero-visual" aria-label="${MR3I18n.t("home.todaySnapshot")}">
        <div class="home-brand-card">
          <img src="${MR3Utils.escape(settings.logoPath || "assets/images/logo.png")}" alt="" />
          <div>
            <span>${MR3Utils.escape(MR3I18n.isArabic() ? settings.businessNameAr : settings.businessNameEn)}</span>
            <strong>${MR3I18n.t("home.ready")}</strong>
          </div>
        </div>
        <div class="home-avatar-card">
          ${avatarHtml(user, "home-avatar")}
          <div>
            <span>${MR3I18n.t("nav.profile")}</span>
            <strong>${MR3Utils.escape(user?.role === "ADMIN" ? MR3I18n.t("common.admin") : MR3I18n.t("common.user"))}</strong>
          </div>
        </div>
        <div class="home-mini-metrics">
          <div><span>${MR3I18n.t("home.today")}</span><strong>${MR3Utils.escape(dateLabel)}</strong></div>
          <div><span>${MR3I18n.t("home.pendingInvoices")}</span><strong>${metrics.pendingSales + metrics.pendingPurchases}</strong></div>
          <div><span>${MR3I18n.t("dashboard.lowStock")}</span><strong>${metrics.low.length}</strong></div>
        </div>
      </div>
    </section>`;
  }

  function renderCards(metrics) {
    const cards = [
      ["cart", "nav.sales", MR3Utils.money(metrics.salesTotal), "green", "salesInvoiceReport"],
      ["invoice", "nav.purchases", MR3Utils.money(metrics.purchaseTotal), "blue", "purchaseDetailedReport"],
      ["chart", "dashboard.netProfit", MR3Utils.money(metrics.profit), "violet", "reports"],
      ["wallet", "nav.expenses", MR3Utils.money(metrics.expenseTotal), "orange", "expenses"],
      ["users", "dashboard.customerBalances", MR3Utils.money(metrics.customerBalances), "red", "customers"],
      ["truck", "dashboard.supplierBalances", MR3Utils.money(metrics.supplierBalances), "orange", "suppliers"],
      ["wallet", "treasury.currentBalance", MR3Utils.money(metrics.treasuryBalance), "green", "treasury"],
      ["box", "dashboard.lowStock", metrics.low.length, "red", "inventory"],
      ["edit", "nav.inventoryAudit", MR3DB.all("inventoryAudits").length, "blue", "inventoryAudit"],
      ["alert", "nav.shortages", metrics.activeShortages, "orange", "shortages"],
      ["users", "dashboard.pendingRequests", metrics.pendingCustomerRequests, "blue", "customerService"],
      ["check", "dashboard.availableRequests", metrics.availableCustomerRequests, "green", "customerService"],
      ["box", "dashboard.reservations", metrics.activeReservations, "violet", "reservations"],
      ["alert", "dashboard.notifications", metrics.unreadNotifications, "orange", "notifications"],
      ["calendar", "dashboard.expired", metrics.expired.length, "red", "inventory"],
      ["calendar", "dashboard.nearExpiry", metrics.nearExpiry.length, "blue", "inventory"]
    ];
    return `<div class="stats-grid home-stats">${cards
      .map(
        ([icon, key, value, color, page]) => `
        <article class="stat-card stat-card-link" data-dashboard-page="${page}" role="button" tabindex="0">
          <span class="stat-icon ${color}">${MR3Utils.icon(icon)}</span>
          <div><p>${key.includes(".") ? MR3I18n.t(key) : key}</p><strong>${value}</strong></div>
        </article>`
      )
      .join("")}</div>`;
  }

  function renderQuickActions() {
    const actions = [
      ["sales", "cart", "dashboard.openSale", "page.salesHint"],
      ["salesPending", "invoice", "nav.salesPending", "home.pendingSalesHint"],
      ["purchases", "invoice", "dashboard.openPurchase", "page.purchasesHint"],
      ["products", "pill", "dashboard.openProducts", "page.productsHint"],
      ["inventory", "box", "dashboard.openInventory", "page.inventoryHint"],
      ["inventoryAudit", "edit", "dashboard.openInventoryAudit", "page.inventoryAuditHint"],
      ["customerService", "users", "dashboard.openCustomerService", "page.customerServiceHint"],
      ["reservations", "box", "dashboard.openReservations", "page.reservationsHint"],
      ["profile", "user", "home.openProfile", "home.profileHint"]
    ].filter(([page]) => {
      const meta = MR3App.pages.find((item) => item.id === page);
      return meta && MR3App.can(meta.permission);
    });
    if (!actions.length) return "";
    return `<section class="quick-actions home-quick" aria-label="${MR3I18n.t("dashboard.quickActions")}">
      <div>
        <p class="eyebrow">${MR3I18n.t("dashboard.quickActions")}</p>
        <h3>${MR3I18n.t("dashboard.quickActionsHint")}</h3>
      </div>
      <div class="quick-actions-grid">
        ${actions.map(([page, icon, title, hint]) => `<button type="button" class="quick-action" data-dashboard-page="${page}">
          <span>${MR3Utils.icon(icon)}</span>
          <strong>${MR3I18n.t(title)}</strong>
          <small>${MR3I18n.t(hint)}</small>
        </button>`).join("")}
      </div>
    </section>`;
  }

  function recentActivity() {
    const sales = MR3DB.all("salesInvoices")
      .filter((invoice) => invoice.status !== "deleted")
      .map((invoice) => ({ at: invoice.createdAt || invoice.date, type: "sale", icon: "cart", title: invoice.number, text: invoice.customerName, amount: invoice.finalTotal, page: "salesInvoiceReport" }));
    const purchases = MR3DB.all("purchaseInvoices")
      .filter((invoice) => invoice.status !== "deleted")
      .map((invoice) => ({ at: invoice.createdAt || invoice.date, type: "purchase", icon: "invoice", title: invoice.number, text: invoice.supplierName, amount: invoice.finalTotal, page: "purchaseDetailedReport" }));
    const payments = MR3DB.all("payments").map((payment) => ({ at: payment.createdAt || payment.date, type: "payment", icon: "wallet", title: payment.number, text: payment.entityName, amount: payment.amount, page: "payments" }));
    return [...sales, ...purchases, ...payments].sort((a, b) => String(b.at || "").localeCompare(String(a.at || ""))).slice(0, 7);
  }

  function renderActivityPanel() {
    const rows = recentActivity();
    const body = rows.length
      ? rows.map((item) => `<button type="button" class="activity-item" data-dashboard-page="${item.page}">
          <span class="activity-icon ${item.type}">${MR3Utils.icon(item.icon)}</span>
          <div>
            <strong>${MR3Utils.escape(item.title)}</strong>
            <small>${MR3Utils.escape(item.text || "")}</small>
          </div>
          <span class="activity-amount">${MR3Utils.money(item.amount)}</span>
        </button>`).join("")
      : MR3Utils.empty(MR3I18n.t("messages.noData"), MR3I18n.t("messages.noDataHint"));
    return `<section class="panel home-activity-panel">
      <div class="panel-header"><h3>${MR3I18n.t("home.recentActivity")}</h3><span class="badge info">${MR3I18n.t("home.live")}</span></div>
      <div class="panel-body activity-list">${body}</div>
    </section>`;
  }

  function healthList(rows, type) {
    if (!rows.length) return `<div class="health-empty">${MR3Utils.icon("check")}<span>${MR3I18n.t("home.noAlerts")}</span></div>`;
    return rows.slice(0, 5).map((product) => `<button type="button" class="health-row" data-dashboard-page="inventory">
      <span>${MR3Utils.icon(type === "low" ? "box" : "calendar")}</span>
      <div>
        <strong>${MR3Utils.escape(MR3App.productName(product))}</strong>
        <small>${type === "low" ? `${MR3I18n.t("product.stock")}: ${MR3Utils.escape(product.stockQuantity)}` : MR3Utils.date(product.expiryDate)}</small>
      </div>
    </button>`).join("");
  }

  function renderHealthPanel(metrics) {
    return `<section class="panel home-health-panel">
      <div class="panel-header"><h3>${MR3I18n.t("home.inventoryHealth")}</h3><span class="badge warning">${metrics.low.length + metrics.nearExpiry.length}</span></div>
      <div class="panel-body health-grid">
        <div class="health-card">
          <h4>${MR3I18n.t("home.lowStockNow")}</h4>
          ${healthList(metrics.low, "low")}
        </div>
        <div class="health-card">
          <h4>${MR3I18n.t("home.nearExpiryNow")}</h4>
          ${healthList(metrics.nearExpiry, "expiry")}
        </div>
      </div>
    </section>`;
  }

  function groupedByDay(collection, field) {
    const days = lastDays(7);
    const rows = MR3DB.all(collection).filter((item) => item.status !== "deleted");
    return {
      labels: days.map((d) => d.slice(5)),
      values: days.map((day) => rows.filter((item) => item.date === day).reduce((total, item) => total + MR3Utils.parseNumber(item[field]), 0))
    };
  }

  function topSelling() {
    const totals = {};
    MR3DB.all("salesInvoices")
      .filter((invoice) => invoice.status !== "deleted")
      .forEach((invoice) => {
        (invoice.items || []).forEach((item) => {
          totals[item.productId] = (totals[item.productId] || 0) + MR3Utils.parseNumber(item.quantity);
        });
      });
    return Object.entries(totals)
      .map(([id, quantity]) => ({ label: MR3App.productName(MR3DB.get("products", id)), quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }

  function paymentMethods() {
    const totals = {};
    MR3DB.all("payments").forEach((payment) => {
      totals[payment.paymentMethod] = (totals[payment.paymentMethod] || 0) + MR3Utils.parseNumber(payment.amount);
    });
    return Object.entries(totals).map(([method, amount]) => ({ label: MR3I18n.t(`pay.${method}`), amount }));
  }

  function shortagesByCategory() {
    const totals = {};
    MR3DB.all("shortages").forEach((shortage) => {
      const product = MR3DB.get("products", shortage.productId);
      const label = MR3App.categoryName(product?.categoryId);
      totals[label] = (totals[label] || 0) + 1;
    });
    return Object.entries(totals).map(([label, count]) => ({ label, count }));
  }

  function lowStockData() {
    return MR3DB.all("products")
      .filter((p) => !p.isDeleted && p.status !== "deleted")
      .filter((p) => MR3Utils.parseNumber(p.stockQuantity) <= MR3Utils.parseNumber(p.minimumStockQuantity))
      .slice(0, 6)
      .map((p) => ({ label: MR3App.productName(p), value: MR3Utils.parseNumber(p.stockQuantity) }));
  }

  function drawCharts() {
    const sales = groupedByDay("salesInvoices", "finalTotal");
    const purchases = groupedByDay("purchaseInvoices", "finalTotal");
    const top = topSelling();
    const payments = paymentMethods();
    const shortage = shortagesByCategory();
    const low = lowStockData();
    const colors = ["#0b8f79", "#1f6feb", "#0f7a55", "#d89013", "#6750bd", "#c93f3f"];
    new Chart(document.getElementById("chartSales"), { type: "line", data: { labels: sales.labels, datasets: [{ data: sales.values, backgroundColor: colors }] } });
    new Chart(document.getElementById("chartPurchases"), { type: "bar", data: { labels: purchases.labels, datasets: [{ data: purchases.values, backgroundColor: colors }] } });
    new Chart(document.getElementById("chartTop"), { type: "bar", data: { labels: top.map((x) => x.label), datasets: [{ data: top.map((x) => x.quantity), backgroundColor: colors }] } });
    new Chart(document.getElementById("chartPayments"), { type: "doughnut", data: { labels: payments.map((x) => x.label), datasets: [{ data: payments.map((x) => x.amount), backgroundColor: colors }] } });
    new Chart(document.getElementById("chartShortages"), { type: "doughnut", data: { labels: shortage.map((x) => x.label), datasets: [{ data: shortage.map((x) => x.count), backgroundColor: colors }] } });
    new Chart(document.getElementById("chartLow"), { type: "bar", data: { labels: low.map((x) => x.label), datasets: [{ data: low.map((x) => x.value), backgroundColor: colors }] } });
  }

  function chartPanel(title, id) {
    return `<section class="panel chart-box"><div class="panel-header"><h3>${title}</h3></div><div class="panel-body"><canvas id="${id}" class="chart-canvas"></canvas></div></section>`;
  }

  const homePage = {
    render(root) {
      const metrics = dashboardMetrics();
      root.innerHTML =
        MR3App.pageHeader("nav.home", "page.homeHint") +
        renderHomeHero(metrics) +
        renderQuickActions() +
        renderCards(metrics) +
        `<div class="home-live-grid">
          ${renderActivityPanel()}
          ${renderHealthPanel(metrics)}
        </div>
        <div class="grid-section">
          ${chartPanel(MR3I18n.t("nav.sales"), "chartSales")}
          ${chartPanel(MR3I18n.t("nav.purchases"), "chartPurchases")}
          ${chartPanel(MR3I18n.t("report.topSelling"), "chartTop")}
          ${chartPanel(MR3I18n.t("report.paymentMethods"), "chartPayments")}
          ${chartPanel(MR3I18n.t("nav.shortages"), "chartShortages")}
          ${chartPanel(MR3I18n.t("dashboard.lowStockChart"), "chartLow")}
        </div>`;
      root.querySelectorAll("[data-dashboard-page]").forEach((button) => {
        button.addEventListener("click", () => MR3App.navigate(button.dataset.dashboardPage));
        button.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            MR3App.navigate(button.dataset.dashboardPage);
          }
        });
      });
      setTimeout(drawCharts, 0);
    }
  };

  window.MR3Pages.home = homePage;
  window.MR3Pages.dashboard = homePage;
})();
