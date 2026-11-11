/* inchange placeholder site — RU/EN switcher (no frameworks, no external requests) */
(function () {
  "use strict";

  var dict = {
    ru: {
      badge: "Скоро",
      h1a: "Один мессенджер",
      h1b: "для жизни и работы",
      sub: "inchange — AI-мессенджер, который разделяет личное и рабочее общение. Никаких разных мессенджеров для дома и офиса.",
      f1t: "Жизнь и работа — раздельно",
      f1d: "Два пространства в одном мессенджере: переключайтесь, не смешивая общение.",
      f2t: "Self-hosted",
      f2d: "Ваши данные остаются у вас. Свой сервер — свои правила.",
      f3t: "Web, телефон и компьютер",
      f3d: "Приложения для браузера, iOS/Android и десктопа — всё синхронизировано.",
      cta: "Написать нам",
      footerTag: "Self-hosted AI-мессенджер",
      t404: "Страница не найдена",
      d404: "Такой страницы нет. Возможно, она появится позже — мы ведь ещё в пути.",
      home: "На главную"
    },
    en: {
      badge: "Coming soon",
      h1a: "One messenger",
      h1b: "for life and work",
      sub: "inchange is an AI messenger that keeps personal and work communication apart. No more juggling separate messengers for home and office.",
      f1t: "Life and work, apart",
      f1d: "Two spaces in one messenger: switch without ever mixing conversations.",
      f2t: "Self-hosted",
      f2d: "Your data stays yours. Your server, your rules.",
      f3t: "Web, phone and desktop",
      f3d: "Apps for the browser, iOS/Android and desktop — all kept in sync.",
      cta: "Contact us",
      footerTag: "Self-hosted AI messenger",
      t404: "Page not found",
      d404: "This page does not exist. It may appear later — we are still on our way.",
      home: "Home"
    }
  };

  var titles = {
    ru: "inchange — AI-мессенджер для жизни и работы",
    en: "inchange — AI messenger for life and work"
  };

  var descriptions = {
    ru: "inchange — AI-мессенджер, который разделяет личное и рабочее общение. Self-hosted. Web, телефон и компьютер. Скоро.",
    en: "inchange is an AI messenger that keeps personal and work communication apart. Self-hosted. Web, phone and desktop. Coming soon."
  };

  var STORAGE_KEY = "inchange_lang";

  function detectLang() {
    var saved = null;
    try { saved = window.localStorage.getItem(STORAGE_KEY); } catch (e) { /* private mode */ }
    if (saved === "ru" || saved === "en") return saved;
    var nav = (navigator.language || "").toLowerCase();
    return nav.indexOf("ru") === 0 ? "ru" : (nav.indexOf("en") === 0 ? "en" : "ru");
  }

  function apply(lang) {
    if (!dict[lang]) lang = "ru";
    var strings = dict[lang];

    var nodes = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute("data-i18n");
      if (Object.prototype.hasOwnProperty.call(strings, key)) {
        nodes[i].textContent = strings[key];
      }
    }

    document.documentElement.setAttribute("lang", lang);
    document.title = titles[lang];

    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", descriptions[lang]);

    var buttons = document.querySelectorAll("[data-lang]");
    for (var j = 0; j < buttons.length; j++) {
      var active = buttons[j].getAttribute("data-lang") === lang;
      buttons[j].classList.toggle("is-active", active);
      buttons[j].setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  function save(lang) {
    try { window.localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* private mode */ }
  }

  function init() {
    apply(detectLang());

    var buttons = document.querySelectorAll("[data-lang]");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function () {
        var lang = this.getAttribute("data-lang");
        apply(lang);
        save(lang);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
