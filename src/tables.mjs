/** Text column width available to a table, in millimetres. */
const PORTRAIT_MM = 174;
const LANDSCAPE_MM = 261;
/** Rough advance width of one character of table text, and one cell's padding. */
const CHAR_MM = 1.8;
const CELL_PAD_MM = 5;

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
export function measureTable(tokens, start) {
  const weights = [];
  const minima = [];
  let column = 0;
  let rows = 0;
  let inHeader = false;

  for (let i = start + 1; i < tokens.length && tokens[i].type !== "table_close"; i++) {
    const token = tokens[i];
    if (token.type === "thead_open") inHeader = true;
    else if (token.type === "thead_close") inHeader = false;
    else if (token.type === "tr_open") {
      column = 0;
      rows++;
    } else if (token.type === "th_open" || token.type === "td_open") {
      const text = tokens[i + 1]?.type === "inline" ? tokens[i + 1].content : "";

      // Weights are in "characters of body prose". Headings are bold and cells
      // that are a single code span are mono, both a little wider per character
      // than the sans used for prose.
      const mono = /^`[^`]+`$/.test(text.trim()) ? 1.25 : 1;
      const weight = inHeader
        ? Math.min(text.length, 14) * 1.15
        : Math.min(text.length, 64) * mono;
      weights[column] = Math.max(weights[column] ?? 0, weight, 6);

      if (inHeader) {
        // A column must at least fit the longest single word of its heading —
        // "Method" broken as "Meth / od" reads worse than a wider column.
        const longestWord = Math.max(...text.split(/[\s/]+/).map((w) => w.length), 0);
        minima[column] = Math.max(minima[column] ?? 0, longestWord * CHAR_MM + CELL_PAD_MM);
      } else {
        // Body cells claim a minimum from their longest word too: a column of
        // "Authenticated" should not arrive as "Authe / nticat / ed". The cap
        // stops one long path or class name from claiming the whole table.
        const isCodeValue = /^`[^`\s]+`$/.test(text.trim());
        const longestWord = Math.max(
          ...text
            .replace(/`/g, "")
            .split(/[\s/]+/)
            .map((w) => w.length),
          0
        );
        const width =
          Math.min(longestWord, 13) * CHAR_MM * (isCodeValue ? 1 : 0.85) + CELL_PAD_MM;
        minima[column] = Math.max(minima[column] ?? 0, width);
      }
      column++;
    }
  }

  const columns = weights.length;
  const available = columns >= 8 ? LANDSCAPE_MM : PORTRAIT_MM;
  const minPercent = weights.map((_, i) =>
    Math.min(((minima[i] ?? 0) / available) * 100, 100 / columns)
  );

  return { columns, rows, percentages: allocate(weights, minPercent) };
}

/**
 * Splits 100% between columns in proportion to their weights, without letting
 * any column fall below its minimum. Columns that would are pinned at their
 * minimum and the rest share what is left — repeatedly, since pinning one
 * column shrinks the pool for the others.
 */
export function allocate(weights, minPercent) {
  const pinned = new Array(weights.length).fill(false);

  for (;;) {
    const pool = 100 - minPercent.reduce((sum, m, i) => sum + (pinned[i] ? m : 0), 0);
    const free = weights.reduce((sum, w, i) => sum + (pinned[i] ? 0 : w), 0) || 1;

    const short = weights.findIndex((w, i) => !pinned[i] && (w / free) * pool < minPercent[i]);
    if (short === -1) {
      return weights.map((w, i) => (pinned[i] ? minPercent[i] : (w / free) * pool));
    }
    pinned[short] = true;
  }
}
