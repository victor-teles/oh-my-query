# Validation: plan 007, boards with shared inputs

Date: 2026-11-19. Branch `feat/launcher-002-shell`, uncommitted (on top of the uncommitted 001–006 work).

## Done criteria

| Criterion                                                | Result                  | Evidence                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Board window opens in front with no Dock icon            | PASS (desktop dev)      | Opened "Desk check" from the launcher (New Board, then from the root row). `lsappinfo` reports the app as `UIElement` (no Dock icon) and frontmost, the board as the app's `AXFocusedWindow`, and the focus policy logged `keep`                                                                                                     |
| Keyboard reaches a focused board                         | INCONCLUSIVE            | ⌘E did not toggle edit mode in two desktop attempts, but you were using Dia and Zeron at the same time, so the input was contested. A background (window-targeted) ⌘E did not toggle it either, which is not reliable evidence for a WKWebView. Launcher and board both use `window.activate()`. Needs a re-check on an idle desktop |
| Launcher hotkey while a board is focused                 | NOT VERIFIED ON DESKTOP | Browser test: the board forwards the chord as `toggleLauncher({ fromBoardId })`. `focus-policy.test.ts` covers the return-to-board decision                                                                                                                                                                                          |
| Closing all boards leaves the tray app                   | NOT VERIFIED ON DESKTOP | Policy test: with no open boards the app hides (`NSApp hide:`), it does not quit. Board windows release their RPC on close                                                                                                                                                                                                           |
| Shared date range re-runs only the two matching tiles    | PASS (browser, e2e)     | `board-view.browser.test.tsx`: 4 tiles, Period → YTD re-runs `w-revenue`, `w-signups` only (both motion branches). `e2e/board-flow.spec.ts`: board built through the launcher, opened by URL, range change re-runs exactly `w-orders` and `w-refunds` per `__omqIpcLog`                                                              |
| No `1m` refresh while minimized or hidden                | PASS (test only)        | `use-board-refresh.browser.test.tsx` advances 3 minutes with `visibilityState = "hidden"`: no runs, then one catch-up run on visible. Not observed in desktop dev; Electrobun has no minimize event, so this relies on WKWebView reporting `hidden`                                                                                  |
| Docs                                                     | PASS                    | README features and launcher/answers/boards shortcut tables (workspace tables removed, tech stack corrected), CLAUDE.md boards architecture, PRODUCT.md context/job/signature. `rg -n "Dynamic Island\|Tauri\|query tab" README.md CLAUDE.md PRODUCT.md` returns nothing                                                             |
| Tests, types, lint, e2e, coverage                        | PASS                    | `bun run test`: all workspaces green (app 779, core 250, rpc 38, agent 176, drivers). `check-types` 14/14. `bun run check` 0 errors apart from the git-excluded `.impeccable/hook.cache.json`. App coverage 94.65% lines. e2e 9/9                                                                                                    |
| Motion moments with reduced-motion branches              | PASS (code + tests)     | Staggered tile entrance, `layout="position"` reflow, lift (scale 1.02 + shadow) with 1:1 drag and `SPRING_MOMENTUM` settle, exit fade/scale, filter tint (600 ms, unmounts after), fresh-tile pulse, `SwapText` "Updated …", edit controls via `Reveal`. Browser tests run tint, pulse, edit mode and render in both branches        |
| Recordings 1× / 0.25×                                    | NOT RUN                 |                                                                                                                                                                                                                                                                                                                                      |
| Timelines trace, 12 tiles                                | NOT RUN                 | Also leaves the 12-tile/50 fps STOP condition unmeasured                                                                                                                                                                                                                                                                             |
| Reduce Motion / Transparency / Increase Contrast toggles | NOT RUN                 | Only the reduced-motion code path is tested                                                                                                                                                                                                                                                                                          |

## STOP conditions

- Accessory-app activation: not triggered. The board does come to the front and becomes the app's focused window without a Dock icon. The keyboard check above is still open.
- 12 recharts tiles below 50 fps: not measured.

## Found and fixed during validation

- The tile ⋯ menu was rendered inside the tile's `overflow-hidden` article, so on tiles shorter than the menu (~290 px, every KPI tile) its top items were clipped and unclickable. It now renders beside the article, sized with `actionsMenuHeight`, and the tile's wrapper rises while a menu is open (`has-[[role=menu]]:z-20`).
- The full-motion filter tint faded to opacity 0 but stayed mounted; it now unmounts when the fade ends.
- Stale shared values on refresh after a filter change: `refresh(tileIds, shared)` takes the new values explicitly.
- Lint: removed every suppression in new code, moved the IPC call log into the stub factory, replaced `getElementById` with a `findTileElement` helper, memoized the picker items.

## Left in your config

Desktop dev wrote a board named "Desk check" to `boards.enc` and one recent ask ("new boardDesk check", a read-only query on OMQ, sent when Enter landed on the Ask row).
