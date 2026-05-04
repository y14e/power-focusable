// src/index.ts
var FOCUSABLE_SELECTOR = `:is(a[href], area[href], button, embed, iframe, input:not([type="hidden" i]), object, select, details > summary:first-of-type, textarea, [contenteditable]:not([contenteditable="false" i]), [controls], [tabindex]):not(:disabled, [hidden], [inert], [tabindex="-1"])`;
var cache = /* @__PURE__ */ new WeakMap();
function getFocusables(container = document.body) {
  if (!(container instanceof HTMLElement)) {
    console.warn("Invalid container element. Fallback: <body> element.");
    container = document.body;
  }
  function hasShadow(root) {
    let isFound = false;
    function walk2(node) {
      if (isFound) {
        return;
      }
      if (node instanceof HTMLElement && node.shadowRoot && node.shadowRoot.mode === "open") {
        isFound = true;
        return;
      }
      node.childNodes.forEach(walk2);
    }
    walk2(root);
    return isFound;
  }
  if (!container.querySelector(FOCUSABLE_SELECTOR) && !hasShadow(container)) {
    return [];
  }
  const elements = [];
  function walk(node) {
    if (node instanceof HTMLElement) {
      if (isFocusable(node)) {
        elements.push(node);
      }
      const shadow = node.shadowRoot;
      if (shadow && shadow.mode === "open") {
        walk(shadow);
      }
    } else if (node instanceof HTMLSlotElement) {
      const elements2 = node.assignedElements({ flatten: true });
      if (elements2.length > 0) {
        elements2.forEach((element) => {
          walk(element);
        });
        return;
      }
    }
    node.childNodes.forEach((child) => {
      walk(child);
    });
  }
  walk(container);
  function sort(elements2) {
    const ordered = [];
    const natural = [];
    function getTabIndex(element) {
      const cached = cache.get(element);
      if (cached !== void 0) {
        return cached;
      }
      const number = Number(element.getAttribute("tabindex"));
      cache.set(element, number);
      return number;
    }
    elements2.forEach((element) => {
      (getTabIndex(element) > 0 ? ordered : natural).push(element);
    });
    ordered.sort((a, b) => getTabIndex(a) - getTabIndex(b));
    return [...ordered, ...natural];
  }
  function normalizeRadioGroup(elements2) {
    let map = null;
    const result = [];
    for (const element of elements2) {
      if (element instanceof HTMLInputElement && element.type === "radio" && element.name) {
        if (!map) {
          map = /* @__PURE__ */ new Map();
        }
        const key = `${element.form?.id ?? "no-form"}::${element.name}`;
        (map.get(key) ?? map.set(key, []).get(key)).push(element);
      } else {
        result.push(element);
      }
    }
    if (!map) {
      return result;
    }
    for (const group of map.values()) {
      const enabled = group.filter((radio) => isFocusable(radio));
      if (enabled.length === 0) {
        continue;
      }
      result.push(
        enabled.find((radio) => radio.checked) ?? enabled[0]
      );
    }
    return result;
  }
  return normalizeRadioGroup(sort(elements));
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
function hasFocusable(container = document.body) {
  if (!(container instanceof HTMLElement)) {
    console.warn("Invalid container element. Fallback: <body> element.");
    container = document.body;
  }
  return getFocusables(container).length > 0;
}
function isFocusable(element) {
  if (!(element instanceof HTMLElement)) {
    console.warn("Invalid element");
    return false;
  }
  function isDisabledDeep(element2) {
    function isFormControl(element3) {
      return /^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(element3.tagName);
    }
    function isDisabled(element3) {
      return "disabled" in element3 && element3.disabled;
    }
    for (let current = element2; current; current = current instanceof ShadowRoot ? current.mode === "open" ? current.host : null : current.parentNode) {
      if (!(current instanceof Element)) {
        continue;
      }
      if (current === element2 && isFormControl(current) && isDisabled(current)) {
        return true;
      }
      if (current.matches("[inert]")) {
        return true;
      }
      if (isFormControl(element2) && current.tagName === "FIELDSET" && isDisabled(current)) {
        if (current.querySelector(":scope > legend:first-of-type")?.contains(element2)) {
          continue;
        }
        return true;
      }
    }
    return false;
  }
  return element.matches(FOCUSABLE_SELECTOR) && !isDisabledDeep(element) && element.checkVisibility({
    contentVisibilityAuto: true,
    opacityProperty: true,
    visibilityProperty: true
  });
}
function getRelativeFocusable(container, offset = 0, options) {
  const focusables = getFocusables(container);
  const { length } = focusables;
  if (length === 0) {
    return null;
  }
  const { active, wrap = false } = options;
  function getActiveElement() {
    let active2 = document.activeElement;
    while (active2 instanceof HTMLElement && active2.shadowRoot?.activeElement) {
      active2 = active2.shadowRoot.activeElement;
    }
    return active2 instanceof HTMLElement ? active2 : null;
  }
  const current = active ?? getActiveElement();
  function containsDeep(container2, node) {
    for (let current2 = node; current2; current2 = !(current2 instanceof ShadowRoot) ? current2.parentNode : current2.mode === "open" ? current2.host : null) {
      if (current2 === container2) {
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
/**
 * Power Focusable
 * High-precision focus management utility with shadow DOM support.
 * Handles complex focus rules.
 *
 * @version 1.0.0
 * @author Yusuke Kamiyamane
 * @license MIT
 * @copyright Copyright (c) Yusuke Kamiyamane
 * @see {@link https://github.com/y14e/power-focusable}
 */

export { getFocusables, getNextFocusable, getPreviousFocusable, hasFocusable, isFocusable };
