(function () {
  // 1️⃣ إعداد قائمة الصلاحيات الشاملة كـ Fallback في حال عدم وجود MR3Seed
  const DEFAULT_PERMISSIONS = [
    "dashboard.view",
    "products.view", "products.create", "products.update", "products.delete",
    "categories.view", "categories.create", "categories.update", "categories.delete",
    "sales.view", "sales.create", "sales.update", "sales.delete",
    "purchases.view", "purchases.create", "purchases.update", "purchases.delete",
    "salesReturns.view", "salesReturns.create",
    "purchaseReturns.view", "purchaseReturns.create",
    "customers.view", "customers.create", "customers.update", "customers.delete",
    "suppliers.view", "suppliers.create", "suppliers.update", "suppliers.delete",
    "inventory.view", "inventory.adjust", "inventory.movement", "inventory.audit",
    "shortages.view", "shortages.create", "shortages.update", "shortages.delete",
    "payments.view", "payments.create",
    "expenses.view", "expenses.create", "expenses.update", "expenses.delete",
    "reports.view",
    "users.manage",
    "settings.manage",
    "customerService.view", "customerService.create", "customerService.update",
    "reservations.view", "reservations.create", "reservations.update",
    "notifications.view",
    "treasury.view", "treasury.create",
    "settlements.view"
  ];

  // تأمين جلب الصلاحيات سواء كانت في Seed أو القائمة التخلفية
  const PERMISSIONS = (typeof MR3Seed !== "undefined" && Array.isArray(MR3Seed.ALL_PERMISSIONS)) 
    ? MR3Seed.ALL_PERMISSIONS 
    : DEFAULT_PERMISSIONS;

  const permissionLabels = {
    "dashboard.view": ["View home", "عرض الرئيسية"],
    "products.view": ["View products", "عرض الأصناف"],
    "products.create": ["Create products", "إضافة أصناف"],
    "products.update": ["Update products", "تعديل الأصناف"],
    "products.delete": ["Delete products", "حذف الأصناف"],
    "categories.view": ["View categories", "عرض التصنيفات"],
    "categories.create": ["Create categories", "إضافة تصنيفات"],
    "categories.update": ["Update categories", "تعديل التصنيفات"],
    "categories.delete": ["Delete categories", "حذف التصنيفات"],
    "sales.view": ["View sales invoices", "عرض فواتير المبيعات"],
    "sales.create": ["Create sales invoices", "إنشاء فواتير مبيعات"],
    "sales.update": ["Update sales invoices", "تعديل فواتير المبيعات"],
    "sales.delete": ["Delete sales invoices", "حذف فواتير المبيعات"],
    "purchases.view": ["View purchase invoices", "عرض فواتير الشراء"],
    "purchases.create": ["Create purchase invoices", "إنشاء فواتير شراء"],
    "purchases.update": ["Update purchase invoices", "تعديل فواتير الشراء"],
    "purchases.delete": ["Delete purchase invoices", "حذف فواتير الشراء"],
    "salesReturns.view": ["View sales returns", "عرض مرتجعات المبيعات"],
    "salesReturns.create": ["Create sales returns", "إنشاء مرتجعات مبيعات"],
    "purchaseReturns.view": ["View purchase returns", "عرض مرتجعات الشراء"],
    "purchaseReturns.create": ["Create purchase returns", "إنشاء مرتجعات شراء"],
    "customers.view": ["View customers", "عرض العملاء"],
    "customers.create": ["Create customers", "إضافة عملاء"],
    "customers.update": ["Update customers", "تعديل العملاء"],
    "customers.delete": ["Delete customers", "حذف العملاء"],
    "suppliers.view": ["View suppliers", "عرض الموردين"],
    "suppliers.create": ["Create suppliers", "إضافة موردين"],
    "suppliers.update": ["Update suppliers", "تعديل الموردين"],
    "suppliers.delete": ["Delete suppliers", "حذف الموردين"],
    "inventory.view": ["View inventory", "عرض المخزون"],
    "inventory.adjust": ["Adjust inventory", "تعديل المخزون"],
    "inventory.movement": ["View item movement", "عرض حركة الأصناف"],
    "inventory.audit": ["Inventory audit", "جرد وتسوية المخزون"],
    "shortages.view": ["View shortages", "عرض النواقص"],
    "shortages.create": ["Create shortages", "إضافة نواقص"],
    "shortages.update": ["Update shortages", "تعديل النواقص"],
    "shortages.delete": ["Delete shortages", "حذف النواقص"],
    "payments.view": ["View payments", "عرض المدفوعات"],
    "payments.create": ["Create payments", "إضافة مدفوعات"],
    "expenses.view": ["View expenses", "عرض المصروفات"],
    "expenses.create": ["Create expenses", "إضافة مصروفات"],
    "expenses.update": ["Update expenses", "تعديل المصروفات"],
    "expenses.delete": ["Delete expenses", "حذف المصروفات"],
    "reports.view": ["View reports", "عرض التقارير"],
    "users.manage": ["Manage users", "إدارة المستخدمين"],
    "settings.manage": ["Manage settings", "إدارة الإعدادات"],
    "customerService.view": ["View customer service", "عرض خدمة العملاء"],
    "customerService.create": ["Create customer requests", "إنشاء طلبات خدمة العملاء"],
    "customerService.update": ["Update customer requests", "تعديل طلبات خدمة العملاء"],
    "reservations.view": ["View reservations", "عرض الحجوزات"],
    "reservations.create": ["Create reservations", "إنشاء حجوزات"],
    "reservations.update": ["Update reservations", "تعديل الحجوزات"],
    "notifications.view": ["View notifications", "عرض التنبيهات"],
    "treasury.view": ["View treasury", "عرض الخزنة"],
    "treasury.create": ["Create treasury deposits and withdrawals", "إضافة صرف وتوريد"],
    "settlements.view": ["View stock settlements", "عرض تسويات المخزون"]
  };

  function label(permission) {
    const item = permissionLabels[permission] || [permission, permission];
    // التحقق بأمان من اللغات
    const isAr = typeof MR3I18n !== "undefined" && typeof MR3I18n.isArabic === "function" ? MR3I18n.isArabic() : true;
    return isAr ? item[1] : item[0];
  }

  function has(user, permission) {
    if (!user) return false;
    
    // عدم الرفض إلا إذا كانت active معرّفة صراحة بـ false
    if (user.active === false) return false;

    // توحيد فحص الأدوار بحروف كبيرة
    const role = String(user.role || "").toUpperCase();
    if (role === "ADMIN") return true;

    // فحص الصلاحيات للمستخدم العادي
    const perms = Array.isArray(user.permissions) ? user.permissions : [];
    return perms.includes(permission);
  }

  function require(permission) {
    const currentUser = (typeof MR3Auth !== "undefined" && typeof MR3Auth.currentUser === "function") 
      ? MR3Auth.currentUser() 
      : (typeof MR3App !== "undefined" && typeof MR3App.user === "function" ? MR3App.user() : null);

    if (!has(currentUser, permission)) {
      if (typeof MR3Utils !== "undefined" && MR3Utils.toast) {
        MR3Utils.toast("error", "خطأ", "ليس لديك صلاحية للوصول لهذه الدالة.");
      } else {
        alert("ليس لديك صلاحية للوصول لهذه الدالة.");
      }
      return false;
    }
    return true;
  }

  window.MR3Permissions = { 
    all: PERMISSIONS, 
    label, 
    has, 
    require 
  };
})();
