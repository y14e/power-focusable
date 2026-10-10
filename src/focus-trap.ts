import { getFocusables } from '@/index';
import { getRelativeFocusable } from '@/internal';
import { focusElement, getActiveElement } from '@/utils';

export function createFocusTrap(
  container: Element = document.body,
): () => void {
  if (!(container instanceof Element)) {
    console.warn('Invalid container element. Fallback: <body> element.');
    container = document.body;
  }

  const instance = new FocusTrap(container);
  return () => instance.destroy();
}

class FocusTrap {
  #container: Element;
  #controller: AbortController | null = null;
  #isDestroyed = false;

  constructor(container: Element) {
    this.#container = container;
    this.#initialize();
  }

  destroy(): void {
    if (this.#isDestroyed) {
      return;
    }

    this.#isDestroyed = true;
    this.#controller?.abort();
    this.#controller = null;
  }

  #initialize(): void {
    this.#controller = new AbortController();
    (this.#container as HTMLElement).addEventListener(
      'keydown',
      this.#onKeyDown,
      { signal: this.#controller.signal },
    );
    focusElement(this.#container);

    if (getActiveElement() !== this.#container) {
      const first = getFocusables(this.#container, { composed: true })[0];
      first && focusElement(first);
    }
  }

  #onKeyDown = (event: KeyboardEvent): void => {
    const { key, altKey, ctrlKey, metaKey, shiftKey } = event;

    if (key !== 'Tab' || altKey || ctrlKey || metaKey) {
      return;
    }

    const focusable = getRelativeFocusable(this.#container, shiftKey ? -1 : 1, {
      composed: true,
      wrap: true,
    });

    if (focusable) {
      event.preventDefault();
      focusElement(focusable);
    }
  };
}
