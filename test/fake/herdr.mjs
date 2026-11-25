// A fake of Herdr's module: what the app would report, and a record of what the mod asked of it.
export const state = {
  shared: {}, focused: null, props: {}, layout: { id: "root", children: [{ id: "tode", size: { px: 120 } }] },
  zoom: 1, ran: [], overlays: [], closed: [],
};
export const reset = (over = {}) => Object.assign(state, { shared: {}, focused: null, props: {}, ran: [], overlays: [], closed: [], zoom: 1 }, over);

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
