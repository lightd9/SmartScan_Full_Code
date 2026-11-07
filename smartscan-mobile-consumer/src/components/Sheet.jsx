import React, { useCallback, useLayoutEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Sheet({ title, onClose, children }) {
  const dialog = useRef(null);
  const scrim = useRef(null);
  const mounted = useRef(false);
  const dismissing = useRef(false);
  const exitAnimations = useRef([]);
  const [closing, setClosing] = useState(false);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const dismiss = useCallback(async () => {
    if (dismissing.current) return;
    dismissing.current = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !dialog.current?.animate) {
      closeRef.current();
      return;
    }
    const panelStyle = getComputedStyle(dialog.current);
    setClosing(true);
    const options = { duration: 180, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' };
    exitAnimations.current = [
      dialog.current.animate([
        { transform: panelStyle.transform, opacity: panelStyle.opacity },
        { transform: 'translateY(28px)', opacity: 0 },
      ], options),
      scrim.current.animate([{ opacity: getComputedStyle(scrim.current).opacity }, { opacity: 0 }], options),
    ];
    await Promise.allSettled(exitAnimations.current.map(animation => animation.finished));
    if (mounted.current) closeRef.current();
  }, []);

  // Restore focus and background interaction in the same commit that removes
  // the sheet, including dismissals completed outside a click event.
  useLayoutEffect(() => {
    mounted.current = true;
    const previous = document.activeElement;
    const frame = document.querySelector('.app-content');
    const nav = document.querySelector('.bottom-nav-bar');
    if (frame) frame.inert = true;
    if (nav) nav.inert = true;
    const focusable = () => [...dialog.current.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')].filter(el => !el.disabled);
    (dialog.current.querySelector('[data-autofocus]') || focusable()[0])?.focus({ preventScroll: true });
    const onKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); dismiss(); }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      mounted.current = false;
      exitAnimations.current.forEach(animation => animation.cancel());
      document.removeEventListener('keydown', onKey);
      if (frame) frame.inert = false;
      if (nav) nav.inert = false;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [dismiss]);
  return createPortal(
    <div className={`modal-overlay ${closing ? 'is-closing' : ''}`} onClick={dismiss}>
      <div className="sheet-scrim" ref={scrim} aria-hidden="true" />
      <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} className="modal-sheet-panel" onClick={event => event.stopPropagation()}>
        <div className="sheet-drag-pill" />
        <header className="sheet-header"><h2 id={titleId}>{title}</h2><button className="circle-button" aria-label="Close" disabled={closing} onClick={dismiss}><X size={20} /></button></header>
        {children}
      </section>
    </div>, document.querySelector('.device-frame') || document.body,
  );
}
