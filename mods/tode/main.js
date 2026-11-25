// tode: a button that opens `tode` (terminal code) in the focused terminal's folder: in a new
// tab (default), a new pane beside it, or a popup window; or shows the one already open there.
// A right-click on it opens the settings (the button's name, where tode opens, and whether to
// show an open one). The same mod is also the settings form, the popup's title bar, the
// not-installed dialog and an invisible popup other mods' buttons use: see role().
import { View, div, svg, image } from "gpui-kit";
import { h_flex, v_flex, InputState, Input } from "gpui-base";
import { run, nextCommand, focused, panes, terminals, theme, shared, setShared, props, layout, settings, spaces, openOverlay, closeOverlay, notify, checking, exec, hc, appHome } from "herdr";

export const DEFAULT_LABEL = "VSCode";
export const LABEL_KEY = "tode.label";
export const MODE_KEY = "tode.open";
export const REUSE_KEY = "tode.reuse";
export const COMMAND = ["tode"];
/** Where tode opens; the first is the default. */
export const MODES = [
  { id: "tab", name: "New tab" },
  { id: "pane", name: "New pane" },
  { id: "window", name: "Popup window" },
];
/** What a click does when tode is already open for the folder; the first is the default. */
export const REUSES = [
  { id: "show", name: "Show it" },
  { id: "new", name: "Open another" },
];
const FORM = { width: 340, height: 322 };

/** The button's name: the saved one, else VSCode. */
export function label() {
  const saved = shared(LABEL_KEY);
  return (typeof saved === "string" && saved.trim()) || DEFAULT_LABEL;
}

/** Saves the button's name; empty goes back to the default. */
export function saveLabel(text) {
  const name = String(text ?? "").trim();
  setShared(LABEL_KEY, name && name !== DEFAULT_LABEL ? name : null);
}

/** Where tode opens: the saved choice, else a new tab. */
export function mode() {
  const saved = shared(MODE_KEY);
  return MODES.some((m) => m.id === saved) ? saved : MODES[0].id;
}

/** Saves where tode opens; the default is saved as null. */
export function saveMode(id) {
  setShared(MODE_KEY, MODES.some((m) => m.id === id) && id !== MODES[0].id ? id : null);
}

/** Whether a click shows a tode already open for the folder (default) or opens another. */
export function reuse() {
  return shared(REUSE_KEY) !== "new";
}

export function saveReuse(id) {
  setShared(REUSE_KEY, id === "new" ? "new" : null);
}

// Every tode this mod starts gets this label, so a click can find it again (terminals()).
// A popup's terminal has no pane, so it also carries its space.
export const TAG = "tode.vscode";
export const SPACE_TAG = "tode.space";

/** The machine of the space `f` is in: null for this computer. */
function machineOf(f) {
  return spaces().find((s) => s.id === f?.space)?.machine ?? null;
}

function inside(folder, root) {
  if (!folder || !root) return true;
  const r = root.replace(/\/+$/, "");
  return folder === r || folder.startsWith(`${r}/`);
}

/** A tode this mod started, still running in that space, open on `folder` or a folder above
 *  it: {terminal, pane (null in a popup), folder}, or null. This computer's only. */
export function findOpen(space, folder) {
  const open = terminals().filter((t) => t.labels?.[TAG] && t.state === "live" && !String(t.address).includes("/"));
  if (!open.length) return null;
  const paneOf = new Map(panes().map((p) => [p.terminal, p]));
  const spaceOf = new Map(spaces().flatMap((s) => (s.tabs ?? []).map((x) => [x.id, s.id])));
  for (const t of open) {
    const pane = paneOf.get(t.address);
    const where = pane ? spaceOf.get(pane.tab) : t.labels[SPACE_TAG];
    if (where === space && inside(folder, t.cwd)) return { terminal: t.address, pane: pane?.pane ?? null, folder: t.cwd ?? null };
  }
  return null;
}

/** terminal.open's arguments for a tab or a pane, in the focused terminal's folder. A pane opens
 *  to the right of the focused one; with no pane focused (a layout terminal block) it is a tab.
 *  A tab is named after the button (`name` names only a tab; panes are renamed once they exist). */
export function openArgs(how = "tab", f = focused()) {
  const place = how === "pane" && f?.pane ? "right" : "tab";
  // The script is on this computer; on another machine tode starts as it is.
  const argv = machineOf(f) ? COMMAND : [`${appHome()}/${TITLE_SCRIPT}`, label()];
  const args = { argv, place };
  if (f?.cwd) args.folder = f.cwd;
  if (place === "tab") args.name = label();
  return args;
}

// Pane headers that show the terminal's title rather than the pane's name (herdr-nvim-header)
// would show the terminal's address: tode sets no title. So tode starts through `tode-title` in
// this folder, which sets the title to the button's name and becomes tode. Herdr names the
// program after what started it, so programs.json matches "tode-title" for the icon.
export const TITLE_SCRIPT = "mods/tode/tode-title";

// tode asks the terminal whether it shows graphics, and how big it is, as it starts; a terminal
// started with `hc run` has nobody to answer and a made-up size until the window shows it. So the
// terminal waits for the window: showing it changes the terminal's size. Then a moment for the
// size to settle, and tode starts; at the latest after 3 s. First it sets the terminal's title
// to the button's name ($2), for when the popup becomes a tab or pane.
export const WAIT_FOR_WINDOW = [
  `p="$1"; printf '\\033]2;%s\\007' "$2"; was=$(stty size 2>/dev/null); i=0`,
  'while [ $i -lt 60 ] && [ "$(stty size 2>/dev/null)" = "$was" ]; do sleep 0.05; i=$((i+1)); done',
  'sleep 0.3; exec "$p"',
].join("; ");

/** hc's arguments for tode in a popup window: a terminal of its own, outside Herdr's tabs,
 *  removed when it exits, on the focused space's machine. */
export function hcArgs(program, f = focused()) {
  const machine = machineOf(f);
  return ["run", "--json", "--bg", "--rm", "--no-parent",
    ...(machine ? ["--on", machine] : []), ...(f?.cwd ? ["--cwd", f.cwd] : []),
    "--label", `${TAG}=1`, ...(f?.space ? ["--label", `${SPACE_TAG}=${f.space}`] : []),
    "--", "/bin/sh", "-c", WAIT_FOR_WINDOW, "tode", program, label()];
}

/** The popup window: a title bar (this mod) over the terminal. Closes itself when tode ends. */
export function windowSpec(address, folder) {
  return {
    kind: "window", key: `tode-${address}`, width: 0.72, height: 0.78,
    layout: { type: "column", children: [
      { type: "block", size: { px: 32 }, content: { mod: "tode", props: { titlebar: true, terminal: address, folder } } },
      { type: "block", content: { terminal: address } },
    ] },
  };
}

function find(node, id) {
  if (!node) return null;
  if (node.id === id) return node;
  for (const c of node.children ?? []) { const hit = find(c, id); if (hit) return hit; }
  return null;
}

const stop = (_e, cx) => cx.stop_propagation();
// Popup windows being replaced by show(), by terminal: shared by the copies, so the replaced
// window's title bar knows not to end tode.
const reopening = new Map();
/** What this copy is, by its props: the popup's title bar, the not-installed dialog, an
 *  invisible action popup, the settings form (any other overlay: mod.open), or the button. */
function role() {
  const p = props() ?? {};
  if (p.titlebar) return "titlebar";
  if (p.missing) return "missing";
  if (p.action) return "action";
  if (p.settings || p.overlay) return "form";
  return "button";
}

/** Waits (up to 3 s) for a pane that `match` picks, then returns it, or null. */
async function waitForPane(cx, match) {
  for (let i = 0; i < 30; i++) {
    const pane = panes().find(match);
    if (pane) return pane;
    await new Promise((r) => cx.timer.after(100, () => r()));
  }
  return null;
}

/** A form button, the primary one filled. */
function formButton(t, id, text, primary, action) {
  return h_flex().id(id).h(30).px(12).items_center().rounded(7)
    .border_1().border_color(primary ? t.solid : t.input).bg(primary ? t.solid : t.raised)
    .text_color(primary ? t.solid_foreground : t.foreground).text_size(12.5).font_medium().cursor_pointer()
    .hover(s => s.opacity(0.88)).on_click(action).child(text);
}

/** Esc closes the overlay this copy is in. */
const closeOnEscape = (overlay) => (e, cx) => { if (e.key === "escape") { closeOverlay(overlay); cx.stop_propagation(); } };

// Another mod's button (a tab bar's) opens tode through this mod: an invisible popup of it with
// props {action: "open" | "open-tab" | "open-pane" | "open-window" | "settings"} does what the
// button here would and closes itself. Herdr's mod commands reach only shown copies, and this
// mod may have none.
export const ACTION = { kind: "popup", at: "pointer", frame: "none", width: 1, height: 1 };
export function actionOverlay(action = "open") {
  return { mod: "tode", props: { action }, ...ACTION };
}

// tode comes from terminal-code (VS Code in the terminal), installed with its own script.
export const TERMINAL_CODE = "https://github.com/zenbu-labs/terminal-code";
export const INSTALL = "curl -fsSL https://tode.sh/install | bash";
const MISSING = { width: 460, height: 268 };

/** tode's full path on that machine (null: this one), or null when it isn't installed.
 *  Rejects when the machine can't be asked. */
export async function findTode(machine) {
  const r = await exec("/bin/sh", ["-c", "command -v tode"], { on: machine });
  return r.stdout?.trim().split("\n")[0] || null;
}

/** The dialog that says tode isn't installed and how to install it. */
export function openMissing(machine) {
  openOverlay({ mod: "tode", props: { missing: true, machine }, kind: "dialog", width: MISSING.width, height: MISSING.height });
}

/** Key commands ("tode.open" in keys.json, or `herdr-app do tode.open`): open as set, or as named. */
export const COMMANDS = { "open": null, "open-tab": "tab", "open-pane": "pane", "open-window": "window" };

export default class Tode extends View {
  init(_props, cx) {
    switch (role()) {
      case "form": this.initSettings(cx); break;
      case "missing": this.handle = cx.focus_handle(); break;
      case "action": cx.spawn(async (cx) => {
        const { action, overlay } = props();
        // Closing this copy cancels its tasks: close only once the work is done.
        if (action === "settings") this.openSettings();
        else if (action in COMMANDS) await this.start(cx, COMMANDS[action] ?? undefined);
        closeOverlay(overlay);
      }); break;
      case "button": cx.spawn(async (cx) => {
        for (;;) {
          const c = await nextCommand();
          if (c in COMMANDS) this.open(cx, COMMANDS[c] ?? undefined);
        }
      }); break;
    }
  }

  // The popup window's title bar: closing tode closes the window.
  async close() {
    const terminal = role() === "titlebar" && !this.moved && props()?.terminal;
    if (!terminal || checking()) return;
    const at = reopening.get(terminal);
    if (at != null) { reopening.delete(terminal); if (Date.now() - at < 3000) return; }
    run("terminal.kill", { terminal });
  }

  // The settings form.
  initSettings(cx) {
    this.text = label();
    this.choice = mode();
    this.reuseChoice = reuse() ? "show" : "new";
    this.input = InputState.new({ value: this.text });
    this.input.set_selected_range({ start: 0, end: this.text.length });
    this.input.on("change", (_e, cx) => { this.text = this.input.value(); cx.notify(); });
    this.input.on("submit", () => this.save());
    this.inputFocused = true;
    this.input.on("focus", (_e, cx) => { this.inputFocused = true; cx.notify(); });
    this.input.on("blur", (_e, cx) => { this.inputFocused = false; cx.notify(); });
    this.input.focus();
    cx.timer.after(300, () => this.input.focus());
    this.handle = cx.focus_handle();
  }

  save() {
    saveLabel(this.text);
    saveMode(this.choice);
    saveReuse(this.reuseChoice);
    closeOverlay(props().overlay);
  }

  open(cx, how = mode()) {
    cx.spawn((cx) => this.start(cx, how));
  }

  /** What a click does, done when tode is shown or started. */
  async start(cx, how = mode()) {
    const f = focused();
    const machine = machineOf(f);
    // Already open for this folder: show that one.
    const open = reuse() && f?.space ? findOpen(f.space, f.cwd) : null;
    if (open) { this.show(open); return; }
    try {
      // tode's full path, as the person's shell finds it (~/.local/bin is often only on the
      // login shell's PATH, which exec has and herdr-core may not). Not there: how to install it.
      const program = await findTode(machine);
      if (!program) { openMissing(machine); return; }
      if (how === "window") {
        const r = await hc(hcArgs(program, f));
        const address = JSON.parse(r.stdout || "{}").address;
        if (!address) throw new Error((r.stderr || r.stdout || "no terminal").trim());
        openOverlay(windowSpec(address, f?.cwd ?? null));
        return;
      }
      // The new pane is named after the button and labelled: it is the one that wasn't there before.
      const before = new Set(panes().map((p) => p.pane));
      const name = label();
      run("terminal.open", openArgs(how, f));
      const pane = await waitForPane(cx, (p) => !before.has(p.pane) && p.terminal);
      if (!pane) return;
      run("pane.rename", { pane: pane.pane, name });
      if (!machine) await hc(["label", pane.terminal, `${TAG}=1`]).catch(() => null);
    } catch (e) {
      notify({ title: "tode didn't start", body: String(e?.message ?? e), level: "error" });
    }
  }

  /** Shows an open tode: its pane (and so its tab), or its popup window again. Opening the
   *  window's key again replaces the open window: its title bar must not end tode then. */
  show(open) {
    if (open.pane) { run("pane.focus", { pane: open.pane }); return; }
    reopening.set(open.terminal, Date.now());
    openOverlay(windowSpec(open.terminal, open.folder));
  }

  openSettings() {
    openOverlay({ mod: "tode", props: { settings: true }, kind: "popup", at: "pointer", width: FORM.width, height: FORM.height });
  }

  // The layout block is sized to the button: its id comes in props().block.
  fit(width) {
    const id = props()?.block;
    if (!id || checking()) return;
    const px = Math.ceil(width / (settings()?.zoom || 1));
    const now = find(layout(), id)?.size?.px;
    if (now == null || Math.abs(now - px) > 1) run("layout.resize", { id, px });
  }

  render() {
    switch (role()) {
      case "titlebar": return this.renderTitlebar();
      case "missing": return this.renderMissing();
      case "action": return div().id("tode-action");
      case "form": return this.renderSettings();
      default: return this.renderBar();
    }
  }

  renderBar() {
    const t = theme();
    const button = h_flex().id("tode-open").h(26).px(8).gap(5).flex_none().items_center().rounded(6)
      .text_size(12).bg(t.chrome).text_color(t.muted).cursor_pointer()
      .hover(s => s.bg(t.hover).text_color(t.foreground))
      .tooltip(`Open tode in ${MODES.find((m) => m.id === mode()).name.toLowerCase()}. Right-click for settings.`)
      .on_mouse_down("left", stop).on_click((_e, cx) => this.open(cx))
      .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); this.openSettings(); })
      .child(svg("mods/tode/icon.svg").size(14)).child(label());
    return h_flex().id("tode-root").size_full().items_center().bg(t.chrome).border_b(1).border_color(t.border)
      .child(h_flex().id("tode-content").flex_none().h_full().pr(10).items_center()
        .on_size_change((size) => this.fit(size.width))
        .child(button));
  }

  // The dialog for when tode isn't installed.
  install() {
    const p = props();
    closeOverlay(p.overlay);
    // In a tab of the focused space, so on its machine; the shell stays open to show how it went.
    run("terminal.open", { argv: ["/bin/sh", "-c", INSTALL], place: "tab", name: "Install terminal-code" });
  }

  copy(cx) {
    const put = 'printf %s "$1" | pbcopy 2>/dev/null || printf %s "$1" | wl-copy 2>/dev/null || printf %s "$1" | xclip -selection clipboard';
    cx.spawn(async (cx) => {
      const r = await exec("/bin/sh", ["-c", put, "sh", INSTALL]).catch(() => null);
      this.copied = r?.code === 0 ? "Copied" : "Couldn't copy";
      cx.notify();
    });
  }

  renderMissing() {
    const t = theme();
    const p = props() ?? {};
    const para = (text) => div().pt(10).text_size(12.5).text_color(t.muted).child(text);
    const where = p.machine ? ` on ${p.machine}` : "";
    return v_flex().id("tode-missing").track_focus(this.handle).on_key_down(closeOnEscape(p.overlay))
      .size_full().p(18).bg(t.popover).text_color(t.foreground)
      .child(h_flex().items_center().gap(8)
        .child(image("mods/tode/icon-color.svg").size(18))
        .child(div().flex_1().text_size(15).font_semibold().child(`terminal-code isn't installed${where}`))
        .child(div().text_size(11).text_color(t.dim).child("Esc")))
      .child(para(`The ${label()} button runs tode, from terminal-code: VS Code inside your terminal. Install it once (macOS and Linux) with:`))
      .child(h_flex().mt(10).h(36).px(10).gap(8).items_center().rounded(8).border_1().border_color(t.input).bg(t.background)
        .child(div().flex_1().min_w(0).truncate().text_size(12.5).font_family(settings()?.font_family ?? "JetBrains Mono").child(INSTALL))
        .child(div().id("tode-copy").flex_none().text_size(11.5).text_color(t.dim).cursor_pointer()
          .hover(s => s.text_color(t.foreground)).on_click((_e, cx) => this.copy(cx)).child(this.copied ?? "Copy")))
      .child(para("Install in a new tab runs it for you; the tab stays open to show how it went. Then click the button again."))
      .child(div().flex_1())
      .child(h_flex().pt(14).gap(8).items_center()
        .child(div().id("tode-github").text_size(12).text_color(t.accent).cursor_pointer().hover(s => s.opacity(0.8))
          .on_click(() => exec("/bin/sh", ["-c", 'open "$1" 2>/dev/null || xdg-open "$1"', "sh", TERMINAL_CODE]).catch(() => null))
          .child("terminal-code on GitHub"))
        .child(div().flex_1())
        .child(formButton(t, "tode-missing-close", "Close", false, () => closeOverlay(p.overlay)))
        .child(formButton(t, "tode-install", "Install in a new tab", true, () => this.install())));
  }

  /** The popup's tode moves into a new tab or a pane beside the focused one: Herdr gives the
   *  terminal a pane (terminal.keep), the pane (and a new tab) gets the button's name, and the
   *  window closes without ending tode. */
  move(cx, place) {
    const p = props();
    if (this.moving) return;
    this.moving = true;
    const name = label();
    run("terminal.keep", { terminal: p.terminal, place });
    cx.spawn(async (cx) => {
      const pane = await waitForPane(cx, (x) => x.terminal === p.terminal);
      this.moving = false;
      // No pane (Herdr refused): the window stays, with tode in it.
      if (!pane) { notify({ title: "tode didn't move", body: "Herdr gave it no pane.", level: "error" }); return; }
      run("pane.rename", { pane: pane.pane, name });
      if (place === "tab") run("tab.rename", { id: pane.tab, name });
      this.moved = true;
      closeOverlay(p.overlay);
    });
  }

  renderTitlebar() {
    const t = theme();
    const p = props() ?? {};
    const folder = String(p.folder ?? "").replace(/^\/(Users|home)\/[^/]+/, "~");
    const icon = (id, path, tip, action) => div().id(id).size(22).flex_none().flex().items_center().justify_center().rounded(6)
      .cursor_pointer().hover(s => s.bg(t.hover).text_color(t.foreground)).tooltip(tip)
      .on_mouse_down("left", stop).on_click(action)
      .child(path ? svg(path).size(14) : "×");
    return h_flex().id("tode-titlebar").size_full().px(10).gap(8).items_center()
      .bg(t.chrome).border_b(1).border_color(t.border).text_color(t.muted).text_size(12)
      .child(image("mods/tode/icon-color.svg").size(14))
      .child(div().font_medium().text_color(t.foreground).child(label()))
      .child(div().flex_1().min_w(0).truncate().text_color(t.dim).child(folder))
      .child(icon("tode-to-tab", "mods/tode/to-tab.svg", "Move to a new tab", (_e, cx) => this.move(cx, "tab")))
      .child(icon("tode-to-pane", "mods/tode/to-pane.svg", "Move to a pane beside the focused one", (_e, cx) => this.move(cx, "right")))
      .child(icon("tode-close", null, "Close tode", () => run("terminal.kill", { terminal: p.terminal })));
  }

  renderSettings() {
    const t = theme();
    const p = props() ?? {};
    const segmented = (key, options, chosen, pick) => h_flex().h(32).p(2).gap(2).rounded(8).border_1().border_color(t.input).bg(t.background)
      .children(options.map((m) => {
        const on = chosen === m.id;
        return h_flex().id(`tode-${key}-${m.id}`).flex_1().h_full().items_center().justify_center().rounded(6)
          .text_size(12).cursor_pointer().bg(on ? t.selected : t.background).text_color(on ? t.foreground : t.muted)
          .when(on, el => el.font_medium()).hover(s => s.bg(on ? t.selected : t.hover).text_color(t.foreground))
          .on_click((_e, cx) => { pick(m.id); cx.notify(); })
          .child(m.name);
      }));
    return v_flex().id("tode-form").track_focus(this.handle).on_key_down(closeOnEscape(p.overlay))
      .size_full().p(16).bg(t.popover).text_color(t.foreground)
      .child(h_flex().items_center().gap(8)
        .child(svg("mods/tode/icon.svg").size(16).text_color(t.muted))
        .child(div().flex_1().text_size(14).font_semibold().child("tode button"))
        .child(div().text_size(11).text_color(t.dim).child("Esc")))
      .child(div().pt(14).pb(6).text_size(11.5).text_color(t.dim).child("Button name"))
      .child(Input.new(this.input).h(34).px(10).rounded(8).border_1()
        .border_color(this.inputFocused ? t.accent : t.input).bg(t.background).text_size(12.8).text_color(t.foreground))
      .child(div().pt(6).text_size(11.5).text_color(t.dim).child(`Empty: ${DEFAULT_LABEL}.`))
      .child(div().pt(14).pb(6).text_size(11.5).text_color(t.dim).child("Open tode in"))
      .child(segmented("mode", MODES, this.choice, (id) => { this.choice = id; }))
      .child(div().pt(12).pb(6).text_size(11.5).text_color(t.dim).child("When tode is already open for the folder"))
      .child(segmented("reuse", REUSES, this.reuseChoice, (id) => { this.reuseChoice = id; }))
      .child(h_flex().pt(14).gap(8).justify_end()
        .child(formButton(t, "tode-cancel", "Cancel", false, () => closeOverlay(p.overlay)))
        .child(formButton(t, "tode-save", "Save", true, () => this.save())));
  }
}
