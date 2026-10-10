import { containsComposed } from '@/composed';
import { getFocusables } from '@/index';
import { resolveOptions } from '@/options';
import type { PowerFocusableOptions as Options } from '@/types';
import {
  getTabIndex,
  isDisabled,
  isFormControl,
  isInert,
  isUngroupedRadio,
} from '@/utils';

export function getRelativeFocusable(
  container: Element,
  offset: number,
  options: Partial<Options>,
): Element | null {
  if (!(container instanceof Element)) {
    console.warn('Invalid container element. Fallback: <body> element.');
    container = document.body;
  }

  const {
    anchor,
    composed,
    filter,
    include,
    skipNegativeTabIndexCheck,
    skipVisibilityCheck,
    wrap,
  } = resolveOptions(options);

  if (!(anchor instanceof Element)) {
    console.warn('Invalid anchor element');
    return null;
  }

  if (!containsComposed(container, anchor)) {
    console.warn('Anchor (active) element not within container');
    return null;
  }

  const focusables = getFocusables(container, {
    composed,
    filter,
    include,
    skipNegativeTabIndexCheck,
    skipVisibilityCheck,
  });
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

export function isDisabledDeep(element: Element): boolean {
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
    // https://html.spec.whatwg.org/multipage/form-elements.html#the-fieldset-element
    // https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#concept-fe-disabled
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

export function normalizeRadioGroup(elements: Element[]): Element[] {
  let map: Map<
    Node,
    Map<HTMLFormElement | null, Map<string, HTMLInputElement[]>>
  > | null = null;

  for (const element of elements) {
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
    const groups = map.get(root) ?? map.set(root, new Map()).get(root);

    if (!groups) {
      continue;
    }

    const { form, name } = element;
    const radios = groups.get(form) ?? groups.set(form, new Map()).get(form);

    if (!radios) {
      continue;
    }

    (radios.get(name) ?? radios.set(name, []).get(name))?.push(element);
  }

  if (!map) {
    return elements;
  }

  const placeholder = new Set<HTMLInputElement>();

  for (const v of map.values()) {
    for (const w of v.values()) {
      for (const x of w.values()) {
        const radio = x.find((r) => r.checked) ?? x[0];
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

export function sortByTabIndex(elements: Element[]): Element[] {
  const ordered: Element[] = [];
  const natural: Element[] = [];

  for (const element of elements) {
    (getTabIndex(element) > 0 ? ordered : natural).push(element);
  }

  return ordered
    .sort((a, b) => getTabIndex(a) - getTabIndex(b))
    .concat(natural);
}
