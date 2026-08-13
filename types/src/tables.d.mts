/**
 * Sizes a table's columns from its content.
 *
 * `table-layout: fixed` is what keeps a table from overflowing the paper — with
 * auto layout a single long identifier pushes the table past the page width and
 * Chrome then shrinks the *whole document* to fit. But fixed layout on its own
 * hands every column an equal share, so a row of ✓ marks gets as much width as
 * a sentence and long headings shatter mid-word.
 *
 * Columns are therefore weighted by what is in them, and each additionally
 * claims a minimum width in millimetres — enough for its longest word — so a
 * heading like "Method" survives regardless of how wordy the rest of that
 * particular table happens to be.
 */
export declare function measureTable(tokens: any, start: any): {
    columns: number;
    rows: number;
    percentages: any;
};
/**
 * Splits 100% between columns in proportion to their weights, without letting
 * any column fall below its minimum. Columns that would are pinned at their
 * minimum and the rest share what is left — repeatedly, since pinning one
 * column shrinks the pool for the others.
 */
export declare function allocate(weights: any, minPercent: any): any;
