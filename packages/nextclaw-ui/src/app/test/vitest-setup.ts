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

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear = () => {
    this.values.clear();
  };

  getItem = (key: string) => this.values.get(key) ?? null;

  key = (index: number) => Array.from(this.values.keys())[index] ?? null;

  removeItem = (key: string) => {
    this.values.delete(key);
  };

  setItem = (key: string, value: string) => {
    this.values.set(key, value);
  };
}

if (typeof window !== 'undefined' && typeof window.localStorage?.getItem !== 'function') {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: new MemoryStorage()
  });
}
