// Event-scoped addresses (safe to use on the client too).
export const eventPath = (slug: string, path = "") => `/${slug}${path}`;
/** An event's people list, searched (e.g. a person's card). */
export const searchPath = (slug: string, q: string) => `/${slug}?q=${encodeURIComponent(q)}`;
