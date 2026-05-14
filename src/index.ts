/**
 * Power Focusable
 * High-precision focus management utility with full composed tree support.
 * Handles complex focus rules including tabindex ordering, radio groups, inert,
 * and shadow DOM.
 *
 * @version 3.1.0
 * @author Yusuke Kamiyamane
 * @license MIT
 * @copyright Copyright (c) Yusuke Kamiyamane
 * @see {@link https://github.com/y14e/power-focusable}
 */

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface PowerFocusableOptions {
  readonly active?: Element | null;
  readonly composed?: boolean;
  readonly filter?: (element: Element) => boolean;
  readonly wrap?: boolean;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const FOCUSABLE_SELECTOR = `:is(a[href], area[href], button, embed, iframe, input:not([type="hidden" i]), object, select, details > summary:first-of-type, textarea, [contenteditable]:not([contenteditable="false" i]), [controls], [tabindex]):not(:disabled, [hidden], [inert], [tabindex="-1"])`;

// -----------------------------------------------------------------------------
// APIs
// -----------------------------------------------------------------------------

export function createFocusTrap(container: Element) {
  if (!(container instanceof Element)) {
    throw new Error('Invalid container element');
  }

  focus(container);

  if (getActiveElement() !== container) {
    const first = getFocusables(container, { composed: true })[0];

    if (first) {
      focus(first);
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    const { key, altKey, ctrlKey, metaKey, shiftKey } = event;

    if (key !== 'Tab' || altKey || ctrlKey || metaKey) {
      return;
    }

    if (!event.composedPath().includes(container)) {
      return;
    }

    const focusable = getRelativeFocusable(container, shiftKey ? -1 : 1, {
      composed: true,
      wrap: true,
    });

    if (!focusable) {
      return;
    }

    event.preventDefault();
    focus(focusable);
  }

  let controller: AbortController | null = new AbortController();
  document.addEventListener('keydown', onKeyDown, {
    capture: true,
    signal: controller.signal,
  });

  return () => {
    controller?.abort();
    controller = null;
  };
}

export function getFocusables(
  container: Element = document.body,
  options: Omit<PowerFocusableOptions, 'active' | 'wrap'> = {},
) {
  if (!(container instanceof Element)) {
    console.warn('Invalid container element. Fallback: <body> element.');
    container = document.body;
  }

  const { composed = false, filter = () => true } = options;
  const elements: Element[] = [];

  if (composed) {
    function traverse(node: Node) {
      if (node instanceof Element) {
        if (isFocusable(node)) {
          elements[elements.length] = node;
        }
      }

      const children = getComposedChildren(node);

      for (let i = 0, l = children.length; i < l; i++) {
        const child = children[i];

        if (!child) {
          continue;
        }

        traverse(child);
      }
    }

    traverse(container);
  } else {
    const candidates = container.querySelectorAll(FOCUSABLE_SELECTOR);

    for (let i = 0, l = candidates.length; i < l; i++) {
      const candidate = candidates[i];

      if (!(candidate instanceof Element)) {
        continue;
      }

      if (isFocusable(candidate)) {
        elements[elements.length] = candidate;
      }
    }
  }

  return normalizeRadioGroup(sortByTabIndex(elements)).filter(filter);
}

export function getNextFocusable(
  container: Element = document.body,
  options: PowerFocusableOptions = {},
) {
  if (!(container instanceof Element)) {
    console.warn('Invalid container element. Fallback: <body> element.');
    container = document.body;
  }

  return getRelativeFocusable(container, 1, options);
}

export function getPreviousFocusable(
  container: Element = document.body,
  options: PowerFocusableOptions = {},
) {
  if (!(container instanceof Element)) {
    console.warn('Invalid container element. Fallback: <body> element.');
    container = document.body;
  }

  return getRelativeFocusable(container, -1, options);
}

export function hasFocusable(
  container: Element = document.body,
  options: Omit<PowerFocusableOptions, 'active' | 'wrap'> = {},
) {
  if (!(container instanceof Element)) {
    console.warn('Invalid container element. Fallback: <body> element.');
    container = document.body;
  }

  return !!getFocusables(container, options).length;
}

export function inertOutside(element: Element) {
  if (!(element instanceof Element)) {
    console.warn('Invalid element');
    return () => {};
  }

  function traverse(node: Element, callback: (_: Element) => void) {
    const parent = getComposedParent(node);

    if (!parent) {
      return;
    }

    for (const sibling of getComposedSiblings(node)) {
      callback(sibling);
    }

    traverse(parent, callback);
  }

  const elements: Element[] = [];

  traverse(element, (node) => {
    if (!(node instanceof Element)) {
      return;
    }

    if (applyInert(node)) {
      elements.push(node);
    }
  });

  return () => {
    elements.forEach((element) => {
      restoreInert(element);
    });
  };
}

export function isFocusable(element: Element) {
  if (!(element instanceof Element)) {
    console.warn('Invalid element');
    return false;
  }

  // Fast path [hidden], [inert]
  if (element.hasAttribute('hidden') || isInert(element)) {
    return false;
  }

  // Fast path [tabindex="-1"]
  if (getTabIndex(element) < 0) {
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
  container: Element,
  offset: number,
  options: PowerFocusableOptions,
) {
  const {
    active = getActiveElement(),
    composed = false,
    filter = () => true,
    wrap = false,
  } = options;
  const focusables = getFocusables(container, { composed, filter });
  const { length } = focusables;

  if (!length) {
    return null;
  }

  if (!active || !containsComposed(container, active)) {
    return null;
  }

  if (!(active instanceof Element)) {
    return null;
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
    if (isInert(current)) {
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

function normalizeRadioGroup(elements: Element[]) {
  let map: Map<string, HTMLInputElement[]> | null = null;

  for (let i = 0, l = elements.length; i < l; i++) {
    const element = elements[i];

    if (!(element instanceof HTMLInputElement)) {
      continue;
    }

    if (!isUngroupedRadio(element)) {
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

function sortByTabIndex(elements: Element[]) {
  const ordered: Element[] = [];
  const natural: Element[] = [];

  for (let i = 0, l = elements.length; i < l; i++) {
    const element = elements[i];

    if (!element) {
      continue;
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

// -----------------------------------------------------------------------------
// Composed
// -----------------------------------------------------------------------------

function containsComposed(container: Node, element: Node) {
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

function getComposedChildren(node: Node) {
  if (node instanceof ShadowRoot) {
    return getChildren(node);
  }

  if (!(node instanceof Element)) {
    return [];
  }

  if (node instanceof HTMLSlotElement) {
    const assigned = node.assignedElements({ flatten: true });

    if (assigned.length) {
      return assigned;
    }
  }

  if (node instanceof HTMLElement && node.shadowRoot?.mode === 'open') {
    return getChildren(node.shadowRoot);
  }

  return getChildren(node);
}

function getComposedParent(node: Node) {
  if (node instanceof Element && node.assignedSlot) {
    return node.assignedSlot;
  }

  const parent = node.parentNode;

  if (parent instanceof ShadowRoot) {
    return parent.host as Element;
  }

  return parent instanceof Element ? parent : null;
}

function getComposedSiblings(node: Element) {
  if (node.assignedSlot) {
    const siblings = node.assignedSlot.children;
    const filtered: Element[] = [];

    for (let i = 0, l = siblings.length; i < l; i++) {
      const sibling = siblings[i];

      if (sibling !== node) {
        if (!(sibling instanceof Element)) {
          continue;
        }

        filtered[filtered.length] = sibling;
      }
    }

    return filtered;
  }

  const parent = getComposedParent(node);

  if (!parent) {
    return [];
  }

  return getSiblings(node);
}

// -----------------------------------------------------------------------------
// State
// -----------------------------------------------------------------------------

const inertRefCounts = new WeakMap<Element, number>();

function applyInert(element: Element) {
  if (isInert(element) && !inertRefCounts.has(element)) {
    return false;
  }

  const count = inertRefCounts.get(element) ?? 0;
  inertRefCounts.set(element, count + 1);

  if (count === 0) {
    setInert(element, true);
  }

  return true;
}

function restoreInert(element: Element) {
  const count = inertRefCounts.get(element);

  if (!count) {
    return;
  }

  if (count === 1) {
    inertRefCounts.delete(element);
    setInert(element, false);
    return;
  }

  inertRefCounts.set(element, count - 1);
}

// -----------------------------------------------------------------------------
// Utils
// -----------------------------------------------------------------------------

function focus(element: Element) {
  if ('focus' in element && typeof element.focus === 'function') {
    element.focus();
  }
}

function getActiveElement() {
  let current = document.activeElement;

  while (current?.shadowRoot?.activeElement) {
    current = current.shadowRoot.activeElement;
  }

  return current;
}

function getChildren(node: ParentNode) {
  const elements: Element[] = [];

  for (
    let child = node.firstElementChild;
    child;
    child = child.nextElementSibling
  ) {
    elements[elements.length] = child;
  }

  return elements;
}

function getSiblings(node: Element) {
  const parent = getComposedParent(node);

  if (!parent) {
    return [];
  }

  const elements: Element[] = [];

  for (
    let child = parent.firstElementChild;
    child;
    child = child.nextElementSibling
  ) {
    if (child !== node) {
      elements[elements.length] = child;
    }
  }

  return elements;
}

function getTabIndex(element: Element) {
  return 'tabIndex' in element ? Number(element.tabIndex) : 0;
}

function isDisabled(element: Element) {
  return 'disabled' in element && !!element.disabled;
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

function isInert(element: Element) {
  return 'inert' in element && !!element.inert;
}

function isUngroupedRadio(element: Element) {
  return (
    element instanceof HTMLInputElement &&
    element.type === 'radio' &&
    !!element.name
  );
}

function setInert(element: Element, boolean: boolean) {
  if (boolean) {
    element.setAttribute('inert', '');
  } else {
    element.removeAttribute('inert');
  }
}
