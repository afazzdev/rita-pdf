export type PartConfig = {
    /**
     * Matches the top-level directory name. Defaults to a slug of `name`.
     */
    id?: string;
    /**
     * Displayed on the part divider. Defaults to `id`.
     */
    name?: string;
    /**
     * "Part I", "Part II"… Numbered in order by default.
     */
    numeral?: string;
    /**
     * Short qualifier shown on the cover card, e.g. "Backend".
     */
    tagline?: string;
    /**
     * Full label for the contents and chapter eyebrows.
     */
    label?: string;
    /**
     * A sentence or two on the part divider.
     */
    blurb?: string;
    /**
     * Accent colour. Falls back to a built-in palette, by position.
     */
    accent?: string;
    /**
     * Tint used behind blockquotes. Derived from the palette.
     */
    accentTint?: string;
};
export type ChapterConfig = {
    /**
     * Path to the Markdown file, relative to the docs directory.
     */
    file: string;
    /**
     * `id` of the part it belongs to. Defaults to the first part.
     */
    part?: string;
    /**
     * Full title. An "X — Y" title displays as "Y" in the chapter opener.
     */
    title?: string;
};
export type Config = {
    /**
     * Directory of Markdown, relative to the config file. Default `"docs"`.
     */
    docs?: string;
    /**
     * Output path. Default `"docs/handbook.pdf"`.
     */
    out?: string;
    /**
     * Cover title and running footer. Default `"Documentation"`.
     */
    title?: string;
    /**
     * Cover title if it differs; newlines are line breaks.
     */
    coverTitle?: string;
    /**
     * Under the cover title.
     */
    subtitle?: string;
    /**
     * Small label in the cover corner, e.g. "ACME · Internal".
     */
    mark?: string;
    /**
     * Extra lines in the cover's footer block.
     */
    meta?: string | string[];
    /**
     * Running footer text. Defaults to `title`.
     */
    footer?: string;
    /**
     * Set `false` to print no cover page.
     */
    cover?: boolean;
    /**
     * `lang` attribute on the document. Default `"en"`.
     */
    lang?: string;
    /**
     * Path to a stylesheet replacing the built-in theme.
     */
    style?: string;
    /**
     * Defaults to one part per top-level directory.
     */
    parts?: PartConfig[];
    /**
     * Defaults to README-first, then alphabetical.
     */
    chapters?: ChapterConfig[];
    /**
     * With `chapters` listed, an unlisted doc fails the build. Default `true`.
     */
    strict?: boolean;
    /**
     * Browser to print with.
     */
    executablePath?: string;
};
export type ResolvedPart = {
    id: string;
    /**
     * CSS class carrying this part's accent, e.g. `part-backend`.
     */
    className: string;
    name: string;
    numeral: string;
    tagline: string;
    label: string;
    blurb: string;
    accent: string;
    accentTint: string;
};
export type ResolvedChapter = {
    file: string;
    part: string;
    title: string;
    /**
     * Title with any leading "Part — " removed.
     */
    shortTitle: string;
    /**
     * Two digits, counting from "01" across the whole book.
     */
    number: string;
    /**
     * Anchor namespace for this chapter's headings.
     */
    id: string;
};
export type ResolvedConfig = {
    docsDir: string;
    outFile: string;
    title: string;
    subtitle: string;
    mark: string;
    meta: string[];
    footer: string;
    coverTitle: string;
    showCover: boolean;
    parts: ResolvedPart[];
    chapters: ResolvedChapter[];
    quiet: boolean;
    lang?: string;
    style?: string;
    executablePath?: string;
};
/**
 * A part of the book: one top-level grouping of chapters, with its own divider
 * page and accent colour.
 *
 * @typedef {object} PartConfig
 * @property {string} [id] Matches the top-level directory name. Defaults to a slug of `name`.
 * @property {string} [name] Displayed on the part divider. Defaults to `id`.
 * @property {string} [numeral] "Part I", "Part II"… Numbered in order by default.
 * @property {string} [tagline] Short qualifier shown on the cover card, e.g. "Backend".
 * @property {string} [label] Full label for the contents and chapter eyebrows.
 * @property {string} [blurb] A sentence or two on the part divider.
 * @property {string} [accent] Accent colour. Falls back to a built-in palette, by position.
 * @property {string} [accentTint] Tint used behind blockquotes. Derived from the palette.
 */
/**
 * One chapter: a Markdown file, and where it belongs.
 *
 * @typedef {object} ChapterConfig
 * @property {string} file Path to the Markdown file, relative to the docs directory.
 * @property {string} [part] `id` of the part it belongs to. Defaults to the first part.
 * @property {string} [title] Full title. An "X — Y" title displays as "Y" in the chapter opener.
 */
/**
 * The shape a `rita.config.mjs` exports. Every key is optional — with no config
 * at all, parts and chapters are inferred from the directory tree.
 *
 * @typedef {object} Config
 * @property {string} [docs] Directory of Markdown, relative to the config file. Default `"docs"`.
 * @property {string} [out] Output path. Default `"docs/handbook.pdf"`.
 * @property {string} [title] Cover title and running footer. Default `"Documentation"`.
 * @property {string} [coverTitle] Cover title if it differs; newlines are line breaks.
 * @property {string} [subtitle] Under the cover title.
 * @property {string} [mark] Small label in the cover corner, e.g. "ACME · Internal".
 * @property {string|string[]} [meta] Extra lines in the cover's footer block.
 * @property {string} [footer] Running footer text. Defaults to `title`.
 * @property {boolean} [cover] Set `false` to print no cover page.
 * @property {string} [lang] `lang` attribute on the document. Default `"en"`.
 * @property {string} [style] Path to a stylesheet replacing the built-in theme.
 * @property {PartConfig[]} [parts] Defaults to one part per top-level directory.
 * @property {ChapterConfig[]} [chapters] Defaults to README-first, then alphabetical.
 * @property {boolean} [strict] With `chapters` listed, an unlisted doc fails the build. Default `true`.
 * @property {string} [executablePath] Browser to print with.
 */
/**
 * A part with every default filled in.
 *
 * @typedef {object} ResolvedPart
 * @property {string} id
 * @property {string} className CSS class carrying this part's accent, e.g. `part-backend`.
 * @property {string} name
 * @property {string} numeral
 * @property {string} tagline
 * @property {string} label
 * @property {string} blurb
 * @property {string} accent
 * @property {string} accentTint
 */
/**
 * A chapter with every default filled in.
 *
 * @typedef {object} ResolvedChapter
 * @property {string} file
 * @property {string} part
 * @property {string} title
 * @property {string} shortTitle Title with any leading "Part — " removed.
 * @property {string} number Two digits, counting from "01" across the whole book.
 * @property {string} id Anchor namespace for this chapter's headings.
 */
/**
 * What {@link loadConfig} returns: absolute paths, no optional keys.
 *
 * @typedef {object} ResolvedConfig
 * @property {string} docsDir
 * @property {string} outFile
 * @property {string} title
 * @property {string} subtitle
 * @property {string} mark
 * @property {string[]} meta
 * @property {string} footer
 * @property {string} coverTitle
 * @property {boolean} showCover
 * @property {ResolvedPart[]} parts
 * @property {ResolvedChapter[]} chapters
 * @property {boolean} quiet
 * @property {string} [lang]
 * @property {string} [style]
 * @property {string} [executablePath]
 */
/** Filenames searched, in order, when no `--config` is given. */
export declare const CONFIG_NAMES: string[];
/**
 * @param {string} [cwd]
 * @returns {string|null} Path to the first config file found, or null.
 */
export declare function findConfig(cwd?: string): string | null;
/**
 * `guides/getting-started.md` -> `Getting Started`; `README.md` -> `Overview`.
 *
 * @param {string} file
 * @returns {string}
 */
export declare function humanizeFile(file: string): string;
/**
 * @param {unknown} text
 * @returns {string}
 */
export declare function slug(text: unknown): string;
/**
 * Reads a config file (if given), layers CLI overrides on top, and fills in
 * every default.
 *
 * @param {object} options
 * @param {string|null} [options.configPath] Config file to read. Nothing is read when omitted.
 * @param {Partial<Config>} [options.overrides] Values winning over the file, e.g. CLI flags.
 * @param {string} [options.cwd] Directory relative paths resolve against.
 * @returns {Promise<ResolvedConfig>}
 */
export declare function loadConfig({ configPath, overrides, cwd }: {
    configPath?: string | null;
    overrides?: Partial<Config>;
    cwd?: string;
}): Promise<ResolvedConfig>;
/**
 * Per-chapter anchor namespace: `guides/development.md` -> `guides-development`.
 *
 * @param {string} file
 * @returns {string}
 */
export declare function chapterId(file: string): string;
