# tode

A button at the right end of the tab bar that opens `tode` (terminal code) in a new pane
beside the focused terminal, in its folder. It says **VSCode** with a small VS Code-style
icon in the tab bar's icon color; a right-click on it renames it.

![tode](preview.png)

## What you see

- At the right of the 42px tab-bar row, a block as wide as its content: background `chrome`,
  a 1px `border` line at the bottom (it continues the tab bar's).
- In it, the button (26px high, 8px side padding, radius 6, 12px text in `muted`; on hover
  `hover` background and `foreground` text) with a 14px icon and the name. 10px to the right
  edge. Tooltip: "Open tode beside the focused terminal. Right-click to rename."
- The icon (`icon.svg`, 24×24, `fill="currentColor"`, tinted with `svg()` like the tab bar's
  other icons): a vertical bar on the right (opacity 0.8), and two bands from its top and bottom
  ends crossing to the left, the upper one (opacity 1) over the lower one (opacity 0.55). Drawn
  from scratch; not the VS Code logo file.
- The form, a 300×196 popup: `popover` background, 16px padding; a header row with the icon,
  (in `muted`), "tode button" (14px semibold) and "Esc" (`dim`); "Button name" (11.5px `dim`); a 34px input
  (radius 8, `background`, border `input`, `accent` while focused); the hint "Empty: VSCode.
  Runs tode in a new pane."; Cancel (`raised`/`input`) and Save (`solid`/`solid_foreground`)
  at the bottom right.

## How it behaves

- Click the button: `terminal.open {argv: ["tode"], place: "right", folder: focused().cwd}`.
  With no focused pane (`focused().pane` null), `place: "tab"`. Without a cwd, no folder.
- Right-click the button (`on_mouse_down("right")`, propagation stopped): `openOverlay({mod: "tode", props: {settings: true}, kind: "popup",
  at: "pointer", width: 300, height: 196})`. `mod.open tode` opens the same form (mod.json's
  `overlay`): the mod draws the form whenever `props().settings` or `props().overlay` is set.
- In the form the current name is selected and focused. Enter or Save saves (trimmed) and
  closes; Esc or Cancel closes. Empty, or "VSCode", saves `null`.
- The name is `shared("tode.label")`, persisted by Herdr; the bar re-renders when it changes.
- Presses on the buttons stop propagation, so the block can be `window_drag` elsewhere.
- The block resizes itself: the content row (`flex_none`) reports its width with
  `on_size_change`; divided by `settings().zoom` and rounded up, it is sent as
  `layout.resize {id: props().block, px}` when it differs from the block's size by more than 1px.
  Not during `checking()`.

## Built from

- `mods/tode/`: `main.js` (one View, bar or form by props), `mod.json`
  (`place: "none"`, an overlay of 300×196), `icon.svg`.
- Layout: the tab bar block becomes the first child (weight 1) of a 42px row; the second child
  is `{"id": "tode", "content": {"mod": "tode", "props": {"block": "tode"}}, "window_drag": true}`.
- The tab bar block keeps its own right padding (10px in Herdr's), so the gap before this button
  is a little wider than between the tab bar's buttons. A negative margin would close it but
  clip the button's hover background and click area at the block's edge.
- herdr: `run`, `focused`, `theme`, `shared`, `setShared`, `props`, `layout`, `settings`,
  `openOverlay`, `closeOverlay`, `checking`. gpui-base: `InputState`, `Input`, `h_flex`, `v_flex`.

## Watch out

- `pane.split` has no folder argument; `terminal.open` with `place: "right"` does.
- `tode` runs through the person's interactive shell, so `~/.local/bin` on its PATH is enough.
- A fixed block width cuts off long names; the self-resizing needs `props.block`.
- Don't keep a `cx`: the size handler only calls `run`.

## Done when

- `herdr-app check mods/tode` passes and `npm test` passes.
- The tab bar shows the icon and "VSCode" at its right end, in the same colors as its other buttons.
- Clicking the button opens a pane to the right running `tode` in the focused terminal's folder.
- Renaming in the right-click form changes the button at once, the block widens or narrows to fit,
  and the name is still there after restarting Herdr.
