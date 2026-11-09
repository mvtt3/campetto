const ts = require("typescript");
const fs = require("fs");
const map = require("./.icons.json");
map.CloudSun = "IconSunLow";
const files = process.argv.slice(2);
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const local = new Map();
  let importNode = null;
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st) && st.moduleSpecifier.text === "lucide-react") {
      importNode = st;
      for (const el of st.importClause.namedBindings.elements) {
        const imported = (el.propertyName || el.name).text;
        if (imported === "LucideIcon") { local.set(el.name.text, "Icon"); continue; }
        if (!map[imported]) throw new Error(file + " unmapped " + imported);
        local.set(el.name.text, map[imported]);
      }
    }
  }
  if (!importNode) continue;
  const edits = [];
  const visit = (n) => {
    if (ts.isIdentifier(n) && local.has(n.text) && n.parent !== undefined) {
      const p = n.parent;
      const skip =
        (ts.isPropertyAccessExpression(p) && p.name === n) ||
        (ts.isPropertyAssignment(p) && p.name === n) ||
        (ts.isPropertySignature(p) && p.name === n) ||
        (ts.isJsxAttribute(p) && p.name === n) ||
        ts.isImportSpecifier(p);
      if (!skip) edits.push([n.getStart(), n.getEnd(), local.get(n.text)]);
    }
    if (ts.isShorthandPropertyAssignment(n) && local.has(n.name.text)) {
      edits.push([n.name.getStart(), n.name.getEnd(), `${n.name.text}: ${local.get(n.name.text)}`]);
      return;
    }
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(sf, (n) => { if (n !== importNode) visit(n); });
  const names = [...new Set([...local.values()])].filter((v) => v !== "Icon").sort();
  const hasType = [...local.values()].includes("Icon");
  const parts = [...names, ...(hasType ? ["type Icon"] : [])];
  const imp = parts.length > 3
    ? `import {\n${parts.map((x) => `  ${x},`).join("\n")}\n} from "@tabler/icons-react";`
    : `import { ${parts.join(", ")} } from "@tabler/icons-react";`;
  edits.push([importNode.getStart(), importNode.getEnd(), imp]);
  edits.sort((a, b) => b[0] - a[0]);
  let out = src;
  for (const [s, e, t] of edits) out = out.slice(0, s) + t + out.slice(e);
  fs.writeFileSync(file, out);
  console.log("ok", file, local.size);
}
