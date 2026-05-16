// src/index.ts
var FOCUSABLE_SELECTOR = `:is(a[href], area[href], button, embed, iframe, input:not([type="hidden" i]), object, select, details > summary:first-of-type, textarea, [contenteditable]:not([contenteditable="false" i]), [controls], [tabindex]):not(:disabled, [hidden], [inert], [tabindex="-1"])`;
function createFocusTrap(container = document.body) {
  if (!(container instanceof Element)) {
    throw new Error("Invalid container element");
  }
  focus(container);
  if (getActiveElement() !== container) {
    const first = getFocusables(container, { composed: true })[0];
    first && focus(first);
  }
  function onKeyDown(event) {
    const { key, altKey, ctrlKey, metaKey, shiftKey } = event;
    if (key !== "Tab" || altKey || ctrlKey || metaKey) {
      return;
    }
    if (!event.composedPath().includes(container)) {
      return;
    }
    const focusable = getRelativeFocusable(container, shiftKey ? -1 : 1, {
      composed: true,
      wrap: true
    });
    if (!focusable) {
      return;
    }
    event.preventDefault();
    focus(focusable);
  }
  let controller = new AbortController();
  document.addEventListener("keydown", onKeyDown, {
    capture: true,
    signal: controller.signal
  });
  return () => {
    controller?.abort();
    controller = null;
  };
}
function getFocusables(container = document.body, options = {}) {
  if (!(container instanceof Element)) {
    console.warn("Invalid container element. Fallback: <body> element.");
    container = document.body;
  }
  const { composed = false, filter = () => true } = options;
  const elements = [];
  if (composed) {
    let traverse2 = function(node) {
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
        traverse2(child);
      }
    };
    traverse2(container);
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
function getNextFocusable(container = document.body, options = {}) {
  if (!(container instanceof Element)) {
    console.warn("Invalid container element. Fallback: <body> element.");
    container = document.body;
  }
  return getRelativeFocusable(container, 1, options);
}
function getPreviousFocusable(container = document.body, options = {}) {
  if (!(container instanceof Element)) {
    console.warn("Invalid container element. Fallback: <body> element.");
    container = document.body;
  }
  return getRelativeFocusable(container, -1, options);
}
function hasFocusable(container = document.body, options = {}) {
  if (!(container instanceof Element)) {
    console.warn("Invalid container element. Fallback: <body> element.");
    container = document.body;
  }
  return !!getFocusables(container, options).length;
}
function inertOutside(element) {
  if (!(element instanceof Element)) {
    console.warn("Invalid element");
    return () => {
    };
  }
  function traverse(node, callback) {
    const parent = getComposedParent(node);
    if (!parent) {
      return;
    }
    for (const sibling of getComposedSiblings(node)) {
      callback(sibling);
    }
    traverse(parent, callback);
  }
  const elements = [];
  traverse(element, (node) => {
    if (!(node instanceof Element)) {
      return;
    }
    applyInert(node) && elements.push(node);
  });
  return () => {
    elements.forEach((element2) => {
      restoreInert(element2);
    });
  };
}
function isFocusable(element) {
  if (!(element instanceof Element)) {
    console.warn("Invalid element");
    return false;
  }
  if (element.hasAttribute("hidden") || isInert(element)) {
    return false;
  }
  if (getTabIndex(element) < 0) {
    return false;
  }
  if (!element.matches(FOCUSABLE_SELECTOR)) {
    return false;
  }
  if (isDisabledDeep(element)) {
    return false;
  }
  if (!element.checkVisibility({
    contentVisibilityAuto: true,
    opacityProperty: true,
    visibilityProperty: true
  })) {
    return false;
  }
  return true;
}
function getRelativeFocusable(container, offset, options) {
  const {
    anchor = getActiveElement(),
    composed = false,
    filter = () => true,
    wrap = false
  } = options;
  const focusables = getFocusables(container, { composed, filter });
  const { length } = focusables;
  if (!length) {
    return null;
  }
  if (!anchor || !containsComposed(container, anchor)) {
    return null;
  }
  if (!(anchor instanceof Element)) {
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
function isDisabledDeep(element) {
  let current = element;
  while (current) {
    if (current instanceof ShadowRoot) {
      if (current.mode !== "open") {
        return false;
      }
      current = current.host;
      continue;
    }
    if (!(current instanceof Element)) {
      current = current.parentNode;
      continue;
    }
    if (current === element && isFormControl(current) && isDisabled(current)) {
      return true;
    }
    if (isInert(current)) {
      return true;
    }
    if (isFormControl(element) && current.tagName === "FIELDSET" && isDisabled(current)) {
      if (!current.querySelector(":scope > legend:first-of-type")?.contains(element)) {
        return true;
      }
    }
    current = current.parentNode;
  }
  return false;
}
function normalizeRadioGroup(elements) {
  let map = null;
  for (let i = 0, l = elements.length; i < l; i++) {
    const element = elements[i];
    if (!(element instanceof HTMLInputElement)) {
      continue;
    }
    if (!isUngroupedRadio(element)) {
      continue;
    }
    if (!map) {
      map = /* @__PURE__ */ new Map();
    }
    const key = `${element.form?.id ?? "no-form"}::${element.name}`;
    const group = map.get(key) ?? map.set(key, []).get(key);
    if (group) {
      group[group.length] = element;
    }
  }
  if (!map) {
    return elements;
  }
  const placeholder = /* @__PURE__ */ new Set();
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
function sortByTabIndex(elements) {
  const ordered = [];
  const natural = [];
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
function containsComposed(container, element) {
  let current = element;
  while (current) {
    if (current === container) {
      return true;
    }
    current = current instanceof ShadowRoot ? current.mode === "open" ? current.host : null : current.parentNode;
  }
  return false;
}
function getComposedChildren(node) {
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
  if (node instanceof HTMLElement && node.shadowRoot?.mode === "open") {
    return getChildren(node.shadowRoot);
  }
  return getChildren(node);
}
function getComposedParent(node) {
  if (node instanceof Element && node.assignedSlot) {
    return node.assignedSlot;
  }
  const parent = node.parentNode;
  if (parent instanceof ShadowRoot) {
    return parent.host;
  }
  return parent instanceof Element ? parent : null;
}
function getComposedSiblings(node) {
  if (node.assignedSlot) {
    const siblings = node.assignedSlot.children;
    const filtered = [];
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
var inertRefCounts = /* @__PURE__ */ new WeakMap();
function applyInert(element) {
  if (isInert(element) && !inertRefCounts.has(element)) {
    return false;
  }
  const count = inertRefCounts.get(element) ?? 0;
  inertRefCounts.set(element, count + 1);
  count === 0 && element.toggleAttribute("inert", true);
  return true;
}
function restoreInert(element) {
  const count = inertRefCounts.get(element);
  if (!count) {
    return;
  }
  if (count === 1) {
    inertRefCounts.delete(element);
    element.toggleAttribute("inert", false);
    return;
  }
  inertRefCounts.set(element, count - 1);
}
function focus(element) {
  "focus" in element && typeof element.focus === "function" && element.focus();
}
function getActiveElement() {
  let current = document.activeElement;
  while (current?.shadowRoot?.activeElement) {
    current = current.shadowRoot.activeElement;
  }
  return current;
}
function getChildren(node) {
  const elements = [];
  for (let child = node.firstElementChild; child; child = child.nextElementSibling) {
    elements[elements.length] = child;
  }
  return elements;
}
function getSiblings(node) {
  const parent = getComposedParent(node);
  if (!parent) {
    return [];
  }
  const elements = [];
  for (let child = parent.firstElementChild; child; child = child.nextElementSibling) {
    if (child !== node) {
      elements[elements.length] = child;
    }
  }
  return elements;
}
function getTabIndex(element) {
  return "tabIndex" in element ? Number(element.tabIndex) : 0;
}
function isDisabled(element) {
  return "disabled" in element && !!element.disabled;
}
function isFormControl(element) {
  const name = element.tagName;
  return name === "BUTTON" || name === "INPUT" || name === "SELECT" || name === "TEXTAREA";
}
function isInert(element) {
  return "inert" in element && !!element.inert;
}
function isUngroupedRadio(element) {
  return element instanceof HTMLInputElement && element.type === "radio" && !!element.name;
}
/**
 * Power Focusable
 * High-precision focus management utility with full composed tree support.
 * Handles complex focus rules including tabindex ordering, radio groups, inert,
 * and shadow DOM.
 *
 * @version 4.0.2
 * @author Yusuke Kamiyamane
 * @license MIT
 * @copyright Copyright (c) Yusuke Kamiyamane
 * @see {@link https://github.com/y14e/power-focusable}
 */

export { createFocusTrap, getFocusables, getNextFocusable, getPreviousFocusable, hasFocusable, inertOutside, isFocusable };
