import { getComposedParent, getComposedSiblings } from '@/composed';
import { isInert } from '@/utils';

const inertRefCounts = new WeakMap<Element, number>();

export function applyInert(element: Element): boolean {
  if (!isInert(element) || inertRefCounts.has(element)) {
    const count = inertRefCounts.get(element) ?? 0;
    inertRefCounts.set(element, count + 1);
    !count && element.setAttribute('inert', '');
    return true;
  }

  return false;
}

export function inertOutside(element: Element): () => void {
  if (!(element instanceof Element)) {
    console.warn('Invalid element');
    return () => {};
  }

  function traverse(node: Element, callback: (_: Element) => void): void {
    const parent = getComposedParent(node);

    if (parent) {
      getComposedSiblings(node).map(callback);
      traverse(parent, callback);
    }
  }

  const elements: Element[] = [];
  traverse(element, (node) => node && applyInert(node) && elements.push(node));
  return () => elements.map(restoreInert);
}

export function restoreInert(element: Element): void {
  const count = inertRefCounts.get(element);

  if (!count) {
    return;
  }

  if (count === 1) {
    inertRefCounts.delete(element);
    element.removeAttribute('inert');
    return;
  }

  inertRefCounts.set(element, count - 1);
}
