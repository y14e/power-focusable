export interface PowerFocusableOptions {
  anchor: Element | null;
  composed: boolean;
  filter: PredicateFunction | undefined;
  include: PredicateFunction | undefined;
  skipNegativeTabIndexCheck: boolean;
  skipVisibilityCheck: boolean;
  wrap: boolean;
}

type PredicateFunction = (element: Element) => boolean;
