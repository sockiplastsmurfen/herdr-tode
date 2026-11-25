// tode: a button that opens `tode` (terminal code) in the focused terminal's folder: in a new
// tab (default), a new pane beside it, or a popup window. A right-click on it opens the settings
// (the button's name and where tode opens). Opened as an overlay (that right-click, or
// `mod.open tode`), the same mod is that settings form; with props {titlebar} it is the
// popup window's title bar.
import { View, div, svg, image } from "gpui-kit";
import { h_flex, v_flex, InputState, Input } from "gpui-base";
import { run, nextCommand, focused, panes, theme, shared, setShared, props, layout, settings, spaces, openOverlay, closeOverlay, notify, checking, exec, hc, appHome } from "herdr";

export const DEFAULT_LABEL = "VSCode";
export const LABEL_KEY = "tode.label";
export const MODE_KEY = "tode.open";
export const COMMAND = ["tode"];
/** Where tode opens; the first is the default. */
export const MODES = [
  { id: "tab", name: "New tab" },
  { id: "pane", name: "New pane" },
  { id: "window", name: "Popup window" },
];
const FORM = { width: 340, height: 264 };

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

/** terminal.open's arguments for a tab or a pane, in the focused terminal's folder. A pane opens
 *  to the right of the focused one; with no pane focused (a layout terminal block) it is a tab.
 *  A tab is named after the button (`name` names only a tab; panes are renamed once they exist). */
export function openArgs(how = "tab", f = focused()) {
  const place = how === "pane" && f?.pane ? "right" : "tab";
  // The script is on this computer; on another machine tode starts as it is.
  const remote = spaces().find((s) => s.id === f?.space)?.machine;
  const argv = remote ? COMMAND : [`${appHome()}/${TITLE_SCRIPT}`, label()];
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
// size to settle, and tode starts; at the latest after 3 s.
export const WAIT_FOR_WINDOW = [
  'p="$1"; was=$(stty size 2>/dev/null); i=0',
  'while [ $i -lt 60 ] && [ "$(stty size 2>/dev/null)" = "$was" ]; do sleep 0.05; i=$((i+1)); done',
  'sleep 0.3; exec "$p"',
].join("; ");

/** hc's arguments for tode in a popup window: a terminal of its own, outside Herdr's tabs,
 *  removed when it exits, on the focused space's machine. */
export function hcArgs(program, f = focused()) {
  const machine = spaces().find((s) => s.id === f?.space)?.machine ?? null;
  return ["run", "--json", "--bg", "--rm", "--no-parent",
    ...(machine ? ["--on", machine] : []), ...(f?.cwd ? ["--cwd", f.cwd] : []),
    "--", "/bin/sh", "-c", WAIT_FOR_WINDOW, "tode", program];
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
const isBar = () => Boolean(props()?.titlebar);
const isForm = () => !isBar() && Boolean(props()?.settings || props()?.overlay);

/** Key commands ("tode.open" in keys.json, or `herdr-app do tode.open`): open as set, or as named. */
export const COMMANDS = { "open": null, "open-tab": "tab", "open-pane": "pane", "open-window": "window" };

export default class Tode extends View {
  init(_props, cx) {
    if (isForm()) this.initSettings(cx);
    else if (!isBar()) cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c in COMMANDS) this.open(cx, COMMANDS[c] ?? undefined);
      }
    });
  }

  // The popup window's title bar: closing tode closes the window.
  async close() {
    const terminal = isBar() && props()?.terminal;
    if (terminal && !checking()) run("terminal.kill", { terminal });
  }

  // The settings form.
  initSettings(cx) {
    this.text = label();
    this.choice = mode();
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
    closeOverlay(props().overlay);
  }

  open(cx, how = mode()) {
    if (how !== "window") {
      // The new pane is named after the button too: it is the one that wasn't there before.
      const before = new Set(panes().map((p) => p.pane));
      const name = label();
      run("terminal.open", openArgs(how));
      cx.spawn(async (cx) => {
        for (let i = 0; i < 30; i++) {
          const pane = panes().find((p) => !before.has(p.pane) && p.terminal);
          if (pane) { run("pane.rename", { pane: pane.pane, name }); return; }
          await new Promise((r) => cx.timer.after(100, () => r()));
        }
      });
      return;
    }
    const f = focused();
    cx.spawn(async () => {
      try {
        // The program's full path, as the person's shell finds it (~/.local/bin is often only
        // on the login shell's PATH, which exec has and herdr-core may not).
        const machine = spaces().find((s) => s.id === f?.space)?.machine ?? null;
        const found = await exec("/bin/sh", ["-c", "command -v tode"], { on: machine }).catch(() => null);
        const program = found?.stdout?.trim().split("\n")[0] || COMMAND[0];
        const r = await hc(hcArgs(program, f));
        const address = JSON.parse(r.stdout || "{}").address;
        if (!address) throw new Error((r.stderr || r.stdout || "no terminal").trim());
        openOverlay(windowSpec(address, f?.cwd ?? null));
      } catch (e) {
        notify({ title: "tode didn't start", body: String(e?.message ?? e), level: "error" });
      }
    });
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
    return isBar() ? this.renderTitlebar() : isForm() ? this.renderSettings() : this.renderBar();
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

  renderTitlebar() {
    const t = theme();
    const p = props() ?? {};
    const folder = String(p.folder ?? "").replace(/^\/(Users|home)\/[^/]+/, "~");
    return h_flex().id("tode-titlebar").size_full().px(10).gap(8).items_center()
      .bg(t.chrome).border_b(1).border_color(t.border).text_color(t.muted).text_size(12)
      .child(image("mods/tode/icon-color.svg").size(14))
      .child(div().font_medium().text_color(t.foreground).child(label()))
      .child(div().flex_1().min_w(0).truncate().text_color(t.dim).child(folder))
      .child(div().id("tode-close").size(22).flex_none().flex().items_center().justify_center().rounded(6)
        .cursor_pointer().hover(s => s.bg(t.hover).text_color(t.foreground)).tooltip("Close tode")
        .on_mouse_down("left", stop).on_click(() => run("terminal.kill", { terminal: p.terminal }))
        .child("×"));
  }

  renderSettings() {
    const t = theme();
    const p = props() ?? {};
    const btn = (id, text, primary, action) => h_flex().id(id).h(30).px(12).items_center().rounded(7)
      .border_1().border_color(primary ? t.solid : t.input).bg(primary ? t.solid : t.raised)
      .text_color(primary ? t.solid_foreground : t.foreground).text_size(12.5).font_medium().cursor_pointer()
      .hover(s => s.opacity(0.88)).on_click(action).child(text);
    return v_flex().id("tode-form").track_focus(this.handle)
      .on_key_down((e, cx) => { if (e.key === "escape") { closeOverlay(p.overlay); cx.stop_propagation(); } })
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
      .child(h_flex().h(32).p(2).gap(2).rounded(8).border_1().border_color(t.input).bg(t.background)
        .children(MODES.map((m) => {
          const on = this.choice === m.id;
          return h_flex().id(`tode-mode-${m.id}`).flex_1().h_full().items_center().justify_center().rounded(6)
            .text_size(12).cursor_pointer().bg(on ? t.selected : t.background).text_color(on ? t.foreground : t.muted)
            .when(on, el => el.font_medium()).hover(s => s.bg(on ? t.selected : t.hover).text_color(t.foreground))
            .on_click((_e, cx) => { this.choice = m.id; cx.notify(); })
            .child(m.name);
        })))
      .child(h_flex().pt(14).gap(8).justify_end()
        .child(btn("tode-cancel", "Cancel", false, () => closeOverlay(p.overlay)))
        .child(btn("tode-save", "Save", true, () => this.save())));
  }
}
