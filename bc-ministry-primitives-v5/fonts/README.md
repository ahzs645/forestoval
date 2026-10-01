# Private font input

Run `python3 bc-ministry-primitives-v5/tools/setup_kabel.py /path/to/Kabel-Black.otf` from the repository root.

The selected OTF is an ignored local build input. It is not supplied by this repository or fetched from Google Fonts. The setup tool checks the selected file against `data/kabel-black-font.json`.

The Vite build serves your supplied font as an asset, and the standalone build inlines it so that the studio can work from disk. Do not distribute those built assets without the necessary permission. Editable SVG exports contain local font-name aliases, not font bytes.
