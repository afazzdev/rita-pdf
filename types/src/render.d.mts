/**
 * Makes sure there is a Chromium to print with, downloading one if not.
 *
 * The download happens here rather than in a postinstall script because npm and
 * pnpm both block package build scripts by default now — a tool run through
 * `npx` cannot count on puppeteer's postinstall having fetched a browser. First
 * run pays for the download (~170MB); later runs are offline.
 */
export declare function ensureBrowser(configuredPath: any, log: any): Promise<any>;
/**
 * Maps each heading id to the printed page it landed on.
 *
 * Chrome writes one named destination per anchor into the PDF catalog's
 * `/Dests` dictionary, pointing at the page object the anchor ended up on —
 * the only place pagination is knowable, since it happens inside the print
 * layout and not in the DOM.
 */
export declare function extractDestinationPages(pdfBytes: any): Promise<Map<any, any>>;
/**
 * Prints the handbook twice: once to find out which page each heading lands on,
 * then again with those numbers filled into the table of contents. The number
 * slots are the same width on both passes, so the second pass cannot reflow the
 * contents and stale the numbers it is printing. If the passes still disagree
 * on page count, the unnumbered version wins — wrong numbers are worse than
 * none.
 */
export declare function renderPdf(config: any, chapters: any, css: any, { tmpDir, log }: {
    log: any;
    tmpDir: any;
}): Promise<{
    pages: number;
    numbered: boolean;
}>;
