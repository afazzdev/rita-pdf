/**
 * Assembles the whole document: cover, contents, part dividers and chapters.
 *
 * @param {import("./config.mjs").ResolvedConfig} config
 * @param {import("./index.mjs").RenderedChapter[]} chapters
 * @param {string} css
 * @param {Map<string, number>|null} [pageOf] Heading id -> printed page. Null on the
 *   measuring pass, when the page numbers are not known yet.
 * @returns {string}
 */
export declare function buildHtml(config: import("./config.mjs").ResolvedConfig, chapters: import("./index.mjs").RenderedChapter[], css: string, pageOf?: Map<string, number> | null): string;
/**
 * The stylesheet, with one accent block per configured part appended. Colours
 * live in config, so a project picks its own without forking the theme.
 */
/**
 * @param {import("./config.mjs").ResolvedConfig} config
 * @param {string} assetsDir
 * @returns {Promise<string>}
 */
export declare function loadCss(config: import("./config.mjs").ResolvedConfig, assetsDir: string): Promise<string>;
