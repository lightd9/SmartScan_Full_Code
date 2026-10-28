import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ScannerProvider, useScanner } from './ScannerContext';
import { AuthProvider } from './AuthProvider';

function TestConsumer() {
  const { openScanner, closeScanner, isScannerOpen } = useScanner();
  return (
    <div>
      <span data-testid="status">{isScannerOpen ? 'open' : 'closed'}</span>
      <button data-testid="open-btn" onClick={() => openScanner('SS-test-123')}>Open</button>
      <button data-testid="close-btn" onClick={() => closeScanner()}>Close</button>
    </div>
  );
}

describe('ScannerContext', () => {
  it('opens and closes scanner popup with state updates', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <AuthProvider>
            <ScannerProvider>
              <TestConsumer />
            </ScannerProvider>
          </AuthProvider>
        </MemoryRouter>
      );
    });

    expect(container.querySelector('[data-testid="status"]').textContent).toBe('closed');

    const openBtn = container.querySelector('[data-testid="open-btn"]');
    await act(async () => {
      openBtn.click();
    });

    expect(container.querySelector('[data-testid="status"]').textContent).toBe('open');

    const closeBtn = container.querySelector('[data-testid="close-btn"]');
    await act(async () => {
      closeBtn.click();
    });

    expect(container.querySelector('[data-testid="status"]').textContent).toBe('closed');

    await act(async () => root.unmount());
    container.remove();
  });
});
