import assert from "node:assert/strict";
import { test } from "node:test";
import { state, reset, command } from "./fake/herdr.mjs";
import { make, find, texts, click, cx, settle } from "./lib.mjs";
import { label, saveLabel, openArgs, mode, saveMode, WAIT_FOR_WINDOW } from "../mods/tode/main.js";

test("the button says VSCode by default", () => {
  reset();
  assert.equal(label(), "VSCode");
  assert.ok(texts(find(make().render(), "tode-open")).includes("VSCode"));
});

test("a saved name is shown instead, and an empty one goes back to VSCode", () => {
  reset();
  saveLabel("  Editor  ");
  assert.equal(state.shared["tode.label"], "Editor");
  assert.ok(texts(make().render()).includes("Editor"));
  saveLabel("   ");
  assert.equal(state.shared["tode.label"], null);
  assert.equal(label(), "VSCode");
});

test("by default a click opens tode in a new tab, in the focused terminal's folder", () => {
  reset({ focused: { pane: "p1", terminal: "t1", cwd: "/work/site" } });
  assert.equal(mode(), "tab");
  click(make().render(), "tode-open");
  assert.deepEqual(state.ran, [{ name: "terminal.open", args: { argv: ["tode"], place: "tab", folder: "/work/site" } }]);
});

test("set to a new pane, a click opens tode to the right of the focused pane", () => {
  reset({ focused: { pane: "p1", terminal: "t1", cwd: "/work/site" }, shared: { "tode.open": "pane" } });
  click(make().render(), "tode-open");
  assert.deepEqual(state.ran, [{ name: "terminal.open", args: { argv: ["tode"], place: "right", folder: "/work/site" } }]);
});

test("a pane falls back to a tab without a focused pane, and no folder is sent without one", () => {
  assert.deepEqual(openArgs("pane", { pane: null, terminal: "t1", cwd: null }), { argv: ["tode"], place: "tab" });
  assert.deepEqual(openArgs("tab", null), { argv: ["tode"], place: "tab" });
});

test("set to a popup window, a click starts tode with hc and shows it in a window with a title bar", async () => {
  reset({ focused: { space: "s1", pane: "p1", terminal: "t1", cwd: "/work/site" }, shared: { "tode.open": "window" },
    spaces: [{ id: "s1", machine: null }] });
  click(make().render(), "tode-open");
  await settle();
  assert.deepEqual(state.hc, [["run", "--json", "--bg", "--rm", "--no-parent", "--cwd", "/work/site",
    "--", "/bin/sh", "-c", WAIT_FOR_WINDOW, "tode", "/home/me/.local/bin/tode"]]);
  assert.equal(state.overlays.length, 1);
  const w = state.overlays[0];
  assert.equal(w.kind, "window");
  assert.deepEqual(w.layout.children.map((c) => c.content), [
    { mod: "tode", props: { titlebar: true, terminal: "t9", folder: "/work/site" } }, { terminal: "t9" }]);
  assert.deepEqual(state.ran, []);
  assert.deepEqual(state.notes, []);
});

test("the popup runs tode on the focused space's machine", async () => {
  reset({ focused: { space: "s2", pane: "p1", cwd: "/srv/app" }, shared: { "tode.open": "window" }, spaces: [{ id: "s2", machine: "vps" }] });
  click(make().render(), "tode-open");
  await settle();
  assert.deepEqual(state.execs[0].opts, { on: "vps" });
  assert.deepEqual(state.hc[0].slice(5, 9), ["--on", "vps", "--cwd", "/srv/app"]);
});

test("when hc can't start tode, a notification says why and no window opens", async () => {
  reset({ focused: { pane: "p1", cwd: "/x" }, shared: { "tode.open": "window" }, hcAnswer: { stdout: "", stderr: "no such folder" } });
  click(make().render(), "tode-open");
  await settle();
  assert.equal(state.overlays.length, 0);
  assert.equal(state.notes[0].level, "error");
  assert.match(state.notes[0].body, /no such folder/);
});

test("the popup's title bar shows the folder and its × ends tode, which closes the window", () => {
  reset({ props: { titlebar: true, terminal: "t9", folder: "/Users/me/site", overlay: "w1" } });
  const bar = make().render();
  assert.ok(texts(bar).includes("~/site"));
  assert.equal(find(bar, "tode-form"), null);
  click(bar, "tode-close");
  assert.deepEqual(state.ran, [{ name: "terminal.kill", args: { terminal: "t9" } }]);
});

test("where tode opens is saved, and the default (a new tab) is saved as nothing", () => {
  reset();
  saveMode("window");
  assert.equal(mode(), "window");
  saveMode("tab");
  assert.equal(state.shared["tode.open"], null);
  saveMode("bogus");
  assert.equal(mode(), "tab");
});

test("the settings form picks where tode opens and saves it with the name", () => {
  reset({ props: { settings: true, overlay: "o1" } });
  const form = make();
  assert.ok(texts(form.render()).includes("New tab"));
  click(form.render(), "tode-mode-window");
  click(form.render(), "tode-save");
  assert.equal(mode(), "window");
  assert.equal(state.shared["tode.label"], null);
  assert.deepEqual(state.closed, ["o1"]);
});

test("Cancel keeps where tode opens", () => {
  reset({ shared: { "tode.open": "pane" }, props: { settings: true, overlay: "o1" } });
  const form = make();
  click(form.render(), "tode-mode-tab");
  click(form.render(), "tode-cancel");
  assert.equal(mode(), "pane");
});

test("a right-click on the button opens the settings popup, which saves the typed name", () => {
  reset();
  find(make().render(), "tode-open").on["on_mouse_down:right"]({}, cx());
  assert.equal(state.overlays.length, 1);
  assert.equal(state.overlays[0].mod, "tode");
  assert.deepEqual(state.overlays[0].props, { settings: true });

  state.props = { settings: true, overlay: "o1" };
  const form = make();
  form.input.type("Code", cx());
  click(form.render(), "tode-save");
  assert.equal(state.shared["tode.label"], "Code");
  assert.deepEqual(state.closed, ["o1"]);
  assert.equal(label(), "Code");
});

test("Cancel closes the popup and keeps the name", () => {
  reset({ shared: { "tode.label": "Kod" }, props: { settings: true, overlay: "o9" } });
  const form = make();
  form.input.type("Other", cx());
  click(form.render(), "tode-cancel");
  assert.equal(state.shared["tode.label"], "Kod");
  assert.deepEqual(state.closed, ["o9"]);
});

test("the block is resized to the button, at zoom 1, and left alone when it fits", () => {
  reset({ props: { block: "tode" }, zoom: 2 });
  const v = make();
  v.fit(241);
  assert.deepEqual(state.ran, []);
  v.fit(200);
  assert.deepEqual(state.ran, [{ name: "layout.resize", args: { id: "tode", px: 100 } }]);
  state.ran = []; state.zoom = 1;
  v.fit(150.4);
  assert.deepEqual(state.ran, [{ name: "layout.resize", args: { id: "tode", px: 151 } }]);
});

test("key commands open tode as set, or in the way they name", async () => {
  reset({ focused: { space: "s1", pane: "p1", cwd: "/w" }, spaces: [{ id: "s1", machine: null }], shared: { "tode.open": "pane" } });
  make();
  await settle();
  command("open");
  await settle();
  command("open-tab");
  await settle();
  command("open-window");
  await settle();
  assert.deepEqual(state.ran.slice(0, 2).map((r) => r.args.place), ["right", "tab"]);
  assert.equal(state.overlays[0].kind, "window");
});
