---
name: oh-my-query
description: Warm, native-calm database IDE — dark-first with an amber heartbeat.
colors:
  amber-primary: "oklch(0.9247 0.0524 66.1732)"
  amber-primary-deep: "oklch(0.4341 0.0392 41.9938)"
  warm-ink: "oklch(0.182 0.007 34.3)"
  warm-raised: "oklch(0.28 0.007 48.5)"
  warm-accent: "oklch(0.321 0.008 48.4)"
  warm-muted: "oklch(0.252 0.005 41)"
  warm-muted-text: "oklch(0.7699 0.005 41)"
  warm-cream: "oklch(0.9821 0.004 70)"
  warm-paper: "oklch(0.9911 0.003 70)"
  dark-border: "oklch(1 0 0 / 0.14)"
  light-border: "oklch(0.86 0.005 48.717)"
  foreground-dark: "oklch(0.9491 0.004 41)"
  foreground-light: "oklch(0.2435 0.005 41)"
  ring-focus: "oklch(0.9247 0.0524 66.1732)"
  destructive-red: "oklch(0.55 0.21 33)"
  warning-ember: "oklch(0.78 0.14 70)"
  success-moss: "oklch(0.72 0.15 145)"
  conn-honey: "oklch(0.78 0.11 75)"
  conn-denim: "oklch(0.65 0.09 235)"
  conn-moss: "oklch(0.68 0.07 145)"
  conn-plum: "oklch(0.62 0.09 310)"
  conn-clay: "oklch(0.7 0.12 35)"
  conn-stone: "oklch(0.6 0.02 80)"
  json-key: "oklch(0.78 0.1 60)"
  json-string: "oklch(0.78 0.09 135)"
  json-number: "oklch(0.8 0.13 40)"
  json-boolean: "oklch(0.84 0.14 70)"
typography:
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.028em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "-0.003em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "-0.003em"
  chrome:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "-0.028em"
  section-label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.022em"
  mono:
    fontFamily: "'JetBrains Mono Variable', ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "-0.003em"
    fontFeature: "'calt', 'liga' 0, 'zero', 'ss02'"
rounded:
  sm: "3.2px"
  md: "5.2px"
  lg: "7.2px"
  xl: "11.2px"
  pill: "9999px"
spacing:
  tight: "2px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  gutter: "24px"
components:
  button-primary:
    backgroundColor: "{colors.amber-primary}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "28px"
  button-primary-hover:
    backgroundColor: "{colors.amber-primary}"
    textColor: "{colors.warm-ink}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.warm-muted-text}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "28px"
  button-ghost-hover:
    backgroundColor: "{colors.warm-muted}"
    textColor: "{colors.foreground-dark}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.foreground-dark}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "28px"
  button-toolbar:
    backgroundColor: "transparent"
    textColor: "{colors.warm-muted-text}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "28px"
  input-default:
    backgroundColor: "{colors.warm-raised}"
    textColor: "{colors.foreground-dark}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
    height: "28px"
  input-focus:
    backgroundColor: "{colors.warm-raised}"
    textColor: "{colors.foreground-dark}"
  card-default:
    backgroundColor: "{colors.warm-raised}"
    textColor: "{colors.foreground-dark}"
    rounded: "{rounded.lg}"
    padding: "16px"
  tabs-trigger:
    backgroundColor: "transparent"
    textColor: "{colors.warm-muted-text}"
    rounded: "{rounded.md}"
    padding: "2px 6px"
  tabs-trigger-active:
    backgroundColor: "{colors.warm-raised}"
    textColor: "{colors.foreground-dark}"
    rounded: "{rounded.md}"
  dynamic-island:
    backgroundColor: "{colors.warm-ink}"
    textColor: "{colors.foreground-dark}"
    rounded: "{rounded.pill}"
    padding: "0 10px"
    height: "24px"
---

# Design System: oh-my-query

## 1. Overview

**Creative North Star: "The Amber Workshop"**

oh-my-query is a dark-first, keyboard-first database IDE built for developers who sit inside it for three-hour debugging sessions. The system feels like an evening workshop: warm amber under the task light, quiet neutrals everywhere else, tools that earn their place on the bench. Surfaces are flat and tonally layered — the kind of native-calm you feel in TablePlus, Postico, Things 3, Linear, and Arc. Vibrancy is real and physical, not decorative. Typography is tight and functional; density is the point, but every group breathes.

The amber accent is structural, not ornamental. It exists because long sessions need a single warm heartbeat to anchor trust — not because dark mode needs "pop". The Dynamic Island in the titlebar is the signature moment: a living status surface where connection health, query progress, and errors converge into one pill that users screenshot.

This system explicitly rejects: bureaucratic grey admin panels (DBeaver, phpMyAdmin, pgAdmin), the generic AI-tool aesthetic (purple/cyan gradients, neon on dark, sparkle icons, "✨ AI-powered" marketing voice), and the chatbot-drawer-bolted-onto-an-IDE pattern. It also rejects ambient typography choices that every other developer tool already made (Inter, IBM Plex, Space Grotesk, Fraunces, Instrument Sans).

**Key Characteristics:**

- Dark-first hero surface; light mode exists but is secondary
- Warm neutrals throughout — every grey tints toward 34–48° hue
- Amber primary used sparingly (focus rings, selected state, the Island at attention)
- Pro-density type scale (10–14px) with generous vertical rhythm between groups
- Real macOS vibrancy via `backdrop-blur-xl backdrop-saturate-200`, only where it earns its weight
- macOS system font (San Francisco via `-apple-system`) for UI, JetBrains Mono (variable, ligatures off) for SQL and data
- iOS-like springs for motion; `prefers-reduced-motion` respected fully

## 2. Colors

A palette of warm neutrals with a single amber accent. Every grey is tinted toward warm hues (34–48°) — there is no pure grey and no `#fff` / `#000` anywhere.

### Primary

- **Amber Heartbeat** (`oklch(0.9247 0.0524 66.1732)`): The signature accent. Appears on the focus ring, active selections, the primary button, and the Dynamic Island when it wants attention. In dark mode it reads as a pale warm amber against near-black; in light mode the primary role inverts to **Espresso** (`oklch(0.4341 0.0392 41.9938)`) — the same warm hue carried darker so it holds contrast on cream.

### Neutral

- **Warm Ink** (`oklch(0.182 0.007 34.3)`): The dark-mode hero background. Near-black tinted toward warm brown.
- **Warm Raised** (`oklch(0.28 0.007 48.5)`): Cards, popovers, input wells, tab-active backgrounds. One tonal step up from Warm Ink — this is how depth is built here, not shadows.
- **Warm Accent** (`oklch(0.321 0.008 48.4)`): Hover surfaces and secondary emphasis.
- **Warm Muted** (`oklch(0.252 0 0)`): Quiet container backgrounds for grouped controls.
- **Warm Muted Text** (`oklch(0.7699 0 0)`): Secondary text, labels, and idle icon color.
- **Warm Cream** (`oklch(0.9821 0 0)`): Light-mode background.
- **Warm Paper** (`oklch(0.9911 0 0)`): Light-mode cards and popovers.
- **Dark Border** (`oklch(1 0 0 / 0.14)`): Hairline dividers on dark — always translucent so they inherit the warm cast beneath.

### Status

- **Destructive Red** (`oklch(0.55 0.21 33)`): Destructive actions and error states. Shared across modes.
- **Warning Ember** (`oklch(0.78 0.14 70)` dark / `oklch(0.52 0.16 70)` light): Slow-running queries, attention banners.
- **Success Moss** (`oklch(0.72 0.15 145)` dark / `oklch(0.55 0.15 145)` light): Completed queries, healthy connection states.

### Connection Palette

A labeled set of six muted, hue-distinct swatches used only for tagging database connections so users can identify them at a glance in sidebars, the command palette, and the Dynamic Island.

- **Honey** `oklch(0.78 0.11 75)` · **Denim** `oklch(0.65 0.09 235)` · **Moss** `oklch(0.68 0.07 145)` · **Plum** `oklch(0.62 0.09 310)` · **Clay** `oklch(0.7 0.12 35)` · **Stone** `oklch(0.6 0.02 80)`

These are never used as chart colors or status indicators. They belong to connections only.

### Syntax & Data

- **JSON Key** `oklch(0.78 0.1 60)` · **JSON String** `oklch(0.78 0.09 135)` · **JSON Number** `oklch(0.8 0.13 40)` · **JSON Boolean** `oklch(0.84 0.14 70)`
- Result-table cell coloring uses these for typed values. Plain text stays on foreground.

### Named Rules

**The Warm-Neutral Rule.** Every neutral carries 0.005–0.008 chroma in the 34–48° warm hue range. Pure grey is prohibited. `#000` and `#fff` are prohibited. If a value is neutral, it tints warm.

**The Amber-at-Rest Rule.** The amber accent appears on ≤10% of any given screen. It belongs to the focus ring, the active selection, the primary button, and the Dynamic Island when it wants attention — nothing else. Scatter it and the heartbeat stops working.

**The Named-Accent Rule.** Connection swatches are for connections. Status colors are for status. Never cross the wires — a moss-colored row is not a success; a plum-tagged connection is not a warning.

## 3. Typography

**Display / UI Font:** macOS system font stack — `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif`. On macOS this resolves to San Francisco; the stack degrades cleanly on other platforms.
**Mono Font:** JetBrains Mono Variable, with fallback `ui-monospace, SFMono-Regular, monospace`.

**Character:** SF Pro is the native macOS UI face — calm, neutral, and unmistakably at home in the OS chrome. The app inherits its proportions and spacing rather than competing with them. Default tracking is a whisper tight (`-0.003em`) so the UI feels deliberate at small sizes. JetBrains Mono handles SQL and result data with ligatures explicitly disabled (`liga: 0`) — SQL operators should read as operators, not as custom glyphs — and with slashed zero (`zero`) and stylistic set `ss02` for data legibility.

### Hierarchy

Sizes run small on purpose. This is a pro tool; users want information. Rhythm comes from weight contrast and vertical grouping, not from scaling type up.

- **Headline** (18px / 1.3 / medium / `-0.028em`): Route-level page titles. Rare — used once per screen at most.
- **Title** (14px / 1.4 / medium / `-0.003em`): Card titles, dialog titles, section heads inside panels.
- **Body** (12px / 1.65 / regular / `-0.003em`): The workhorse. Form fields, descriptions, general UI copy. Keep prose ≤65–75ch.
- **Chrome** (11px / 1.4 / medium / `-0.028em`): Titlebar actions, toolbar labels, the Dynamic Island.
- **Section Label** (10px / 1.2 / medium / `+0.022em` UPPERCASE): Sidebar group headings, small capitals above grouped content.
- **Mono** (13px / 1.55 / regular / `-0.003em`): SQL editor, result tables, code blocks, keyboard shortcut keys.

### Named Rules

**The Small-and-Tight Rule.** Default body is 12px with `-0.003em` tracking. Never scale the whole UI up to feel "safer" — if a surface feels cramped, add vertical space between groups, don't inflate every element.

**The Ligatures-Off Rule.** Mono renders SQL. `=>`, `!=`, `<=`, `->` are operators, not arrows. `font-feature-settings: "liga" 0, "zero"` is not optional.

**The Native-Type Rule.** The UI face is the macOS system font, not a bundled web font. Don't reach for Inter, IBM Plex, Space Grotesk, Fraunces, or Instrument Sans to "give the app personality" — personality lives in color, motion, and the Dynamic Island, not in the typeface. Letting SF do the talking is the whole point of native-calm.

## 4. Elevation

This system is **flat with tonal vibrancy**. Depth is built by stepping warm-tinted surfaces upward in lightness (Warm Ink → Warm Muted → Warm Raised → Warm Accent), not by dropping shadows. Shadows exist in the Tailwind default scale but are used only in rare, specific moments — the Dynamic Island gets a gentle `shadow-sm` because it's the single hovering surface in the app, and popovers use `shadow-md` to separate from the warm parent surface.

Native macOS vibrancy is enabled on the window (`windowEffects: { effects: ["sidebar"] }`, with `transparent: true` and `macOSPrivateApi: true`). The sidebar background in Tauri renders through real system vibrancy — not a CSS blur fake. The Dynamic Island composites over this with `backdrop-blur-xl backdrop-saturate-200` so it inherits the ambient wallpaper warmth.

### Shadow Vocabulary

- **`shadow-sm`** (Tailwind default): Only on the Dynamic Island pill. A soft grounding glow.
- **`shadow-md`** (Tailwind default): Popovers, dropdown menus, context menus — separating transient UI from the warm parent.
- **No `shadow-lg` / `shadow-xl` / `shadow-2xl`**: Forbidden. Heavier shadows belong to consumer products, not pro tooling.

### Named Rules

**The Flat-With-Vibrancy Rule.** Surfaces are flat at rest. Depth comes from warm tonal layering and real macOS vibrancy. Shadows are reserved for the Island and transient popovers — nothing else.

**The No-Dropshadow-On-Cards Rule.** Cards sit inside the warm parent surface and step up tonally. If a card reads as floating, add tonal contrast, not shadow.

## 5. Components

### Buttons

- **Shape:** Softly rounded (`5.2px` / `rounded-md`). Icon-only xs uses `3.2px` / `rounded-sm`.
- **Height:** 28px default (`h-7`), with `xs` 20px, `sm` 24px, `lg` 32px. This is a pro app; controls are compact.
- **Primary:** Amber Heartbeat background, Warm Ink text (`bg-primary text-primary-foreground`). Hover drops opacity to 80%, never changing hue. Used sparingly — one primary per surface.
- **Ghost:** Transparent ground, muted text. Hover fills with Warm Muted. The workhorse for toolbars and list actions.
- **Outline:** Hairline border in Dark Border. Hover fills with `input/50`. Used when a button needs to be findable without demanding attention.
- **Secondary:** Warm Raised background, Warm Raised text-deep. Soft accent for non-primary actions that still need visual weight.
- **Destructive:** Red text on a 10%-tint red background. Hover deepens to 20%. Never solid red — destructive is a statement, not an assault.
- **Toolbar:** Transparent, muted text, quiet hover. The default for titlebar and tab-bar action chrome.
- **Focus:** Amber ring (`ring-ring/50`, `ring-2`) with matching border shift. Always visible — focus rings are a feature.
- **Transition:** `150ms ease-out` on all state changes.

### Inputs

- **Style:** Warm Raised fill at 20–30% opacity, Dark Border hairline, `rounded-md`. Height matches buttons at 28px.
- **Focus:** Border shifts to amber, ring expands to `ring-2 ring-ring/50`. No glow, no elevation.
- **Error:** Border and ring pick up Destructive Red (20% tint in dark, 40% in light-on-light). `aria-invalid` triggers the treatment.
- **Disabled:** 50% opacity, no pointer.

### Cards

- **Corner Style:** `rounded-lg` (7.2px) — gently curved but not soft.
- **Background:** Warm Raised.
- **Shadow Strategy:** None by default (see Elevation). Separation is tonal.
- **Border:** 1px ring in `foreground/10` — a ghost border. Hairline, never announcing itself.
- **Internal Padding:** 16px default (`p-4`), 12px in `size="sm"`. Gap between header/content/footer is `1rem` default, `0.75rem` sm.

### Tabs

Three variants, each purposeful:

- **Default:** Muted background fill, active tab becomes Warm Raised with a subtle border. For content-switcher tabs inside a panel.
- **Line:** Transparent list, active tab gets a 2px underline in `foreground`. For route-level navigation.
- **Segment:** Borderless grouped list with a 1px divider between triggers that fades on active. For mode switchers (e.g., Results / Explain / Schema).

All triggers: 28px default height, 12px font, medium weight, `150ms ease-out` transitions.

### Dynamic Island — Signature Component

The titlebar's centered status pill is the single most distinctive surface in the app. Treat it with outsized care.

- **Shape:** `rounded-full` pill, 24px tall, `px-2.5` horizontal padding.
- **Ground:** `bg-background/85` — the Warm Ink background at 85% opacity — composited over real macOS vibrancy via `backdrop-blur-xl backdrop-saturate-200`.
- **Border:** 1px hairline at `border/60` — softer than the standard hairline so it reads as a single floating object.
- **Shadow:** `shadow-sm` — a single grounding note, the one place in the app that earns a shadow.
- **Typography:** Chrome (11px medium, `-0.028em`). Tabular nums for query timers and counts.
- **Motion:** Morphs between hidden → connection-status → query-status → error states via Framer Motion `layout` with a spring (`stiffness: 400, damping: 30`). Content items blur-in and blur-out on kind change (`filter: blur(4px) → blur(0px)`, easing `[0.22, 1, 0.36, 1]`, 220ms). Respects `prefers-reduced-motion` by dropping the blur and spring.
- **States:** `hidden`, `connection-ok`, `connection-error`, `query-running`, `query-ok`, `query-error`. Errors use `role="alert"` + `aria-live="assertive"`; everything else is `role="status"` + `aria-live="polite"`.

### SQL Editor (CodeMirror)

- **Theme:** GitHub Dark, overridden so `.cm-editor`, `.cm-gutters`, and `.cm-activeLineGutter` stay transparent and inherit the Warm Ink parent.
- **Font:** Mono role (13px JetBrains Mono Variable, ligatures off, slashed zero, `ss02`).
- **Completion icons:** Custom glyphs for semantic weight — `◫` (table, teal), `◱` (view, plum), `○` (column, honey), `◇` (keyword, clay, 700 weight). These replace the default CodeMirror icons entirely.

### Named Rules

**The Compact-Control Rule.** Default interactive controls (buttons, inputs, tabs) are 28px tall. Don't inflate to 36/40px — the whole system's rhythm depends on this density.

**The Ghost-Border Rule.** Cards use a 1px ring at `foreground/10`. Never use a visible 1px solid border on cards — hairlines announce themselves; ghost borders separate without shouting.

**The Signature Rule.** The Dynamic Island is the one place `backdrop-blur-xl` and `shadow-sm` earn their keep. Don't scatter blur or shadow elsewhere "to match".

## 6. Do's and Don'ts

### Do:

- **Do** tint every neutral warm (0.005–0.008 chroma, 34–48° hue). There is no such thing as pure grey in this app.
- **Do** reserve the Amber Heartbeat for focus rings, selected state, the primary button, and the Dynamic Island at attention.
- **Do** build depth through tonal surface layering (Warm Ink → Warm Raised → Warm Accent).
- **Do** use the macOS system font (`-apple-system`) for UI and JetBrains Mono for SQL and data — with ligatures off on mono.
- **Do** keep default controls at 28px (`h-7`) and body text at 12px. Density is the point.
- **Do** use real macOS vibrancy via `windowEffects: ["sidebar"]` on the Tauri window, and `backdrop-blur-xl backdrop-saturate-200` on the Dynamic Island.
- **Do** put iOS-like springs (`stiffness: 400, damping: 30`) on morphing elements and exponential ease-outs on state transitions (`150ms ease-out`).
- **Do** keep focus rings visible — 2px amber, always. Focus is a feature.
- **Do** respect `prefers-reduced-motion` by dropping springs, blurs, and exit animations.

### Don't:

- **Don't** use `#000` or `#fff` anywhere. Ever.
- **Don't** use purple or cyan gradients, neon accents on dark, or sparkle iconography. This is not a "✨ AI-powered" product.
- **Don't** build a chatbot drawer bolted onto the IDE. AI output lands in the editor like a colleague pasted it — not like a product feature.
- **Don't** imitate DBeaver / phpMyAdmin / pgAdmin chrome — bureaucratic grey panels, icon-heavy toolbars, zero personality. That's the anti-brand.
- **Don't** use Inter, IBM Plex, Space Grotesk, Fraunces, or Instrument Sans. The macOS system font is the UI face — let it disappear into the OS.
- **Don't** scale controls up to 36/40px to feel "safer". The system's rhythm breaks.
- **Don't** use `border-left` / `border-right` greater than 1px as a colored accent stripe on cards, list items, or callouts. Rewrite with full borders, tonal backgrounds, or leading icons.
- **Don't** use `background-clip: text` with gradients. Emphasis is weight and size.
- **Don't** use `shadow-lg` / `xl` / `2xl` on anything. Heavy drop shadows belong to consumer products.
- **Don't** drop shadows on cards. Cards step up tonally.
- **Don't** use the connection palette for charts or status — connections only.
- **Don't** use ligatures on SQL — `=>` / `!=` / `<=` / `->` are operators, not glyphs.
- **Don't** animate CSS layout properties. Animate `transform`, `opacity`, `filter`, or use Framer `layout`.
- **Don't** imitate macOS widgets. Inherit the discipline — keyboard-first, quiet chrome, real vibrancy — not the skin.
