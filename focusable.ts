/**
 * focusable.ts
 *
 * @version 1.0.2
 * @author Yusuke Kamiyamane
 * @license MIT
 * @copyright Copyright (c) 2026 Yusuke Kamiyamane
 * @see {@link https://github.com/y14e/focusable-ts}
 */

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface FocusableOptions {
  readonly active?: HTMLElement | null;
  readonly wrap?: boolean;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const FOCUSABLE_SELECTOR = `:is(a[href], area[href], button, embed, iframe, input:not([type="hidden" i]), object, select, details > summary:first-of-type, textarea, [contenteditable]:not([contenteditable="false" i]), [controls], [tabindex]):not(:disabled, [hidden], [inert], [tabindex="-1"])`;

// -----------------------------------------------------------------------------
// APIs
// -----------------------------------------------------------------------------

const cache: WeakMap<HTMLElement, number> = new WeakMap();

export function getFocusables(
  container: HTMLElement = document.body,
): HTMLElement[] {
  if (!(container instanceof HTMLElement)) {
    console.warn('Invalid container element.');
    return [];
  }

  const elements: HTMLElement[] = [];

  container
    .querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    .forEach((node) => {
      if (isFocusable(node)) {
        elements.push(node);
      }
    });

  function sort(elements: HTMLElement[]) {
    const ordered: HTMLElement[] = [];
    const natural: HTMLElement[] = [];

    function getTabIndex(element: HTMLElement) {
      const cached = cache.get(element);

      if (cached !== undefined) {
        return cached;
      }

      const number = Number(element.getAttribute('tabindex'));
      cache.set(element, number);
      return number;
    }

    elements.forEach((element) => {
      (getTabIndex(element) > 0 ? ordered : natural).push(element);
    });

    ordered.sort((a, b) => getTabIndex(a) - getTabIndex(b));
    return ordered.concat(natural);
  }

  return sort(elements);
}

export function getNextFocusable(
  container: HTMLElement = document.body,
  options: FocusableOptions = {},
): HTMLElement | null {
  if (!(container instanceof HTMLElement)) {
    console.warn('Invalid container element.');
    return null;
  }

  return getRelativeFocusable(container, 1, options);
}

export function getPreviousFocusable(
  container: HTMLElement = document.body,
  options: FocusableOptions = {},
): HTMLElement | null {
  if (!(container instanceof HTMLElement)) {
    console.warn('Invalid container element.');
    return null;
  }

  return getRelativeFocusable(container, -1, options);
}

export function hasFocusable(container: HTMLElement = document.body): boolean {
  if (!(container instanceof HTMLElement)) {
    console.warn('Invalid container element.');
    return false;
  }

  return getFocusables(container).length > 0;
}

export function isFocusable(element: HTMLElement): boolean {
  if (!(element instanceof HTMLElement)) {
    console.warn('Invalid target element.');
    return false;
  }

  function isDisabledDeep(element: Element) {
    function isDisabled(element: Element) {
      return 'disabled' in element && element.disabled;
    }

    function isFormControl(element: Element) {
      return /^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(element.tagName);
    }

    for (
      let current: Node | null = element;
      current;
      current =
        current instanceof ShadowRoot
          ? current.mode === 'open'
            ? current.host
            : null
          : current.parentNode
    ) {
      if (!(current instanceof Element)) {
        continue;
      }

      // [disabled]
      if (
        current === element &&
        isFormControl(current) &&
        isDisabled(current)
      ) {
        return true;
      }

      // [inert]
      if (current.matches('[inert]')) {
        return true;
      }

      // fieldset[disabled]
      if (
        isFormControl(element) &&
        current.tagName === 'FIELDSET' &&
        isDisabled(current)
      ) {
        if (
          current
            .querySelector(':scope > legend:first-of-type')
            ?.contains(element)
        ) {
          continue;
        }

        return true;
      }
    }

    return false;
  }

  return (
    element.matches(FOCUSABLE_SELECTOR) &&
    !isDisabledDeep(element) &&
    element.checkVisibility({
      contentVisibilityAuto: true,
      opacityProperty: true,
      visibilityProperty: true,
    })
  );
}

// -----------------------------------------------------------------------------
// Core
// -----------------------------------------------------------------------------

function getRelativeFocusable(
  container: HTMLElement,
  offset: number = 0,
  options: FocusableOptions = {},
) {
  const focusables = getFocusables(container);
  const { length } = focusables;

  if (length === 0) {
    return null;
  }

  const { active, wrap = false } = options;

  function getActiveElement() {
    let active = document.activeElement;

    while (active instanceof HTMLElement && active.shadowRoot?.activeElement) {
      active = active.shadowRoot.activeElement;
    }

    return active instanceof HTMLElement ? active : null;
  }

  const current = active ?? getActiveElement();

  function containsDeep(container: Node, node: Node) {
    for (
      let current: Node | null = node;
      current;
      current = !(current instanceof ShadowRoot)
        ? current.parentNode
        : current.mode === 'open'
          ? current.host
          : null
    ) {
      if (current === container) {
        return true;
      }
    }

    return false;
  }

  if (!current || !containsDeep(container, current)) {
    return null;
  }

  const currentIndex = focusables.indexOf(current);

  if (currentIndex === -1) {
    return null;
  }

  const offsetIndex = currentIndex + offset;

  if ((offsetIndex < 0 || offsetIndex >= length) && !wrap) {
    return null;
  }

  return focusables[(offsetIndex + length) % length] ?? null;
}
