import { describe, expect, it } from "vitest";
import { createRenderer } from "../src/markdown.mjs";
import { allocate } from "../src/tables.mjs";

const md = createRenderer();

/** Percentages from the `<colgroup>` the table renderer emits. */
function columnWidths(markdown) {
  const html = md.render(markdown);
  return [...html.matchAll(/<col style="width:([\d.]+)%">/g)].map((m) => Number(m[1]));
}

function table(header, alignment, ...rows) {
  return [header, alignment, ...rows].join("\n");
}

describe("column allocation", () => {
  it("splits the full width and nothing more", () => {
    const widths = columnWidths(
      table("| Method | Path | Purpose |", "|---|---|---|", "| GET | `/v1/things` | List them |")
    );

    expect(widths).toHaveLength(3);
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 1);
  });

  it("gives the wordier column more room", () => {
    const [method, purpose] = columnWidths(
      table(
        "| Method | Purpose |",
        "|---|---|",
        "| GET | Returns every thing the account can see, paginated |"
      )
    );

    expect(purpose).toBeGreaterThan(method);
  });

  it("keeps a short heading wide enough to sit on one line", () => {
    // The regression this pins: "Method" over three-letter verbs used to be
    // squeezed to a couple of characters and printed as "Meth / od", but only
    // in tables whose other columns happened to be wordier.
    const [method] = columnWidths(
      table(
        "| Method | Purpose |",
        "|---|---|",
        "| GET | " + "a very long sentence ".repeat(8) + "|"
      )
    );

    // 6 characters at ~1.8mm plus padding, over the 174mm text column.
    expect(method).toBeGreaterThan((6 * 1.8 + 5) / 1.74 - 1);
  });

  it("is not thrown off by a single enormous cell", () => {
    const widths = columnWidths(
      table(
        "| Path | Note |",
        "|---|---|",
        "| `/v1/accounts/{accountId}/subscriptions/{subscriptionId}/invoices` | short |"
      )
    );

    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 1);
    expect(Math.min(...widths)).toBeGreaterThan(5);
  });
});

describe("allocate", () => {
  it("honours minimums before sharing out the rest", () => {
    const widths = allocate([1, 1, 50], [30, 30, 0]);

    expect(widths[0]).toBeGreaterThanOrEqual(30);
    expect(widths[1]).toBeGreaterThanOrEqual(30);
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
  });

  it("still totals 100 when every column is pinned", () => {
    const widths = allocate([1, 1], [50, 50]);

    expect(widths).toEqual([50, 50]);
  });

  it("shares proportionally when no minimum binds", () => {
    const [small, large] = allocate([25, 75], [0, 0]);

    expect(small).toBeCloseTo(25, 6);
    expect(large).toBeCloseTo(75, 6);
  });
});

describe("table classes", () => {
  it("sends a nine-column table to landscape paper", () => {
    const html = md.render(
      table(
        "| a | b | c | d | e | f | g | h | i |",
        "|---|---|---|---|---|---|---|---|---|",
        "| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |"
      )
    );

    expect(html).toContain('class="landscape-table"');
  });

  it("leaves a six-column table in portrait", () => {
    const html = md.render(
      table("| a | b | c | d | e | f |", "|---|---|---|---|---|---|", "| 1 | 2 | 3 | 4 | 5 | 6 |")
    );

    expect(html).not.toContain("landscape-table");
  });

  it("lets a tall table break across pages", () => {
    const rows = Array.from({ length: 9 }, (_, i) => `| ${i} | row |`);
    const html = md.render(table("| n | v |", "|---|---|", ...rows));

    expect(html).toContain("long-table");
  });

  it("holds a short table together", () => {
    const html = md.render(table("| n | v |", "|---|---|", "| 1 | one |"));

    expect(html).not.toContain("long-table");
  });
});
