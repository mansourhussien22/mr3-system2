(function () {
  const requestStatuses = ["pending", "searching", "ordered", "available", "customerNotified", "delivered", "cancelled"];
  const reservationStatuses = ["active", "delivered", "cancelled", "expired"];

  function statusOptions(statuses, value) {
    return MR3Utils.optionsHtml(statuses.map((status) => ({ value: status, label: MR3I18n.t(`status.${status}`) })), value);
  }

  function customerOptions(value) {
    const rows = MR3DB.all("customers").filter((customer) => customer.id !== "cus_walkin" && !customer.isDeleted && customer.status !== "deleted");
    return `<option value="">${MR3I18n.t("customer.newFromRequest")}</option>${MR3Utils.optionsHtml(rows, value || "", (customer) => `${customer.code || ""} - ${customer.name} - ${customer.phone || ""}`)}`;
  }

  function productOptions(value) {
    return MR3Utils.optionsHtml(MR3DB.all("products").filter((product) => product.isActive && !product.isDeleted && product.status !== "deleted"), value || "", (product) => `${MR3App.productName(product)} - ${product.code}`);
  }

  function createCustomerFromRequest(data) {
    if (data.customerId) return MR3DB.get("customers", data.customerId);
    if (!data.customerName || !data.customerMobile) throw new Error(MR3I18n.t("messages.customerRequired"));
    return MR3DB.insert("customers", {
      code: MR3DB.nextCode("customerCodes", "CUST", 6),
      name: data.customerName,
      phone: data.customerMobile,
      address: "",
      openingBalance: 0,
      balance: 0,
      creditLimit: 0,
      notes: MR3I18n.t("customer.createdFromService"),
      createdAt: MR3Utils.now(),
      updatedAt: MR3Utils.now()
    });
  }

  function openRequestForm(request) {
    if (!MR3App.require(request ? "customerService.update" : "customerService.create")) return;
    const isEdit = Boolean(request);
    MR3Utils.formModal({
      title: isEdit ? MR3I18n.t("customerService.editRequest") : MR3I18n.t("customerService.newRequest"),
      fields: [
        { name: "customerId", label: MR3I18n.t("invoice.customer"), type: "select", options: [{ value: "", label: MR3I18n.t("customer.newFromRequest") }].concat(MR3DB.all("customers").filter((c) => c.id !== "cus_walkin" && !c.isDeleted && c.status !== "deleted").map((c) => ({ value: c.id, label: `${c.code || ""} - ${c.name} - ${c.phone || ""}` }))) },
        { name: "customerName", label: MR3I18n.t("common.name") },
        { name: "customerMobile", label: MR3I18n.t("common.phone") },
        { name: "productId", label: MR3I18n.t("invoice.product"), type: "select", options: MR3DB.all("products").filter((p) => p.isActive && !p.isDeleted && p.status !== "deleted").map((p) => ({ value: p.id, label: `${MR3App.productName(p)} - ${p.code}` })), required: true },
        { name: "quantity", label: MR3I18n.t("common.quantity"), type: "number", min: 1, step: "1", required: true },
        { name: "expectedSupplierId", label: MR3I18n.t("product.supplier"), type: "select", options: [{ value: "", label: MR3I18n.t("common.none") }].concat(MR3DB.all("suppliers").filter((s) => !s.isDeleted && s.status !== "deleted").map((s) => ({ value: s.id, label: `${s.code || ""} - ${s.name}` }))) },
        { name: "depositAmount", label: MR3I18n.t("customerService.deposit"), type: "number", min: 0, step: "0.01" },
        { name: "status", label: MR3I18n.t("common.status"), type: "select", options: requestStatuses.map((status) => ({ value: status, label: MR3I18n.t(`status.${status}`) })) },
        { name: "notes", label: MR3I18n.t("common.notes"), type: "textarea", wide: true }
      ],
      values: { status: "pending", quantity: 1, depositAmount: 0, ...request },
      three: true,
      onSubmit(data) {
        const product = MR3DB.get("products", data.productId);
        if (!product) throw new Error(MR3I18n.t("messages.noData"));
        const customer = createCustomerFromRequest(data);
        const patch = {
          customerId: customer.id,
          customerCode: customer.code || "",
          customerName: customer.name,
          customerMobile: customer.phone || data.customerMobile || "",
          productId: product.id,
          productName: MR3App.productName(product),
          quantity: MR3Utils.parseNumber(data.quantity),
          expectedSupplierId: data.expectedSupplierId || "",
          depositAmount: MR3Utils.parseNumber(data.depositAmount),
          status: data.status || "pending",
          notes: data.notes || "",
          updatedAt: MR3Utils.now()
        };
        if (isEdit) {
          MR3DB.update("customerRequests", request.id, patch);
          MR3DB.audit({ action: "customerRequest.update", entityType: "customerRequest", entityId: request.id, oldValue: request, newValue: patch });
        } else {
          const created = MR3DB.insert("customerRequests", {
            ...patch,
            number: MR3DB.nextCode("customerService", "CSR", 6),
            requestDate: MR3Utils.today(),
            createdBy: MR3App.user().name,
            createdAt: MR3Utils.now()
          });
          if (created.depositAmount > 0) {
            MR3DB.update("customers", customer.id, { balance: MR3Utils.parseNumber(customer.balance) - created.depositAmount });
            MR3DB.insert("payments", { number: MR3DB.counter("payments", "PAY"), entityType: "customer", entityId: customer.id, entityName: customer.name, direction: "IN", amount: created.depositAmount, paymentMethod: "cash", date: MR3Utils.today(), notes: created.number, userId: MR3App.user().id, userName: MR3App.user().name, createdAt: MR3Utils.now() });
          }
          MR3DB.audit({ action: "customerRequest.create", entityType: "customerRequest", entityId: created.id, newValue: created });
        }
        MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.saved"));
        MR3App.render();
      }
    });
  }

  function requestTable(rows) {
    if (!rows.length) return MR3Utils.empty(MR3I18n.t("messages.noData"), MR3I18n.t("messages.noDataHint"));
    return `<div class="table-wrap"><table class="data-table"><thead><tr>
      <th>${MR3I18n.t("invoice.number")}</th><th>${MR3I18n.t("invoice.customer")}</th><th>${MR3I18n.t("invoice.product")}</th><th>${MR3I18n.t("common.quantity")}</th><th>${MR3I18n.t("common.status")}</th><th>${MR3I18n.t("customerService.deposit")}</th><th>${MR3I18n.t("common.actions")}</th>
    </tr></thead><tbody>${rows.map((request) => `<tr data-id="${request.id}">
      <td>${MR3Utils.escape(request.number)}</td><td>${MR3Utils.escape(request.customerName)}<br><span class="muted">${MR3Utils.escape(request.customerMobile || "")}</span></td><td>${MR3Utils.escape(request.productName)}</td><td>${request.quantity}</td><td>${MR3Utils.badge(MR3I18n.t(`status.${request.status}`), request.status === "available" ? "success" : "info")}</td><td>${MR3Utils.money(request.depositAmount || 0)}</td>
      <td><div class="table-actions">${MR3Utils.actionButton("edit", "edit", MR3I18n.t("common.edit"))}${MR3Utils.actionButton("notify", "alert", MR3I18n.t("customerService.notify"))}${MR3Utils.actionButton("deliver", "check", MR3I18n.t("status.delivered"), "icon-button success-button")}</div></td>
    </tr>`).join("")}</tbody></table></div>`;
  }

  function openNotify(request) {
    MR3Utils.formModal({
      title: MR3I18n.t("customerService.notify"),
      fields: [
        { name: "notificationMethod", label: MR3I18n.t("customerService.notificationMethod"), type: "select", options: ["phone", "whatsapp", "sms", "inPerson"].map((method) => ({ value: method, label: MR3I18n.t(`notify.${method}`) })) },
        { name: "notes", label: MR3I18n.t("common.notes"), type: "textarea", wide: true }
      ],
      onSubmit(data) {
        MR3DB.update("customerRequests", request.id, { status: "customerNotified", notificationMethod: data.notificationMethod, notificationDate: MR3Utils.now(), notifiedBy: MR3App.user().name, notificationNotes: data.notes || "" });
        MR3Production.addNotification("customerNotified", MR3I18n.t("customerService.customerNotified"), `${request.customerName} - ${request.productName}`, "customerService", request.id);
        MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.saved"));
        MR3App.render();
      }
    });
  }

  window.MR3Pages.customerService = {
    render(root) {
      const tools = MR3App.can("customerService.create") ? `<button class="primary-button" id="addCustomerRequest">${MR3Utils.icon("plus")}${MR3I18n.t("customerService.newRequest")}</button>` : "";
      root.innerHTML = MR3App.pageHeader("nav.customerService", "page.customerServiceHint", tools) + `<section class="panel"><div class="panel-body">
        <div class="filters"><label class="field"><span>${MR3I18n.t("common.search")}</span><input id="requestSearch" class="search-input" /></label><label class="field"><span>${MR3I18n.t("common.status")}</span><select id="requestStatus"><option value="">${MR3I18n.t("common.all")}</option>${statusOptions(requestStatuses, "")}</select></label></div>
        <div id="requestTable"></div>
      </div></section>`;
      const refresh = () => {
        const q = root.querySelector("#requestSearch").value;
        const status = root.querySelector("#requestStatus").value;
        const rows = MR3DB.all("customerRequests").filter((request) => MR3Utils.textMatch(request, q, ["number", "customerCode", "customerName", "customerMobile", "productName"]) && (!status || request.status === status));
        root.querySelector("#requestTable").innerHTML = requestTable(rows);
        MR3App.bindTableActions(root.querySelector("#requestTable"), {
          edit: (id) => openRequestForm(MR3DB.get("customerRequests", id)),
          notify: (id) => openNotify(MR3DB.get("customerRequests", id)),
          deliver: (id) => {
            const request = MR3DB.get("customerRequests", id);
            MR3DB.update("customerRequests", id, { status: "delivered", deliveredAt: MR3Utils.now(), deliveredBy: MR3App.user().name });
            MR3DB.audit({ action: "customerRequest.deliver", entityType: "customerRequest", entityId: id, oldValue: request, newValue: { status: "delivered" } });
            MR3App.render();
          }
        });
      };
      root.querySelector("#addCustomerRequest")?.addEventListener("click", () => openRequestForm());
      root.querySelector("#requestSearch").addEventListener("input", refresh);
      root.querySelector("#requestStatus").addEventListener("input", refresh);
      refresh();
    }
  };

  function openReservationForm(reservation) {
    if (!MR3App.require(reservation ? "reservations.update" : "reservations.create")) return;
    MR3Utils.formModal({
      title: reservation ? MR3I18n.t("reservation.edit") : MR3I18n.t("reservation.new"),
      fields: [
        { name: "customerId", label: MR3I18n.t("invoice.customer"), type: "select", options: MR3DB.all("customers").filter((c) => c.id !== "cus_walkin" && !c.isDeleted && c.status !== "deleted").map((c) => ({ value: c.id, label: `${c.code || ""} - ${c.name}` })), required: true },
        { name: "productId", label: MR3I18n.t("invoice.product"), type: "select", options: MR3DB.all("products").filter((p) => p.isActive && !p.isDeleted && p.status !== "deleted").map((p) => ({ value: p.id, label: `${MR3App.productName(p)} - ${p.code}` })), required: true },
        { name: "unitType", label: MR3I18n.t("common.unit"), type: "select", options: MR3Seed.UNIT_TYPES.map((unit) => ({ value: unit, label: MR3I18n.t(`unit.${unit}`) })) },
        { name: "quantity", label: MR3I18n.t("common.quantity"), type: "number", min: 1, step: "1", required: true },
        { name: "expiresAt", label: MR3I18n.t("reservation.expiresAt"), type: "date" },
        { name: "status", label: MR3I18n.t("common.status"), type: "select", options: reservationStatuses.map((status) => ({ value: status, label: MR3I18n.t(`status.${status}`) })) },
        { name: "notes", label: MR3I18n.t("common.notes"), type: "textarea", wide: true }
      ],
      values: { unitType: "box", quantity: 1, status: "active", ...reservation },
      three: true,
      onSubmit(data) {
        const product = MR3DB.get("products", data.productId);
        const customer = MR3DB.get("customers", data.customerId);
        const quantity = MR3Utils.parseNumber(data.quantity);
        if (!product || !customer) throw new Error(MR3I18n.t("messages.noData"));
        if (!reservation && MR3Production.availableUnits(product, data.unitType) < quantity) throw new Error(MR3I18n.t("messages.stockNotEnough"));
        const patch = { customerId: customer.id, customerName: customer.name, productId: product.id, productName: MR3App.productName(product), unitType: data.unitType, quantity, expiresAt: data.expiresAt || "", status: data.status || "active", notes: data.notes || "", updatedAt: MR3Utils.now() };
        if (reservation) MR3DB.update("reservations", reservation.id, patch);
        else MR3DB.insert("reservations", { ...patch, number: MR3DB.nextCode("reservations", "RSV", 6), createdBy: MR3App.user().name, createdAt: MR3Utils.now() });
        MR3DB.audit({ action: reservation ? "reservation.update" : "reservation.create", entityType: "reservation", entityId: reservation?.id || "", newValue: patch });
        MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.saved"));
        MR3App.render();
      }
    });
  }

  function reservationTable(rows) {
    if (!rows.length) return MR3Utils.empty(MR3I18n.t("messages.noData"), MR3I18n.t("messages.noDataHint"));
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>${MR3I18n.t("invoice.number")}</th><th>${MR3I18n.t("invoice.customer")}</th><th>${MR3I18n.t("invoice.product")}</th><th>${MR3I18n.t("common.quantity")}</th><th>${MR3I18n.t("reservation.expiresAt")}</th><th>${MR3I18n.t("common.status")}</th><th>${MR3I18n.t("common.actions")}</th></tr></thead><tbody>
      ${rows.map((reservation) => `<tr data-id="${reservation.id}"><td>${reservation.number}</td><td>${MR3Utils.escape(reservation.customerName)}</td><td>${MR3Utils.escape(reservation.productName)}</td><td>${reservation.quantity} ${MR3I18n.t(`unit.${reservation.unitType}`)}</td><td>${MR3Utils.date(reservation.expiresAt)}</td><td>${MR3Utils.badge(MR3I18n.t(`status.${reservation.status}`), reservation.status === "active" ? "success" : "info")}</td><td>${MR3Utils.actionButton("edit", "edit", MR3I18n.t("common.edit"))}</td></tr>`).join("")}
    </tbody></table></div>`;
  }

  window.MR3Pages.reservations = {
    render(root) {
      const tools = MR3App.can("reservations.create") ? `<button class="primary-button" id="addReservation">${MR3Utils.icon("plus")}${MR3I18n.t("reservation.new")}</button>` : "";
      root.innerHTML = MR3App.pageHeader("nav.reservations", "page.reservationsHint", tools) + `<section class="panel"><div class="panel-body"><div id="reservationTable"></div></div></section>`;
      root.querySelector("#reservationTable").innerHTML = reservationTable(MR3DB.all("reservations"));
      root.querySelector("#addReservation")?.addEventListener("click", () => openReservationForm());
      MR3App.bindTableActions(root, { edit: (id) => openReservationForm(MR3DB.get("reservations", id)) });
    }
  };

  window.MR3Pages.notifications = {
    render(root) {
      const rows = MR3DB.all("notifications").sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      const body = rows.length
        ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>${MR3I18n.t("common.date")}</th><th>${MR3I18n.t("common.title")}</th><th>${MR3I18n.t("common.details")}</th><th>${MR3I18n.t("common.status")}</th><th>${MR3I18n.t("common.actions")}</th></tr></thead><tbody>${rows.map((item) => `<tr data-id="${item.id}"><td>${MR3Utils.dateTime(item.createdAt)}</td><td>${MR3Utils.escape(item.title)}</td><td>${MR3Utils.escape(item.message)}</td><td>${MR3Utils.badge(item.status, item.status === "unread" ? "warning" : "success")}</td><td>${MR3Utils.actionButton("open", "eye", MR3I18n.t("common.details"))}${MR3Utils.actionButton("read", "check", MR3I18n.t("notifications.markRead"), "icon-button success-button")}</td></tr>`).join("")}</tbody></table></div>`
        : MR3Utils.empty(MR3I18n.t("home.noAlerts"), "");
      root.innerHTML = MR3App.pageHeader("nav.notifications", "page.notificationsHint") + `<section class="panel"><div class="panel-body">${body}</div></section>`;
      MR3App.bindTableActions(root, {
        open: (id) => {
          const item = MR3DB.get("notifications", id);
          if (item?.targetPage) MR3App.navigate(item.targetPage);
        },
        read: (id) => {
          MR3DB.update("notifications", id, { status: "read" });
          MR3App.render();
        }
      });
    }
  };

  function ledgerBalanceAfter(entityType, direction, before, amount) {
    if (entityType === "customer") return direction === "IN" ? before - amount : before + amount;
    return direction === "OUT" ? before - amount : before + amount;
  }

  function createTreasuryLinkedPayment(data, isDeposit, amount) {
    const entityType = data.accountType;
    const collection = entityType === "customer" ? "customers" : "suppliers";
    const entityId = entityType === "customer" ? data.customerId : data.supplierId;
    const entity = MR3DB.get(collection, entityId);
    if (!entity) throw new Error(MR3I18n.t("messages.noData"));
    const direction = isDeposit ? "IN" : "OUT";
    const before = MR3Utils.parseNumber(entity.balance);
    const after = ledgerBalanceAfter(entityType, direction, before, amount);
    const record = MR3DB.insert("payments", {
      number: MR3DB.counter("payments", "PAY"),
      entityType,
      entityId: entity.id,
      entityName: entity.name,
      direction,
      amount,
      paymentMethod: data.paymentMethod,
      date: data.date,
      notes: data.notes || MR3I18n.t(isDeposit ? "treasury.deposit" : "treasury.withdrawal"),
      balanceBefore: before,
      balanceAfter: after,
      userId: MR3App.user().id,
      userName: MR3App.user().name,
      createdAt: MR3Utils.now()
    });
    MR3DB.update(collection, entity.id, { balance: after });
    MR3DB.audit({
      action: `${entityType}.${direction === "IN" ? "receive" : "pay"}`,
      entityType,
      entityId: entity.id,
      reference: record.number,
      oldValue: { balance: before },
      newValue: { balance: after },
      reason: data.notes || ""
    });
    return record;
  }

  function openTreasuryOperation(type) {
    if (!MR3App.require("treasury.create")) return;
    const isDeposit = type === "deposit";
    const customers = MR3DB.all("customers").filter((customer) => customer.id !== "cus_walkin" && !customer.isDeleted && customer.status !== "deleted");
    const suppliers = MR3DB.all("suppliers").filter((supplier) => !supplier.isDeleted && supplier.status !== "deleted");
    const footer = `<button class="ghost-button" type="button" data-close-modal>${MR3I18n.t("common.cancel")}</button><button class="primary-button" type="submit" form="treasuryOperationForm">${MR3Utils.icon("save")}${MR3I18n.t("common.save")}</button>`;
    const modal = MR3Utils.modal({
      title: MR3I18n.t(isDeposit ? "treasury.deposit" : "treasury.withdrawal"),
      body: `<form id="treasuryOperationForm" class="modal-form form-grid" novalidate>
        <label class="field"><span>${MR3I18n.t("treasury.targetType")}</span><select name="accountType" id="treasuryAccountType">
          <option value="treasury">${MR3I18n.t("treasury.cashAccount")}</option>
          <option value="customer">${MR3I18n.t("invoice.customer")}</option>
          <option value="supplier">${MR3I18n.t("invoice.supplier")}</option>
          <option value="other">${MR3I18n.t("common.other")}</option>
        </select></label>
        <label class="field" data-treasury-target="customer"><span>${MR3I18n.t("invoice.customer")}</span><select name="customerId">${MR3Utils.optionsHtml(customers.map((customer) => ({ value: customer.id, label: `${customer.code || ""} - ${customer.name} - ${MR3Utils.money(customer.balance)}` })))}</select></label>
        <label class="field" data-treasury-target="supplier"><span>${MR3I18n.t("invoice.supplier")}</span><select name="supplierId">${MR3Utils.optionsHtml(suppliers.map((supplier) => ({ value: supplier.id, label: `${supplier.code || ""} - ${supplier.name} - ${MR3Utils.money(supplier.balance)}` })))}</select></label>
        <label class="field" data-treasury-target="manual"><span>${MR3I18n.t("treasury.account")}</span><input name="accountName" value="${MR3Utils.escape(MR3I18n.t(isDeposit ? "treasury.deposit" : "treasury.withdrawal"))}" /></label>
        <label class="field"><span>${MR3I18n.t("common.amount")}</span><input name="amount" type="number" min="0.01" step="0.01" required /></label>
        <label class="field"><span>${MR3I18n.t("common.paymentMethod")}</span><select name="paymentMethod">${MR3App.paymentOptions("cash")}</select></label>
        <label class="field"><span>${MR3I18n.t("common.date")}</span><input name="date" type="date" value="${MR3Utils.today()}" required /></label>
        <label class="field wide"><span>${MR3I18n.t("common.notes")}</span><textarea name="notes" rows="3"></textarea></label>
      </form>`,
      footer
    });
    const form = modal.querySelector("#treasuryOperationForm");
    const accountType = form.querySelector("#treasuryAccountType");
    const syncTarget = () => {
      const value = accountType.value;
      form.querySelectorAll("[data-treasury-target]").forEach((field) => {
        const target = field.dataset.treasuryTarget;
        const visible = (target === value) || (target === "manual" && (value === "treasury" || value === "other"));
        field.hidden = !visible;
        field.querySelectorAll("input,select").forEach((control) => {
          control.disabled = !visible;
          control.required = visible && ((target === "customer" && value === "customer") || (target === "supplier" && value === "supplier") || (target === "manual" && value === "other"));
        });
      });
    };
    accountType.addEventListener("change", syncTarget);
    syncTarget();
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const submitButton = modal.querySelector('[type="submit"][form="treasuryOperationForm"]');
      MR3Utils.setButtonLoading(submitButton, true);
      try {
        const data = Object.fromEntries(new FormData(form).entries());
        const amount = MR3Utils.parseNumber(data.amount);
        if (amount <= 0) throw new Error(MR3I18n.t("messages.positiveNumber"));
        if (data.accountType === "customer" || data.accountType === "supplier") {
          createTreasuryLinkedPayment(data, isDeposit, amount);
          MR3Utils.closeModal();
          MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.saved"));
          MR3App.render();
          return;
        }
        const balanceBefore = MR3Production.treasuryBalance();
        const direction = isDeposit ? "IN" : "OUT";
        const balanceAfter = balanceBefore + (isDeposit ? amount : -amount);
        const accountName = data.accountType === "other" ? data.accountName : MR3I18n.t("treasury.cashAccount");
        const record = MR3DB.insert("treasuryTransactions", {
          number: MR3DB.counter("treasury", isDeposit ? "TRD" : "TRW"),
          type: isDeposit ? "deposit" : "withdrawal",
          direction,
          accountName,
          accountType: data.accountType || "treasury",
          accountId: "",
          amount,
          paymentMethod: data.paymentMethod,
          date: data.date,
          notes: data.notes || "",
          balanceBefore,
          balanceAfter,
          userId: MR3App.user().id,
          userName: MR3App.user().name,
          createdAt: MR3Utils.now()
        });
        MR3DB.audit({
          action: isDeposit ? "treasury.deposit" : "treasury.withdrawal",
          entityType: "treasuryTransaction",
          entityId: record.id,
          reference: record.number,
          oldValue: { balance: balanceBefore },
          newValue: { balance: balanceAfter },
          reason: data.notes || ""
        });
        MR3Utils.closeModal();
        MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.saved"));
        MR3App.render();
      } catch (error) {
        MR3Utils.setButtonLoading(submitButton, false);
        MR3Utils.toast("error", MR3I18n.t("messages.failed"), error.message);
      }
    });
  }

  window.MR3Pages.treasury = {
    render(root) {
      const rows = MR3Production.treasuryRows();
      const balance = MR3Production.treasuryBalance();
      const table = rows.length
        ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>${MR3I18n.t("common.date")}</th><th>${MR3I18n.t("movement.reference")}</th><th>${MR3I18n.t("movement.type")}</th><th>${MR3I18n.t("treasury.target")}</th><th>${MR3I18n.t("payment.direction")}</th><th>${MR3I18n.t("common.amount")}</th><th>${MR3I18n.t("common.paymentMethod")}</th><th>${MR3I18n.t("treasury.balanceBefore")}</th><th>${MR3I18n.t("treasury.balanceAfter")}</th><th>${MR3I18n.t("common.notes")}</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${row.date}</td><td>${MR3Utils.escape(row.reference)}</td><td>${MR3I18n.t(`treasury.${row.type}`)}</td><td>${MR3Utils.escape(row.accountName || "")}</td><td>${row.direction}</td><td>${MR3Utils.money(row.amount)}</td><td>${MR3I18n.t(`pay.${row.method}`)}</td><td>${row.balanceBefore === undefined ? "-" : MR3Utils.money(row.balanceBefore)}</td><td>${row.balanceAfter === undefined ? "-" : MR3Utils.money(row.balanceAfter)}</td><td>${MR3Utils.escape(row.notes)}</td></tr>`).join("")}</tbody></table></div>`
        : MR3Utils.empty(MR3I18n.t("messages.noData"), "");
      const tools = MR3App.can("treasury.create")
        ? `<button id="treasuryDeposit" class="success-button">${MR3Utils.icon("plus")}${MR3I18n.t("treasury.deposit")}</button><button id="treasuryWithdrawal" class="warning-button">${MR3Utils.icon("wallet")}${MR3I18n.t("treasury.withdrawal")}</button>`
        : "";
      root.innerHTML = MR3App.pageHeader("nav.treasury", "page.treasuryHint", tools) + `<div class="stats-grid"><article class="stat-card"><span class="stat-icon green">${MR3Utils.icon("wallet")}</span><div><p>${MR3I18n.t("treasury.currentBalance")}</p><strong>${MR3Utils.money(balance)}</strong></div></article></div><section class="panel"><div class="panel-body">${table}</div></section>`;
      root.querySelector("#treasuryDeposit")?.addEventListener("click", () => openTreasuryOperation("deposit"));
      root.querySelector("#treasuryWithdrawal")?.addEventListener("click", () => openTreasuryOperation("withdrawal"));
    }
  };
})();
