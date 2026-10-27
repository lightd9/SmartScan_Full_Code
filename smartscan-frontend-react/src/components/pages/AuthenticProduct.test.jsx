import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AuthenticProduct from './AuthenticProduct';

function ProductRouteProbe() {
  const location = useLocation();
  return <output data-testid="product-route-state">{JSON.stringify(location.state)}</output>;
}

describe('public product verification route', () => {
  it('opens the read-only product history without requesting a wallet', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const state = {
      qrData: '0x1111111111111111111111111111111111111111,SS-00000000-0000-0000-0000-000000000001',
      warnings: ['unusual_frequency'],
    };

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[{ pathname: '/authentic-product', state }]}>
          <Routes>
            <Route path="/authentic-product" element={<AuthenticProduct />} />
            <Route path="/product" element={<ProductRouteProbe />} />
          </Routes>
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain('No wallet is needed to read this record');
    expect(container.textContent).not.toContain('Connect Wallet');
    const button = container.querySelector('button');
    expect(button?.textContent).toContain('View public product history');

    await act(async () => button.click());

    const routeState = JSON.parse(container.querySelector('[data-testid="product-route-state"]').textContent);
    expect(routeState).toEqual(state);

    await act(async () => root.unmount());
    container.remove();
  });
});
