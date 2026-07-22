(function () {
  const EXPIRY_MIN_DAYS = 90;

  function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next.toISOString().slice(0, 10);
  }

  function minExpiryDate() {
    return addDays(new Date(), EXPIRY_MIN_DAYS);
  }

  function isExpired(value) {
    return Boolean(value) && String(value).slice(0, 10) < MR3Utils.today();
  }

  function requiresExpiry(productOrData) {
    return String(productOrData?.requiresExpiryTracking) === "true" || productOrData?.requiresExpiryTracking === true;
  }

  function validateExpiry(productOrData) {
    if (!requiresExpiry(productOrData)) return;
    const value = productOrData.expiryDate;
    if (!value) throw new Error(MR3I18n.t("messages.expiryRequired"));
    if (value <= MR3Utils.today()) throw new Error(MR3I18n.t("messages.expiredBlocked"));
    if (value < minExpiryDate()) throw new Error(MR3I18n.t("messages.expiryMinDays"));
  }

  function conversion(product) {
    const cfg = product?.unitConversions || {};
    return {
      stripsPerBox: Math.max(1, MR3Utils.parseNumber(cfg.stripsPerBox, 10)),
      tabletsPerStrip: Math.max(1, MR3Utils.parseNumber(cfg.tabletsPerStrip, 10))
    };
  }

  function unitFactor(product, unitType) {
    if (!product || !unitType) return 0;
    if (unitType === product.unitType) return 1;
    const cfg = conversion(product);
    if (product.unitType === "box") {
      if (unitType === "strip") return 1 / cfg.stripsPerBox;
      if (unitType === "tablet") return 1 / (cfg.stripsPerBox * cfg.tabletsPerStrip);
    }
    if (product.unitType === "strip" && unitType === "tablet") return 1 / cfg.tabletsPerStrip;
    return 0;
  }

  function toStockQuantity(product, unitType, quantity) {
    const factor = unitFactor(product, unitType || product?.unitType);
    if (!factor) throw new Error(MR3I18n.t("messages.unitUnavailable"));
    return MR3Utils.parseNumber(quantity) * factor;
  }

  function fromStockQuantity(product, unitType, stockQuantity) {
    const factor = unitFactor(product, unitType || product?.unitType);
    if (!factor) return 0;
    return MR3Utils.parseNumber(stockQuantity) / factor;
  }

  function activeReservations(product) {
    return MR3DB.all("reservations").filter((reservation) => reservation.productId === product.id && reservation.status === "active");
  }

  function reservedStockQuantity(product) {
    return activeReservations(product).reduce((total, reservation) => total + toStockQuantity(product, reservation.unitType || product.unitType, reservation.quantity), 0);
  }

  function batches(product) {
    return MR3DB.all("stockBatches")
      .filter((batch) => batch.productId === product.id && MR3Utils.parseNumber(batch.quantityRemaining) > 0)
      .sort((a, b) => {
        const ax = a.expiryDate || "9999-12-31";
        const bx = b.expiryDate || "9999-12-31";
        return ax.localeCompare(bx);
      });
  }

  function saleableStockQuantity(product) {
    const rows = batches(product).filter((batch) => !isExpired(batch.expiryDate));
    if (rows.length) return rows.reduce((total, batch) => total + MR3Utils.parseNumber(batch.quantityRemaining), 0);
    return requiresExpiry(product) ? 0 : MR3Utils.parseNumber(product.stockQuantity);
  }

  function availableStockQuantity(product) {
    return Math.max(0, saleableStockQuantity(product) - reservedStockQuantity(product));
  }

  function availableUnits(product, unitType) {
    return Math.floor(fromStockQuantity(product, unitType || product.unitType, availableStockQuantity(product)) * 1000) / 1000;
  }

  function receiveBatch(options) {
    const product = MR3DB.get("products", options.productId);
    if (!product) return null;
    const quantityStock = toStockQuantity(product, options.unitType || product.unitType, options.quantity);
    if (requiresExpiry(product)) validateExpiry({ ...product, expiryDate: options.expiryDate || product.expiryDate });
    return MR3DB.insert("stockBatches", {
      productId: product.id,
      productName: MR3App.productName(product),
      quantityOriginal: quantityStock,
      quantityRemaining: quantityStock,
      expiryDate: options.expiryDate || "",
      purchaseCost: MR3Utils.parseNumber(options.purchaseCost),
      sourceReference: options.reference || "",
      storeId: product.storeId || MR3DB.getSettings().storeId || "store_main",
      createdAt: MR3Utils.now()
    });
  }

  function consumeBatches(options) {
    const product = MR3DB.get("products", options.productId);
    if (!product) throw new Error(MR3I18n.t("messages.noData"));
    const quantityStock = toStockQuantity(product, options.unitType || product.unitType, options.quantity);
    if (availableStockQuantity(product) + 0.000001 < quantityStock) throw new Error(MR3I18n.t("messages.stockNotEnough"));
    const allocations = [];
    let remaining = quantityStock;
    const batchRows = batches(product).filter((batch) => !isExpired(batch.expiryDate));
    if (!batchRows.length && !requiresExpiry(product)) {
      return [{ batchId: "", expiryDate: "", quantity: quantityStock, purchaseCost: MR3Utils.parseNumber(product.purchasePrice) }];
    }
    batchRows
      .forEach((batch) => {
        if (remaining <= 0) return;
        const take = Math.min(MR3Utils.parseNumber(batch.quantityRemaining), remaining);
        if (take <= 0) return;
        remaining -= take;
        allocations.push({ batchId: batch.id, expiryDate: batch.expiryDate || "", quantity: take, purchaseCost: MR3Utils.parseNumber(batch.purchaseCost) });
        MR3DB.update("stockBatches", batch.id, { quantityRemaining: MR3Utils.parseNumber(batch.quantityRemaining) - take });
      });
    if (remaining > 0.000001) throw new Error(MR3I18n.t("messages.stockNotEnough"));
    return allocations;
  }

  function addNotification(type, title, message, targetPage, entityId) {
    return MR3DB.insert("notifications", {
      type,
      title,
      message,
      targetPage: targetPage || "home",
      entityId: entityId || "",
      status: "unread",
      date: MR3Utils.today(),
      createdAt: MR3Utils.now()
    });
  }

  function checkAvailability(productId) {
    const product = MR3DB.get("products", productId);
    if (!product) return;
    const available = availableUnits(product, product.unitType);
    MR3DB.all("customerRequests")
      .filter((request) => request.productId === productId && ["pending", "searching", "ordered"].includes(request.status))
      .forEach((request) => {
        if (available >= MR3Utils.parseNumber(request.quantity)) {
          MR3DB.update("customerRequests", request.id, { status: "available", availableAt: MR3Utils.now() });
          addNotification("customerRequest", MR3I18n.t("notifications.requestAvailable"), `${request.customerName} - ${request.productName}`, "customerService", request.id);
        }
      });
  }

  function treasuryRows() {
    const payments = MR3DB.all("payments").map((payment) => ({
      date: payment.date,
      reference: payment.number,
      type: payment.entityType === "supplier" ? (payment.direction === "IN" ? "supplierReceive" : "supplierPayment") : (payment.direction === "OUT" ? "customerRefund" : "customerPayment"),
      direction: payment.direction,
      amount: MR3Utils.parseNumber(payment.amount),
      method: payment.paymentMethod,
      accountName: payment.entityName || "",
      accountType: payment.entityType || "",
      notes: payment.notes || "",
      balanceBefore: payment.balanceBefore,
      balanceAfter: payment.balanceAfter,
      userName: payment.userName || ""
    }));
    const expenses = MR3DB.all("expenses").map((expense) => ({
      date: expense.date,
      reference: expense.number,
      type: "expense",
      direction: "OUT",
      amount: MR3Utils.parseNumber(expense.amount),
      method: expense.paymentMethod,
      accountName: expense.title || "",
      accountType: "expense",
      notes: expense.title || ""
    }));
    const manual = MR3DB.all("treasuryTransactions").map((item) => ({
      date: item.date,
      reference: item.number,
      type: item.type,
      direction: item.direction,
      amount: MR3Utils.parseNumber(item.amount),
      method: item.paymentMethod,
      accountName: item.accountName || "",
      accountType: item.accountType || "",
      notes: item.notes || "",
      balanceBefore: item.balanceBefore,
      balanceAfter: item.balanceAfter,
      userName: item.userName || ""
    }));
    return [...payments, ...expenses, ...manual].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  function treasuryBalance() {
    return treasuryRows().reduce((total, row) => total + (row.direction === "OUT" ? -row.amount : row.amount), 0);
  }

  function unreadNotifications() {
    return MR3DB.all("notifications").filter((item) => item.status !== "read").length;
  }

  window.MR3Production = {
    EXPIRY_MIN_DAYS,
    minExpiryDate,
    isExpired,
    requiresExpiry,
    validateExpiry,
    toStockQuantity,
    fromStockQuantity,
    availableStockQuantity,
    availableUnits,
    receiveBatch,
    consumeBatches,
    addNotification,
    checkAvailability,
    treasuryRows,
    treasuryBalance,
    unreadNotifications
  };
})();
