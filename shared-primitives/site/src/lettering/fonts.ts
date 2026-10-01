// First-party copies of the engine's faces (BCPrimitives.FACES), pinned by the
// lockfile and emitted by Vite. The engine loads these before any local or
// Google face, so every browser fits the lettering with the same binaries.
// Noto Sans is the variable font: the engine requests weight 800 and condensed
// width from its axes. Each face is the latin + latin-ext subsets.
import notoLatin from '@fontsource-variable/noto-sans/files/noto-sans-latin-wdth-normal.woff2?url';
import notoExt from '@fontsource-variable/noto-sans/files/noto-sans-latin-ext-wdth-normal.woff2?url';
import open800 from '@fontsource/open-sans/files/open-sans-latin-800-normal.woff2?url';
import open800Ext from '@fontsource/open-sans/files/open-sans-latin-ext-800-normal.woff2?url';
import open700 from '@fontsource/open-sans/files/open-sans-latin-700-normal.woff2?url';
import open700Ext from '@fontsource/open-sans/files/open-sans-latin-ext-700-normal.woff2?url';
import condensed700 from '@fontsource/roboto-condensed/files/roboto-condensed-latin-700-normal.woff2?url';
import condensed700Ext from '@fontsource/roboto-condensed/files/roboto-condensed-latin-ext-700-normal.woff2?url';
import condensed800 from '@fontsource/roboto-condensed/files/roboto-condensed-latin-800-normal.woff2?url';
import condensed800Ext from '@fontsource/roboto-condensed/files/roboto-condensed-latin-ext-800-normal.woff2?url';
import inter900 from '@fontsource/inter/files/inter-latin-900-normal.woff2?url';
import inter900Ext from '@fontsource/inter/files/inter-latin-ext-900-normal.woff2?url';
import slab700 from '@fontsource/roboto-slab/files/roboto-slab-latin-700-normal.woff2?url';
import slab700Ext from '@fontsource/roboto-slab/files/roboto-slab-latin-ext-700-normal.woff2?url';
import slab500 from '@fontsource/roboto-slab/files/roboto-slab-latin-500-normal.woff2?url';
import slab500Ext from '@fontsource/roboto-slab/files/roboto-slab-latin-ext-500-normal.woff2?url';
import sans400 from '@fontsource/roboto/files/roboto-latin-400-normal.woff2?url';
import sans400Ext from '@fontsource/roboto/files/roboto-latin-ext-400-normal.woff2?url';
import sans700 from '@fontsource/roboto/files/roboto-latin-700-normal.woff2?url';
import sans700Ext from '@fontsource/roboto/files/roboto-latin-ext-700-normal.woff2?url';
import raleway900 from '@fontsource/raleway/files/raleway-latin-900-normal.woff2?url';
import raleway900Ext from '@fontsource/raleway/files/raleway-latin-ext-900-normal.woff2?url';

export interface FontSource { url: string; unicodeRange: string }

// The Google Fonts subset ranges, as in the Fontsource stylesheets.
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
const face = (latin: string, ext: string): FontSource[] => [{ url: latin, unicodeRange: LATIN }, { url: ext, unicodeRange: LATIN_EXT }];

/** Engine face id -> its bundled files (window.BC_FONT_SOURCES). */
export const FONT_SOURCES: Record<string, FontSource[]> = {
  'noto-condensed': face(notoLatin, notoExt),
  'open-heavy': face(open800, open800Ext),
  'open-bold': face(open700, open700Ext),
  'condensed-bold': face(condensed700, condensed700Ext),
  'condensed-heavy': face(condensed800, condensed800Ext),
  'inter-black': face(inter900, inter900Ext),
  'slab-bold': face(slab700, slab700Ext),
  'slab-medium': face(slab500, slab500Ext),
  'sans-regular': face(sans400, sans400Ext),
  'sans-bold': face(sans700, sans700Ext),
  'raleway-black': face(raleway900, raleway900Ext),
};
