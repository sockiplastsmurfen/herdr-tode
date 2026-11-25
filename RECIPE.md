# tode

A button at the right end of the tab bar that opens `tode` (terminal code) in the focused
terminal's folder: in a new tab (default), a new pane beside it, or a popup window. It says
**VSCode** with a small VS Code-style icon in the tab bar's icon color; a right-click on it opens
its settings: the name and where tode opens.

![tode](preview.png)

## What you see

- At the right of the 42px tab-bar row, a block as wide as its content: background `chrome`,
  a 1px `border` line at the bottom (it continues the tab bar's).
- In it, the button (26px high, 8px side padding, radius 6, 12px text in `muted`; on hover
  `hover` background and `foreground` text) with a 14px icon and the name. 10px to the right
  edge. Tooltip: "Open tode in new tab. Right-click for settings." (the chosen place, lowercase).
- The icon (`icon.svg`, 24×24, `fill="currentColor"`, tinted with `svg()` like the tab bar's
  other icons): a vertical bar on the right (opacity 0.8), and two bands from its top and bottom
  ends crossing to the left, the upper one (opacity 1) over the lower one (opacity 0.55). Drawn
  from scratch; not the VS Code logo file.
- The form, a 340×264 popup: `popover` background, 16px padding; a header row with the icon
  (in `muted`), "tode button" (14px semibold) and "Esc" (`dim`); "Button name" (11.5px `dim`); a 34px input
  (radius 8, `background`, border `input`, `accent` while focused); the hint "Empty: VSCode.";
  "Open tode in" and a 32px segmented control (border `input`, `background`; three equal
  segments New tab / New pane / Popup window, 12px; the chosen one `selected` and `foreground`,
  medium, the others `muted`, `hover` on hover); Cancel (`raised`/`input`) and Save
  (`solid`/`solid_foreground`) at the bottom right.
- The popup window: 72% × 78% of the app, centered. A 32px title bar (`chrome`, `border` line at
  the bottom, 10px padding, 12px `muted`): the blue icon (`image`), the button's name (medium,
  `foreground`), the folder
  with the home folder as `~` (`dim`, truncated), and a 22px × (`hover` on hover). Under it the
  terminal.

## How it behaves

- Click the button, by `shared("tode.open")` (`"tab"` default, `"pane"`, `"window"`):
  - tab: `terminal.open {argv: [appHome() + "/mods/tode/tode-title", label], place: "tab",
    folder: focused().cwd, name: label}` (`name` names the tab).
  - pane: the same with `place: "right"` and no `name`; with no focused pane
    (`focused().pane` null) as a tab.
  - Both: the pane that wasn't in `panes()` before is renamed, `pane.rename {pane, name: label}`
    (looked for every 100 ms, up to 3 s). On another machine (the focused space's `machine`)
    argv is just `["tode"]`: the script is on this computer.
  - `tode-title` (executable): `printf '\033]2;%s\007' "$1"; shift; exec tode "$@"`.
  - window: `exec("/bin/sh", ["-c", "command -v tode"], {on: machine})` for the full path
    (`machine`: the focused space's), then `hc(["run", "--json", "--bg", "--rm", "--no-parent",
    "--on", machine?, "--cwd", cwd?, "--", "/bin/sh", "-c", WAIT, "tode", path])`, then
    `openOverlay({kind: "window", key: "tode-<address>", width: 0.72, height: 0.78, layout:
    column[block 32px {mod: "tode", props: {titlebar: true, terminal, folder}}, block {terminal}]})`.
    × runs `terminal.kill`; the window closes when the terminal ends; the title bar's `close()`
    kills the terminal too (app quit, layout switch). Errors: `notify` level error.
  - Without a cwd, no folder in any of them.
- Right-click the button (`on_mouse_down("right")`, propagation stopped): `openOverlay({mod: "tode", props: {settings: true}, kind: "popup",
  at: "pointer", width: 340, height: 264})`. `mod.open tode` opens the same form (mod.json's
  `overlay`): the mod draws the form whenever `props().settings` or `props().overlay` is set.
- In the form the current name is selected and focused. Enter or Save saves the name (trimmed)
  and the place, and closes; Esc or Cancel closes. Empty, or "VSCode", saves `null`; New tab
  saves `null`.
- `shared("tode.label")` and `shared("tode.open")`, persisted by Herdr; the bar re-renders when
  they change.
- Key commands through `nextCommand()` on the bar copy: `open` (as set), `open-tab`,
  `open-pane`, `open-window`.
- Presses on the buttons stop propagation, so the block can be `window_drag` elsewhere.
- The block resizes itself: the content row (`flex_none`) reports its width with
  `on_size_change`; divided by `settings().zoom` and rounded up, it is sent as
  `layout.resize {id: props().block, px}` when it differs from the block's size by more than 1px.
  Not during `checking()`.

## Built from

- `mods/tode/`: `main.js` (one View: title bar with `props.titlebar`, form with
  `props.settings` or `props.overlay`, else the bar), `tode-title` (the title script),
  `icon-color.svg` (the blue icon: the same shapes as `icon.svg` in `#0a6fbf` lower band,
  `#0b5c9e` bar, `#2ea6f3` upper band), `mod.json`
  (`place: "none"`, an overlay of 340×264), `icon.svg`.
- Layout: the tab bar block becomes the first child (weight 1) of a 42px row; the second child
  is `{"id": "tode", "content": {"mod": "tode", "props": {"block": "tode"}}, "window_drag": true}`.
- The tab bar block keeps its own right padding (10px in Herdr's), so the gap before this button
  is a little wider than between the tab bar's buttons. A negative margin would close it but
  clip the button's hover background and click area at the block's edge.
- `programs.json` (Herdr's home): `"tode": {"name": "tode", "icon": "mods/tode/icon-color.svg",
  "tint": false, "match": ["tode-title", "Electron Helper"]}`, so tabs and pane headers show
  the blue icon.
- herdr: `run`, `nextCommand`, `focused`, `panes`, `appHome`, `theme`, `shared`, `setShared`, `props`, `layout`,
  `settings`, `spaces`, `openOverlay`, `closeOverlay`, `notify`, `checking`, `exec`, `hc`. gpui-base: `InputState`, `Input`, `h_flex`, `v_flex`.

## Watch out

- `pane.split` has no folder argument; `terminal.open` with `place: "right"` does.
- `tode` runs through the person's interactive shell for tabs and panes, so `~/.local/bin` on its
  PATH is enough. `hc run` doesn't use that shell: look the path up with `exec` (which has the
  person's PATH).
- tode asks the terminal whether it shows graphics (kitty) and how big it is as it starts. A
  terminal from `hc run` has nobody to answer until the window shows it, and tode quits with
  "Unsupported terminal". So WAIT is `p="$1"; was=$(stty size); i=0; while [ $i -lt 60 ] &&
  [ "$(stty size)" = "$was" ]; do sleep 0.05; i=$((i+1)); done; sleep 0.3; exec "$p"`: the
  size changes when the window attaches.
- `terminal.open`'s `name` names a tab, not a pane: rename the new pane with `pane.rename`.
- Some pane headers (herdr-nvim-header) show the terminal's title, not the pane's name, and tode
  sets no title (it shows the address, `t16s`): hence `tode-title`. Don't put `/bin/sh -c` first
  in argv: a tab starts through the person's shell, Herdr then names the program after the first
  word, and a shell (`sh`) always shows its own name and icon in headers.
- In a tab (through fish) Herdr names the program after what started it (`tode-title`); in a
  pane after the running process (`Electron Helper`). programs.json must match both.
- `pane.focus {terminal}` fails for a window's terminal ("no such pane"); don't call it.
- The title bar copy also gets `props().overlay`: test `titlebar` before treating `overlay` as
  the form.
- tode draws its window at its own size, not always filling the pane or popup (the same in a
  tab); that is tode, not the mod.
- A fixed block width cuts off long names; the self-resizing needs `props.block`.
- Don't keep a `cx`: the size handler only calls `run`.

## Done when

- `herdr-app check mods/tode` passes and `npm test` passes.
- The tab bar shows the icon and "VSCode" at its right end, in the same colors as its other buttons.
- New tabs and panes are named after the button, with the blue icon in the tab and the pane
  header, in Herdr's own `pane` header and in ones that show the title.
- Clicking the button opens `tode` in the focused terminal's folder in a new tab; set to New
  pane, in a pane to the right; set to Popup window, in a window with the title bar, and × or
  quitting tode closes it.
- Renaming in the right-click form changes the button at once, the block widens or narrows to fit,
  and the name and the place are still there after restarting Herdr.
