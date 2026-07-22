(function () {
  const KEY = "mr3-theme";

  function current() {
    return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  }

  function labelKey() {
    return current() === "dark" ? "theme.light" : "theme.dark";
  }

  function apply(theme) {
    const next = theme === "dark" ? "dark" : "light";
    localStorage.setItem(KEY, next);
    document.documentElement.dataset.theme = next;
    document.documentElement.classList.add("theme-switching");
    refresh();
    window.setTimeout(() => document.documentElement.classList.remove("theme-switching"), 420);
  }

  function toggle() {
    apply(current() === "dark" ? "light" : "dark");
  }

  function refresh(root) {
    const scope = root || document;
    const isDark = current() === "dark";
    scope.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      const label = window.MR3I18n ? MR3I18n.t(labelKey()) : isDark ? "Light mode" : "Dark mode";
      button.classList.toggle("is-dark", isDark);
      button.setAttribute("aria-pressed", isDark ? "true" : "false");
      button.setAttribute("title", label);
      button.setAttribute("aria-label", label);
      button.innerHTML = `<span class="theme-toggle-icon">${MR3Utils.icon(isDark ? "sun" : "moon")}</span><strong>${MR3Utils.escape(label)}</strong>`;
    });
  }

  function init() {
    document.documentElement.dataset.theme = current();
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      if (button.dataset.themeBound === "true") return;
      button.dataset.themeBound = "true";
      button.addEventListener("click", toggle);
    });
    refresh();
  }

  window.MR3Theme = { current, apply, toggle, refresh, init };
})();
