// The mod's imports of Herdr's modules go to the fakes (hooks.mjs): in-thread hooks where Node
// has them (22.15 and later), else the older module.register.
import * as module from "node:module";
import { resolve } from "./hooks.mjs";

if (module.registerHooks) module.registerHooks({ resolve });
else module.register("./hooks.mjs", import.meta.url);
