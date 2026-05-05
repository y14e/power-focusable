// src/index.ts
var FOCUSABLE_SELECTOR = `:is(a[href], area[href], button, embed, iframe, input:not([type="hidden" i]), object, select, details > summary:first-of-type, textarea, [contenteditable]:not([contenteditable="false" i]), [controls], [tabindex]):not(:disabled, [hidden], [inert], [tabindex="-1"])`;
var tabIndexCache = /* @__PURE__ */ new WeakMap();
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
          elements.push(node);
        }
        const shadow = node.shadowRoot;
        if (shadow && shadow.mode === "open") {
          walk2(shadow);
        }
      } else if (node instanceof HTMLSlotElement) {
        const assigned = node.assignedElements({ flatten: true });
        if (assigned.length > 0) {
          assigned.forEach((a) => {
            walk2(a);
          });
          return;
        }
      }
      node.childNodes.forEach((child) => {
        walk2(child);
      });
    };
    walk2(container);
  } else {
    elements.push(
      ...[
        ...container.querySelectorAll(FOCUSABLE_SELECTOR)
      ].filter(isFocusable)
    );
  }
  function sort(elements2) {
    const ordered = [];
    const natural = [];
    function getTabIndex(element) {
      const cached = tabIndexCache.get(element);
      if (cached !== void 0) {
        console.log('hit cache', cached);
        return cached;
      }
      const number = Number(element.getAttribute("tabindex"));
      tabIndexCache.set(element, number);
      return number;
    }
    elements2.forEach((element) => {
      (getTabIndex(element) > 0 ? ordered : natural).push(element);
    });
    ordered.sort((a, b) => getTabIndex(a) - getTabIndex(b));
    return [...ordered, ...natural];
  }
  function normalize(elements2) {
    let map = null;
    for (const element of elements2) {
      if (element instanceof HTMLInputElement && element.type === "radio" && element.name) {
        if (!map) {
          map = /* @__PURE__ */ new Map();
        }
        const key = `${element.form?.id ?? "no-form"}::${element.name}`;
        (map.get(key) ?? map.set(key, []).get(key)).push(element);
      }
    }
    if (!map) {
      return elements2;
    }
    const placeholder = /* @__PURE__ */ new Set();
    for (const group of map.values()) {
      if (group.length > 0) {
        const enabled = group.filter((radio) => isFocusable(radio));
        if (enabled.length > 0) {
          placeholder.add(
            enabled.find((radio) => radio.checked) ?? enabled[0]
          );
        }
      }
    }
    return elements2.filter((element) => {
      if (element instanceof HTMLInputElement && element.type === "radio" && element.name) {
        return placeholder.has(element);
      }
      return true;
    });
  }
  return normalize(sort(elements));
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
  const { active, composed = false, wrap = false } = options;
  const focusables = getFocusables(container, { composed });
  const { length } = focusables;
  if (length === 0) {
    return null;
  }
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
 * Handles complex focus rules including tabindex ordering, radio groups, etc.
 *
 * @version 2.0.3
 * @author Yusuke Kamiyamane
 * @license MIT
 * @copyright Copyright (c) Yusuke Kamiyamane
 * @see {@link https://github.com/y14e/power-focusable}
 */

export { getFocusables, getNextFocusable, getPreviousFocusable, hasFocusable, isFocusable };
