/** Key used for both localStorage and cookie storage of the user's theme. */
export const THEME_KEY = "theme";

export type Theme = "light" | "dark";

/** Max-age for the theme cookie: ~1 year (seconds). */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
