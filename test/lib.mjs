// Helpers: make a view as Herdr would, render it, find elements by id and click them.
import Tode from "../mods/tode/main.js";

export const cx = () => ({ notify() {}, stop_propagation() {}, focus_handle: () => ({ focus() {} }), timer: { after() {}, every() {} } });

export function make() {
  const v = new Tode();
  v.init({}, cx());
  return v;
}

export function find(node, id) {
  const e = node?.__el ?? node;
  if (!e || typeof e !== "object") return null;
  if (e.id === id) return e;
  for (const k of e.kids ?? []) { const hit = find(k, id); if (hit) return hit; }
  return null;
}

/** Every piece of text in what was drawn. */
export function texts(node) {
  const e = node?.__el ?? node;
  if (typeof e === "string") return [e];
  return (e?.kids ?? []).flatMap(texts);
}

export const click = (node, id) => {
  const e = find(node, id);
  if (!e) throw new Error(`no element ${id}`);
  e.on.on_click({}, cx());
};
