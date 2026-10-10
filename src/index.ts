import { containsComposed, getComposedChildren } from '@/composed';
import {
  FOCUSABLE_SELECTOR,
  FOCUSABLE_SELECTOR_WITH_NEGATIVE_TABINDEX,
} from '@/constants';
import { createFocusTrap } from '@/focus-trap';
import { inertOutside } from '@/inert';
import {
  getRelativeFocusable,
  isDisabledDeep,
  normalizeRadioGroup,
  sortByTabIndex,
} from '@/internal';
import { resolveOptions } from '@/options';
import type { PowerFocusableOptions as Options } from '@/types';
import { focusElement, getActiveElement, getTabIndex, isInert } from '@/utils';

export function getFocusables(
  container: Element = document.body,
  options: Partial<Omit<Options, 'anchor' | 'wrap'>> = {},
): Element[] {
  if (!(container instanceof Element)) {
    console.warn('Invalid container element. Fallback: <body> element.');
    container = document.body;
  }

  const {
    composed,
    filter,
    include,
    skipNegativeTabIndexCheck,
    skipVisibilityCheck,
  } = resolveOptions(options);
  const candidates: Element[] = [];

  if (!composed && !include) {
    for (const match of container.querySelectorAll(
      !skipNegativeTabIndexCheck
        ? FOCUSABLE_SELECTOR
        : FOCUSABLE_SELECTOR_WITH_NEGATIVE_TABINDEX,
    )) {
      match &&
        isFocusable(match, {
          skipNegativeTabIndexCheck,
          skipVisibilityCheck,
        }) &&
        candidates.push(match);
    }
  } else {
    function traverse(node: Element): void {
      if (
        isFocusable(node, {
          skipNegativeTabIndexCheck,
          skipVisibilityCheck,
        }) ||
        include?.(node)
      ) {
        candidates.push(node);
      }

      (!composed ? [...node.children] : getComposedChildren(node)).map(
        traverse,
      );
    }

    (!composed ? [...container.children] : getComposedChildren(container)).map(
      traverse,
    );
  }

  return normalizeRadioGroup(
    sortByTabIndex(!filter ? candidates : candidates.filter(filter)),
  );
}

export function getNextFocusable(
  container: Element = document.body,
  options: Partial<Options> = {},
): Element | null {
  return getRelativeFocusable(container, 1, options);
}

export function getPreviousFocusable(
  container: Element = document.body,
  options: Partial<Options> = {},
): Element | null {
  return getRelativeFocusable(container, -1, options);
}

export function hasFocusable(
  container: Element = document.body,
  options: Partial<Omit<Options, 'anchor' | 'wrap'>> = {},
): boolean {
  return !!getFocusables(container, options).length;
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

  const { skipNegativeTabIndexCheck, skipVisibilityCheck } =
    resolveOptions(options);

  // Fast path: [hidden], [inert]
  if (element.hasAttribute('hidden') || isInert(element)) {
    return false;
  }

  // Fast path: [tabindex="-1"]
  if (!skipNegativeTabIndexCheck && getTabIndex(element) < 0) {
    return false;
  }

  if (
    !element.matches(
      !skipNegativeTabIndexCheck
        ? FOCUSABLE_SELECTOR
        : FOCUSABLE_SELECTOR_WITH_NEGATIVE_TABINDEX,
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

export type { Options as PowerFocusableOptions };
export {
  containsComposed,
  createFocusTrap,
  focusElement,
  getActiveElement,
  inertOutside,
};
