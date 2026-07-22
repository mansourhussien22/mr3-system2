(function () {
  const KEY = "mr3-session-v1";

  function getStoredSession() {
    return localStorage.getItem(KEY) || sessionStorage.getItem(KEY);
  }

  function currentUser() {
    const raw = getStoredSession();
    if (!raw) return null;
    try {
      const session = JSON.parse(raw);
      return MR3DB.get("users", session.userId);
    } catch (error) {
      return null;
    }
  }

  function login(identifier, password, remember) {
    const value = MR3Utils.normalize(identifier);
    const user = MR3DB.all("users").find((item) => {
      return item.active && (MR3Utils.normalize(item.email) === value || MR3Utils.normalize(item.username) === value) && item.password === password;
    });
    if (!user) return null;
    const payload = JSON.stringify({ userId: user.id, at: MR3Utils.now() });
    if (remember) {
      localStorage.setItem(KEY, payload);
      sessionStorage.removeItem(KEY);
    } else {
      sessionStorage.setItem(KEY, payload);
      localStorage.removeItem(KEY);
    }
    return user;
  }

  function logout() {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
    location.replace("login.html");
  }

  function requireAuth() {
    const user = currentUser();
    if (!user || !user.active) {
      localStorage.removeItem(KEY);
      sessionStorage.removeItem(KEY);
      location.replace("login.html");
      return null;
    }
    return user;
  }

  const MR3Login = {
    init() {
      MR3I18n.apply(MR3I18n.current());
      const language = MR3Utils.$("#loginLanguage");
      language.value = MR3I18n.current();
      language.addEventListener("change", () => {
        MR3I18n.apply(language.value);
        MR3Theme.refresh();
      });

      const toggle = MR3Utils.$("#togglePassword");
      const password = MR3Utils.$("#password");
      toggle.innerHTML = MR3Utils.icon("eye");
      toggle.addEventListener("click", () => {
        const showing = password.type === "text";
        password.type = showing ? "password" : "text";
        toggle.innerHTML = MR3Utils.icon(showing ? "eye" : "eyeOff");
      });

      MR3Utils.$("#loginForm").addEventListener("submit", (event) => {
        event.preventDefault();
        const button = MR3Utils.$("#loginButton");
        const error = MR3Utils.$("#loginError");
        const loader = button.querySelector(".button-loader");
        const label = button.querySelector(".button-label");
        const originalLabel = label.textContent;
        error.textContent = "";
        button.disabled = true;
        loader.hidden = false;
        label.textContent = MR3I18n.t("auth.loading");
        setTimeout(() => {
          const user = login(MR3Utils.$("#identifier").value, password.value, MR3Utils.$("#remember").checked);
          if (!user) {
            error.textContent = MR3I18n.t("auth.invalid");
            button.disabled = false;
            loader.hidden = true;
            label.textContent = originalLabel;
            return;
          }
          location.replace("dashboard.html?v=20260615-movements-audit4#home");
        }, 350);
      });
    }
  };

  window.MR3Auth = { currentUser, login, logout, requireAuth };
  window.MR3Login = MR3Login;
})();
