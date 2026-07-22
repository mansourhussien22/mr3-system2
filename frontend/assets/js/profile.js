(function () {
  function duplicate(data, id) {
    return MR3DB.all("users").some((user) => user.id !== id && (MR3Utils.normalize(user.email) === MR3Utils.normalize(data.email) || MR3Utils.normalize(user.username) === MR3Utils.normalize(data.username)));
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

  function avatarMarkup(user, avatar) {
    if (avatar) return `<img src="${MR3Utils.escape(avatar)}" alt="${MR3Utils.escape(user?.name || "")}" />`;
    return `<span>${MR3Utils.escape(initials(user))}</span>`;
  }

  function readOptimizedImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => resolve(String(reader.result || ""));
        image.onload = () => {
          const maxSide = 520;
          const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.84));
        };
        image.src = String(reader.result || "");
      };
      reader.readAsDataURL(file);
    });
  }

  window.MR3Pages.profile = {
    render(root) {
      const user = MR3App.user();
      let avatar = user?.avatar || "";
      root.innerHTML =
        MR3App.pageHeader("nav.profile", "page.profileHint") +
        `<section class="profile-shell">
          <article class="panel profile-identity-card">
            <div class="profile-cover">
              <img src="assets/images/login-image.png" alt="" />
            </div>
            <div class="profile-avatar-preview" id="profileAvatarPreview">${avatarMarkup(user, avatar)}</div>
            <div class="profile-identity-body">
              <p class="eyebrow">${MR3I18n.t("profile.accountType")}</p>
              <h3>${MR3Utils.escape(user?.name || "")}</h3>
              <span class="badge ${user?.role === "ADMIN" ? "violet" : "info"}">${user?.role === "ADMIN" ? MR3I18n.t("common.admin") : MR3I18n.t("common.user")}</span>
              <div class="profile-line"><span>${MR3I18n.t("common.username")}</span><strong>${MR3Utils.escape(user?.username || "")}</strong></div>
              <div class="profile-line"><span>${MR3I18n.t("common.email")}</span><strong>${MR3Utils.escape(user?.email || "")}</strong></div>
              <div class="profile-line"><span>${MR3I18n.t("profile.lastUpdate")}</span><strong>${MR3Utils.dateTime(user?.updatedAt || user?.createdAt)}</strong></div>
            </div>
          </article>

          <article class="panel profile-form-card">
            <div class="panel-header">
              <h3>${MR3I18n.t("profile.personalInfo")}</h3>
              <span class="badge success">${MR3I18n.t("profile.savedLocally")}</span>
            </div>
            <div class="panel-body">
              <form id="profileForm" class="form-grid" novalidate>
                <label class="field">
                  <span>${MR3I18n.t("common.name")}</span>
                  <input name="name" value="${MR3Utils.escape(user?.name || "")}" required />
                </label>
                <label class="field">
                  <span>${MR3I18n.t("common.username")}</span>
                  <input name="username" value="${MR3Utils.escape(user?.username || "")}" required />
                </label>
                <label class="field">
                  <span>${MR3I18n.t("common.email")}</span>
                  <input name="email" type="email" value="${MR3Utils.escape(user?.email || "")}" required />
                </label>
                <label class="field">
                  <span>${MR3I18n.t("common.phone")}</span>
                  <input name="phone" value="${MR3Utils.escape(user?.phone || "")}" />
                </label>
                <label class="field wide">
                  <span>${MR3I18n.t("common.address")}</span>
                  <input name="address" value="${MR3Utils.escape(user?.address || "")}" />
                </label>
                <label class="field wide">
                  <span>${MR3I18n.t("profile.newPassword")}</span>
                  <input name="password" type="password" autocomplete="new-password" placeholder="${MR3Utils.escape(MR3I18n.t("profile.keepPassword"))}" />
                </label>
                <div class="profile-upload-row wide">
                  <label class="secondary-button profile-upload-button">
                    ${MR3Utils.icon("user")}
                    <span>${MR3I18n.t("profile.choosePhoto")}</span>
                    <input id="profileAvatarInput" type="file" accept="image/*" hidden />
                  </label>
                  <button id="removeProfileAvatar" class="ghost-button" type="button">${MR3Utils.icon("x")}${MR3I18n.t("profile.removePhoto")}</button>
                  <p>${MR3I18n.t("profile.photoHint")}</p>
                </div>
                <div class="profile-submit-row wide">
                  <button id="saveProfileButton" class="primary-button" type="submit">${MR3Utils.icon("save")}${MR3I18n.t("profile.saveProfile")}</button>
                </div>
              </form>
            </div>
          </article>
        </section>`;

      const form = root.querySelector("#profileForm");
      const preview = root.querySelector("#profileAvatarPreview");
      const fileInput = root.querySelector("#profileAvatarInput");
      const removeButton = root.querySelector("#removeProfileAvatar");

      const updatePreview = () => {
        preview.innerHTML = avatarMarkup(user, avatar);
        removeButton.disabled = !avatar;
      };

      fileInput.addEventListener("change", async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
          MR3Utils.toast("error", MR3I18n.t("messages.failed"), MR3I18n.t("profile.invalidPhoto"));
          fileInput.value = "";
          return;
        }
        try {
          avatar = await readOptimizedImage(file);
          updatePreview();
        } catch (error) {
          MR3Utils.toast("error", MR3I18n.t("messages.failed"), MR3I18n.t("profile.invalidPhoto"));
        }
      });

      removeButton.addEventListener("click", () => {
        avatar = "";
        fileInput.value = "";
        updatePreview();
      });

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }
        const submitButton = root.querySelector("#saveProfileButton");
        MR3Utils.setButtonLoading(submitButton, true);
        const data = Object.fromEntries(new FormData(form).entries());
        const patch = {
          name: String(data.name || "").trim(),
          username: String(data.username || "").trim(),
          email: String(data.email || "").trim(),
          phone: String(data.phone || "").trim(),
          address: String(data.address || "").trim(),
          avatar,
          updatedAt: MR3Utils.now()
        };
        if (String(data.password || "").trim()) patch.password = String(data.password).trim();
        if (duplicate(patch, user.id)) {
          MR3Utils.setButtonLoading(submitButton, false);
          MR3Utils.toast("error", MR3I18n.t("messages.failed"), MR3I18n.t("messages.duplicateUser"));
          return;
        }
        MR3DB.update("users", user.id, patch);
        MR3App.refreshUser();
        MR3Utils.toast("success", MR3I18n.t("messages.success"), MR3I18n.t("profile.saved"));
        MR3App.render();
      });

      updatePreview();
    }
  };
})();
