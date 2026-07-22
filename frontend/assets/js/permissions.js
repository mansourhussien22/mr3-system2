(function () {
  const PERMISSIONS = MR3Seed.ALL_PERMISSIONS;

  const permissionLabels = {
    "dashboard.view": ["View home", "عرض الهوم"],
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
    "settings.manage": ["Manage settings", "إدارة الإعدادات"]
  };

  Object.assign(permissionLabels, {
    "inventory.audit": ["Inventory audit", "جرد وتسوية المخزون"],
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
  });

  function label(permission) {
    const item = permissionLabels[permission] || [permission, permission];
    return MR3I18n.isArabic() ? item[1] : item[0];
  }

  function has(user, permission) {
    if (!user || !user.active) return false;
    if (user.role === "ADMIN") return true;
    return (user.permissions || []).includes(permission);
  }

  function require(permission) {
    if (!has(MR3Auth.currentUser(), permission)) {
      MR3Utils.toast("error", MR3I18n.t("messages.failed"), MR3I18n.t("messages.permissionDenied"));
      return false;
    }
    return true;
  }

  window.MR3Permissions = { all: PERMISSIONS, label, has, require };
})();
