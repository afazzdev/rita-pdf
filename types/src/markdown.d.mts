export declare function escapeHtml(str: any): string;
export declare function createRenderer(): any;
/**
 * Rewrites one chapter's tokens in place:
 *  - drops the leading H1 (it becomes the chapter opener) and the doc's own TOC
 *  - demotes remaining headings one level and namespaces their ids
 *  - rewrites `#anchor` and `../other/doc.md#anchor` links to those ids
 *  - turns bare `.md` path references into cross-references to that chapter
 *
 * Returns the entries this chapter contributes to the front table of contents.
 */
export declare function transformChapter(tokens: any, chapter: any, { chapterByFile, docsName }: {
    chapterByFile: any;
    docsName: any;
}): any[];
