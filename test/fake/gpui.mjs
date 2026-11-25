// A fake of gpui-kit and gpui-base: every builder method returns its element, which keeps its
// tag, id, children and handlers, so a test can render a view and find and click things.
function el(tag) {
  const e = { tag, kids: [], on: {}, id: null };
  const api = new Proxy(e, {
    get(_o, k) {
      if (k === "__el") return e;
      if (k === "child") return (c) => { if (c == null) throw new Error(`null child in ${tag}`); e.kids.push(c); return api; };
      if (k === "children") return (cs) => { for (const c of cs) e.kids.push(c); return api; };
      if (k === "when") return (c, f) => (c ? f(api) : api);
      if (k === "hover") return (f) => { f(api); return api; };
      if (k === "id") return (x) => { e.id = x; return api; };
      if (typeof k === "string" && k.startsWith("on_")) return (a, b) => { e.on[typeof a === "string" ? `${k}:${a}` : k] = typeof a === "function" ? a : b; return api; };
      return () => api;
    },
  });
  return api;
}

export const div = () => el("div"), svg = (p) => el(`svg:${p}`), image = (p) => el(`img:${p}`);
export const v_flex = () => el("v"), h_flex = () => el("h");

class State {
  constructor(o) { this.v = o?.value ?? ""; this.handlers = {}; }
  static new(o) { return new State(o); }
  value() { return this.v; }
  set_value(v) { this.v = v; }
  set_selected_range() {}
  on(event, handler) { this.handlers[event] = handler; return true; }
  /** A test types: sets the value and runs the change handler. */
  type(v, cx) { this.v = v; this.handlers.change?.({}, cx); }
  submit(cx) { this.handlers.submit?.({}, cx); }
  focus() {}
}
export const InputState = State;
export const Input = { new: () => el("input") };
export class View {}
