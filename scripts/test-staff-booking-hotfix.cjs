// Execute the real submission handlers with mocked fetch/state. No server or customer calls.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const source = fs.readFileSync(path.resolve(__dirname, "../app/staff/(app)/pickups/page.tsx"), "utf8");
const tree = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function handler(name, env) {
  let initializer;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) initializer = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(initializer, name);
  const js = ts.transpileModule(`const handler = ${initializer.getText(tree)};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return new Function(...Object.keys(env), `${js}; return handler;`)(...Object.values(env));
}
function setup(fetch) {
  const state = {};
  const env = {
    fetch, apiPath: p => `/willcall${p}`, appointmentSaveInFlight: { current: false },
    console: { info() {} }, fetchAppointments: () => { state.refreshes = (state.refreshes ?? 0) + 1; },
  };
  for (const key of ["AppointmentSaving", "AppointmentSaveError", "CreateModalError", "DialogOpen", "Error"]) env[`set${key}`] = value => { state[key] = value; };
  return { env, state };
}
(async () => {
  for (const name of ["submitCreateAppointment", "submitUpdate"]) {
    let count = 0, release, request;
    const response = new Promise(resolve => { release = resolve; });
    const { env, state } = setup(async (url, options) => { count++; request = { url, options }; return response; });
    const submit = handler(name, env);
    const args = name === "submitUpdate" ? ["appointment-test", { customerPhone: "8015550101" }, false, ""] : [{ orderNbrs: ["TEST100"] }];
    const first = submit(...args);
    await submit(...args);
    assert.equal(count, 1);
    assert.equal(state.AppointmentSaving, true);
    release({ ok: true, status: 200, json: async () => ({}) });
    await first;
    assert.equal(state.AppointmentSaving, false);
    assert.equal(env.appointmentSaveInFlight.current, false);
    assert.equal(state.refreshes, 1);
    if (name === "submitUpdate") assert.equal(JSON.parse(request.options.body).notifyCustomer, false);
    console.log(`PASS ${name}: double click sends one request; saving state resets`);
  }
  {
    const { env, state } = setup(async () => ({ ok: false, json: async () => ({ message: "Order TEST100 already has an active pickup appointment." }) }));
    const saved = await handler("submitUpdate", env)("test", {}, false, "");
    assert.equal(saved, false);
    assert.match(state.AppointmentSaveError, /already has an active/);
    assert.equal(state.refreshes, undefined);
    console.log("PASS edit failure preserves the server explanation");
  }
  {
    const { env, state } = setup(async () => { throw Error("offline"); });
    await handler("submitCreateAppointment", env)({});
    assert.equal(env.appointmentSaveInFlight.current, false);
    assert.equal(state.AppointmentSaving, false);
    assert.match(state.CreateModalError, /Refresh the calendar before trying again/);
    console.log("PASS network failure releases the guard and warns against blind retries");
  }
  console.log("4/4 passed");
})().catch(e => { console.error(e); process.exitCode = 1; });
