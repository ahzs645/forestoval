import { mountLiveLettering } from './index';
import './editor.css';
import './app.css';

// The standalone app: the editor on its own page. Deployed beside the viewer
// (at lettering/), it links back to it.
if (import.meta.env.PROD) document.querySelector<HTMLElement>('[data-part="viewer"]')!.hidden = false;
mountLiveLettering(document.getElementById('app')!);
