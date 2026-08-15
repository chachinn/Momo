import fs from "node:fs";

const VERSION = "1.11.0";
const OLD_VERSION = "1.10.3";
const INDEX = "index.html";
const APP = "app.js";
const SW = "service-worker.js";
const SMART = "smart-money.js";
const WORKFLOW = ".github/workflows/momo-smart-money-release.yml";
const SELF = "scripts/momo-smart-money-release.mjs";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, value) { fs.writeFileSync(path, value); }
function assert(ok, message) { if (!ok) throw new Error(message); }

let index = read(INDEX);
let app = read(APP);
let sw = read(SW);

assert(index.includes(`content="${OLD_VERSION}"`) || index.includes(`content="${VERSION}"`), "Unexpected index version baseline");
assert(app.includes('const DB_VERSION = 4;'), "DB_VERSION changed unexpectedly; refusing release");
assert(sw.includes(OLD_VERSION) || sw.includes(VERSION), "Unexpected service-worker version baseline");

index = index.replaceAll(OLD_VERSION, VERSION);

if (!index.includes('src="./smart-money.js"') && !index.includes('src="smart-money.js"')) {
  index = index.replace(
    /\n<\/body>\s*<\/html>\s*$/,
    '\n  <script src="./smart-money.js"></script>\n</body>\n</html>\n'
  );
}

assert(index.includes('src="./smart-money.js"'), "Could not wire smart-money.js into index.html");

app = app.replace(
  /\/\/ Momo 1\.10\.3[^\n]*/,
  "// Momo 1.11.0 — Smart Money + Local Intelligence"
);

sw = sw.replaceAll(OLD_VERSION, VERSION);

if (!sw.includes('"./smart-money.js"')) {
  sw = sw.replace(
    '  "./firebase-momo.js"\n];',
    '  "./firebase-momo.js",\n  "./smart-money.js"\n];'
  );
}

if (!sw.includes('url.pathname.endsWith(\n      "/smart-money.js"')) {
  sw = sw.replace(
    '    url.pathname.endsWith(\n      "/firebase-momo.js"\n    ) ||',
    '    url.pathname.endsWith(\n      "/firebase-momo.js"\n    ) ||\n    url.pathname.endsWith(\n      "/smart-money.js"\n    ) ||'
  );
}

assert(sw.includes('"./smart-money.js"'), "Smart Money missing from service-worker core shell");
assert(sw.includes('"/smart-money.js"'), "Smart Money missing from service-worker shell routing");

write(INDEX, index);
write(APP, app);
write(SW, sw);

// Static integrity gates.
const ids = [...index.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
const duplicateIds = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
assert(duplicateIds.length === 0, `Duplicate HTML IDs: ${duplicateIds.join(", ")}`);

const expectedCore = ["index.html", "styles.css", "app.js", "firebase-momo.js", "smart-money.js"];
for (const asset of expectedCore) assert(sw.includes(asset), `Service worker missing ${asset}`);
assert(index.includes(`name="momo-app-version" content="${VERSION}"`), "index version mismatch");
assert(sw.includes(`"${VERSION}"`), "service worker version mismatch");
assert(app.includes("Momo 1.11.0"), "app marker version mismatch");
assert(app.includes('const DB_VERSION = 4;'), "DB_VERSION must remain 4");
assert(read(SMART).includes('const SMART_VERSION = "1.11.0";'), "Smart Money version mismatch");

// Temporary release helpers must not remain in production.
if (fs.existsSync(WORKFLOW)) fs.rmSync(WORKFLOW);
if (fs.existsSync(SELF)) fs.rmSync(SELF);

console.log("Momo 1.11.0 Smart Money patch prepared successfully.");
