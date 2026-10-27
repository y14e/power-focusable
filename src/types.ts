export interface PowerFocusableOptions {
  anchor: Element | null;
  composed: boolean;
  filter: Predicate | undefined;
  include: Predicate | undefined;
  skipNegativeTabIndexCheck: boolean;
  skipVisibilityCheck: boolean;
  wrap: boolean;
}

type Predicate = (element: Element) => boolean;
