// ---------------------------------------------------------------------------
// Locale
// ---------------------------------------------------------------------------
const localeNode = document.getElementById("locale-data");
const localeData = localeNode ? JSON.parse(localeNode.textContent) : { locale: "en", strings: {} };
const locale = localeData.locale;
const t = (key) => localeData.strings[key] || key;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function appendBars(container, heights) {
  heights.forEach((h) => {
    const bar = document.createElement("i");
    bar.style.setProperty("--h", h + "px");
    container.append(bar);
  });
}

function selectedServiceLabel(form) {
  return form.elements.service.selectedOptions[0].textContent;
}

function todayAsInputValue() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

// ---------------------------------------------------------------------------
// Navigation (mobile menu) — returns a close function used by the Escape key
// ---------------------------------------------------------------------------
function initNavigation() {
  const menu = document.querySelector(".menu");
  const nav = document.querySelector(".navlinks");
  if (!menu) return () => {};

  const setOpen = (open) => {
    nav.classList.toggle("open", open);
    menu.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-label", t(open ? "Close navigation" : "Open navigation"));
  };

  menu.addEventListener("click", () => setOpen(!nav.classList.contains("open")));
  nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setOpen(false)));

  return () => setOpen(false);
}

// ---------------------------------------------------------------------------
// Language picker — keeps ?query and #hash when switching language
// ---------------------------------------------------------------------------
function initLanguagePicker() {
  const picker = document.querySelector(".language-picker");
  if (!picker) return null;

  picker.querySelectorAll("a").forEach((a) => {
    const target = new URL(a.href, location.origin);
    target.search = location.search;
    target.hash = location.hash;
    a.href = target.href;
  });

  document.addEventListener("click", (e) => {
    if (!picker.contains(e.target)) picker.open = false;
  });

  return picker;
}

function initEscapeKey(closeNavigation, picker) {
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeNavigation();
    if (picker && picker.open) {
      picker.open = false;
      picker.querySelector("summary").focus();
    }
  });
}

// ---------------------------------------------------------------------------
// "Get a quote" buttons always go to this language's contact page
// ---------------------------------------------------------------------------
function initQuoteLinks() {
  document.querySelectorAll(".quote").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      location.href = "/" + locale + "/contact/";
    }),
  );
}

// ---------------------------------------------------------------------------
// Decorative waveforms
// ---------------------------------------------------------------------------
function initWaveforms() {
  const wave = document.querySelector(".wave");
  if (wave) {
    appendBars(
      wave,
      [8, 16, 10, 24, 31, 17, 35, 22, 12, 28, 36, 19, 30, 13, 24, 32, 18, 9, 22, 14],
    );
  }

  document.querySelectorAll(".track-wave").forEach((trackWave, track) => {
    const heights = Array.from(
      { length: 48 },
      (_, n) => 5 + Math.round(Math.abs(Math.sin(n * 1.8 + track) * Math.cos(n * 0.33)) * 20),
    );
    appendBars(trackWave, heights);
  });
}

// ---------------------------------------------------------------------------
// LQA demo: literal vs. native-reviewed translation
// ---------------------------------------------------------------------------
function initVersionToggle() {
  const buttons = document.querySelectorAll("[data-version]");
  if (!buttons.length) return;

  const translation = document.querySelector("#translation");
  const label = document.querySelector("#review-label");
  const note = document.querySelector("#review-note");
  const badge = document.querySelector("#review-badge");

  buttons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.classList.contains("active")));

    button.addEventListener("click", () => {
      buttons.forEach((other) => {
        other.classList.toggle("active", other === button);
        other.setAttribute("aria-pressed", String(other === button));
      });

      const reviewed = button.dataset.version === "reviewed";
      translation.textContent = reviewed ? "Trở lại cuộc chiến!" : "Nhảy trở lại vào hành động.";
      label.textContent = t(reviewed ? "NATURAL • CONTEXT-AWARE" : "LITERAL • NEEDS CONTEXT");
      note.textContent = t(
        reviewed
          ? "An energetic, natural invitation for an action game."
          : "Word-for-word phrasing loses the intended invitation and tone.",
      );
      badge.textContent = t(reviewed ? "✓ Reviewed" : "△ Needs review");
    });
  });
}

// ---------------------------------------------------------------------------
// Contact form — builds a draft email (nothing is sent by the site itself)
// ---------------------------------------------------------------------------
function initBriefForm() {
  const form = document.querySelector("#briefForm");
  if (!form) return;

  const fieldLabels = {
    name: "Name",
    email: "Email",
    company: "Company",
    service: "Service",
    languages: "Languages",
    deadline: "Deadline",
    details: "Details",
  };

  function buildBody() {
    const lines = Array.from(new FormData(form).entries()).map(([key, value]) => {
      const text = key === "service" ? selectedServiceLabel(form) : value;
      return t(fieldLabels[key] || key) + ": " + text;
    });
    return "VNlocalization — " + t("Project inquiry") + "\n\n" + lines.join("\n\n");
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const subject = "VNlocalization — " + selectedServiceLabel(form);
    location.href =
      "mailto:info@penguinsgroup.com.vn?subject=" +
      encodeURIComponent(subject) +
      "&body=" +
      encodeURIComponent(buildBody());

    const result = document.querySelector("#result");
    result.textContent = t(
      "Please review and send the draft in your email app to info@penguinsgroup.com.vn. If no app opens, email your project details directly to this address.",
    );
    result.style.display = "block";
  });

  // Pre-select the service from ?service=...
  const requested = new URLSearchParams(location.search).get("service");
  if (requested && [...form.elements.service.options].some((o) => o.value === requested)) {
    form.elements.service.value = requested;
  }

  form.elements.deadline.min = todayAsInputValue();
}

// ---------------------------------------------------------------------------
// Service workbench tabs (accessible: arrow keys, Home, End)
// Panels are examples, not customer deliverables.
// ---------------------------------------------------------------------------
function initDemoTabs() {
  const tabs = [...document.querySelectorAll("[data-demo]")];

  function activate(tab, focus = false) {
    tabs.forEach((item) => {
      const active = item === tab;
      item.setAttribute("aria-selected", String(active));
      item.tabIndex = active ? 0 : -1;
      document.getElementById(item.getAttribute("aria-controls")).hidden = !active;
    });
    if (focus) tab.focus();
  }

  function indexForKey(key, index) {
    if (key === "ArrowRight") return (index + 1) % tabs.length;
    if (key === "ArrowLeft") return (index - 1 + tabs.length) % tabs.length;
    if (key === "Home") return 0;
    if (key === "End") return tabs.length - 1;
    return null;
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activate(tab));
    tab.addEventListener("keydown", (e) => {
      const next = indexForKey(e.key, index);
      if (next === null) return;
      e.preventDefault();
      activate(tabs[next], true);
    });
  });
}

// ---------------------------------------------------------------------------
// Subtitling demo: slider switches the sample cue
// ---------------------------------------------------------------------------
function initCueSlider() {
  const slider = document.getElementById("cue-range");
  if (!slider) return;

  const cues = [
    { text: "Mọi hành trình đều bắt đầu từ đây.", time: "00:01 / 00:09" },
    { text: "Cùng nhau, ta khám phá những điều mới.", time: "00:04 / 00:09" },
    { text: "Và viết tiếp câu chuyện của riêng mình.", time: "00:07 / 00:09" },
  ];

  slider.addEventListener("input", () => {
    const cue = cues[Math.max(0, Math.min(cues.length - 1, Number(slider.value) - 1))];
    document.getElementById("scene-subtitle").textContent = cue.text;
    document.getElementById("cue-time").textContent = cue.time;
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
const closeNavigation = initNavigation();
const picker = initLanguagePicker();
initEscapeKey(closeNavigation, picker);
initQuoteLinks();
initWaveforms();
initVersionToggle();
initBriefForm();
initDemoTabs();
initCueSlider();

// ---------------------------------------------------------------------------
// Mobile quick-quote bar (shown by CSS on small screens, not on the contact form)
// ---------------------------------------------------------------------------
function initStickyQuote() {
  const source = document.querySelector(".navlinks .btn");
  if (!source || document.querySelector("#briefForm")) return;

  const bar = document.createElement("a");
  bar.className = "sticky-quote";
  bar.href = source.getAttribute("href");
  bar.textContent = source.textContent.trim();
  document.body.append(bar);
  document.body.classList.add("has-sticky-quote");
}
initStickyQuote();

// ---------------------------------------------------------------------------
// Visual effects (all skipped when the visitor prefers reduced motion)
// ---------------------------------------------------------------------------
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Scrolling strip of service names, taken from the page itself (so it is localized)
function initMarquee() {
  const hero = document.querySelector(".home-hero");
  if (!hero) return;

  const labels = [...document.querySelectorAll(".service h3, .industry h3")]
    .map((h) =>
      h.innerHTML
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
  if (!labels.length) return;

  const band = document.createElement("div");
  band.className = "marquee";
  band.setAttribute("aria-hidden", "true");
  const track = document.createElement("div");
  track.className = "marquee-track";
  for (let copy = 0; copy < 2; copy++) {
    const group = document.createElement("div");
    group.className = "marquee-item";
    labels.forEach((label) => {
      const item = document.createElement("span");
      item.textContent = label;
      group.append(item);
    });
    track.append(group);
  }
  band.append(track);
  hero.after(band);
}

function initScrollChrome() {
  const header = document.querySelector("header");
  const bar = document.createElement("div");
  bar.className = "scroll-progress";
  bar.setAttribute("aria-hidden", "true");
  document.body.prepend(bar);

  let ticking = false;
  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.setProperty("--p", max > 0 ? Math.min(1, window.scrollY / max) : 0);
    if (header) header.classList.toggle("scrolled", window.scrollY > 8);
    ticking = false;
  };
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
}

function initReveal() {
  if (prefersReducedMotion || !("IntersectionObserver" in window)) return;

  const targets = document.querySelectorAll(
    ".sectionhead, .service, .industry, .step, .next-heading, .next-card, .examples-copy, .workbench, .qualitygrid > div, .aboutband, .faq h2, .faq details, .cta, .pagehero > *, .detailgrid > *",
  );
  document.documentElement.classList.add("has-reveal");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
  );

  targets.forEach((el) => {
    const siblings = [...el.parentElement.children].filter((c) =>
      c.matches(".service, .industry, .step, .next-card, details"),
    );
    el.style.setProperty("--i", Math.max(0, siblings.indexOf(el)));
    el.classList.add("reveal");
    observer.observe(el);
  });
}

// Cursor spotlight on cards + subtle hero parallax (mouse / pen only)
function initPointerEffects() {
  if (prefersReducedMotion || !window.matchMedia("(pointer: fine)").matches) return;

  document.querySelectorAll(".service, .industry").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", e.clientX - rect.left + "px");
      card.style.setProperty("--my", e.clientY - rect.top + "px");
    });
  });

  const hero = document.querySelector(".home-hero");
  if (hero) {
    hero.addEventListener("pointermove", (e) => {
      const rect = hero.getBoundingClientRect();
      hero.style.setProperty("--px", ((e.clientX - rect.left) / rect.width - 0.5) * 2);
      hero.style.setProperty("--py", ((e.clientY - rect.top) / rect.height - 0.5) * 2);
    });
    hero.addEventListener("pointerleave", () => {
      hero.style.setProperty("--px", 0);
      hero.style.setProperty("--py", 0);
    });
  }
}

initMarquee();
initScrollChrome();
initReveal();
initPointerEffects();
