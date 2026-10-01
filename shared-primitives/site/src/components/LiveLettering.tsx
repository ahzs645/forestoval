import { useEffect, useRef, type CSSProperties } from 'react';
import type { ViewSettings } from '../App';
import { mountLiveLettering, type LetteringEditor } from '@forestoval/live-lettering';
import '@forestoval/live-lettering/editor.css';

/** Native SVG, not an image or iframe: click the actual curved text to edit it. */
export function LiveLettering({ view }: { view: ViewSettings }) {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<LetteringEditor | null>(null);
  useEffect(() => {
    if (!host.current) return;
    const editor = mountLiveLettering(host.current);
    controller.current = editor;
    return () => { editor.destroy(); controller.current = null; };
  }, []);
  useEffect(() => { controller.current?.setPalette(view.palette); }, [view.palette]);
  return <div className="fo-live-host" ref={host} style={{ '--fo-canvas-background': view.surface.background } as CSSProperties} />;
}
