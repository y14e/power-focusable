export function containsComposed(container: Node, element: Node): boolean {
  let current: Node | null = element;

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

export function getComposedChildren(node: Node): Element[] {
  if (node instanceof ShadowRoot) {
    return [...node.children];
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

  if (node instanceof HTMLElement && node.shadowRoot?.mode === 'open') {
    return [...node.shadowRoot.children];
  }

  return [...node.children];
}

export function getComposedParent(node: Node): Element | null {
  if (node instanceof Element && node.assignedSlot) {
    return node.assignedSlot;
  }

  const parent = node.parentNode;
  return parent instanceof ShadowRoot
    ? parent.host
    : parent instanceof Element
      ? parent
      : null;
}

export function getComposedSiblings(node: Element): Element[] {
  const parent = getComposedParent(node);

  if (!parent) {
    return [];
  }

  const filtered: Element[] = [];

  for (const sibling of (parent instanceof HTMLSlotElement
    ? parent.assignedElements({ flatten: true })
    : getComposedChildren(parent)
  ).filter((s) => s !== node)) {
    filtered.push(sibling);
  }

  return filtered;
}
