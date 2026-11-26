// Logical app routes are independent of the GitHub Pages repository prefix.
// Keep the Railway history-mode behavior unchanged.
export const pagesMode = import.meta.env.BASE_URL.endsWith("/unni/");
export function readRoute() {
  return pagesMode ? (location.hash.startsWith("#/") ? location.hash.slice(1) : "/") : location.pathname + location.search;
}
export function pushRoute(path) {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) return;
  history.pushState(history.state, "", pagesMode ? import.meta.env.BASE_URL + "#" + path : path);
}
