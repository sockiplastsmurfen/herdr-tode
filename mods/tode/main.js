// tode: a button that opens `tode` (terminal code) in a new pane beside the focused terminal,
// in that terminal's folder. A right-click on it names the button. Opened as an overlay (that
// right-click, or `mod.open tode`), the same mod is that settings form.
import { View, div, svg } from "gpui-kit";
import { h_flex, v_flex, InputState, Input } from "gpui-base";
import { run, focused, theme, shared, setShared, props, layout, settings, openOverlay, closeOverlay, checking } from "herdr";

export const DEFAULT_LABEL = "VSCode";
export const LABEL_KEY = "tode.label";
export const COMMAND = ["tode"];
const FORM = { width: 300, height: 196 };

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

/** The command that opens tode for what is focused now: a pane to the right in the
 *  focused terminal's folder, or a new tab when no pane is focused (a layout terminal block). */
export function openArgs(f = focused()) {
  const args = { argv: COMMAND, place: f?.pane ? "right" : "tab" };
  if (f?.cwd) args.folder = f.cwd;
  return args;
}

function find(node, id) {
  if (!node) return null;
  if (node.id === id) return node;
  for (const c of node.children ?? []) { const hit = find(c, id); if (hit) return hit; }
  return null;
}

const stop = (_e, cx) => cx.stop_propagation();
const isForm = () => Boolean(props()?.settings || props()?.overlay);

export default class Tode extends View {
  init(_props, cx) {
    if (isForm()) this.initSettings(cx);
  }

  // The settings form.
  initSettings(cx) {
    this.text = label();
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
    closeOverlay(props().overlay);
  }

  open() {
    run("terminal.open", openArgs());
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
    return isForm() ? this.renderSettings() : this.renderBar();
  }

  renderBar() {
    const t = theme();
    const button = h_flex().id("tode-open").h(26).px(8).gap(5).flex_none().items_center().rounded(6)
      .text_size(12).bg(t.chrome).text_color(t.muted).cursor_pointer()
      .hover(s => s.bg(t.hover).text_color(t.foreground))
      .tooltip(`Open tode beside the focused terminal. Right-click to rename.`)
      .on_mouse_down("left", stop).on_click(() => this.open())
      .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); this.openSettings(); })
      .child(svg("mods/tode/icon.svg").size(14)).child(label());
    return h_flex().id("tode-root").size_full().items_center().bg(t.chrome).border_b(1).border_color(t.border)
      .child(h_flex().id("tode-content").flex_none().h_full().pr(10).items_center()
        .on_size_change((size) => this.fit(size.width))
        .child(button));
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
      .child(div().pt(6).text_size(11.5).text_color(t.dim).child(`Empty: ${DEFAULT_LABEL}. Runs tode in a new pane.`))
      .child(h_flex().pt(14).gap(8).justify_end()
        .child(btn("tode-cancel", "Cancel", false, () => closeOverlay(p.overlay)))
        .child(btn("tode-save", "Save", true, () => this.save())));
  }
}
