import { vi } from 'vitest';

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true
});

class MockResizeObserver {
  observe = () => {}

  unobserve = () => {}

  disconnect = () => {}
}

vi.stubGlobal('ResizeObserver', MockResizeObserver);
