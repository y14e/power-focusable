export function containsComposed(container: Element, element: Element): boolean {
  let current: ParentNode | null = element;

  while (current) {
    if (current === container) {
      return true;
    }

    current =
      current instanceof ShadowRoot
        ? current.mode === 'open'
          ? current.host
          : null
        : current.parentNode;
  }

  return false;
}

export function getComposedChildren(element: Element): Element[] {
  if (element instanceof ShadowRoot) {
    return [...element.children];
  }

  if (!(element instanceof Element)) {
    return [];
  }

  if (element instanceof HTMLSlotElement) {
    const assigned = element.assignedElements({ flatten: true });

    if (assigned.length) {
      return assigned;
    }
  }

  if (element instanceof HTMLElement && element.shadowRoot?.mode === 'open') {
    return [...element.shadowRoot.children];
  }

  return [...element.children];
}

export function getComposedParent(element: Element): Element | null {
  if (element instanceof Element && element.assignedSlot) {
    return element.assignedSlot;
  }

  const parent = element.parentNode;
  return parent instanceof ShadowRoot ? parent.host : parent instanceof Element ? parent : null;
}

export function getComposedSiblings(element: Element): Element[] {
  const parent = getComposedParent(element);
  return parent
    ? (parent instanceof HTMLSlotElement
        ? parent.assignedElements({ flatten: true })
        : getComposedChildren(parent)
      ).filter((s) => s !== element)
    : [];
}
