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

  function traverse(element: Element, callback: (_: Element) => void): void {
    const parent = getComposedParent(element);

    if (parent) {
      getComposedSiblings(element).map(callback);
      traverse(parent, callback);
    }
  }

  const elements: Element[] = [];
  traverse(element, (e) => applyInert(e) && elements.push(e));
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
