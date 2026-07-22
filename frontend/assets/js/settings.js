(function () {
  function renderForm(settings) {
    return `<section class="panel"><div class="panel-body"><form id="settingsForm" class="form-grid">
      <label class="field"><span>${MR3I18n.t("settings.businessNameAr")}</span><input name="businessNameAr" value="${MR3Utils.escape(settings.businessNameAr)}" required /></label>
      <label class="field"><span>${MR3I18n.t("settings.businessNameEn")}</span><input name="businessNameEn" value="${MR3Utils.escape(settings.businessNameEn)}" required /></label>
      <label class="field"><span>${MR3I18n.t("common.phone")}</span><input name="phone" value="${MR3Utils.escape(settings.phone)}" /></label>
      <label class="field"><span>${MR3I18n.t("common.address")}</span><input name="address" value="${MR3Utils.escape(settings.address)}" /></label>
      <label class="field"><span>${MR3I18n.t("settings.logoPath")}</span><input name="logoPath" value="${MR3Utils.escape(settings.logoPath)}" /></label>
      <label class="field"><span>${MR3I18n.t("settings.defaultLanguage")}</span><select name="defaultLanguage"><option value="en"${settings.defaultLanguage === "en" ? " selected" : ""}>English</option><option value="ar"${settings.defaultLanguage === "ar" ? " selected" : ""}>العربية</option></select></label>
      <label class="field"><span>${MR3I18n.t("settings.currency")}</span><input name="currency" value="${MR3Utils.escape(settings.currency)}" /></label>
      <label class="field wide"><span>${MR3I18n.t("settings.receiptFooter")}</span><textarea name="receiptFooter">${MR3Utils.escape(settings.receiptFooter)}</textarea></label>
      <div class="wide page-tools">
        <button class="primary-button" type="submit">${MR3Utils.icon("save")}${MR3I18n.t("common.save")}</button>
        <button class="danger-button" id="resetDemo" type="button">${MR3Utils.icon("refresh")}${MR3I18n.t("settings.resetDemo")}</button>
      </div>
    </form></div></section>`;
  }

  window.MR3Pages.settings = {
    render(root) {
      root.innerHTML = MR3App.pageHeader("nav.settings", "") + renderForm(MR3DB.getSettings());
      root.querySelector("#settingsForm").addEventListener("submit", (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.target).entries());
        MR3DB.updateSettings(data);
        MR3I18n.apply(data.defaultLanguage);
        MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.saved"));
        MR3App.render();
      });
      root.querySelector("#resetDemo").addEventListener("click", async () => {
        if (!(await MR3Utils.confirm(MR3I18n.t("settings.resetDemo")))) return;
        MR3DB.reset();
        MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("messages.dataReset"));
        setTimeout(() => location.replace("login.html"), 500);
      });
    }
  };
})();
