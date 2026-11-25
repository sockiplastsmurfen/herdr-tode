import assert from "node:assert/strict";
import { test } from "node:test";
import { state, reset } from "./fake/herdr.mjs";
import { make, find, texts, click, cx } from "./lib.mjs";
import { label, saveLabel, openArgs } from "../mods/tode/main.js";

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

test("a click opens tode in a pane to the right, in the focused terminal's folder", () => {
  reset({ focused: { pane: "p1", terminal: "t1", cwd: "/work/site" } });
  click(make().render(), "tode-open");
  assert.deepEqual(state.ran, [{ name: "terminal.open", args: { argv: ["tode"], place: "right", folder: "/work/site" } }]);
});

test("without a focused pane it opens a tab, and without a folder it leaves the folder out", () => {
  assert.deepEqual(openArgs({ pane: null, terminal: "t1", cwd: null }), { argv: ["tode"], place: "tab" });
  assert.deepEqual(openArgs(null), { argv: ["tode"], place: "tab" });
});

test("the gear opens the settings popup, which saves the typed name", () => {
  reset();
  click(make().render(), "tode-settings");
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
