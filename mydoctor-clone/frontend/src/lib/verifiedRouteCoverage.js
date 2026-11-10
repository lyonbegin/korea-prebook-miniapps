/** Exact routes with observed original HTTP 200 public factual metadata.
 * Source: backend/data/public_source_facts_20261109.json and public_menu_facts_20261110.json
 * No source-unverified child page is treated as a locally supported destination.
 */
export const KNOWN_SOURCE_ROUTES = new Set([]);
export const originalSite = "https://my-doctor.io";
export const sourceRouteKey = path => {
  try{const u=new URL(path,originalSite);return decodeURIComponent(u.pathname)+u.search}
  catch{return String(path||"")}
};
export const hasLocalSourceFacts = path => KNOWN_SOURCE_ROUTES.has(sourceRouteKey(path));
