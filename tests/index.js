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
    let traverse2 = function(node) {
      if (node instanceof HTMLElement) {
        if (isFocusable(node)) {
          elements[elements.length] = node;
        }
        const shadow = node.shadowRoot;
        if (shadow && shadow.mode === "open") {
          traverse2(shadow);
        }
      }
      if (node instanceof HTMLSlotElement) {
        const assigned = node.assignedElements({ flatten: true });
        if (assigned.length) {
          for (let i = 0, l = assigned.length; i < l; i++) {
            traverse2(assigned[i]);
          }
          return;
        }
      }
      const children = node.childNodes;
      for (let i = 0, l = children.length; i < l; i++) {
        traverse2(children[i]);
      }
    };
    traverse2(container);
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
  return !!getFocusables(container, options).length;
}
function isFocusable(element) {
  if (!(element instanceof HTMLElement)) {
    console.warn("Invalid element");
    return false;
  }
  if (element.hasAttribute("hidden") || element.hasAttribute("inert")) {
    return false;
  }
  const index = element.getAttribute("tabindex");
  if (index && Number(index) < 0) {
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
  let current = element;
  while (current) {
    if (current === container) {
      return true;
    }
    current = current instanceof ShadowRoot ? current.mode === "open" ? current.host : null : current.parentNode;
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
var tabIndexCache = /* @__PURE__ */ new WeakMap();
function getTabIndex(element) {
  const cached = tabIndexCache.get(element);
  if (cached !== void 0) {
    return cached;
  }
  const index = Number(element.getAttribute("tabindex"));
  tabIndexCache.set(element, index);
  return index;
}
function isDisabled(element) {
  return "disabled" in element && !!element.disabled;
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
    if (current.hasAttribute("inert")) {
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
function isFormControl(element) {
  const name = element.tagName;
  return name === "BUTTON" || name === "INPUT" || name === "SELECT" || name === "TEXTAREA";
}
function isUngroupedRadio(element) {
  return element instanceof HTMLInputElement && element.type === "radio" && !!element.name;
}
function normalizeRadioGroup(elements) {
  let map = null;
  for (let i = 0, l = elements.length; i < l; i++) {
    const element = elements[i];
    if (!isUngroupedRadio(element)) {
      continue;
    }
    if (!map) {
      map = /* @__PURE__ */ new Map();
    }
    const key = `${element.form?.id ?? "no-form"}::${element.name}`;
    const group = map.get(key) ?? map.set(key, []).get(key);
    group[group.length] = element;
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
 * @version 2.1.5
 * @author Yusuke Kamiyamane
 * @license MIT
 * @copyright Copyright (c) Yusuke Kamiyamane
 * @see {@link https://github.com/y14e/power-focusable}
 */

export { getFocusables, getNextFocusable, getPreviousFocusable, hasFocusable, isFocusable };
