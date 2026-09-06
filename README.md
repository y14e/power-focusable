# Power Focusable

High-precision focus management utility with full composed tree support. Handles complex focus rules including tabindex ordering, radio groups, inert.

> [!NOTE]
> Supports shadow DOM traversal via the composed tree. Only open shadow roots are included; closed shadow roots are not accessible.

## Install

```bash
npm i power-focusable
```

```ts
// npm
import {
  createFocusTrap,
  getFocusables,
  getNextFocusable,
  getPreviousFocusable,
  hasFocusable,
  inertOutside,
  isFocusable,
} from 'power-focusable';

// CDNs
import { ... } 'https://esm.sh/power-focusable@4.3.29';
// or
import { ... } 'https://cdn.jsdelivr.net/npm/power-focusable@4.3.29/+esm';
// or
import { ... } 'https://esm.unpkg.com/power-focusable@4.3.29';
```

## 🪄 Options

```ts
interface PowerFocusableOptions {
  anchor: Element | null;                 // default: DocumentOrShadowRoot.activeElement
  composed: boolean;                      // default: false
  filter: PredicateFunction | undefined;  // default: undefined
  include: PredicateFunction | undefined; // default: undefined
  skipNegativeTabIndexCheck: boolean;     // default: false
  skipVisibilityCheck: boolean;           // default: false
  wrap: boolean;                          // default: false
}

type PredicateFunction = (element: Element) => boolean;
```

### `anchor`

Specifies the starting element.

Used by `getNextFocusable` and `getPreviousFocusable`.

### `composed`

If `true`, traverses the composed tree (including shadow DOM; slower)

Used by `getFocusables`, `getNextFocusable`, `getPreviousFocusable`, and `hasFocusable`.

### `filter`

Custom filter function for excluding elements from focus traversal.

The function should return `true` to include the element, or `false` to exclude it.

Used by `getFocusables`, `getNextFocusable`, `getPreviousFocusable`, and `hasFocusable`.

### `include`

Custom include function for adding elements to focus traversal even if they are not normally focusable.

The function should return `true` to include the element, or `false` to ignore it.

Used by `getFocusables`, `getNextFocusable`, `getPreviousFocusable`, and `hasFocusable`.

### `skipNegativeTabIndexCheck`

If `true`, skips the negative `tabindex` check when determining focusability.

Used by `getFocusables`, `getNextFocusable`, `getPreviousFocusable`, `hasFocusable`, and `isFocusable`.

### `skipVisibilityCheck`

If `true`, skips `checkVisibility()` when determining focusability.

Used by `getFocusables`, `getNextFocusable`, `getPreviousFocusable`, `hasFocusable`, and `isFocusable`.

### `wrap`

If `true`, wraps around to the first or last element when reaching the end.

Used by `getNextFocusable` and `getPreviousFocusable`.

## 📦 APIs

### `createFocusTrap`

Creates a keyboard focus trap within the container. Automatically focuses the container itself when possible; otherwise focuses the first available focusable element.

```ts
const cleanup = createFocusTrap(container);
// => () => void
//
// container (optional): Element (default: <body>)
```

### `getFocusables`

Returns all focusable elements within the container.

```ts
getFocusables(container);
// => Element[]
//
// container (optional): Element (default: <body>)
```

### `getNextFocusable`

Returns the next focusable element within the container, starting from active element.

```ts
getNextFocusable(container);
// => Element | null
//
// container (optional): Element (default: <body>)

// Specifies the starting element
getNextFocusable(container, { anchor: document.querySelector('.button') });

// Wraps around to the first element when reaching the end
getNextFocusable(container, { wrap: true });
```

### `getPreviousFocusable`

Returns the previous focusable element within the container, starting from active element.

```ts
getPreviousFocusable(container);
// => Element | null
//
// container (optional): Element (default: <body>)

// Specifies the starting element
getPreviousFocusable(container, { anchor: document.querySelector('.button') });

// Wraps around to the last element when reaching the end
getPreviousFocusable(container, { wrap: true });

```

### `hasFocusable`

Returns whether the container contains at least one focusable element.

```ts
hasFocusable(container);
// => boolean
//
// container (optional): Element (default: <body>)
```

### `inertOutside`

Temporarily applies `inert` to all elements outside the target element. Useful for modals, dialogs, and overlays.

```ts
const cleanup = inertOutside(element);
// => () => void
//
// element: Element
```

### `isFocusable`

Returns whether the given element is focusable.

```ts
isFocusable(element);
// => boolean
//
// element: Element

```
