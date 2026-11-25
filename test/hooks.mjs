// The mod's imports of Herdr's modules go to the fakes. Synchronous, so it serves both
// module.registerHooks and module.register.
const fake = (name) => new URL(`./fake/${name}`, import.meta.url).href;

export function resolve(specifier, context, next) {
  if (specifier === "gpui-kit" || specifier === "gpui-base") return { url: fake("gpui.mjs"), shortCircuit: true };
  if (specifier === "herdr") return { url: fake("herdr.mjs"), shortCircuit: true };
  return next(specifier, context);
}
