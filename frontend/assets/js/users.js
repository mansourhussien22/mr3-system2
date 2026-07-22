(function () {
  // =============================================
  // [تحسين الأداء] يفضل نقل هذا التحقق إلى قاعدة البيانات (Unique Index)
  // لتجنب تحميل كل المستخدمين في الذاكرة عند التعداد الكبير.
  // =============================================
  function duplicate(data, id) {
    const normalizedEmail = MR3Utils.normalize(data.email || '');
    const normalizedUsername = MR3Utils.normalize(data.username || '');

    if (!normalizedEmail && !normalizedUsername) return false;

    return MR3DB.all("users").some((user) => {
      if (user.id === id) return false;
      return (
        MR3Utils.normalize(user.email) === normalizedEmail ||
        MR3Utils.normalize(user.username) === normalizedUsername
      );
    });
  }

  // =============================================
  // دالة مساعدة لتحديث حالة مربعات الصلاحيات حسب الدور
  // =============================================
  function updatePermissionsUI(form, role, masterCheckbox) {
    const inputs = form.querySelectorAll("input[name='permissions']");
    const isAdmin = role === "ADMIN";

    inputs.forEach((input) => {
      if (isAdmin) {
        input.checked = true;   // الأدمن يملك كل الصلاحيات
        input.disabled = true;  // تعطيل التعديل عليه
      } else {
        input.checked = false;  // 🔥 إلغاء التحديد فوراً عند التحويل إلى USER
        input.disabled = false; // تفعيل التعديل للمستخدم العادي
      }
    });

    // تحديث مربع الاختيار الرئيسي (Master)
    if (masterCheckbox) {
      if (isAdmin) {
        masterCheckbox.checked = true;
        masterCheckbox.indeterminate = false;
        masterCheckbox.disabled = true;
      } else {
        masterCheckbox.checked = false;      // 🔥 إلغاء تحديد master
        masterCheckbox.indeterminate = false; // 🔥 إزالة حالة غير محددة
        masterCheckbox.disabled = false;
      }
    }
  }

  function openForm(user) {
    if (!MR3App.require("users.manage")) return;
    const isEdit = Boolean(user);

    const isAdminUser = user?.role === "ADMIN";
    const permissionBoxes = MR3Permissions.all
      .map((permission) => {
        const checked = isAdminUser || (user?.permissions || []).includes(permission) ? " checked" : "";
        const disabled = isAdminUser ? " disabled" : "";
        return `<label class="checkbox-line"><input type="checkbox" name="permissions" value="${MR3Utils.escape(permission)}"${checked}${disabled} /><span>${MR3Utils.escape(MR3Permissions.label(permission))}</span></label>`;
      })
      .join("");

    const body = `<form id="userForm" class="modal-form form-grid" novalidate>
      <label class="field"><span>${MR3I18n.t("common.name")}</span><input name="name" value="${MR3Utils.escape(user?.name || "")}" required /></label>
      <label class="field"><span>${MR3I18n.t("common.username")}</span><input name="username" value="${MR3Utils.escape(user?.username || "")}" required /></label>
      <label class="field"><span>${MR3I18n.t("common.email")}</span><input name="email" type="email" value="${MR3Utils.escape(user?.email || "")}" required /></label>
      
      <label class="field">
        <span>${MR3I18n.t("common.password")} ${isEdit ? `(${MR3I18n.t("common.optional")})` : ""}</span>
        <input name="password" type="password" autocomplete="new-password" minlength="6" ${isEdit ? "" : "required"} placeholder="${isEdit ? "••••••••" : ""}" />
      </label>

      <label class="field"><span>${MR3I18n.t("common.role")}</span><select name="role" id="roleSelect"><option value="USER"${user?.role !== "ADMIN" ? " selected" : ""}>${MR3I18n.t("common.user")}</option><option value="ADMIN"${user?.role === "ADMIN" ? " selected" : ""}>${MR3I18n.t("common.admin")}</option></select></label>
      <label class="field"><span>${MR3I18n.t("common.status")}</span><select name="active"><option value="true"${user?.active !== false ? " selected" : ""}>${MR3I18n.t("common.active")}</option><option value="false"${user?.active === false ? " selected" : ""}>${MR3I18n.t("common.inactive")}</option></select></label>
      
      <div class="wide" id="permissionsSection">
        <div class="field-label">${MR3I18n.t("nav.users")} - ${MR3Permissions.all.length} ${MR3I18n.t("common.selectAll")}</div>
        <div class="page-tools" style="justify-content:flex-start;margin:8px 0">
          <button class="success-button" type="button" data-permission-all>${MR3Utils.icon("check")}${MR3I18n.t("common.selectAll")}</button>
          <button class="ghost-button" type="button" data-permission-none>${MR3Utils.icon("x")}${MR3I18n.t("common.clearAll")}</button>
        </div>
        <div class="permission-grid">
          <label class="checkbox-line permission-master-box"><input type="checkbox" id="permissionMaster" ${isAdminUser ? "checked disabled" : ""} /><span>${MR3I18n.t("common.selectAll")}</span></label>
          ${permissionBoxes}
        </div>
      </div>
    </form>`;

    const footer = `<button class="ghost-button" type="button" data-close-modal>${MR3I18n.t("common.cancel")}</button><button class="primary-button" form="userForm" type="submit">${MR3Utils.icon("save")}${MR3I18n.t("common.save")}</button>`;
    const modal = MR3Utils.modal({ title: isEdit ? MR3I18n.t("common.edit") : MR3I18n.t("common.add"), body, footer });
    
    const form = modal.querySelector("#userForm");
    const master = modal.querySelector("#permissionMaster");
    const roleSelect = form.querySelector("#roleSelect");
    const permissionInputs = () => Array.from(form.querySelectorAll("input[name='permissions']"));
    
    // =============================================
    // وظائف التحكم في Master والمربعات
    // =============================================
    const syncMaster = () => {
      if (master.disabled) return;
      const inputs = permissionInputs();
      const checked = inputs.filter((input) => input.checked).length;
      master.checked = inputs.length > 0 && checked === inputs.length;
      master.indeterminate = checked > 0 && checked < inputs.length;
    };

    const setAllPermissions = (checked) => {
      const inputs = permissionInputs();
      const isDisabled = inputs.length > 0 && inputs[0].disabled;
      if (isDisabled) return;
      
      inputs.forEach((input) => {
        input.checked = checked;
      });
      syncMaster();
    };

    // =============================================
    // ربط الأحداث (Events)
    // =============================================
    modal.querySelectorAll("[data-permission-all]").forEach((button) => button.addEventListener("click", () => setAllPermissions(true)));
    modal.querySelectorAll("[data-permission-none]").forEach((button) => button.addEventListener("click", () => setAllPermissions(false)));
    
    master.addEventListener("change", () => {
      if (master.disabled) return;
      setAllPermissions(master.checked);
    });

    permissionInputs().forEach((input) => input.addEventListener("change", syncMaster));
    
    // =============================================
    // تفعيل التفاعل عند تغيير الدور (Role)
    // =============================================
    roleSelect.addEventListener("change", function () {
      const selectedRole = this.value;
      updatePermissionsUI(form, selectedRole, master);
      syncMaster();
    });

    // التهيئة الأولية
    const initialRole = roleSelect.value;
    updatePermissionsUI(form, initialRole, master);
    syncMaster();

    // =============================================
    // حدث إرسال النموذج (Submit) - [تم التصليح النهائي]
    // =============================================
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const data = Object.fromEntries(new FormData(form).entries());
      data.active = data.active === "true";
      
      // قراءة الصلاحيات المحددة فعلياً من الـ checkboxes
      const selectedPermissions = Array.from(
        form.querySelectorAll("input[name='permissions']:checked")
      ).map((input) => input.value);

      // حفظ الصلاحيات بالشكل الصحيح
      if (data.role === "ADMIN") {
        data.permissions = MR3Permissions.all.slice();
      } else {
        // 🔥 طبقة أمان إضافية: لا نسمح للمستخدم العادي بإرسال صلاحيات غير مدرجة في القائمة الأساسية
        const allowedPermissions = MR3Permissions.all;
        data.permissions = selectedPermissions.filter(p => allowedPermissions.includes(p));
        // إذا كنت لا تريد أي صلاحيات للمستخدم العادي، يمكنك جعلها [] مباشرة، لكن هنا نترك المرونة.
      }

      if (data.password && data.password.length < 6) {
        MR3Utils.toast("error", MR3I18n.t("messages.failed"), "كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
        return;
      }

      if (isEdit && !data.password) {
        delete data.password;
      }

      if (duplicate(data, user?.id)) {
        MR3Utils.toast("error", MR3I18n.t("messages.failed"), MR3I18n.t("messages.duplicateUser"));
        return;
      }

      try {
        if (isEdit) {
          await MR3DB.update("users", user.id, data);
        } else {
          await MR3DB.insert("users", { ...data, createdAt: MR3Utils.now(), updatedAt: MR3Utils.now() });
        }
        MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.saved"));
        MR3Utils.closeModal();
        MR3App.render();
      } catch (error) {
        console.error("DB Error:", error);
        MR3Utils.toast("error", MR3I18n.t("messages.failed"), MR3I18n.t("messages.errorOccurred") || "حدث خطأ داخلي، حاول مرة أخرى.");
      }
    });
  }

  // =============================================
  // دوال الحذف والتعديل
  // =============================================
  async function deleteUser(id) {
    if (!MR3App.require("users.manage")) return;
    const currentUser = MR3App.user();
    if (id === currentUser?.id) {
      MR3Utils.toast("error", MR3I18n.t("messages.failed"), MR3I18n.t("messages.permissionDenied"));
      return;
    }
    if (!(await MR3Utils.confirm(MR3I18n.t("messages.confirmDelete")))) return;
    
    try {
      await MR3DB.remove("users", id);
      MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.deleted"));
      MR3App.render();
    } catch (error) {
      console.error("Delete Error:", error);
      MR3Utils.toast("error", MR3I18n.t("messages.failed"), MR3I18n.t("messages.errorOccurred") || "فشل الحذف");
    }
  }

  async function toggleUser(id) {
    if (!MR3App.require("users.manage")) return;
    const user = MR3DB.get("users", id);
    if (!user) return;
    if (user.id === MR3App.user()?.id) {
      MR3Utils.toast("error", MR3I18n.t("messages.failed"), "لا يمكن تعطيل حسابك الحالي.");
      return;
    }
    
    try {
      await MR3DB.update("users", id, { active: !user.active });
      MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.saved"));
      MR3App.render();
    } catch (error) {
      console.error("Toggle Error:", error);
      MR3Utils.toast("error", MR3I18n.t("messages.failed"), MR3I18n.t("messages.errorOccurred") || "فشل التحديث");
    }
  }

  // =============================================
  // عرض الجدول
  // =============================================
  function table() {
    const users = MR3DB.all("users");
    
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>${MR3I18n.t("common.name")}</th><th>${MR3I18n.t("common.email")}</th><th>${MR3I18n.t("common.role")}</th><th>${MR3I18n.t("common.status")}</th><th>${MR3I18n.t("common.actions")}</th></tr></thead><tbody>
      ${users.map((user) => `<tr data-id="${user.id}"><td>${MR3Utils.escape(user.name)}</td><td>${MR3Utils.escape(user.email)}</td><td>${MR3Utils.badge(user.role === "ADMIN" ? MR3I18n.t("common.admin") : MR3I18n.t("common.user"), user.role === "ADMIN" ? "violet" : "info")}</td><td>${MR3Utils.badge(user.active ? MR3I18n.t("common.active") : MR3I18n.t("common.inactive"), user.active ? "success" : "danger")}</td><td><div class="table-actions">
        ${MR3Utils.actionButton("edit", "edit", MR3I18n.t("common.edit"))}
        ${MR3Utils.actionButton("toggle", "refresh", user.active ? MR3I18n.t("common.inactive") : MR3I18n.t("common.active"), "icon-button warning-button")}
        ${MR3Utils.actionButton("delete", "trash", MR3I18n.t("common.delete"), "icon-button danger-button")}
      </div></td></tr>`).join("")}
    </tbody></table></div>`;
  }

  // =============================================
  // تسجيل الصفحة
  // =============================================
  window.MR3Pages.users = {
    render(root) {
      root.innerHTML = MR3App.pageHeader("nav.users", "", `<button id="addUser" class="primary-button">${MR3Utils.icon("plus")}${MR3I18n.t("common.add")}</button>`) + `<section class="panel"><div class="panel-body">${table()}</div></section>`;
      root.querySelector("#addUser").addEventListener("click", () => openForm());
      MR3App.bindTableActions(root, { 
        edit: (id) => openForm(MR3DB.get("users", id)), 
        delete: deleteUser, 
        toggle: toggleUser 
      });
    }
  };
})();
