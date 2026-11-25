import assert from "node:assert/strict";
import { test } from "node:test";
import { state, reset, command } from "./fake/herdr.mjs";
import { make, find, texts, click, cx, settle } from "./lib.mjs";
import { label, saveLabel, openArgs, mode, saveMode, WAIT_FOR_WINDOW, reuse, saveReuse, findOpen, actionOverlay } from "../mods/tode/main.js";

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

const argv = (name) => ["/home/me/.config/herdr-app/mods/tode/tode-title", name];

test("by default a click opens tode in a new tab, in the focused terminal's folder", async () => {
  reset({ focused: { pane: "p1", terminal: "t1", cwd: "/work/site" } });
  assert.equal(mode(), "tab");
  click(make().render(), "tode-open");
  await settle();
  assert.deepEqual(state.ran[0], { name: "terminal.open", args: { argv: argv("VSCode"), place: "tab", folder: "/work/site", name: "VSCode" } });
});

test("the new tab or pane is named after the button", async () => {
  reset({ focused: { pane: "p1", terminal: "t1", cwd: "/w" }, shared: { "tode.label": "Kod" }, panes: [{ pane: "p1", terminal: "t1" }] });
  click(make().render(), "tode-open");
  await settle();
  assert.equal(state.ran[0].args.name, "Kod");
  assert.deepEqual(state.ran[0].args.argv, argv("Kod"));
  assert.deepEqual(state.ran[1], { name: "pane.rename", args: { pane: "p101", name: "Kod" } });

  reset({ focused: { pane: "p1", terminal: "t1", cwd: "/w" }, shared: { "tode.label": "Kod", "tode.open": "pane" }, panes: [{ pane: "p1", terminal: "t1" }] });
  click(make().render(), "tode-open");
  await settle();
  assert.equal(state.ran[0].args.name, undefined);
  assert.deepEqual(state.ran[1], { name: "pane.rename", args: { pane: "p101", name: "Kod" } });
});

test("set to a new pane, a click opens tode to the right of the focused pane", async () => {
  reset({ focused: { pane: "p1", terminal: "t1", cwd: "/work/site" }, shared: { "tode.open": "pane" } });
  click(make().render(), "tode-open");
  await settle();
  assert.deepEqual(state.ran[0], { name: "terminal.open", args: { argv: argv("VSCode"), place: "right", folder: "/work/site" } });
});

test("a pane falls back to a tab without a focused pane, and no folder is sent without one", () => {
  assert.deepEqual(openArgs("pane", { pane: null, terminal: "t1", cwd: null }), { argv: argv("VSCode"), place: "tab", name: "VSCode" });
  assert.deepEqual(openArgs("tab", null), { argv: argv("VSCode"), place: "tab", name: "VSCode" });
});

test("set to a popup window, a click starts tode with hc and shows it in a window with a title bar", async () => {
  reset({ focused: { space: "s1", pane: "p1", terminal: "t1", cwd: "/work/site" }, shared: { "tode.open": "window" },
    spaces: [{ id: "s1", machine: null }] });
  click(make().render(), "tode-open");
  await settle();
  assert.deepEqual(state.hc, [["run", "--json", "--bg", "--rm", "--no-parent", "--cwd", "/work/site",
    "--label", "tode.vscode=1", "--label", "tode.space=s1",
    "--", "/bin/sh", "-c", WAIT_FOR_WINDOW, "tode", "/home/me/.local/bin/tode", "VSCode"]]);
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

test("the popup's title bar shows the button's name and the folder, and its × ends tode", () => {
  reset({ props: { titlebar: true, terminal: "t9", folder: "/Users/me/site", overlay: "w1" }, shared: { "tode.label": "Kod" } });
  const bar = make().render();
  assert.ok(texts(bar).includes("~/site"));
  assert.ok(texts(bar).includes("Kod"));
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
  assert.deepEqual(state.ran.filter((r) => r.name === "terminal.open").map((r) => r.args.place), ["right", "tab"]);
  assert.equal(state.overlays[0].kind, "window");
});

test("on another machine tode starts without the title script, which is on this one", () => {
  reset({ spaces: [{ id: "s2", machine: "vps" }] });
  assert.deepEqual(openArgs("tab", { space: "s2", pane: "p1", cwd: "/srv" }).argv, ["tode"]);
});

test("tode-title sets the terminal's title to its first argument and runs tode with the rest", async () => {
  const { spawnSync } = await import("node:child_process");
  const { mkdtempSync, writeFileSync, chmodSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { fileURLToPath } = await import("node:url");
  // A stand-in tode that prints its arguments.
  const bin = mkdtempSync(`${tmpdir()}/tode-test-`);
  writeFileSync(`${bin}/tode`, '#!/bin/sh\necho "tode $*"\n');
  chmodSync(`${bin}/tode`, 0o755);
  const script = fileURLToPath(new URL("../mods/tode/tode-title", import.meta.url));
  const r = spawnSync(script, ["Min kod", "--x"], { encoding: "utf8", env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
  assert.equal(r.stdout, "\x1b]2;Min kod\x07tode --x\n");
});

test("without tode installed, a click explains how to install terminal-code instead of opening anything", async () => {
  reset({ focused: { space: "s2", pane: "p1", cwd: "/w" }, spaces: [{ id: "s2", machine: "vps" }], which: "" });
  click(make().render(), "tode-open");
  await settle();
  assert.equal(state.ran.length, 0);
  assert.deepEqual(state.hc, []);
  assert.equal(state.overlays.length, 1);
  assert.equal(state.overlays[0].kind, "dialog");
  assert.deepEqual(state.overlays[0].props, { missing: true, machine: "vps" });
  assert.equal(state.execs[0].opts.on, "vps");
});

test("the install dialog shows the command and runs it in a new tab", () => {
  reset({ props: { missing: true, machine: null, overlay: "d1" } });
  const view = make();
  const drawn = view.render();
  assert.ok(texts(drawn).includes("curl -fsSL https://tode.sh/install | bash"));
  assert.ok(texts(drawn).some((t) => t.includes("terminal-code")));
  assert.equal(find(drawn, "tode-form"), null);
  click(drawn, "tode-install");
  assert.deepEqual(state.closed, ["d1"]);
  assert.deepEqual(state.ran, [{ name: "terminal.open", args: { argv: ["/bin/sh", "-c", "curl -fsSL https://tode.sh/install | bash"], place: "tab", name: "Install terminal-code" } }]);
});

test("the install dialog copies the command and links to terminal-code on GitHub", async () => {
  reset({ props: { missing: true, machine: null, overlay: "d1" } });
  const view = make();
  click(view.render(), "tode-copy");
  await settle();
  assert.deepEqual(state.execs[0].args.slice(-1), ["curl -fsSL https://tode.sh/install | bash"]);
  assert.ok(texts(view.render()).includes("Copied"));
  click(view.render(), "tode-github");
  assert.deepEqual(state.execs[1].args.slice(-1), ["https://github.com/zenbu-labs/terminal-code"]);
  click(view.render(), "tode-missing-close");
  assert.deepEqual(state.closed, ["d1"]);
});

test("when the machine can't be asked, a notification says so", async () => {
  reset({ focused: { pane: "p1", cwd: "/w" }, execFails: true });
  click(make().render(), "tode-open");
  await settle();
  assert.equal(state.overlays.length, 0);
  assert.equal(state.notes[0].level, "error");
});

test("a new tab or pane's tode is labelled, so a later click can find it", async () => {
  reset({ focused: { space: "s1", pane: "p1", terminal: "t1", cwd: "/w" }, spaces: [{ id: "s1", machine: null, tabs: [{ id: "tb1" }] }],
    panes: [{ pane: "p1", terminal: "t1", tab: "tb1" }] });
  click(make().render(), "tode-open");
  await settle();
  assert.deepEqual(state.hc, [["label", "t101", "tode.vscode=1"]]);
});

const opened = (over = {}) => ({
  focused: { space: "s1", pane: "p1", terminal: "t1", cwd: "/w/app/src" },
  spaces: [{ id: "s1", machine: null, tabs: [{ id: "tb1" }, { id: "tb2" }] }, { id: "s2", machine: null, tabs: [{ id: "tb9" }] }],
  panes: [{ pane: "p1", terminal: "t1", tab: "tb1" }, { pane: "p7", terminal: "t7", tab: "tb2" }],
  terminals: [{ address: "t7", state: "live", cwd: "/w/app", labels: { "tode.vscode": "1" } }],
  ...over,
});

test("a click shows the tode already open for the folder, or a folder above it, instead of opening another", async () => {
  reset(opened());
  click(make().render(), "tode-open");
  await settle();
  assert.deepEqual(state.ran, [{ name: "pane.focus", args: { pane: "p7" } }]);
  assert.deepEqual(state.execs, []);
});

test("an open tode for another folder, another space or one that ended doesn't count", () => {
  reset(opened());
  assert.equal(findOpen("s1", "/w/other"), null);
  assert.equal(findOpen("s2", "/w/app"), null);
  assert.equal(findOpen("s1", "/w/application"), null);
  assert.deepEqual(findOpen("s1", "/w/app"), { terminal: "t7", pane: "p7", folder: "/w/app" });
  state.terminals[0].state = "finished";
  assert.equal(findOpen("s1", "/w/app"), null);
  state.terminals[0].state = "live";
  state.terminals[0].labels = {};
  assert.equal(findOpen("s1", "/w/app"), null);
});

test("an open popup is found by its space label and shown again; its old title bar keeps tode running", async () => {
  reset(opened({ terminals: [{ address: "t8", state: "live", cwd: "/w/app", labels: { "tode.vscode": "1", "tode.space": "s1" } }] }));
  click(make().render(), "tode-open");
  await settle();
  assert.equal(state.overlays.length, 1);
  assert.equal(state.overlays[0].key, "tode-t8");
  // The replaced window's title bar closes.
  state.props = { titlebar: true, terminal: "t8", overlay: "w1" };
  await make().close();
  assert.deepEqual(state.ran, []);
  // A later close (the person's ×) does end it.
  await make().close();
  assert.deepEqual(state.ran, [{ name: "terminal.kill", args: { terminal: "t8" } }]);
});

test("set to open another, a click opens a new one even when one is open", async () => {
  reset(opened({ shared: { "tode.reuse": "new" } }));
  assert.equal(reuse(), false);
  click(make().render(), "tode-open");
  await settle();
  assert.equal(state.ran[0].name, "terminal.open");
});

test("the settings save whether to show an open tode", () => {
  reset({ props: { settings: true, overlay: "o1" } });
  const form = make();
  click(form.render(), "tode-reuse-new");
  click(form.render(), "tode-save");
  assert.equal(state.shared["tode.reuse"], "new");
  saveReuse("show");
  assert.equal(state.shared["tode.reuse"], null);
  assert.equal(reuse(), true);
});

test("the popup's title bar moves tode into a new tab or a pane, named after the button, without ending it", async () => {
  for (const [button, place] of [["tode-to-tab", "tab"], ["tode-to-pane", "right"]]) {
    reset({ props: { titlebar: true, terminal: "t8", folder: "/w", overlay: "w1" }, shared: { "tode.label": "Kod" } });
    const bar = make();
    click(bar.render(), button);
    assert.deepEqual(state.ran[0], { name: "terminal.keep", args: { terminal: "t8", place } });
    state.panes.push({ pane: "p8", terminal: "t8", tab: "tb8" });
    await settle(150);
    assert.deepEqual(state.ran.slice(1), [
      { name: "pane.rename", args: { pane: "p8", name: "Kod" } },
      ...(place === "tab" ? [{ name: "tab.rename", args: { id: "tb8", name: "Kod" } }] : [])]);
    assert.deepEqual(state.closed, ["w1"]);
    await bar.close();
    assert.equal(state.ran.some((r) => r.name === "terminal.kill"), false);
  }
});

test("another mod's button opens tode through an invisible popup, which closes itself when done", async () => {
  const spec = actionOverlay();
  assert.deepEqual(spec, { mod: "tode", props: { action: "open" }, kind: "popup", at: "pointer", frame: "none", width: 1, height: 1 });
  reset({ props: { action: "open", overlay: "a1" }, focused: { space: "s1", pane: "p1", terminal: "t1", cwd: "/w" },
    spaces: [{ id: "s1", machine: null, tabs: [{ id: "tb1" }] }], panes: [{ pane: "p1", terminal: "t1", tab: "tb1" }] });
  const view = make();
  assert.equal(find(view.render(), "tode-form"), null);
  await settle(80);
  assert.equal(state.ran[0].name, "terminal.open");
  assert.deepEqual(state.ran[1], { name: "pane.rename", args: { pane: "p101", name: "VSCode" } });
  assert.deepEqual(state.closed, ["a1"]);
});

test("the invisible popup can open the settings, or tode in a named way", async () => {
  reset({ props: { action: "settings", overlay: "a2" } });
  make();
  await settle();
  assert.deepEqual(state.overlays[0].props, { settings: true });
  assert.deepEqual(state.closed, ["a2"]);

  reset({ props: { action: "open-pane", overlay: "a3" }, focused: { space: "s1", pane: "p1", terminal: "t1", cwd: "/w" },
    spaces: [{ id: "s1", machine: null, tabs: [] }] });
  make();
  await settle(80);
  assert.equal(state.ran[0].args.place, "right");
  assert.deepEqual(state.closed, ["a3"]);
});

test("when Herdr gives the popup's tode no pane, the window stays and says so; its × still ends tode", async () => {
  reset({ props: { titlebar: true, terminal: "t8", folder: "/w", overlay: "w1" } });
  const bar = make();
  click(bar.render(), "tode-to-tab");
  await settle(900);
  assert.deepEqual(state.closed, []);
  assert.equal(state.notes[0].level, "error");
  await bar.close();
  assert.deepEqual(state.ran.at(-1), { name: "terminal.kill", args: { terminal: "t8" } });
});
