# forestoval

Reference-based reconstructions of the BC Ministry of Forests crest family, broken
into shared vector primitives, with a browser viewer for comparing each logo
against its reference images.

**Site:** https://projects.ahmadjalil.com/forestoval/ (also reachable at https://ahzs645.github.io/forestoval/).
The v5 studio is at https://projects.ahmadjalil.com/forestoval/studio/.

- `shared-primitives/`: the isolated building blocks (SVG), the layout and
  lettering data, the scripts that generate them, the reference images, and
  `site/`, the viewer. See [`shared-primitives/README.md`](shared-primitives/README.md),
  which also lists where each shared value lives.
- `bc-ministry-primitives-v5/`: the v5 studio the pieces are cut from; the site
  takes its lettering from `examples/`. `python build.py` builds the standalone page.
- `airtanker-operations/`: the Airtanker Operations badge package.

## Run locally

```sh
cd shared-primitives/site
npm install
npm run dev
```

Python tools beyond the standard library (reference gallery, lettering fit,
studio browser tests) need `pip install -r requirements.txt`.

Pushing to `main` checks that the generated files are up to date, builds the site
(with the studio at `studio/`) and deploys it to GitHub Pages
(`.github/workflows/pages.yml`). Pull requests run the same checks and build
without deploying.

These are reference-based reconstructions, not authenticated government identity masters.

## Kabel Black tree-oval lettering

The live editor and studio support `Kabel-Black.otf` on both heavy tree-oval
inscriptions. Supply your own copy once, before building:

```sh
python3 bc-ministry-primitives-v5/tools/setup_kabel.py /path/to/Kabel-Black.otf
```

Then open **Compose → Live lettering → Forest Service** and select **Kabel
Black · supplied OTF**. New drafts use it by default; older drafts keep their
previous v2 settings until explicitly changed. The editor also has a local OTF
picker for session-only use. [Setup, exports, deployment and validation](bc-ministry-primitives-v5/docs/kabel-black.md).
