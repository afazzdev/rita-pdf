import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.mjs";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

/** Loads the fixture docs with no config file, as `rita-pdf` does bare. */
function inferred(overrides = {}) {
  return loadConfig({ configPath: null, cwd: FIXTURES, overrides: { docs: "docs", ...overrides } });
}

describe("inference", () => {
  it("makes one part per top-level directory", async () => {
    const config = await inferred();

    expect(config.parts.map((p) => p.id)).toEqual(["alpha", "beta"]);
  });

  it("gives each part its own accent", async () => {
    const config = await inferred();
    const [alpha, beta] = config.parts;

    expect(alpha.accent).not.toBe(beta.accent);
    expect(alpha.className).toBe("part-alpha");
  });

  it("puts a directory's README before its other files", async () => {
    const config = await inferred();

    expect(config.chapters.map((c) => c.file)).toEqual([
      "alpha/README.md",
      "alpha/guides/configuration.md",
      "beta/README.md",
      "beta/state.md",
    ]);
  });

  it("numbers chapters across the whole book", async () => {
    const config = await inferred();

    expect(config.chapters.map((c) => c.number)).toEqual(["01", "02", "03", "04"]);
  });

  it("titles a README 'Overview' and humanizes the rest", async () => {
    const config = await inferred();
    const titles = Object.fromEntries(config.chapters.map((c) => [c.file, c.shortTitle]));

    expect(titles["alpha/README.md"]).toBe("Overview");
    expect(titles["alpha/guides/configuration.md"]).toBe("Configuration");
  });
});

describe("overrides", () => {
  it("lets a caller override the title", async () => {
    const config = await inferred({ title: "From the CLI" });

    expect(config.title).toBe("From the CLI");
    expect(config.footer).toBe("From the CLI");
  });

  it("resolves paths against the config's directory", async () => {
    const config = await inferred();

    expect(config.docsDir).toBe(join(FIXTURES, "docs"));
  });
});

describe("strict chapter lists", () => {
  const listOne = {
    docs: "docs",
    chapters: [{ file: "alpha/README.md" }],
  };

  it("fails when a doc is missing from the list, and names it", async () => {
    await expect(
      loadConfig({ configPath: null, cwd: FIXTURES, overrides: listOne })
    ).rejects.toThrow(/beta\/README\.md/);
  });

  it("says how to proceed", async () => {
    await expect(
      loadConfig({ configPath: null, cwd: FIXTURES, overrides: listOne })
    ).rejects.toThrow(/strict: false/);
  });

  it("allows a partial list when strict is off", async () => {
    const config = await loadConfig({
      configPath: null,
      cwd: FIXTURES,
      overrides: { ...listOne, strict: false },
    });

    expect(config.chapters).toHaveLength(1);
  });
});

describe("failure modes", () => {
  it("refuses a docs directory that is not there", async () => {
    await expect(inferred({ docs: "nope" })).rejects.toThrow(/not found/);
  });
});
