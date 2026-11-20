# Conch identity

Chosen direction: **Whorl**, concept 1. Its continuous spiral, broad negative-space channel and asymmetrical outer lip give the strongest compact silhouette. Spire has disconnected sections; Open Call relies on a finer rim. Whorl was redrawn manually as one filled Bézier path, retaining the generated concept's essential geometry while smoothing the contours and removing raster texture.

Final colors: Warm Ink #1a1614; Amber #f6dcc0. Wordmark: Optima Bold, rendered from the macOS system font into the transparent PNG lockups. No font file is distributed. The SVG uses currentColor and a square 1000-unit viewBox.

The app-icon body occupies the centered 824-unit square from (100,100) to (924,924) on a 1024 canvas, with continuous-curvature corners, transparent margin and a soft shadow. This is a custom curve following the requested proportions, not a claim of a pixel-identical Apple template. The tray is a tightly framed one-color version of the same shell; every RGB pixel is black and alpha carries all edge antialiasing.

Generation: built-in image_gen, three separate concept calls, transparent backgrounds. Original concept outputs are retained at their native 1254 × 1254 size. Final artwork is rebuilt from vector geometry and exported with Pillow, including all ten iconset PNGs and six ICO frames. Dimensions and alpha were checked using Pillow and sips. See verification.json for the complete inventory and asset-review.png for the visual review sheet.

The raster small-size assets were inspected. Dock and menu-bar runtime rendering was not tested. No code, build configuration, root documentation, package names, commits or pushes were changed by this asset task.

## Generation prompt set

All three prompts specify logo-brand; one quiet, crafted, trustworthy macOS database launcher icon; pale amber #f6dcc0 on flat warm ink #1a1614; a centered 824-unit Big Sur continuous-curvature body in a transparent 1024 square; a roughly 530-unit centered symbol; readability at 16 px and in one color. Exclusions: text, letters, monograms, database cylinders, sparkles or AI cues, purple/cyan, neon, glossy 3D, emoji-looking or scallop shells, presentation boards.

1. **Whorl:** a bold compact asymmetric spiral conch shell, a single flat silhouette with a broad negative-space spiral channel; organic precise curves, a gently pointed outer lip at lower right and a compact circular core.
2. **Spire:** a bold conch gastropod shell viewed sideways on a diagonal upward-right axis; short tapered upper-left spire stepping into a generous rounded body and one wide curved aperture at lower right; sculptural cut-paper silhouette with at most two broad carved grooves.
3. **Open Call:** an asymmetric teardrop conch flaring toward upper right; generous open spiral aperture and compact coiled lower-left heel; smooth, confident woodblock-like geometry without hatching or texture, one broad negative-space channel and tapered lip.
