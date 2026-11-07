// Android resizes the WebView for the IME in EdgeToEdgeActivity. WKWebView and
// browsers can instead resize only the visual viewport. Keep forms/sheets in
// that visible area without treating pinch zoom as a keyboard or resetting React.
const viewport = window.visualViewport;
if (viewport) {
  const root = document.documentElement;
  let frame = 0;
  const update = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const element = document.activeElement;
      const editing = element instanceof HTMLElement &&
        element.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea, [contenteditable="true"]');
      // A tap on Submit can move focus before the keyboard has finished closing.
      // Keep the button in place until the visual viewport actually expands.
      const overlay = (editing || root.hasAttribute('data-keyboard-overlay')) && Math.abs(viewport.scale - 1) < 0.05 &&
        root.clientHeight - viewport.height > 100;
      root.toggleAttribute('data-keyboard-overlay', overlay);
      if (overlay) {
        root.style.setProperty('--keyboard-viewport-height', `${viewport.height}px`);
        root.style.setProperty('--keyboard-viewport-top', `${viewport.offsetTop}px`);
      } else {
        root.style.removeProperty('--keyboard-viewport-height');
        root.style.removeProperty('--keyboard-viewport-top');
      }
    });
  };
  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);
  document.addEventListener('focusin', update);
  document.addEventListener('focusout', update);
  update();
  if (import.meta.hot) import.meta.hot.dispose(() => {
    cancelAnimationFrame(frame);
    viewport.removeEventListener('resize', update);
    viewport.removeEventListener('scroll', update);
    document.removeEventListener('focusin', update);
    document.removeEventListener('focusout', update);
    root.removeAttribute('data-keyboard-overlay');
    root.style.removeProperty('--keyboard-viewport-height');
    root.style.removeProperty('--keyboard-viewport-top');
  });
}
