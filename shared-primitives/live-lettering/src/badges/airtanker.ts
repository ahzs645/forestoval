import layout from '../../../layout.json';
import master from '../../../../airtanker-operations/airtanker-operations-editable.svg?raw';
import type { M } from '../svg';
import { defineBadge } from './badge';

/** The Airtanker Operations badge as the Recreations tab rebuilds it: the
 *  package's band and wings, and the shared tree crest (the Forest Service
 *  crest's frame and tree scene, with the single-colour ridge line) scaled into
 *  the package's oval. The band words come from the package master. */
export const AIRTANKER = defineBadge({
  id: 'airtanker-package',
  name: 'Airtanker Operations · package',
  recipe: 'airtanker',
  confidence: 'Rebuilt from the shared primitives and the airtanker package master',
  theme: 'airtanker',
  artwork: [{ file: 'airtanker-operations/lower-band.svg' }, { file: 'airtanker-operations/wings-pair.svg' }],
  crest: {
    transform: layout['airtanker-operations'].crestTransform as M,
    pieces: ['bc-ministry-v5/crest/frame.svg', 'bc-ministry-v5/scenes/tree.svg', 'bc-ministry-v5/scenes/tree-parts/mountain-ridge.svg'],
  },
  marks: { file: 'airtanker-operations/diamond.svg', drawnFor: 'tree-heavy' },
  bands: [{ content: 'service', slot: 'airtanker-band', label: 'Airtanker band', master, text: 'airtanker-operations', face: 'condensed-bold' }],
  // The engine's own photo-approximated wings and their label.
  replaces: { slots: ['wings-label'], warnings: ['APPROXIMATION'] },
});
