/**
 * Power Focusable
 * High-precision focus management utility with full composed tree support.
 * Handles complex focus rules including tabindex ordering, radio groups, inert.
 *
 * @version 4.1.6
 * @author Yusuke Kamiyamane
 * @license MIT
 * @copyright Copyright (c) Yusuke Kamiyamane
 * @see {@link https://github.com/y14e/power-focusable}
 */

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface PowerFocusableOptions {
  readonly anchor?: Element | null;
  readonly composed?: boolean;
  readonly filter?: ((element: Element) => boolean) | undefined;
  readonly include?: ((element: Element) => boolean) | undefined;
  readonly wrap?: boolean;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const FOCUSABLE_SELECTOR = `:is(a[href], area[href], button, embed, iframe, input:not([type="hidden" i]), object, select, details > summary:first-of-type, textarea, [contenteditable]:not([contenteditable="false" i]), [controls], [tabindex]):not(:disabled, [hidden], [inert], [tabindex="-1"])`;

// -----------------------------------------------------------------------------
// APIs
// -----------------------------------------------------------------------------

export function createFocusTrap(
  container: Element = document.body,
): () => void {
  if (!(container instanceof Element)) {
    throw new Error('Invalid container element');
  }

  focusElement(container);

  if (getActiveElement() !== container) {
    const first = getFocusables(container, { composed: true })[0];
    first && focusElement(first);
  }

  function onKeyDown(event: KeyboardEvent): void {
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
    focusElement(focusable);
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
  options: Omit<PowerFocusableOptions, 'anchor' | 'wrap'> = {},
): Element[] {
  if (!(container instanceof Element)) {
    console.warn('Invalid container element. Fallback: <body> element.');
    container = document.body;
  }

  let { composed = false, filter, include } = options;

  if (typeof composed !== 'boolean') {
    console.warn('Invalid composed. Fallback: false.');
    composed = false;
  }

  if (typeof filter !== 'undefined' && typeof filter !== 'function') {
    console.warn('Invalid filter. Fallback: no filter function (undefined).');
    filter = undefined;
  }

  if (typeof include !== 'undefined' && typeof include !== 'function') {
    console.warn('Invalid include. Fallback: no include function (undefined).');
    include = undefined;
  }

  const elements: Element[] = [];

  if (composed || include) {
    function traverse(node: Node): void {
      if (node instanceof Element) {
        if (isFocusable(node) || include?.(node)) {
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

  const unfiltered = normalizeRadioGroup(sortByTabIndex(elements));
  return filter ? unfiltered.filter(filter) : unfiltered;
}

export function getNextFocusable(
  container: Element = document.body,
  options: PowerFocusableOptions = {},
): Element | null {
  return getRelativeFocusable(container, 1, options);
}

export function getPreviousFocusable(
  container: Element = document.body,
  options: PowerFocusableOptions = {},
): Element | null {
  return getRelativeFocusable(container, -1, options);
}

export function hasFocusable(
  container: Element = document.body,
  options: Omit<PowerFocusableOptions, 'anchor' | 'wrap'> = {},
): boolean {
  return !!getFocusables(container, options).length;
}

export function inertOutside(element: Element): () => void {
  if (!(element instanceof Element)) {
    console.warn('Invalid element');
    return () => {};
  }

  function traverse(node: Element, callback: (_: Element) => void): void {
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

    applyInert(node) && elements.push(node);
  });

  return () => {
    elements.forEach((element) => {
      restoreInert(element);
    });
  };
}

export function isFocusable(element: Element): boolean {
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
): Element | null {
  let {
    anchor = getActiveElement(),
    composed = false,
    filter,
    include,
    wrap = false,
  } = options;

  if (!(anchor instanceof Element)) {
    const active = getActiveElement();

    if (active instanceof Element) {
      console.warn('Invalid anchor element. Fallback: active element.');
      anchor = active;
    } else {
      console.warn('Invalid anchor element');
      return null;
    }
  }

  if (!containsComposed(container, anchor)) {
    console.warn('Anchor (active) element not within container');
    return null;
  }

  if (typeof composed !== 'boolean') {
    console.warn('Invalid composed. Fallback: false.');
    composed = false;
  }

  if (typeof filter !== 'undefined' && typeof filter !== 'function') {
    console.warn('Invalid filter. Fallback: no filter function (undefined).');
    filter = undefined;
  }

  if (typeof include !== 'undefined' && typeof include !== 'function') {
    console.warn('Invalid include. Fallback: no include function (undefined).');
    include = undefined;
  }

  if (typeof wrap !== 'boolean') {
    console.warn('Invalid wrap. Fallback: false.');
    wrap = false;
  }

  const focusables = getFocusables(container, { composed, filter, include });
  const { length } = focusables;

  if (!length) {
    return null;
  }

  const currentIndex = focusables.indexOf(anchor);

  if (currentIndex === -1) {
    return null;
  }

  const offsetIndex = currentIndex + offset;

  if ((offsetIndex < 0 || offsetIndex >= length) && !wrap) {
    return null;
  }

  return focusables[(offsetIndex + length) % length] ?? null;
}

function isDisabledDeep(element: Element): boolean {
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

function normalizeRadioGroup(elements: Element[]): Element[] {
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
    placeholder.add(group.find((radio) => radio.checked) ?? group[0]);
  }

  return elements.filter((element) => {
    if (isUngroupedRadio(element)) {
      return placeholder.has(element);
    }

    return true;
  });
}

function sortByTabIndex(elements: Element[]): Element[] {
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

function containsComposed(container: Node, element: Node): boolean {
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

function getComposedChildren(node: Node): Element[] {
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

function getComposedParent(node: Node): Element | null {
  if (node instanceof Element && node.assignedSlot) {
    return node.assignedSlot;
  }

  const parent = node.parentNode;

  if (parent instanceof ShadowRoot) {
    return parent.host as Element;
  }

  return parent instanceof Element ? parent : null;
}

function getComposedSiblings(node: Element): Element[] {
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
// Inert
// -----------------------------------------------------------------------------

const inertRefCounts = new WeakMap<Element, number>();

function applyInert(element: Element): boolean {
  if (isInert(element) && !inertRefCounts.has(element)) {
    return false;
  }

  const count = inertRefCounts.get(element) ?? 0;
  inertRefCounts.set(element, count + 1);
  count === 0 && element.setAttribute('inert', '');
  return true;
}

function restoreInert(element: Element): void {
  const count = inertRefCounts.get(element);

  if (!count) {
    return;
  }

  if (count === 1) {
    inertRefCounts.delete(element);
    element.removeAttribute('inert');
    return;
  }

  inertRefCounts.set(element, count - 1);
}

// -----------------------------------------------------------------------------
// Utils
// -----------------------------------------------------------------------------

function focusElement(element: Element): void {
  'focus' in element && typeof element.focus === 'function' && element.focus();
}

function getActiveElement(): Element | null {
  let current = document.activeElement;

  while (current?.shadowRoot?.activeElement) {
    current = current.shadowRoot.activeElement;
  }

  return current;
}

function getChildren(node: ParentNode): Element[] {
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

function getSiblings(node: Element): Element[] {
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

function getTabIndex(element: Element): number {
  return 'tabIndex' in element ? Number(element.tabIndex) : 0;
}

function isDisabled(element: Element): boolean {
  return 'disabled' in element && !!element.disabled;
}

function isFormControl(element: Element): boolean {
  const name = element.tagName;
  return (
    name === 'BUTTON' ||
    name === 'INPUT' ||
    name === 'SELECT' ||
    name === 'TEXTAREA'
  );
}

function isInert(element: Element): boolean {
  return 'inert' in element && !!element.inert;
}

function isUngroupedRadio(element: Element): boolean {
  return (
    element instanceof HTMLInputElement &&
    element.type === 'radio' &&
    !!element.name
  );
}
