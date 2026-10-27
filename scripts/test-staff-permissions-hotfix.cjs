// Exercise actual NextAuth callbacks and UI scope calculations without backend/network calls.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
function parse(file) {
  const text = fs.readFileSync(path.resolve(__dirname, "..", file), "utf8");
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}
function find(tree, predicate) {
  let result;
  function visit(node) { if (predicate(node)) result = node; ts.forEachChild(node, visit); }
  visit(tree);
  assert.ok(result, "Expected source expression");
  return result;
}
function evaluate(source, env) {
  const code = ts.transpileModule(`const value = ${source};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return new Function(...Object.keys(env), `${code};return value;`)(...Object.values(env));
}
const auth = parse("src/lib/auth.ts");
const jwtNode = find(auth, n => ts.isMethodDeclaration(n) && n.name.getText(auth) === "jwt");
const jwtSource = `async function(${jwtNode.parameters.map(p => p.getText(auth)).join(",")})${jwtNode.body.getText(auth)}`;
const stores = ["slc-hq", "boise-willcall", "jackson-willcall"];
const old = { id: "staff-test", type: "staff", role: "ADMIN", locationAccess: stores, staffToken: "signed-original-token", isActive: true };
const current = { id: old.id, email: "staff@example.invalid", role: "ADMIN", locationAccess: ["boise-willcall"], isActive: true };
function setup(response = { ok: true, status: 200, json: async () => ({ user: current }) }) {
  const requests = [];
  const run = evaluate(jwtSource, {
    STAFF_API_BASE_URL: "https://backend.example.invalid", AbortSignal,
    fetch: async (url, options) => { requests.push({ url, options }); if (response instanceof Error) throw response; return response; },
    console: { warn() {} },
  });
  return { run, requests };
}
const checks = [
  ["existing staff sessions refresh Boise-only permissions from the backend", async () => {
    const { run, requests } = setup();
    const result = await run({ token: structuredClone(old) });
    assert.deepEqual(result.locationAccess, ["boise-willcall"]);
    assert.equal(result.role, "ADMIN");
    assert.equal(requests[0].options.cache, "no-store");
    assert.equal(requests[0].url, "https://backend.example.invalid/api/staff/me");
  }],
  ["browser session.update cannot replace staff identity, token, role or stores", async () => {
    const { run, requests } = setup();
    const result = await run({ token: structuredClone(old), trigger: "update", session: { user: { type: "customer", staffToken: "forged-token", role: "ADMIN", locationAccess: stores } } });
    assert.equal(result.type, "staff");
    assert.equal(result.staffToken, "signed-original-token");
    assert.equal(requests[0].options.headers.Authorization, "Bearer signed-original-token");
    assert.deepEqual(result.locationAccess, ["boise-willcall"]);
  }],
  ["transient backend failure clears permissions and allows later refresh", async () => {
    const { run } = setup(new Error("offline"));
    const result = await run({ token: structuredClone(old) });
    assert.equal(result.role, "VIEWER");
    assert.deepEqual(result.locationAccess, []);
    assert.equal(result.staffToken, old.staffToken);
  }],
  ["expired or disabled sessions lose staff bearer token and privileges", async () => {
    const { run } = setup({ ok: false, status: 401 });
    const result = await run({ token: structuredClone(old) });
    assert.equal(result.isActive, false);
    assert.equal(result.staffToken, null);
    assert.deepEqual(result.locationAccess, []);
  }],
  ["wrong-user responses never grant permissions", async () => {
    const { run } = setup({ ok: true, status: 200, json: async () => ({ user: { ...current, id: "someone-else" } }) });
    assert.deepEqual((await run({ token: structuredClone(old) })).locationAccess, []);
  }],
  ["customer session refresh never calls staff endpoints", async () => {
    const { run, requests } = setup();
    const result = await run({ token: { id: "customer-test", type: "customer" } });
    assert.equal(result.type, "customer");
    assert.equal(requests.length, 0);
  }],
  ["initial staff sign-in preserves the freshly authenticated profile", async () => {
    const { run, requests } = setup();
    const result = await run({ token: {}, user: { ...current, type: "staff", token: "new-signed-token" } });
    assert.deepEqual(result.locationAccess, ["boise-willcall"]);
    assert.equal(result.staffToken, "new-signed-token");
    assert.equal(requests.length, 0);
  }],
  ["calendar admin dropdown contains only the assigned stores", async () => {
    const tree = parse("app/staff/(app)/pickups/page.tsx");
    const node = find(tree, n => ts.isVariableDeclaration(n) && n.name.getText(tree) === "accessibleLocations");
    const result = evaluate(node.initializer.getText(tree), { useMemo: fn => fn(), session: { user: current }, pickupLocations: stores.map(id => ({ id })) });
    assert.deepEqual(result, ["boise-willcall"]);
  }],
  ["cached calendar rows are hidden immediately when location access shrinks", async () => {
    const tree = parse("app/staff/(app)/pickups/page.tsx");
    const node = find(tree, n => ts.isVariableDeclaration(n) && n.name.getText(tree) === "filteredAppointments");
    const result = evaluate(node.initializer.getText(tree), { useMemo: fn => fn(), appointments: stores.map(locationId => ({ locationId, status: "Scheduled" })), accessibleLocations: ["boise-willcall"], selectedLocations: stores, selectedStatuses: ["Scheduled"], isAdmin: true });
    assert.deepEqual(result.map(r => r.locationId), ["boise-willcall"]);
  }],
  ["cached dashboard rows honor the current store scope", async () => {
    const tree = parse("app/staff/(app)/page.tsx");
    const node = find(tree, n => ts.isVariableDeclaration(n) && n.name.getText(tree) === "visiblePickups");
    const result = evaluate(node.initializer.getText(tree), { useMemo: fn => fn(), pickups: stores.map(locationId => ({ locationId })), session: { user: current } });
    assert.deepEqual(result.map(r => r.locationId), ["boise-willcall"]);
  }],
];
(async () => {
  let failed = 0;
  for (const [name, run] of checks) {
    try { await run(); console.log(`PASS ${name}`); }
    catch (e) { failed++; console.log(`FAIL ${name}: ${e.message}`); }
  }
  console.log(`${checks.length - failed}/${checks.length} passed`);
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
