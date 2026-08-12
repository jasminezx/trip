const fs = require("fs");
const path = require("path");

const siteDir = path.join(process.cwd(), "docs", "site");
const outDir = path.join(process.cwd(), "out");
const indexTemplate = path.join(siteDir, "index.html");
const outIndex = path.join(outDir, "index.html");

const docLinksMarker = "<!-- GENERATED_DOC_LINKS -->";
const importLinksMarker = "<!-- GENERATED_IMPORT_LINKS -->";

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildLinkList(dir, linkPrefix) {
  if (!fs.existsSync(dir)) {
    return "<li><span>暂无页面</span></li>";
  }

  const files = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".html"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "zh-CN"))
    .filter((name) => name !== "index.html");

  if (files.length === 0) {
    return "<li><span>暂无页面</span></li>";
  }

  return files
    .map((name) => {
      const href = encodeURI(`${linkPrefix}/${name}`);
      const label = escapeHtml(name.replace(/\.html$/i, ""));
      return `          <li><a href="${href}">${label}</a></li>`;
    })
    .join("\n");
}

function main() {
  const template = fs.readFileSync(indexTemplate, "utf8");
  const docsSection = buildLinkList(path.join(siteDir, "pages"), "pages");
  const importedSection = buildLinkList(path.join(siteDir, "imported"), "imported");

  if (!template.includes(docLinksMarker) || !template.includes(importLinksMarker)) {
    throw new Error("Index template is missing generated link markers.");
  }

  const output = template
    .replace(docLinksMarker, docsSection)
    .replace(importLinksMarker, importedSection);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outIndex, output, "utf8");
}

main();
