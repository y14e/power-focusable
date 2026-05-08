/**
 * Power Focusable
 * High-precision focus management utility with shadow DOM support.
 * Handles complex focus rules including tabindex ordering, radio groups, etc.
 *
 * @version 2.1.7
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
  container = document.body,
  options: Omit<PowerFocusableOptions, 'active' | 'wrap'> = {},
) {
  if (!(container instanceof HTMLElement)) {
    console.warn('Invalid container element. Fallback: <body> element.');
    container = document.body;
  }

  const { composed = false } = options;
  const elements: HTMLElement[] = [];

  if (composed) {
    function traverse(node: Element | Node | ShadowRoot) {
      if (node instanceof HTMLElement) {
        if (isFocusable(node)) {
          elements[elements.length] = node;
        }

        const shadow = node.shadowRoot;

        if (shadow && shadow.mode === 'open') {
          traverse(shadow);
        }
      }

      if (node instanceof HTMLSlotElement) {
        const assigned = node.assignedElements({ flatten: true });

        if (assigned.length) {
          for (let i = 0, l = assigned.length; i < l; i++) {
            const a = assigned[i];

            if (a) {
              traverse(a);
            }
          }

          return;
        }
      }

      const children = node.childNodes;

      for (let i = 0, l = children.length; i < l; i++) {
        const child = children[i];

        if (child) {
          traverse(child);
        }
      }
    }

    traverse(container);
  } else {
    const candidates =
      container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);

    for (let i = 0, l = candidates.length; i < l; i++) {
      const candidate = candidates[i];

      if (candidate && isFocusable(candidate)) {
        elements[elements.length] = candidate;
      }
    }
  }

  return normalizeRadioGroup(sortByTabIndex(elements));
}

export function getNextFocusable(
  container = document.body,
  options: PowerFocusableOptions = {},
) {
  if (!(container instanceof HTMLElement)) {
    console.warn('Invalid container element. Fallback: <body> element.');
    container = document.body;
  }

  return getRelativeFocusable(container, 1, options);
}

export function getPreviousFocusable(
  container = document.body,
  options: PowerFocusableOptions = {},
) {
  if (!(container instanceof HTMLElement)) {
    console.warn('Invalid container element. Fallback: <body> element.');
    container = document.body;
  }

  return getRelativeFocusable(container, -1, options);
}

export function hasFocusable(
  container = document.body,
  options: Omit<PowerFocusableOptions, 'active' | 'wrap'> = {},
) {
  if (!(container instanceof HTMLElement)) {
    console.warn('Invalid container element. Fallback: <body> element.');
    container = document.body;
  }

  return !!getFocusables(container, options).length;
}

export function isFocusable(element: HTMLElement) {
  if (!(element instanceof HTMLElement)) {
    console.warn('Invalid element');
    return false;
  }

  // Fast path [hidden], [inert]
  if (element.hasAttribute('hidden') || element.hasAttribute('inert')) {
    return false;
  }

  // Fast path [tabindex="-1"]
  const index = element.getAttribute('tabindex');

  if (index && Number(index) < 0) {
    return false;
  }

  if (!element.matches(FOCUSABLE_SELECTOR)) {
    return false;
  }

  if (isDisabledDeep(element)) {
    return false;
  }

  if (
    !element.checkVisibility({
      contentVisibilityAuto: true,
      opacityProperty: true,
      visibilityProperty: true,
    })
  ) {
    return false;
  }

  return true;
}

// -----------------------------------------------------------------------------
// Core
// -----------------------------------------------------------------------------

function getRelativeFocusable(
  container: HTMLElement,
  offset: number,
  options: PowerFocusableOptions,
) {
  const {
    active = getActiveElement(),
    composed = false,
    wrap = false,
  } = options;
  const focusables = getFocusables(container, { composed });
  const { length } = focusables;

  if (!length) {
    return null;
  }

  if (!active || !containsDeep(container, active)) {
    return null;
  }

  if (!(active instanceof HTMLElement)) {
    throw new Error('Unreachable');
  }

  const currentIndex = focusables.indexOf(active);

  if (currentIndex === -1) {
    return null;
  }

  const offsetIndex = currentIndex + offset;

  if ((offsetIndex < 0 || offsetIndex >= length) && !wrap) {
    return null;
  }

  return focusables[(offsetIndex + length) % length] ?? null;
}

// -----------------------------------------------------------------------------
// Utils
// -----------------------------------------------------------------------------

function containsDeep(container: Node, element: Node) {
  let current: Node | null = element;

  while (current) {
    if (current === container) {
      return true;
    }

    current =
      current instanceof ShadowRoot
        ? current.mode === 'open'
          ? current.host
          : null
        : current.parentNode;
  }

  return false;
}

function getActiveElement() {
  let current = document.activeElement;

  while (current?.shadowRoot?.activeElement) {
    current = current.shadowRoot.activeElement;
  }

  return current;
}

const tabIndexCache = new WeakMap<HTMLElement, number>();

function getTabIndex(element: HTMLElement) {
  const cached = tabIndexCache.get(element);

  if (cached !== undefined) {
    return cached;
  }

  const index = Number(element.getAttribute('tabindex'));
  tabIndexCache.set(element, index);
  return index;
}

function isDisabled(element: Element) {
  return 'disabled' in element && !!element.disabled;
}

function isDisabledDeep(element: Element) {
  let current: Node | null = element;

  while (current) {
    if (current instanceof ShadowRoot) {
      if (current.mode !== 'open') {
        return false;
      }

      current = current.host;
      continue;
    }

    if (!(current instanceof Element)) {
      current = current.parentNode;
      continue;
    }

    // [disabled]
    if (current === element && isFormControl(current) && isDisabled(current)) {
      return true;
    }

    // [inert]
    if (current.hasAttribute('inert')) {
      return true;
    }

    // fieldset[disabled]
    if (
      isFormControl(element) &&
      current.tagName === 'FIELDSET' &&
      isDisabled(current)
    ) {
      if (
        !current
          .querySelector(':scope > legend:first-of-type')
          ?.contains(element)
      ) {
        return true;
      }
    }

    current = current.parentNode;
  }

  return false;
}

function isFormControl(element: Element) {
  const name = element.tagName;
  return (
    name === 'BUTTON' ||
    name === 'INPUT' ||
    name === 'SELECT' ||
    name === 'TEXTAREA'
  );
}

function isUngroupedRadio(element: Element) {
  return (
    element instanceof HTMLInputElement &&
    element.type === 'radio' &&
    !!element.name
  );
}

function normalizeRadioGroup(elements: HTMLElement[]) {
  let map: Map<string, HTMLInputElement[]> | null = null;

  for (let i = 0, l = elements.length; i < l; i++) {
    const element = elements[i];

    if (!(element instanceof HTMLInputElement) || !isUngroupedRadio(element)) {
      continue;
    }

    if (!map) {
      map = new Map();
    }

    const key = `${element.form?.id ?? 'no-form'}::${element.name}`;
    const group = map.get(key) ?? map.set(key, []).get(key);

    if (group) {
      group[group.length] = element;
    }
  }

  if (!map) {
    return elements;
  }

  const placeholder = new Set();

  for (const group of map.values()) {
    /* Safety
    const radios = group.filter(isFocusable);

    if (radios.length) {
      placeholder.add(radios.find((radio) => radio.checked) ?? radios[0]);
    }
    */
    placeholder.add(group.find((radio) => radio.checked) ?? group[0]);
  }

  return elements.filter((element) => {
    if (isUngroupedRadio(element)) {
      return placeholder.has(element);
    }

    return true;
  });
}

function sortByTabIndex(elements: HTMLElement[]) {
  const ordered: HTMLElement[] = [];
  const natural: HTMLElement[] = [];

  for (let i = 0, l = elements.length; i < l; i++) {
    const element = elements[i];

    if (!element) {
      throw new Error('Unreachable');
    }

    const target = getTabIndex(element) > 0 ? ordered : natural;
    target[target.length] = element;
  }

  ordered.sort((a, b) => getTabIndex(a) - getTabIndex(b));
  let count = 0;
  const sorted = new Array(ordered.length + natural.length);

  for (let i = 0, l = ordered.length; i < l; i++) {
    sorted[count++] = ordered[i];
  }

  for (let i = 0, l = natural.length; i < l; i++) {
    sorted[count++] = natural[i];
  }

  return sorted;
}
