// A fake of Herdr's module: what the app would report, and a record of what the mod asked of it.
// Key commands for the mod: a test pushes one with command(name).
const waiting = [];
export const state = {
  shared: {}, focused: null, props: {}, layout: { id: "root", children: [{ id: "tode", size: { px: 120 } }] },
  zoom: 1, ran: [], overlays: [], closed: [], notes: [], spaces: [], hc: [], execs: [],
  hcAnswer: { stdout: '{"address":"t9","state":"live"}', stderr: "" }, which: "/home/me/.local/bin/tode\n",
};
export const reset = (over = {}) => (waiting.length = 0, Object.assign(state, { shared: {}, focused: null, props: {}, ran: [], overlays: [], closed: [], notes: [], spaces: [], hc: [], execs: [], zoom: 1,
  hcAnswer: { stdout: '{"address":"t9","state":"live"}', stderr: "" }, which: "/home/me/.local/bin/tode\n" }, over));

export const theme = () => new Proxy({}, { get: (_o, k) => `#${String(k)}` });
export const shared = (k) => state.shared[k] ?? null;
export const setShared = (k, v) => { state.shared[k] = v; return null; };
export const focused = () => state.focused;
export const props = () => state.props;
export const layout = () => state.layout;
export const settings = () => ({ zoom: state.zoom });
export const checking = () => false;
export const run = (name, args) => { state.ran.push({ name, args }); return null; };
export const openOverlay = (spec) => { state.overlays.push(spec); return `o${state.overlays.length}`; };
export const closeOverlay = (id) => { state.closed.push(id); return null; };
export const spaces = () => state.spaces;
export const notify = (n) => { state.notes.push(n); return "n1"; };
export const exec = async (cmd, args, opts) => { state.execs.push({ cmd, args, opts }); return { stdout: state.which, stderr: "", code: 0 }; };
export const hc = async (args) => { state.hc.push(args); return state.hcAnswer; };
export const nextCommand = () => new Promise((r) => waiting.push(r));
export const command = (name) => waiting.shift()?.(name);
