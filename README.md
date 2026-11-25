# tode for Herdr

A [Herdr](https://herdr.dev) mod: a button in the tab bar that opens
[`tode`](#requirements) (terminal code) in a new pane beside the focused terminal, in that
terminal's folder.

![The button in the tab bar](preview.png)

- **The button** says **VSCode** by default, with a small blue icon in the style of VS Code's
  (drawn for this mod; it is not Microsoft's logo file). Click it: a terminal pane opens to
  the right of the focused pane, in its folder, running `tode`. Closing `tode` closes the pane.
  If no pane is focused (a terminal shown outside a tab), it opens in a new tab instead.
- **The gear** beside it opens a small form to name the button. **Save** (or Enter) keeps the
  name, **Cancel** (or Esc) doesn't; an empty name goes back to **VSCode**. The name is kept in
  Herdr's shared state (`shared("tode.label")`), so it is still there after a restart, and other
  mods can show it too. `mod.open tode` (or the command palette) opens the same form.
- **Theme colors** throughout: the bar uses `chrome`, `border`, `muted`, `hover`; the form
  `popover`, `input`, `accent`, `solid`. Only the icon has its own blue.
- **Its block fits the button**: the mod measures its content and resizes its layout block
  (`layout.resize`) when the name changes.

![The settings form](screenshots/settings.png)

## Requirements

`tode` on your `PATH` as your login shell sees it (for example `~/.local/bin/tode`). Herdr starts
the command in your interactive shell, so it finds what your shell finds. If `tode` is missing,
Herdr shows a toast with the exit code.

## Install

Tell your agent in Herdr:

```
Read ~/.config/herdr-app/AGENTS.md, then add this mod: github.com/sockiplastsmurfen/herdr-tode
```

Or by hand:

```sh
cp -R mods/tode ~/.config/herdr-app/mods/tode
herdr-app check ~/.config/herdr-app/mods/tode
```

Then put it in your layout, to the right of the tab bar. In a layout like Herdr's `main`, turn
the `tabs` block into a row with it (Herdr's shipped layouts are read-only: clone one first with
`herdr-app do layout.clone '{"name":"main","as":"my-main"}'`):

```json
{ "id": "tabs-row", "type": "row", "size": { "px": 42 }, "resizable": false, "children": [
  { "id": "tabs", "type": "block", "size": { "weight": 1 }, "window_drag": true, "content": { "mod": "tabs" } },
  { "id": "tode", "type": "block", "size": { "px": 120 }, "window_drag": true,
    "content": { "mod": "tode", "props": { "block": "tode" } } } ] }
```

`props.block` is the block's own id: the mod resizes that block to fit the button. Leave it out
to keep a fixed width.

The mod runs one program, `tode`, through Herdr's `terminal.open`. It doesn't reach the network
or read files.

[RECIPE.md](RECIPE.md) describes the mod for an agent that builds it from scratch.

## Tests

```sh
npm test
```

Node 20.6 or later, no dependencies. A module hook gives the mod's imports of Herdr's modules
fakes (`test/fake/gpui.mjs` keeps what a view draws so a test can find and click things,
`test/fake/herdr.mjs` the shared state, focus and layout Herdr would report, and records the
commands the mod runs).
