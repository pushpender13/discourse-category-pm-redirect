import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.0", (api) => {
  const site = api.container.lookup("service:site");

  function getRestrictedEntries() {
    const raw = settings.restricted_categories || "";
    return raw
      .split("|")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }

  function getCategoryById(id) {
    if (!site || !site.categories) return null;
    return site.categories.find((c) => c.id === id);
  }

  function getCategoryBySlug(slug) {
    if (!site || !site.categories) return null;
    return site.categories.find(
      (c) => c.slug?.toLowerCase() === slug?.toLowerCase()
    );
  }

  function isCategoryRestricted(category) {
    if (!category) return false;
    const entries = getRestrictedEntries();
    if (entries.length === 0) return false;
    const idStr = String(category.id);
    const slug = (category.slug || "").toLowerCase();
    return entries.includes(idStr) || entries.includes(slug);
  }

  function buildPmSubject(categoryName) {
    return `I would like to join ${categoryName}`;
  }

  function buildPmBody(categoryName) {
    return `Hi,\n\nI would like to join ${categoryName}.\n\nPlease grant me access.\n\nThank you`;
  }

  function openComposer(categoryName) {
    const pmTarget = settings.pm_target || "moderators";
    const useGroup = settings.use_group !== false;
    const composer = api.container.lookup("service:composer");

    if (composer) {
      composer
        .open({
          action: "privateMessage",
          title: buildPmSubject(categoryName),
          body: buildPmBody(categoryName),
          recipients: pmTarget,
        })
        .catch(() => fallbackToUrl(categoryName, pmTarget, useGroup));
    } else {
      fallbackToUrl(categoryName, pmTarget, useGroup);
    }
  }

  function fallbackToUrl(categoryName, pmTarget, useGroup) {
    const title = encodeURIComponent(buildPmSubject(categoryName));
    const body = encodeURIComponent(buildPmBody(categoryName));
    if (useGroup) {
      window.location.href = `/new-message?groupname=${pmTarget}&title=${title}&body=${body}`;
    } else {
      window.location.href = `/new-message?username=${pmTarget}&title=${title}&body=${body}`;
    }
  }

  function extractInfoFromPath(pathname) {
    const parts = pathname.split("/").filter(Boolean);
    if (parts[0] !== "c") return null;

    const lastPart = parts[parts.length - 1];
    if (/^\d+$/.test(lastPart)) {
      return { id: parseInt(lastPart, 10), slug: parts[parts.length - 2] };
    }
    return { slug: lastPart };
  }

  function resolveCategory(pathname) {
    const info = extractInfoFromPath(pathname);
    if (!info) return null;

    if (info.id) {
      const cat = getCategoryById(info.id);
      if (cat) return cat;
    }

    if (info.slug) {
      return getCategoryBySlug(info.slug);
    }

    return null;
  }

  document.addEventListener("click", function (e) {
    const link = e.target.closest("a[href*='/c/']");
    if (!link || !link.href) return;

    let url;
    try {
      url = new URL(link.href, window.location.origin);
    } catch (_) {
      return;
    }

    if (url.origin !== window.location.origin) return;

    const category = resolveCategory(url.pathname);
    if (!category || !isCategoryRestricted(category)) return;

    e.preventDefault();
    e.stopPropagation();

    openComposer(category.name || category.slug);
  });

  api.onPageChange((url) => {
    if (!url.startsWith("/c/")) return;

    const category = resolveCategory(url);
    if (!category || !isCategoryRestricted(category)) return;

    const categoryName = category.name || category.slug;
    const router = api.container.lookup("service:router");

    if (router) {
      router.replaceWith("/");
    }

    setTimeout(() => {
      openComposer(categoryName);
    }, 300);
  });
});
