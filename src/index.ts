/**
 * Power Focusable
 * High-precision focus management utility with full composed tree support.
 * Handles complex focus rules including tabindex ordering, radio groups, inert.
 *
 * @version 4.3.28
 * @author Yusuke Kamiyamane
 * @license MIT
 * @copyright Copyright (c) Yusuke Kamiyamane
 * @see {@link https://github.com/y14e/power-focusable}
 */

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface PowerFocusableOptions {
  anchor: Element | null;
  composed: boolean;
  filter: PredicateFunction;
  include: PredicateFunction;
  skipNegativeTabIndexCheck: boolean;
  skipVisibilityCheck: boolean;
  wrap: boolean;
}

type PredicateFunction = (element: Element) => boolean;

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const FOCUSABLE_SELECTOR = `:is(a[href], area[href], button, embed, iframe, input:not([type="hidden" i]), object, select, details > summary:first-of-type, textarea, [contenteditable]:not([contenteditable="false" i]), [controls], [tabindex]):not(:disabled, [hidden], [inert], [tabindex="-1"])`;
const FOCUSABLE_SELECTOR_WITH_NEGATIVE_TABINDEX = FOCUSABLE_SELECTOR.replace(
  /(,\s*)?\[tabindex="-1"\]/g,
  '',
);

// -----------------------------------------------------------------------------
// APIs
// -----------------------------------------------------------------------------

export function createFocusTrap(
  container: Element = document.body,
): () => void {
  if (!(container instanceof Element)) {
    console.warn('Invalid container element. Fallback: <body> element.');
    container = document.body;
  }

  const trap = new FocusTrap(container);
  return () => trap.destroy();
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
    this.#container.addEventListener('keydown', this.#onKeyDown, {
      signal: this.#controller.signal,
    });
    focusElement(this.#container);

    if (getActiveElement() !== this.#container) {
      const first = getFocusables(this.#container, { composed: true })[0];
      first && focusElement(first);
    }
  }

  #onKeyDown = (event: Event): void => {
    if (!(event instanceof KeyboardEvent)) {
      return;
    }

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

export function getFocusables(
  container: Element = document.body,
  options: Partial<Omit<PowerFocusableOptions, 'anchor' | 'wrap'>> = {},
): Element[] {
  if (!(container instanceof Element)) {
    console.warn('Invalid container element. Fallback: <body> element.');
    container = document.body;
  }

  let {
    composed = false,
    filter,
    include,
    skipNegativeTabIndexCheck = false,
    skipVisibilityCheck = false,
  } = options;

  if (typeof composed !== 'boolean') {
    console.warn('Invalid composed option. Fallback: false.');
    composed = false;
  }

  if (typeof filter !== 'undefined' && typeof filter !== 'function') {
    console.warn(
      'Invalid filter function. Fallback: no filter function (undefined).',
    );
    filter = undefined;
  }

  if (typeof include !== 'undefined' && typeof include !== 'function') {
    console.warn(
      'Invalid include function. Fallback: no include function (undefined).',
    );
    include = undefined;
  }

  if (typeof skipNegativeTabIndexCheck !== 'boolean') {
    console.warn('Invalid skipNegativeTabIndexCheck option. Fallback: false.');
    skipNegativeTabIndexCheck = false;
  }

  if (typeof skipVisibilityCheck !== 'boolean') {
    console.warn('Invalid skipVisibilityCheck option. Fallback: false.');
    skipVisibilityCheck = false;
  }

  const candidates: Element[] = [];

  if (composed || include) {
    function traverse(node: Element): void {
      if (
        isFocusable(node, {
          skipNegativeTabIndexCheck,
          skipVisibilityCheck,
        }) ||
        include?.(node)
      ) {
        candidates[candidates.length] = node;
      }

      const children = composed ? getComposedChildren(node) : getChildren(node);

      for (let i = 0, l = children.length; i < l; i++) {
        const child = children[i];
        child && traverse(child);
      }
    }

    const children = composed
      ? getComposedChildren(container)
      : getChildren(container);

    for (let i = 0, l = children.length; i < l; i++) {
      const child = children[i];
      child && traverse(child);
    }
  } else {
    const matches = container.querySelectorAll(
      skipNegativeTabIndexCheck
        ? FOCUSABLE_SELECTOR_WITH_NEGATIVE_TABINDEX
        : FOCUSABLE_SELECTOR,
    );

    for (let i = 0, l = matches.length; i < l; i++) {
      const matched = matches[i];

      if (
        matched &&
        isFocusable(matched, {
          skipNegativeTabIndexCheck,
          skipVisibilityCheck,
        })
      ) {
        candidates[candidates.length] = matched;
      }
    }
  }

  return normalizeRadioGroup(
    sortByTabIndex(filter ? candidates.filter(filter) : candidates),
  );
}

export function getNextFocusable(
  container: Element = document.body,
  options: Partial<PowerFocusableOptions> = {},
): Element | null {
  return getRelativeFocusable(container, 1, options);
}

export function getPreviousFocusable(
  container: Element = document.body,
  options: Partial<PowerFocusableOptions> = {},
): Element | null {
  return getRelativeFocusable(container, -1, options);
}

export function hasFocusable(
  container: Element = document.body,
  options: Partial<Omit<PowerFocusableOptions, 'anchor' | 'wrap'>> = {},
): boolean {
  return !!getFocusables(container, options).length;
}

export function inertOutside(element: Element): () => void {
  if (!(element instanceof Element)) {
    console.warn('Invalid element');
    return () => {};
  }

  function traverse(node: Element, fn: (_: Element) => void): void {
    const parent = getComposedParent(node);

    if (parent) {
      for (const sibling of getComposedSiblings(node)) {
        fn(sibling);
      }

      traverse(parent, fn);
    }
  }

  const elements: Element[] = [];
  traverse(element, (node) => node && applyInert(node) && elements.push(node));

  return () => {
    for (let i = 0, l = elements.length; i < l; i++) {
      const element = elements[i];
      element && restoreInert(element);
    }
  };
}

export function isFocusable(
  element: Element,
  options: {
    skipNegativeTabIndexCheck?: boolean;
    skipVisibilityCheck?: boolean;
  } = {},
): boolean {
  if (!(element instanceof Element)) {
    console.warn('Invalid element');
    return false;
  }

  let { skipNegativeTabIndexCheck = false, skipVisibilityCheck = false } =
    options;

  if (typeof skipNegativeTabIndexCheck !== 'boolean') {
    console.warn('Invalid skipNegativeTabIndexCheck option. Fallback: false.');
    skipNegativeTabIndexCheck = false;
  }

  if (typeof skipVisibilityCheck !== 'boolean') {
    console.warn('Invalid skipVisibilityCheck option. Fallback: false.');
    skipVisibilityCheck = false;
  }

  // Fast path [hidden], [inert]
  if (element.hasAttribute('hidden') || isInert(element)) {
    return false;
  }

  // Fast path [tabindex="-1"]
  if (!skipNegativeTabIndexCheck && getTabIndex(element) < 0) {
    return false;
  }

  if (
    !element.matches(
      skipNegativeTabIndexCheck
        ? FOCUSABLE_SELECTOR_WITH_NEGATIVE_TABINDEX
        : FOCUSABLE_SELECTOR,
    )
  ) {
    return false;
  }

  if (isDisabledDeep(element)) {
    return false;
  }

  if (
    !skipVisibilityCheck &&
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
  options: Partial<PowerFocusableOptions>,
): Element | null {
  if (!(container instanceof Element)) {
    console.warn('Invalid container element. Fallback: <body> element.');
    container = document.body;
  }

  let {
    anchor = getActiveElement(),
    composed = false,
    filter,
    include,
    skipNegativeTabIndexCheck = false,
    skipVisibilityCheck = false,
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
    console.warn('Invalid composed option. Fallback: false.');
    composed = false;
  }

  if (typeof filter !== 'undefined' && typeof filter !== 'function') {
    console.warn(
      'Invalid filter function. Fallback: no filter function (undefined).',
    );
    filter = undefined;
  }

  if (typeof include !== 'undefined' && typeof include !== 'function') {
    console.warn(
      'Invalid include function. Fallback: no include function (undefined).',
    );
    include = undefined;
  }

  if (typeof skipNegativeTabIndexCheck !== 'boolean') {
    console.warn('Invalid skipNegativeTabIndexCheck option. Fallback: false.');
    skipNegativeTabIndexCheck = false;
  }

  if (typeof skipVisibilityCheck !== 'boolean') {
    console.warn('Invalid skipVisibilityCheck option. Fallback: false.');
    skipVisibilityCheck = false;
  }

  if (typeof wrap !== 'boolean') {
    console.warn('Invalid wrap option. Fallback: false.');
    wrap = false;
  }

  const settings = {
    composed,
    skipNegativeTabIndexCheck,
    skipVisibilityCheck,
  };
  filter && Object.assign(settings, { filter });
  include && Object.assign(settings, { include });
  const focusables = getFocusables(container, settings);
  const { length } = focusables;

  if (!length) {
    return null;
  }

  const anchorIndex = focusables.indexOf(anchor);

  if (anchorIndex === -1) {
    return null;
  }

  const offsetIndex = anchorIndex + offset;

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
  let map: Map<
    Node,
    Map<HTMLFormElement | null, Map<string, HTMLInputElement[]>>
  > | null = null;

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

    const root = element.getRootNode();
    let value = map.get(root);

    if (!value) {
      value = new Map();
      map.set(root, value);
    }

    let v = value.get(element.form);

    if (!v) {
      v = new Map();
      value.set(element.form, v);
    }

    let vv = v.get(element.name);

    if (!vv) {
      vv = [];
      v.set(element.name, vv);
    }

    vv[vv.length] = element;
  }

  if (!map) {
    return elements;
  }

  const placeholder = new Set<HTMLInputElement>();

  for (const value of map.values()) {
    for (const v of value.values()) {
      for (const vv of v.values()) {
        const radio = vv.find((element) => element.checked) ?? vv[0];
        radio && placeholder.add(radio);
      }
    }
  }

  return elements.filter((element) => {
    if (!(element instanceof HTMLInputElement)) {
      return true;
    }

    return !isUngroupedRadio(element) || placeholder.has(element);
  });
}

function sortByTabIndex(elements: Element[]): Element[] {
  const ordered: Element[] = [];
  const natural: Element[] = [];

  for (let i = 0, l = elements.length; i < l; i++) {
    const element = elements[i];

    if (element) {
      const target = getTabIndex(element) > 0 ? ordered : natural;
      target[target.length] = element;
    }
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
    } else {
      current =
        current instanceof ShadowRoot
          ? current.mode === 'open'
            ? current.host
            : null
          : current.parentNode;
    }
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
  } else {
    const parent = node.parentNode;
    return parent instanceof ShadowRoot
      ? parent.host
      : parent instanceof Element
        ? parent
        : null;
  }
}

function getComposedSiblings(node: Element): Element[] {
  const parent = getComposedParent(node);

  if (!parent) {
    return [];
  }

  const siblings =
    parent instanceof HTMLSlotElement
      ? parent.assignedElements({ flatten: true })
      : getComposedChildren(parent);
  const filtered: Element[] = [];

  for (let i = 0, l = siblings.length; i < l; i++) {
    const sibling = siblings[i];

    if (sibling && sibling !== node) {
      filtered[filtered.length] = sibling;
    }
  }

  return filtered;
}

// -----------------------------------------------------------------------------
// Inert
// -----------------------------------------------------------------------------

const inertRefCounts = new WeakMap<Element, number>();

function applyInert(element: Element): boolean {
  if (!isInert(element) || inertRefCounts.has(element)) {
    const count = inertRefCounts.get(element) ?? 0;
    inertRefCounts.set(element, count + 1);
    !count && element.setAttribute('inert', '');
    return true;
  } else {
    return false;
  }
}

function restoreInert(element: Element): void {
  const count = inertRefCounts.get(element);

  if (!count) {
    return;
  }

  if (count === 1) {
    inertRefCounts.delete(element);
    element.removeAttribute('inert');
  } else {
    inertRefCounts.set(element, count - 1);
  }
}

// -----------------------------------------------------------------------------
// Utils
// -----------------------------------------------------------------------------

export function focusElement(element: Element): void {
  'focus' in element && typeof element.focus === 'function' && element.focus();
}

export function getActiveElement(): Element | null {
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

function isUngroupedRadio(element: HTMLInputElement): boolean {
  return element.type === 'radio' && !!element.name;
}
