/**
 * The example handbook, built in CI as a smoke test.
 *
 * It exercises the parts of the pipeline that are easy to break: two parts with
 * their own accents, a mermaid diagram, a directory tree, tables of varying
 * width, cross-document links and a bare `.md` path reference.
 */
export default {
  docs: "docs",
  out: "handbook.pdf",

  title: "Example Handbook",
  coverTitle: "Example\nHandbook",
  subtitle: "A small documentation set, bound by rita-pdf",
  mark: "rita-pdf · example",
  meta: ["Built from examples/docs"],

  parts: [
    {
      id: "platform",
      name: "platform",
      tagline: "Service",
      blurb: "The example service: its layout, configuration and HTTP surface.",
    },
    {
      id: "client",
      name: "client",
      tagline: "Browser",
      blurb: "The browser client, its architecture and its single store.",
    },
  ],

  chapters: [
    { part: "platform", file: "platform/README.md", title: "platform — Overview" },
    { part: "platform", file: "platform/guides/configuration.md", title: "platform — Configuration" },
    { part: "platform", file: "platform/guides/deployment.md", title: "platform — Deployment" },
    { part: "platform", file: "platform/reference/api.md", title: "platform — API Reference" },
    { part: "client", file: "client/README.md", title: "client — Overview" },
    { part: "client", file: "client/state.md", title: "client — State" },
  ],
};
