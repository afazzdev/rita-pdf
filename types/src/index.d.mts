export { loadConfig, findConfig, CONFIG_NAMES } from "./config.mjs";
export { buildHtml, loadCss } from "./document.mjs";
export type Config = import("./config.mjs").Config;
export type PartConfig = import("./config.mjs").PartConfig;
export type ChapterConfig = import("./config.mjs").ChapterConfig;
export type ResolvedConfig = import("./config.mjs").ResolvedConfig;
/**
 * Re-exported from the package entry so a config file can say
 * `\@type {import("rita-pdf").Config}` and have it resolve.
 *
 * @typedef {import("./config.mjs").Config} Config
 * @typedef {import("./config.mjs").PartConfig} PartConfig
 * @typedef {import("./config.mjs").ChapterConfig} ChapterConfig
 * @typedef {import("./config.mjs").ResolvedConfig} ResolvedConfig
 */
declare const ASSETS_DIR: string;
export type RenderedChapter = import("./config.mjs").ResolvedChapter & {
    body: string;
    tocEntries: {
        id: string;
        text: string;
    }[];
};
/**
 * A chapter with its Markdown rendered to HTML.
 *
 * @typedef {import("./config.mjs").ResolvedChapter & {
 *   body: string,
 *   tocEntries: { id: string, text: string }[],
 * }} RenderedChapter
 */
/**
 * Reads every chapter and renders it to HTML, collecting contents entries.
 *
 * Exported because it is the seam tests use to check the assembled HTML without
 * starting a browser.
 *
 * @param {import("./config.mjs").ResolvedConfig} config
 * @returns {Promise<RenderedChapter[]>}
 */
export declare function renderChapters(config: import("./config.mjs").ResolvedConfig): Promise<RenderedChapter[]>;
/**
 * Builds the PDF described by `config` (already normalized by `loadConfig`).
 *
 * @param {import("./config.mjs").ResolvedConfig} config
 * @param {object} [options]
 * @param {(message: string) => void} [options.log] Progress reporter. Silent by default.
 * @returns {Promise<{
 *   outFile: string,
 *   pages: number,
 *   numbered: boolean,
 *   chapters: RenderedChapter[],
 *   dangling: string[],
 * }>} `numbered` is false when the contents shipped without page numbers;
 *   `dangling` lists links still pointing at a .md file, which cannot work in a PDF.
 */
export declare function build(config: import("./config.mjs").ResolvedConfig, { log }?: {
    log?: (message: string) => void;
}): Promise<{
    outFile: string;
    pages: number;
    numbered: boolean;
    chapters: RenderedChapter[];
    dangling: string[];
}>;
export { ASSETS_DIR };
