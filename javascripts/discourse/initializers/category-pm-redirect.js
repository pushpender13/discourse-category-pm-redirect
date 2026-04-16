import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("0.8", (api) => {
  const settings = window.categoryPmRedirectSettings;

  function normalizeSlug(slug) {
    return slug?.toLowerCase().trim();
  }

  function isRestricted(slug) {
    if (!slug) return false;
    return settings.restrictedCategories
      .map(normalizeSlug)
      .includes(normalizeSlug(slug));
  }

  function buildPmUrl(categoryName) {
    const title = encodeURIComponent(`Request to join ${categoryName}`);
    const body = encodeURIComponent(
      `Hi,\n\nI would like to join ${categoryName}.\n\nThanks`
    );

    if (settings.useGroup) {
      return `/new-message?groupname=${settings.pmTarget}&title=${title}&body=${body}`;
    } else {
      return `/new-message?username=${settings.pmTarget}&title=${title}&body=${body}`;
    }
  }

  // Intercept clicks (homepage, sidebar, badges)
  document.addEventListener("click", function (e) {
    const link = e.target.closest(
      "a.category-title-link, a.badge-category, a.boxed-category"
    );
    if (!link) return;

    const url = new URL(link.href, window.location.origin);
    const parts = url.pathname.split("/");

    // /c/slug/id
    if (parts[1] !== "c") return;

    const slug = parts[2];

    if (!isRestricted(slug)) return;

    e.preventDefault();

    const categoryName = slug.replace(/-/g, " ");

    window.location.href = buildPmUrl(categoryName);
  });

  // Optional: block direct navigation
  api.onPageChange((url) => {
    const parts = url.split("/");

    if (parts[1] !== "c") return;

    const slug = parts[2];

    if (!isRestricted(slug)) return;

    const categoryName = slug.replace(/-/g, " ");

    window.location.replace(buildPmUrl(categoryName));
  });
});
