// src/index.ts
var FOCUSABLE_SELECTOR = `:is(a[href], area[href], button, embed, iframe, input:not([type="hidden" i]), object, select, details > summary:first-of-type, textarea, [contenteditable]:not([contenteditable="false" i]), [controls], [tabindex]):not(:disabled, [hidden], [inert], [tabindex="-1"])`;
function getFocusables(container = document.body, options = {}) {
  if (!(container instanceof HTMLElement)) {
    console.warn("Invalid container element. Fallback: <body> element.");
    container = document.body;
  }
  const { composed = false } = options;
  const elements = [];
  if (composed) {
    let walk2 = function(node) {
      if (node instanceof HTMLElement) {
        if (isFocusable(node)) {
          elements[elements.length] = node;
        }
        const shadow = node.shadowRoot;
        if (shadow && shadow.mode === "open") {
          walk2(shadow);
        }
      } else if (node instanceof HTMLSlotElement) {
        const assigned = node.assignedElements({ flatten: true });
        if (assigned.length > 0) {
          for (let i = 0, l = assigned.length; i < l; i++) {
            walk2(assigned[i]);
          }
          return;
        }
      }
      const children = node.childNodes;
      for (let i = 0, l = children.length; i < l; i++) {
        walk2(children[i]);
      }
    };
    walk2(container);
  } else {
    const candidates = container.querySelectorAll(FOCUSABLE_SELECTOR);
    for (let i = 0, l = candidates.length; i < l; i++) {
      const candidate = candidates[i];
      if (isFocusable(candidate)) {
        elements[elements.length] = candidate;
      }
    }
  }
  return normalizeRadioGroup(sortByTabIndex(elements));
}
function getNextFocusable(container = document.body, options = {}) {
  if (!(container instanceof HTMLElement)) {
    console.warn("Invalid container element. Fallback: <body> element.");
    container = document.body;
  }
  return getRelativeFocusable(container, 1, options);
}
function getPreviousFocusable(container = document.body, options = {}) {
  if (!(container instanceof HTMLElement)) {
    console.warn("Invalid container element. Fallback: <body> element.");
    container = document.body;
  }
  return getRelativeFocusable(container, -1, options);
}
function hasFocusable(container = document.body, options = {}) {
  if (!(container instanceof HTMLElement)) {
    console.warn("Invalid container element. Fallback: <body> element.");
    container = document.body;
  }
  return getFocusables(container, options).length > 0;
}
function isFocusable(element) {
  if (!(element instanceof HTMLElement)) {
    console.warn("Invalid element");
    return false;
  }
  if (element.hasAttribute("hidden") || element.hasAttribute("inert")) {
    return false;
  }
  const tabIndex = element.getAttribute("tabindex");
  if (tabIndex !== null) {
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
  if (!element.checkVisibility({
    contentVisibilityAuto: true,
    opacityProperty: true,
    visibilityProperty: true
  })) {
    return false;
  }
  return true;
}
function getRelativeFocusable(container, offset = 0, options) {
  const { active: a = null, composed = false, wrap = false } = options;
  const focusables = getFocusables(container, { composed });
  const { length } = focusables;
  if (length === 0) {
    return null;
  }
  const active = a ?? getActiveElement();
  if (active === null || !containsDeep(container, active)) {
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
function containsDeep(container, element) {
  function walk(node) {
    if (node === null) {
      return false;
    }
    if (node === container) {
      return true;
    }
    if (node instanceof ShadowRoot) {
      return node.mode === "open" ? walk(node.host) : false;
    }
    return walk(node.parentNode);
  }
  return walk(element);
}
function getActiveElement() {
  function walk(node) {
    if (node === null) {
      return null;
    }
    const active = node.shadowRoot?.activeElement;
    return active ? walk(active) : node;
  }
  return walk(document.activeElement);
}
var tabIndexCache = /* @__PURE__ */ new WeakMap();
function getTabIndex(element) {
  const cached = tabIndexCache.get(element);
  if (cached !== void 0) {
    return cached;
  }
  const number = Number(element.getAttribute("tabindex"));
  tabIndexCache.set(element, number);
  return number;
}
function isDisabled(element) {
  return "disabled" in element && element.disabled;
}
function isDisabledDeep(element) {
  function walk(node) {
    if (node === null) {
      return false;
    }
    if (node instanceof ShadowRoot) {
      return node.mode === "open" ? walk(node.host) : false;
    }
    if (!(node instanceof Element)) {
      return walk(node.parentNode);
    }
    if (node === element && isFormControl(node) && isDisabled(node)) {
      return true;
    }
    if (node.hasAttribute("inert")) {
      return true;
    }
    if (isFormControl(element) && node.tagName === "FIELDSET" && isDisabled(node)) {
      if (node.querySelector(":scope > legend:first-of-type")?.contains(element)) {
        return walk(node.parentNode);
      }
      return true;
    }
    return walk(node.parentNode);
  }
  return walk(element);
}
function isFormControl(element) {
  const tagName = element.tagName;
  return tagName === "BUTTON" || tagName === "INPUT" || tagName === "SELECT" || tagName === "TEXTAREA";
}
function normalizeRadioGroup(elements) {
  let map = null;
  for (let i = 0, l = elements.length; i < l; i++) {
    const element = elements[i];
    if (element instanceof HTMLInputElement && element.type === "radio" && element.name) {
      if (!map) {
        map = /* @__PURE__ */ new Map();
      }
      const key = `${element.form?.id ?? "no-form"}::${element.name}`;
      const group = map.get(key) ?? map.set(key, []).get(key);
      group[group.length] = element;
    }
  }
  if (!map) {
    return elements;
  }
  const placeholder = /* @__PURE__ */ new Set();
  for (const group of map.values()) {
    if (group.length > 0) {
      const enabled = group.filter(isFocusable);
      if (enabled.length > 0) {
        placeholder.add(enabled.find((radio) => radio.checked) ?? enabled[0]);
      }
    }
  }
  return elements.filter((element) => {
    if (element instanceof HTMLInputElement && element.type === "radio" && element.name) {
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
/**
 * Power Focusable
 * High-precision focus management utility with shadow DOM support.
 * Handles complex focus rules including tabindex ordering, radio groups, etc.
 *
 * @version 2.1.1
 * @author Yusuke Kamiyamane
 * @license MIT
 * @copyright Copyright (c) Yusuke Kamiyamane
 * @see {@link https://github.com/y14e/power-focusable}
 */

export { getFocusables, getNextFocusable, getPreviousFocusable, hasFocusable, isFocusable };
