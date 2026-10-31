import { getComposedParent, getComposedSiblings } from './composed';
import { isInert } from './utils';

const counts = new WeakMap<Element, number>();

function applyInert(element: Element): boolean {
  if (isInert(element) && !counts.has(element)) {
    return false;
  }

  const count = counts.get(element) ?? 0;
  counts.set(element, count + 1);
  !count && element.setAttribute('inert', '');
  return true;
}

export function inertOutside(element: Element): () => void {
  if (!(element instanceof Element)) {
    console.warn('Invalid element');
    return () => {};
  }

  function traverse(node: Element, callback: (_: Element) => void): void {
    const parent = getComposedParent(node);

    if (parent) {
      getComposedSiblings(node).forEach(callback);
      traverse(parent, callback);
    }
  }

  const elements: Element[] = [];
  traverse(element, (node) => node && applyInert(node) && elements.push(node));
  return () => elements.map(restoreInert);
}

function restoreInert(element: Element): void {
  const count = counts.get(element);

  if (!count) {
    return;
  }

  if (count === 1) {
    counts.delete(element);
    element.removeAttribute('inert');
    return;
  }

  counts.set(element, count - 1);
}
