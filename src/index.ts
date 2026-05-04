/**
 * Power Focusable
 * High-precision focus management utility with shadow DOM support.
 * Handles complex focus rules including tabindex ordering, radio groups, etc.
 *
 * @version 2.0.1
 * @author Yusuke Kamiyamane
 * @license MIT
 * @copyright Copyright (c) Yusuke Kamiyamane
 * @see {@link https://github.com/y14e/power-focusable}
 */

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface PowerFocusableOptions {
  readonly active?: HTMLElement | null;
  readonly composed?: boolean;
  readonly wrap?: boolean;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const FOCUSABLE_SELECTOR = `:is(a[href], area[href], button, embed, iframe, input:not([type="hidden" i]), object, select, details > summary:first-of-type, textarea, [contenteditable]:not([contenteditable="false" i]), [controls], [tabindex]):not(:disabled, [hidden], [inert], [tabindex="-1"])`;

// -----------------------------------------------------------------------------
// APIs
// -----------------------------------------------------------------------------

export function getFocusables(
  container: HTMLElement = document.body,
  options: Omit<PowerFocusableOptions, 'active' | 'wrap'> = {},
): HTMLElement[] {
  if (!(container instanceof HTMLElement)) {
    console.warn('Invalid container element. Fallback: <body> element.');
    container = document.body;
  }

  const { composed = false } = options;
  const elements: HTMLElement[] = [];

  if (composed) {
    function walk(node: Node) {
      if (node instanceof HTMLElement) {
        if (isFocusable(node)) {
          elements.push(node);
        }

        const shadow = node.shadowRoot;

        if (shadow && shadow.mode === 'open') {
          walk(shadow);
        }
      } else if (node instanceof HTMLSlotElement) {
        const assigned = node.assignedElements({ flatten: true });

        if (assigned.length > 0) {
          assigned.forEach((a) => {
            walk(a);
          });

          return;
        }
      }

      node.childNodes.forEach((child) => {
        walk(child);
      });
    }

    walk(container);
  } else {
    elements.push(
      ...[
        ...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ].filter(isFocusable),
    );
  }

  const cache = new WeakMap<HTMLElement, number>();

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
    return [...ordered, ...natural];
  }

  function normalizeRadioGroup(elements: HTMLElement[]) {
    let map: Map<string, HTMLInputElement[]> | null = null;

    for (const element of elements) {
      if (
        element instanceof HTMLInputElement &&
        element.type === 'radio' &&
        element.name
      ) {
        if (!map) {
          map = new Map();
        }

        const key = `${element.form?.id ?? 'no-form'}::${element.name}`;
        (
          map.get(key) ?? (map.set(key, []).get(key) as HTMLInputElement[])
        ).push(element);
      }
    }

    if (!map) {
      return elements;
    }

    const placeholder = new Set();

    for (const group of map.values()) {
      if (group.length > 0) {
        const enabled = group.filter((radio) => isFocusable(radio));

        if (enabled.length > 0) {
          placeholder.add(
            enabled.find((radio: HTMLInputElement) => radio.checked) ??
              enabled[0],
          );
        }
      }
    }

    return elements.filter((element) => {
      if (
        element instanceof HTMLInputElement &&
        element.type === 'radio' &&
        element.name
      ) {
        return placeholder.has(element);
      }

      return true;
    });
  }

  return normalizeRadioGroup(sort(elements));
}

export function getNextFocusable(
  container: HTMLElement = document.body,
  options: PowerFocusableOptions = {},
): HTMLElement | null {
  if (!(container instanceof HTMLElement)) {
    console.warn('Invalid container element. Fallback: <body> element.');
    container = document.body;
  }

  return getRelativeFocusable(container, 1, options);
}

export function getPreviousFocusable(
  container: HTMLElement = document.body,
  options: PowerFocusableOptions = {},
): HTMLElement | null {
  if (!(container instanceof HTMLElement)) {
    console.warn('Invalid container element. Fallback: <body> element.');
    container = document.body;
  }

  return getRelativeFocusable(container, -1, options);
}

export function hasFocusable(container: HTMLElement = document.body): boolean {
  if (!(container instanceof HTMLElement)) {
    console.warn('Invalid container element. Fallback: <body> element.');
    container = document.body;
  }

  return getFocusables(container).length > 0;
}

export function isFocusable(element: HTMLElement): boolean {
  if (!(element instanceof HTMLElement)) {
    console.warn('Invalid element');
    return false;
  }

  function isDisabledDeep(element: Element) {
    function isFormControl(element: Element) {
      return /^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(element.tagName);
    }

    function isDisabled(element: Element) {
      return 'disabled' in element && element.disabled;
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
  options: PowerFocusableOptions,
) {
  const { active, composed = false, wrap = false } = options;
  const focusables = getFocusables(container, { composed });
  const { length } = focusables;

  if (length === 0) {
    return null;
  }

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
