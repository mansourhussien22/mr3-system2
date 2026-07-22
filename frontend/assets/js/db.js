(function () {
  const LEGACY_KEY = "mr3-db-v1";
  const KEY = "__mr3_store_v2";
  const BACKUP_KEY = "__mr3_store_backup_v2";
  const ENCODE_PREFIX = "MR3:";
  const VERSION = 3;
  const UNIT_TYPES = ["box", "strip", "tablet", "tube", "bottle", "syrup", "ampoule", "packet", "piece", "other"];
  const PAYMENT_METHODS = ["cash", "visa", "vodafoneCash", "orangeCash", "instapay", "bankTransfer"];
  const ALL_PERMISSIONS = [
    "dashboard.view",
    "products.view",
    "products.create",
    "products.update",
    "products.delete",
    "categories.view",
    "categories.create",
    "categories.update",
    "categories.delete",
    "sales.view",
    "sales.create",
    "sales.update",
    "sales.delete",
    "purchases.view",
    "purchases.create",
    "purchases.update",
    "purchases.delete",
    "salesReturns.view",
    "salesReturns.create",
    "purchaseReturns.view",
    "purchaseReturns.create",
    "customers.view",
    "customers.create",
    "customers.update",
    "customers.delete",
    "suppliers.view",
    "suppliers.create",
    "suppliers.update",
    "suppliers.delete",
    "inventory.view",
    "inventory.adjust",
    "inventory.audit",
    "inventory.movement",
    "shortages.view",
    "shortages.create",
    "shortages.update",
    "shortages.delete",
    "payments.view",
    "payments.create",
    "expenses.view",
    "expenses.create",
    "expenses.update",
    "expenses.delete",
    "customerService.view",
    "customerService.create",
    "customerService.update",
    "reservations.view",
    "reservations.create",
    "reservations.update",
    "notifications.view",
    "treasury.view",
    "treasury.create",
    "settlements.view",
    "reports.view",
    "users.manage",
    "settings.manage"
  ];

  const USER_PERMISSIONS = [
    "dashboard.view",
    "products.view",
    "sales.view",
    "sales.create",
    "purchases.view",
    "customers.view",
    "customers.create",
    "suppliers.view",
    "inventory.view",
    "customerService.view",
    "customerService.create",
    "reservations.view",
    "reservations.create",
    "notifications.view",
    "treasury.view",
    "treasury.create",
    "inventory.movement",
    "shortages.view",
    "shortages.create",
    "payments.view",
    "payments.create",
    "expenses.view",
    "expenses.create",
    "reports.view"
  ];

  let db;

  function encodeStore(value) {
    const json = JSON.stringify(value);
    const encoded = btoa(unescape(encodeURIComponent(json)));
    return ENCODE_PREFIX + encoded;
  }

  function decodeStore(raw) {
    if (!raw) return null;
    if (raw.startsWith(ENCODE_PREFIX)) {
      return JSON.parse(decodeURIComponent(escape(atob(raw.slice(ENCODE_PREFIX.length)))));
    }
    return JSON.parse(raw);
  }

  function codeNumber(value) {
    const match = String(value || "").match(/(\d+)$/);
    return match ? Number(match[1]) : 0;
  }

  function nextSequence(data, name, prefix, width) {
    data.counters[name] = (data.counters[name] || 0) + 1;
    return `${prefix}-${String(data.counters[name]).padStart(width || 6, "0")}`;
  }

  function ensureCounterAtLeast(data, name, rows, field) {
    const max = (rows || []).reduce((highest, row) => Math.max(highest, codeNumber(row[field])), 0);
    data.counters[name] = Math.max(data.counters[name] || 0, max);
  }

  function ensureArray(data, name) {
    if (!Array.isArray(data[name])) data[name] = [];
    return data[name];
  }

  function ensureDefaultCategories(data) {
    const defaults = [
      ["cat_medicine", "Medicine", "Medicine"],
      ["cat_cosmetics", "Cosmetics / Cosmo", "Cosmetics / Cosmo"],
      ["cat_medical_supplies", "Medical Supplies", "Medical Supplies"],
      ["cat_food_supplements", "Food Supplements", "Food Supplements"],
      ["cat_baby_care", "Baby Care", "Baby Care"],
      ["cat_personal_care", "Personal Care", "Personal Care"],
      ["cat_other", "Other", "Other"]
    ];
    data.categories = ensureArray(data, "categories");
    defaults.forEach(([id, nameAr, nameEn]) => {
      if (!data.categories.some((category) => category.id === id || category.nameEn === nameEn)) {
        data.categories.push({ id, nameAr, nameEn, icon: "pill", notes: "" });
      }
    });
  }

  function normalizeEntityCodes(data) {
    ensureCounterAtLeast(data, "customerCodes", data.customers, "code");
    ensureCounterAtLeast(data, "supplierCodes", data.suppliers, "code");
    ensureCounterAtLeast(data, "productCodes", data.products, "code");
    ensureCounterAtLeast(data, "barcodes", data.products, "barcode");
    (data.customers || []).forEach((customer) => {
      if (!customer.code) customer.code = customer.id === "cus_walkin" ? "CUST-WALKIN" : nextSequence(data, "customerCodes", "CUST", 6);
      if (customer.creditLimit === undefined) customer.creditLimit = 0;
      if (customer.storeId === undefined) customer.storeId = "store_main";
    });
    (data.suppliers || []).forEach((supplier) => {
      if (!supplier.code) supplier.code = nextSequence(data, "supplierCodes", "SUP", 6);
      if (supplier.creditLimit === undefined) supplier.creditLimit = 0;
      if (supplier.companyName === undefined) supplier.companyName = "";
      if (supplier.storeId === undefined) supplier.storeId = "store_main";
    });
    (data.products || []).forEach((product) => {
      if (!product.code) product.code = nextSequence(data, "productCodes", "PRD", 6);
      if (!product.barcode) {
        data.counters.barcodes = (data.counters.barcodes || 622000000000) + 1;
        product.barcode = String(data.counters.barcodes);
      }
      if (product.scientificName === undefined) product.scientificName = "";
      if (product.tradeName === undefined) product.tradeName = product.nameEn || product.nameAr || "";
      if (product.manufacturer === undefined) product.manufacturer = "";
      if (product.dosageForm === undefined) product.dosageForm = "";
      if (product.strength === undefined) product.strength = "";
      if (product.requiresExpiryTracking === undefined) product.requiresExpiryTracking = Boolean(product.expiryDate);
      if (product.storageConditions === undefined) product.storageConditions = "";
      if (product.reservedQuantity === undefined) product.reservedQuantity = 0;
      if (product.storeId === undefined) product.storeId = "store_main";
      if (!product.unitConversions) product.unitConversions = { stripsPerBox: 10, tabletsPerStrip: 10 };
    });
  }

  function ensureStockBatches(data) {
    const batches = ensureArray(data, "stockBatches");
    (data.products || []).forEach((product) => {
      const hasBatch = batches.some((batch) => batch.productId === product.id);
      const quantity = Number(product.stockQuantity) || 0;
      if (!hasBatch && quantity > 0) {
        batches.push({
          id: MR3Utils.uid("bat"),
          productId: product.id,
          productName: product.nameEn || product.nameAr || "",
          quantityOriginal: quantity,
          quantityRemaining: quantity,
          expiryDate: product.expiryDate || "",
          purchaseCost: Number(product.purchasePrice) || 0,
          sourceReference: "Opening",
          storeId: product.storeId || "store_main",
          createdAt: MR3Utils.now()
        });
      }
    });
  }

  function normalizeProductCodes(data, force) {
    const products = data.products || [];
    const needsNumeric = force || products.some((product) => !/^\d+$/.test(String(product.code || "")));
    if (needsNumeric) {
      products.forEach((product, index) => {
        product.code = String(index + 1);
      });
    }
    data.counters.productCodes = products.reduce((max, product) => Math.max(max, codeNumber(product.code)), 0);
  }

  function migrate(data) {
    const previousVersion = data.meta?.version || 0;
    if (!data.meta || data.meta.version !== VERSION) {
      data.meta = { ...(data.meta || {}), version: VERSION };
    }
    if (!data.settings) data.settings = {};
    if (!data.settings.storeId) data.settings.storeId = "store_main";
    ensureArray(data, "customers");
    ensureArray(data, "suppliers");
    ensureArray(data, "products");
    ensureDefaultCategories(data);
    (data.users || []).forEach((user) => {
      if (user.phone === undefined) user.phone = "";
      if (user.address === undefined) user.address = "";
      if (user.avatar === undefined) user.avatar = "";
    });
    if (!Array.isArray(data.heldSalesInvoices)) data.heldSalesInvoices = [];
    if (!Array.isArray(data.heldPurchaseInvoices)) data.heldPurchaseInvoices = [];
    ensureArray(data, "auditLogs");
    ensureArray(data, "inventoryAudits");
    ensureArray(data, "notifications");
    ensureArray(data, "customerRequests");
    ensureArray(data, "reservations");
    ensureArray(data, "settlementRecords");
    ensureArray(data, "stockBatches");
    ensureArray(data, "treasuryTransactions");
    ensureArray(data, "customerLedger");
    ensureArray(data, "supplierLedger");
    if (!db?.counters && !data.counters) data.counters = {};
    if (!data.counters) data.counters = {};
    if (data.settings && !localStorage.getItem("mr3-language") && data.settings.defaultLanguage === "en") {
      data.settings.defaultLanguage = "ar";
    }
    if (!data.counters.heldSales) data.counters.heldSales = 0;
    if (!data.counters.heldPurchases) data.counters.heldPurchases = 0;
    normalizeEntityCodes(data);
    normalizeProductCodes(data, previousVersion < 3);
    ensureStockBatches(data);
    (data.users || []).forEach((user) => {
      if (user.role === "ADMIN") user.permissions = ALL_PERMISSIONS.slice();
    });
    return data;
  }

  function seed() {
    const now = MR3Utils.now();
    const today = MR3Utils.today();
    const categories = [
      { id: "cat_pain", nameAr: "مسكنات", nameEn: "Painkillers", icon: "pill", notes: "" },
      { id: "cat_antibiotic", nameAr: "مضادات حيوية", nameEn: "Antibiotics", icon: "pill", notes: "" },
      { id: "cat_vitamin", nameAr: "فيتامينات", nameEn: "Vitamins", icon: "pill", notes: "" },
      { id: "cat_skin", nameAr: "العناية بالبشرة", nameEn: "Skin care", icon: "box", notes: "" },
      { id: "cat_baby", nameAr: "رعاية الأطفال", nameEn: "Baby care", icon: "box", notes: "" },
      { id: "cat_supplies", nameAr: "مستلزمات طبية", nameEn: "Medical supplies", icon: "layers", notes: "" }
    ];
    const suppliers = [
      { id: "sup_alpha", code: "SUP-001", name: "Alpha Medical", phone: "01000000001", address: "Cairo", openingBalance: 0, balance: 1200, notes: "", createdAt: now, updatedAt: now },
      { id: "sup_delta", code: "SUP-002", name: "Delta Pharma", phone: "01000000002", address: "Giza", openingBalance: 0, balance: 0, notes: "", createdAt: now, updatedAt: now }
    ];
    const customers = [
      { id: "cus_walkin", name: "Walk-in Customer", phone: "", address: "", openingBalance: 0, balance: 0, notes: "", createdAt: now, updatedAt: now },
      { id: "cus_ahmed", name: "Ahmed Hassan", phone: "01012345678", address: "Nasr City", openingBalance: 0, balance: 150, notes: "", createdAt: now, updatedAt: now }
    ];
    const products = [
      {
        id: "prd_para",
        code: "1",
        barcode: "622100100001",
        nameAr: "باراسيتامول 500 مجم",
        nameEn: "Paracetamol 500mg",
        categoryId: "cat_pain",
        unitType: "box",
        boxPrice: 45,
        stripPrice: 8,
        tabletPrice: 1,
        purchasePrice: 30,
        salePrice: 45,
        stockQuantity: 84,
        minimumStockQuantity: 20,
        expiryDate: "2027-08-30",
        supplierId: "sup_alpha",
        notes: "Fast moving item",
        image: "",
        createdAt: now,
        updatedAt: now,
        isActive: true
      },
      {
        id: "prd_amox",
        code: "2",
        barcode: "622100100002",
        nameAr: "أموكسيسيلين 500 مجم",
        nameEn: "Amoxicillin 500mg",
        categoryId: "cat_antibiotic",
        unitType: "box",
        boxPrice: 92,
        stripPrice: 18,
        tabletPrice: 2.5,
        purchasePrice: 68,
        salePrice: 92,
        stockQuantity: 38,
        minimumStockQuantity: 15,
        expiryDate: "2026-11-15",
        supplierId: "sup_delta",
        notes: "",
        image: "",
        createdAt: now,
        updatedAt: now,
        isActive: true
      },
      {
        id: "prd_vitc",
        code: "3",
        barcode: "622100100003",
        nameAr: "فيتامين سي",
        nameEn: "Vitamin C",
        categoryId: "cat_vitamin",
        unitType: "bottle",
        boxPrice: 0,
        stripPrice: 0,
        tabletPrice: 0,
        purchasePrice: 52,
        salePrice: 75,
        stockQuantity: 8,
        minimumStockQuantity: 10,
        expiryDate: "2026-09-01",
        supplierId: "sup_alpha",
        notes: "Low stock",
        image: "",
        createdAt: now,
        updatedAt: now,
        isActive: true
      },
      {
        id: "prd_gloves",
        code: "4",
        barcode: "622200100001",
        nameAr: "قفازات طبية",
        nameEn: "Medical Gloves",
        categoryId: "cat_supplies",
        unitType: "packet",
        boxPrice: 0,
        stripPrice: 0,
        tabletPrice: 0,
        purchasePrice: 80,
        salePrice: 110,
        stockQuantity: 2,
        minimumStockQuantity: 8,
        expiryDate: "2028-01-01",
        supplierId: "sup_delta",
        notes: "Critical shortage",
        image: "",
        createdAt: now,
        updatedAt: now,
        isActive: true
      }
    ];
    const salesInvoices = [
      {
        id: "sal_seed",
        number: "SI-0001",
        customerId: "cus_ahmed",
        customerName: "Ahmed Hassan",
        date: today,
        items: [
          { productId: "prd_para", productName: "Paracetamol 500mg", unitType: "strip", quantity: 2, unitPrice: 8, discountValue: 0, total: 16 },
          { productId: "prd_amox", productName: "Amoxicillin 500mg", unitType: "box", quantity: 1, unitPrice: 92, discountValue: 8, total: 84 }
        ],
        subtotal: 108,
        discountType: "value",
        discountInput: 0,
        discountValue: 0,
        finalTotal: 100,
        paidAmount: 100,
        remainingAmount: 0,
        isCredit: false,
        paymentMethod: "cash",
        userId: "u_admin",
        userName: "System Admin",
        notes: "Seed sale",
        createdAt: now,
        status: "active"
      }
    ];
    const purchaseInvoices = [
      {
        id: "pur_seed",
        number: "PI-0001",
        supplierId: "sup_alpha",
        supplierName: "Alpha Medical",
        date: today,
        items: [
          { productId: "prd_para", productName: "Paracetamol 500mg", unitType: "box", quantity: 100, unitPrice: 30, total: 3000 },
          { productId: "prd_vitc", productName: "Vitamin C", unitType: "bottle", quantity: 10, unitPrice: 52, total: 520 }
        ],
        subtotal: 3520,
        discountValue: 0,
        finalTotal: 3520,
        paidAmount: 2320,
        remainingAmount: 1200,
        paymentMethod: "bankTransfer",
        userId: "u_admin",
        userName: "System Admin",
        notes: "Seed purchase",
        createdAt: now,
        status: "active"
      }
    ];
    const movements = [
      { id: "mov_1", productId: "prd_para", date: today, type: "purchase", reference: "PI-0001", quantityIn: 100, quantityOut: 0, balanceAfter: 100, unitType: "box", unitPrice: 30, userId: "u_admin", userName: "System Admin", notes: "Opening purchase" },
      { id: "mov_2", productId: "prd_para", date: today, type: "sale", reference: "SI-0001", quantityIn: 0, quantityOut: 16, balanceAfter: 84, unitType: "strip", unitPrice: 8, userId: "u_admin", userName: "System Admin", notes: "Seed sale" },
      { id: "mov_3", productId: "prd_amox", date: today, type: "purchase", reference: "Opening", quantityIn: 50, quantityOut: 0, balanceAfter: 50, unitType: "box", unitPrice: 68, userId: "u_admin", userName: "System Admin", notes: "Opening stock" },
      { id: "mov_4", productId: "prd_amox", date: today, type: "sale", reference: "SI-0001", quantityIn: 0, quantityOut: 12, balanceAfter: 38, unitType: "box", unitPrice: 92, userId: "u_admin", userName: "System Admin", notes: "Seed sale" },
      { id: "mov_5", productId: "prd_vitc", date: today, type: "purchase", reference: "PI-0001", quantityIn: 10, quantityOut: 0, balanceAfter: 10, unitType: "bottle", unitPrice: 52, userId: "u_admin", userName: "System Admin", notes: "Opening purchase" },
      { id: "mov_6", productId: "prd_vitc", date: today, type: "adjustment", reference: "ADJ-0001", quantityIn: 0, quantityOut: 2, balanceAfter: 8, unitType: "bottle", unitPrice: 0, userId: "u_admin", userName: "System Admin", notes: "Damaged items" }
    ];
    return {
      meta: { version: VERSION, seededAt: now },
      settings: {
        businessNameAr: "صيدلية MR3",
        businessNameEn: "MR3 Pharmacy",
        phone: "01000000000",
        address: "Cairo, Egypt",
        logoPath: "assets/images/logo.png",
        defaultLanguage: "ar",
        currency: "EGP",
        receiptFooter: "Thank you for choosing MR3 System"
      },
      counters: { sales: 1, purchases: 1, heldSales: 0, heldPurchases: 0, salesReturns: 0, purchaseReturns: 0, payments: 0, expenses: 0, adjustments: 1, shortages: 1, productCodes: 4, customerCodes: 1, supplierCodes: 2, barcodes: 622200100001, customerService: 0, reservations: 0, treasury: 0, settlements: 0 },
      users: [
        { id: "u_admin", name: "System Admin", username: "admin", email: "admin@example.com", phone: "", address: "", avatar: "", password: "Admin@123456", role: "ADMIN", active: true, permissions: ALL_PERMISSIONS.slice(), createdAt: now, updatedAt: now },
        { id: "u_user", name: "Pharmacy User", username: "user", email: "user@example.com", phone: "", address: "", avatar: "", password: "User@123456", role: "USER", active: true, permissions: USER_PERMISSIONS.slice(), createdAt: now, updatedAt: now }
      ],
      categories,
      customers,
      suppliers,
      products,
      salesInvoices,
      purchaseInvoices,
      heldSalesInvoices: [],
      heldPurchaseInvoices: [],
      salesReturns: [],
      purchaseReturns: [],
      movements,
      payments: [
        { id: "pay_seed_1", number: "PAY-0001", entityType: "customer", entityId: "cus_ahmed", entityName: "Ahmed Hassan", direction: "IN", amount: 100, paymentMethod: "cash", date: today, notes: "Sales invoice SI-0001", userId: "u_admin", userName: "System Admin", createdAt: now },
        { id: "pay_seed_2", number: "PAY-0002", entityType: "supplier", entityId: "sup_alpha", entityName: "Alpha Medical", direction: "OUT", amount: 2320, paymentMethod: "bankTransfer", date: today, notes: "Purchase invoice PI-0001", userId: "u_admin", userName: "System Admin", createdAt: now }
      ],
      expenses: [
        { id: "exp_seed", number: "EXP-0001", title: "Electricity bill", amount: 450, paymentMethod: "cash", date: today, notes: "", userId: "u_admin", userName: "System Admin", createdAt: now, updatedAt: now }
      ],
      shortages: [
        { id: "sho_gloves", number: "SH-0001", productId: "prd_gloves", productName: "Medical Gloves", code: "SUP-2001", currentStock: 2, minimumStock: 8, requiredQuantity: 12, status: "pending", notes: "Order soon", createdAt: now, updatedAt: now, userId: "u_admin", userName: "System Admin" }
      ]
    };
  }

  function load() {
    if (db) return db;
    const raw = localStorage.getItem(KEY) || localStorage.getItem(BACKUP_KEY) || localStorage.getItem(LEGACY_KEY);
    if (!raw) {
      db = seed();
      save();
      return db;
    }
    try {
      db = migrate(decodeStore(raw));
      save();
    } catch (error) {
      db = seed();
      save();
    }
    return db;
  }

  function save() {
    const encoded = encodeStore(db || seed());
    localStorage.setItem(KEY, encoded);
    localStorage.setItem(BACKUP_KEY, encoded);
    localStorage.removeItem(LEGACY_KEY);
  }

  function reset() {
    db = seed();
    save();
    localStorage.removeItem("mr3-session-v1");
    sessionStorage.removeItem("mr3-session-v1");
    return db;
  }

  function table(name) {
    const data = load();
    if (!Array.isArray(data[name])) data[name] = [];
    return data[name];
  }

  function all(name) {
    return table(name).slice();
  }

  function get(name, id) {
    return table(name).find((row) => row.id === id) || null;
  }

  function insert(name, row) {
    const record = { id: row.id || MR3Utils.uid(name.slice(0, 3)), ...row };
    table(name).push(record);
    save();
    return record;
  }

  function update(name, id, patch) {
    const rows = table(name);
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) return null;
    const next = typeof patch === "function" ? patch({ ...rows[index] }) : { ...rows[index], ...patch };
    rows[index] = { ...next, updatedAt: next.updatedAt || MR3Utils.now() };
    save();
    return rows[index];
  }

  function remove(name, id) {
    const rows = table(name);
    const index = rows.findIndex((row) => row.id === id);
    if (index < 0) return false;
    rows.splice(index, 1);
    save();
    return true;
  }

  function counter(name, prefix) {
    const data = load();
    data.counters[name] = (data.counters[name] || 0) + 1;
    save();
    return `${prefix}-${String(data.counters[name]).padStart(4, "0")}`;
  }

  function nextCode(name, prefix, width) {
    const data = load();
    const value = nextSequence(data, name, prefix, width || 6);
    save();
    return value;
  }

  function nextBarcode() {
    const data = load();
    data.counters.barcodes = (data.counters.barcodes || 622000000000) + 1;
    save();
    return String(data.counters.barcodes);
  }

  function previewNumberCode(name) {
    const data = load();
    return String((data.counters[name] || 0) + 1);
  }

  function nextNumberCode(name) {
    const data = load();
    data.counters[name] = (data.counters[name] || 0) + 1;
    save();
    return String(data.counters[name]);
  }

  function claimNumberCode(name, code) {
    const data = load();
    data.counters[name] = Math.max(data.counters[name] || 0, codeNumber(code));
    save();
    return String(code);
  }

  function audit(entry) {
    const user = window.MR3App?.user?.();
    return insert("auditLogs", {
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      reference: entry.reference || "",
      oldValue: entry.oldValue || null,
      newValue: entry.newValue || null,
      reason: entry.reason || "",
      userId: entry.userId || user?.id || "",
      userName: entry.userName || user?.name || "",
      date: MR3Utils.today(),
      createdAt: MR3Utils.now()
    });
  }

  function getSettings() {
    return load().settings;
  }

  function updateSettings(patch) {
    const data = load();
    data.settings = { ...data.settings, ...patch };
    save();
    return data.settings;
  }

  window.MR3Seed = { ALL_PERMISSIONS, USER_PERMISSIONS, UNIT_TYPES, PAYMENT_METHODS };
  window.MR3DB = { load, save, reset, table, all, get, insert, update, remove, counter, nextCode, nextBarcode, previewNumberCode, nextNumberCode, claimNumberCode, audit, getSettings, updateSettings };
  load();
})();
