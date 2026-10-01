# Font input

`Kabel-Black.otf` is committed here for now, so every build (local, Pages, standalone studio) uses it for the tree oval. It is never fetched from Google Fonts. Check it, or replace it after removing it, with `python3 bc-ministry-primitives-v5/tools/setup_kabel.py --check` (or `... setup_kabel.py /path/to/Kabel-Black.otf`) from the repository root; the tool checks the file against `data/kabel-black-font.json`.

Kabel is a commercial typeface: keeping the OTF in this repository and on the published site distributes it. Other `.otf`/`.ttf` files here stay ignored.

The Vite build serves the font as an asset, and the standalone build inlines it so that the studio can work from disk. Do not distribute those built assets without the necessary permission. Editable SVG exports contain local font-name aliases, not font bytes.
