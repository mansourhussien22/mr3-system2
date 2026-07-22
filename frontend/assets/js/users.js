(function () {
  // دالة لجلب المستخدمين من السيرفر
  async function fetchUsers() {
    try {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('فشل جلب المستخدمين');
      return await response.json();
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  function duplicate(users, data, id) {
    const normalizedEmail = MR3Utils.normalize(data.email || '');
    const normalizedUsername = MR3Utils.normalize(data.username || '');

    if (!normalizedEmail && !normalizedUsername) return false;

    return users.some((user) => {
      if (user.id === id) return false;
      return (
        MR3Utils.normalize(user.email) === normalizedEmail ||
        MR3Utils.normalize(user.username) === normalizedUsername
      );
    });
  }

  function updatePermissionsUI(form, role, masterCheckbox) {
    const inputs = form.querySelectorAll("input[name='permissions']");
    const isAdmin = role === "ADMIN";

    inputs.forEach((input) => {
      if (isAdmin) {
        input.checked = true;
        input.disabled = true;
      } else {
        input.checked = false;
        input.disabled = false;
      }
    });

    if (masterCheckbox) {
      if (isAdmin) {
        masterCheckbox.checked = true;
        masterCheckbox.indeterminate = false;
        masterCheckbox.disabled = true;
      } else {
        masterCheckbox.checked = false;
        masterCheckbox.indeterminate = false;
        masterCheckbox.disabled = false;
      }
    }
  }

  async function openForm(user) {
    if (!MR3App.require("users.manage")) return;
    const isEdit = Boolean(user);
    const isAdminUser = user?.role === "ADMIN";
    
    // إصلاح مشكلة الترجمة: تحديد النص مباشرة بناء على اللغة
    const optionalText = MR3I18n.current() === "ar" ? "اختياري" : "Optional";

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
        <span>${MR3I18n.t("common.password")} ${isEdit ? `(${optionalText})` : ""}</span>
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

    const footer = `<button class="ghost-button" type="button" data-close-modal>${MR3I18n.t("common.cancel")}</button><button class="primary-button" form="userForm" type="submit" id="saveUserBtn">${MR3Utils.icon("save")}${MR3I18n.t("common.save")}</button>`;
    const modal = MR3Utils.modal({ title: isEdit ? MR3I18n.t("common.edit") : MR3I18n.t("common.add"), body, footer });
    
    const form = modal.querySelector("#userForm");
    const master = modal.querySelector("#permissionMaster");
    const roleSelect = form.querySelector("#roleSelect");
    const saveBtn = modal.querySelector("#saveUserBtn");
    const permissionInputs = () => Array.from(form.querySelectorAll("input[name='permissions']"));
    
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
      inputs.forEach((input) => { input.checked = checked; });
      syncMaster();
    };

    modal.querySelectorAll("[data-permission-all]").forEach((button) => button.addEventListener("click", () => setAllPermissions(true)));
    modal.querySelectorAll("[data-permission-none]").forEach((button) => button.addEventListener("click", () => setAllPermissions(false)));
    
    master.addEventListener("change", () => {
      if (master.disabled) return;
      setAllPermissions(master.checked);
    });

    permissionInputs().forEach((input) => input.addEventListener("change", syncMaster));
    
    roleSelect.addEventListener("change", function () {
      updatePermissionsUI(form, this.value, master);
      syncMaster();
    });

    updatePermissionsUI(form, roleSelect.value, master);
    syncMaster();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      saveBtn.disabled = true;
      saveBtn.innerHTML = "جاري الحفظ...";

      const data = Object.fromEntries(new FormData(form).entries());
      data.active = data.active === "true";
      
      const selectedPermissions = Array.from(
        form.querySelectorAll("input[name='permissions']:checked")
      ).map((input) => input.value);

      if (data.role === "ADMIN") {
        data.permissions = MR3Permissions.all.slice();
      } else {
        data.permissions = selectedPermissions.filter(p => MR3Permissions.all.includes(p));
      }

      if (data.password && data.password.length < 6) {
        MR3Utils.toast("error", MR3I18n.t("messages.failed"), "كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
        saveBtn.disabled = false;
        saveBtn.innerHTML = `${MR3Utils.icon("save")}${MR3I18n.t("common.save")}`;
        return;
      }

      if (isEdit && !data.password) {
        delete data.password;
      }

      const allUsers = await fetchUsers();
      if (duplicate(allUsers, data, user?.id)) {
        MR3Utils.toast("error", MR3I18n.t("messages.failed"), MR3I18n.t("messages.duplicateUser"));
        saveBtn.disabled = false;
        saveBtn.innerHTML = `${MR3Utils.icon("save")}${MR3I18n.t("common.save")}`;
        return;
      }

      try {
        const url = isEdit ? `/api/users/${user.id}` : '/api/users';
        const method = isEdit ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
          method: method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (!response.ok) throw new Error('فشل الحفظ في السيرفر');

        MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.saved"));
        MR3Utils.closeModal();
        MR3Pages.users.render(document.getElementById('mainContent') || document.body); // تحديث الصفحة
      } catch (error) {
        console.error("Server Error:", error);
        MR3Utils.toast("error", MR3I18n.t("messages.failed"), MR3I18n.t("messages.errorOccurred"));
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  async function deleteUser(id) {
    if (!MR3App.require("users.manage")) return;
    const currentUser = MR3App.user();
    if (id === currentUser?.id) {
      MR3Utils.toast("error", MR3I18n.t("messages.failed"), MR3I18n.t("messages.permissionDenied"));
      return;
    }
    if (!(await MR3Utils.confirm(MR3I18n.t("messages.confirmDelete")))) return;
    
    try {
      const response = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('فشل الحذف');

      MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.deleted"));
      MR3Pages.users.render(document.getElementById('mainContent') || document.body);
    } catch (error) {
      console.error("Delete Error:", error);
      MR3Utils.toast("error", MR3I18n.t("messages.failed"), MR3I18n.t("messages.errorOccurred"));
    }
  }

  async function toggleUser(id) {
    if (!MR3App.require("users.manage")) return;
    
    // جلب المستخدمين أولاً لمعرفة الحالة الحالية
    const users = await fetchUsers();
    const user = users.find(u => u.id === id);
    if (!user) return;
    
    if (user.id === MR3App.user()?.id) {
      MR3Utils.toast("error", MR3I18n.t("messages.failed"), "لا يمكن تعطيل حسابك الحالي.");
      return;
    }
    
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !user.active })
      });
      
      if (!response.ok) throw new Error('فشل التحديث');

      MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.saved"));
      MR3Pages.users.render(document.getElementById('mainContent') || document.body);
    } catch (error) {
      console.error("Toggle Error:", error);
      MR3Utils.toast("error", MR3I18n.t("messages.failed"), MR3I18n.t("messages.errorOccurred"));
    }
  }

  async function table() {
    const users = await fetchUsers();
    
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>${MR3I18n.t("common.name")}</th><th>${MR3I18n.t("common.email")}</th><th>${MR3I18n.t("common.role")}</th><th>${MR3I18n.t("common.status")}</th><th>${MR3I18n.t("common.actions")}</th></tr></thead><tbody>
      ${users.map((user) => `<tr data-id="${user.id}"><td>${MR3Utils.escape(user.name)}</td><td>${MR3Utils.escape(user.email)}</td><td>${MR3Utils.badge(user.role === "ADMIN" ? MR3I18n.t("common.admin") : MR3I18n.t("common.user"), user.role === "ADMIN" ? "violet" : "info")}</td><td>${MR3Utils.badge(user.active ? MR3I18n.t("common.active") : MR3I18n.t("common.inactive"), user.active ? "success" : "danger")}</td><td><div class="table-actions">
        ${MR3Utils.actionButton("edit", "edit", MR3I18n.t("common.edit"))}
        ${MR3Utils.actionButton("toggle", "refresh", user.active ? MR3I18n.t("common.inactive") : MR3I18n.t("common.active"), "icon-button warning-button")}
        ${MR3Utils.actionButton("delete", "trash", MR3I18n.t("common.delete"), "icon-button danger-button")}
      </div></td></tr>`).join("")}
    </tbody></table></div>`;
  }

  window.MR3Pages.users = {
    async render(root) {
      root.innerHTML = MR3App.pageHeader("nav.users", "", `<button id="addUser" class="primary-button">${MR3Utils.icon("plus")}${MR3I18n.t("common.add")}</button>`) + `<section class="panel"><div class="panel-body"><div style="text-align:center; padding: 20px;">جاري تحميل المستخدمين...</div></div></section>`;
      
      const tableHtml = await table();
      root.querySelector(".panel-body").innerHTML = tableHtml;

      root.querySelector("#addUser").addEventListener("click", () => openForm());
      
      // التعديل هنا لجلب البيانات المحدثة عند التعديل
      MR3App.bindTableActions(root, { 
        edit: async (id) => {
            const users = await fetchUsers();
            openForm(users.find(u => u.id === id));
        }, 
        delete: deleteUser, 
        toggle: toggleUser 
      });
    }
  };
})();
