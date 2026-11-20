// Size limits shared by bookSchema (guards input from the browser) and
// parseSearchResponse (truncates Open Library data to fit). Keep this module
// free of imports so both client and server code can use it.
export const MAX_TITLE_LENGTH = 1000;
export const MAX_AUTHORS = 50;
export const MAX_AUTHOR_LENGTH = 500;
export const MAX_CURRENT_PAGE = 100_000;
