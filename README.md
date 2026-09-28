# forestoval

Reference-based reconstructions of the BC Ministry of Forests crest family, broken
into shared vector primitives, with a browser viewer for comparing each logo
against its reference images.

**Site:** https://ahzs645.github.io/forestoval/

- `shared-primitives/`: the isolated building blocks (SVG), the layout and
  lettering data, the scripts that generate them, and `site/`, the viewer.
  See [`shared-primitives/README.md`](shared-primitives/README.md).
- `bc-ministry-primitives-v5/`: the v5 studio the pieces are cut from; the site
  takes its lettering from `examples/`.
- `airtanker-operations/`: the Airtanker Operations badge package.

## Run locally

```sh
cd shared-primitives/site
npm install
npm run dev
```

Pushing to `main` builds the site and deploys it to GitHub Pages
(`.github/workflows/pages.yml`).

These are reference-based reconstructions, not authenticated government identity masters.
