/**
 * Power Focusable
 * High-precision focus management utility with shadow DOM support.
 * Handles complex focus rules including tabindex ordering, radio groups, etc.
 *
 * @version 2.1.3
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
          elements[elements.length] = node;
        }

        const shadow = node.shadowRoot;

        if (shadow && shadow.mode === 'open') {
          walk(shadow);
        }
      } else if (node instanceof HTMLSlotElement) {
        const assigned = node.assignedElements({ flatten: true });

        if (assigned.length) {
          for (let i = 0, l = assigned.length; i < l; i++) {
            walk(assigned[i] as Node);
          }

          return;
        }
      }

      const children = node.childNodes;

      for (let i = 0, l = children.length; i < l; i++) {
        walk(children[i] as Node);
      }
    }

    walk(container);
  } else {
    const candidates =
      container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);

    for (let i = 0, l = candidates.length; i < l; i++) {
      const candidate = candidates[i] as HTMLElement;

      if (isFocusable(candidate)) {
        elements[elements.length] = candidate;
      }
    }
  }

  return normalizeRadioGroup(sortByTabIndex(elements));
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

export function hasFocusable(
  container: HTMLElement = document.body,
  options: Omit<PowerFocusableOptions, 'active' | 'wrap'> = {},
): boolean {
  if (!(container instanceof HTMLElement)) {
    console.warn('Invalid container element. Fallback: <body> element.');
    container = document.body;
  }

  return !!getFocusables(container, options).length;
}

export function isFocusable(element: HTMLElement): boolean {
  if (!(element instanceof HTMLElement)) {
    console.warn('Invalid element');
    return false;
  }

  // Fast path [hidden], [inert]
  if (element.hasAttribute('hidden') || element.hasAttribute('inert')) {
    return false;
  }

  // Fast path [tabindex="-1"]
  const tabIndex = element.getAttribute('tabindex');

  if (tabIndex) {
    if (Number(tabIndex) < 0) {
      return false;
    }
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
  offset: number = 0,
  options: PowerFocusableOptions,
) {
  const { active: a = null, composed = false, wrap = false } = options;
  const focusables = getFocusables(container, { composed });
  const { length } = focusables;

  if (!length) {
    return null;
  }

  const active = a ?? getActiveElement();

  if (!active || !containsDeep(container, active)) {
    return null;
  }

  const currentIndex = focusables.indexOf(active as HTMLElement);

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
  function walk(node: Node | null): boolean {
    if (!node) {
      return false;
    }

    if (node === container) {
      return true;
    }

    if (node instanceof ShadowRoot) {
      return node.mode === 'open' ? walk(node.host) : false;
    }

    return walk(node.parentNode);
  }

  return walk(element);
}

function getActiveElement() {
  function walk(node: Element | null): Element | null {
    if (!node) {
      return null;
    }

    const active = node.shadowRoot?.activeElement;
    return active ? walk(active) : node;
  }

  return walk(document.activeElement);
}

const tabIndexCache = new WeakMap<HTMLElement, number>();

function getTabIndex(element: HTMLElement) {
  const cached = tabIndexCache.get(element);

  if (cached !== undefined) {
    return cached;
  }

  const number = Number(element.getAttribute('tabindex'));
  tabIndexCache.set(element, number);
  return number;
}

function isDisabled(element: Element) {
  return 'disabled' in element && element.disabled;
}

function isDisabledDeep(element: Element) {
  function walk(node: Node | null): boolean {
    if (!node) {
      return false;
    }

    if (node instanceof ShadowRoot) {
      return node.mode === 'open' ? walk(node.host) : false;
    }

    if (!(node instanceof Element)) {
      return walk(node.parentNode);
    }

    // [disabled]
    if (node === element && isFormControl(node) && isDisabled(node)) {
      return true;
    }

    // [inert]
    if (node.hasAttribute('inert')) {
      return true;
    }

    // fieldset[disabled]
    if (
      isFormControl(element) &&
      node.tagName === 'FIELDSET' &&
      isDisabled(node)
    ) {
      if (
        node.querySelector(':scope > legend:first-of-type')?.contains(element)
      ) {
        return walk(node.parentNode);
      }

      return true;
    }

    return walk(node.parentNode);
  }

  return walk(element);
}

function isFormControl(element: Element) {
  const tagName = element.tagName;
  return (
    tagName === 'BUTTON' ||
    tagName === 'INPUT' ||
    tagName === 'SELECT' ||
    tagName === 'TEXTAREA'
  );
}

function normalizeRadioGroup(elements: HTMLElement[]) {
  let map: Map<string, HTMLInputElement[]> | null = null;

  for (let i = 0, l = elements.length; i < l; i++) {
    const element = elements[i];
    if (
      element instanceof HTMLInputElement &&
      element.type === 'radio' &&
      element.name
    ) {
      if (!map) {
        map = new Map();
      }

      const key = `${element.form?.id ?? 'no-form'}::${element.name}`;
      const group = (map.get(key) ??
        map.set(key, []).get(key)) as HTMLInputElement[];
      group[group.length] = element;
    }
  }

  if (!map) {
    return elements;
  }

  const placeholder = new Set();

  for (const group of map.values()) {
    if (group.length) {
      // Unsafe fast path
      // const enabled = group;
      const enabled = group.filter(isFocusable);

      if (enabled.length) {
        placeholder.add(enabled.find((radio) => radio.checked) ?? enabled[0]);
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

function sortByTabIndex(elements: HTMLElement[]) {
  const ordered: HTMLElement[] = [];
  const natural: HTMLElement[] = [];

  for (let i = 0, l = elements.length; i < l; i++) {
    const element = elements[i] as HTMLElement;
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
