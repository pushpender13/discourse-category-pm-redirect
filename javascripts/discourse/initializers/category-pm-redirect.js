import { apiInitializer } from "discourse/lib/api";
import { getOwner } from "@ember/application";

export default apiInitializer("1.0", (api) => {
  const siteSettings = api.container.lookup("service:site-settings");
  const site = api.container.lookup("service:site");
  const currentUser = api.getCurrentUser();

  function getSettings() {
    return window.categoryPmRedirectSettings || {};
  }

  function getCategoryBySlug(slug) {
    if (!site || !site.categories) return null;
    return site.categories.find(
      (c) => c.slug === slug || c.slug?.toLowerCase() === slug?.toLowerCase()
    );
  }

  function getCategoryById(id) {
    if (!site || !site.categories) return null;
    return site.categories.find((c) => c.id === parseInt(id, 10));
  }

  function isUserMemberOfGroup(groupName) {
    if (!currentUser) return false;
    const groups = currentUser.groups || [];
    return groups.some(
      (g) => g.name?.toLowerCase() === groupName?.toLowerCase()
    );
  }

  function isCategoryRestricted(category) {
    if (!category) return false;

    const permission = category.permission;

    if (permission === null || permission === undefined) {
      return true;
    }

    if (permission === 0) {
      return true;
    }

    return false;
  }

  function buildPmSubject(categoryName) {
    return `I would like to join ${categoryName}`;
  }

  function buildPmBody(categoryName) {
    return `Hi,\n\nI would like to join ${categoryName}.\n\nPlease grant me access.\n\nThank you`;
  }

  function openComposer(categoryName) {
    const settings = getSettings();
    const pmTarget = settings.pmTarget || "moderators";
    const useGroup = settings.useGroup !== false;

    const composer = api.container.lookup("service:composer");

    if (composer) {
      const params = {
        action: "privateMessage",
        title: buildPmSubject(categoryName),
        body: buildPmBody(categoryName),
      };

      if (useGroup) {
        params.recipients = pmTarget;
      } else {
        params.recipients = pmTarget;
      }

      composer
        .open(params)
        .catch(() => {
          fallbackToUrl(categoryName, pmTarget, useGroup);
        });
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

  function extractSlugAndIdFromPath(pathname) {
    const parts = pathname.split("/").filter(Boolean);
    if (parts[0] !== "c") return null;

    const result = {};

    const lastPart = parts[parts.length - 1];
    if (/^\d+$/.test(lastPart)) {
      result.id = parseInt(lastPart, 10);
      result.slug = parts[parts.length - 2] || parts[1];
    } else {
      result.slug = lastPart || parts[1];
    }

    return result;
  }

  function resolveCategory(pathname) {
    const info = extractSlugAndIdFromPath(pathname);
    if (!info) return null;

    let category = null;

    if (info.id) {
      category = getCategoryById(info.id);
    }

    if (!category && info.slug) {
      category = getCategoryBySlug(info.slug);
    }

    return category;
  }

  document.addEventListener("click", function (e) {
    const link = e.target.closest(
      "a.category-title-link, a.badge-category, a.boxed-category, a[href*='/c/']"
    );
    if (!link || !link.href) return;

    let url;
    try {
      url = new URL(link.href, window.location.origin);
    } catch (_) {
      return;
    }

    if (url.origin !== window.location.origin) return;

    const category = resolveCategory(url.pathname);
    if (!category) return;

    if (!isCategoryRestricted(category)) return;

    e.preventDefault();
    e.stopPropagation();

    openComposer(category.name || category.slug);
  });

  api.onPageChange((url) => {
    if (!url.startsWith("/c/")) return;

    const category = resolveCategory(url);
    if (!category) return;

    if (!isCategoryRestricted(category)) return;

    const settings = getSettings();
    const pmTarget = settings.pmTarget || "moderators";
    const useGroup = settings.useGroup !== false;

    const categoryName = category.name || category.slug;

    const composer = api.container.lookup("service:composer");

    if (composer) {
      const router = api.container.lookup("service:router");
      if (router) {
        router.replaceWith("/");
      }

      setTimeout(() => {
        openComposer(categoryName);
      }, 300);
    } else {
      fallbackToUrl(categoryName, pmTarget, useGroup);
    }
  });
});
