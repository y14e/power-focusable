# Power Focusable

High-precision focus management utility with shadow DOM support. Handles complex focus rules including tabindex ordering, radio groups, etc.

> [!NOTE]
> Supports shadow DOM traversal via the composed tree. Only open shadow roots are included; closed shadow roots are not accessible.

## Install

```bash
npm i power-focusable
```

```ts
// npm
import {
  getFocusables,
  getNextFocusable,
  getPreviousFocusable,
  hasFocusable,
  isFocusable,
} from 'power-focusable';

// CDNs
import { ... } 'https://esm.sh/power-focusable'
// or
import { ... } 'https://cdn.jsdelivr.net/npm/power-focusable/dist/index.js';
// or
import { ... } 'https://unpkg.com/power-focusable/dist/index.js';
```

## 🪄 Options

```ts
interface PowerFocusableOptions {
  active?: Element | null; // default: document.activeElement
  composed?: boolean;      // default: false
  wrap?: boolean;          // default: false
}
```

### `active`

Specifies the starting element.

Used by `getNextFocusable` and `getPreviousFocusable`.

### `composed`

If `true`, traverses the composed tree (including shadow DOM; slower)

Used by `getFocusables`, `getNextFocusable`, `getPreviousFocusable`, and `hasFocusable`.

### `wrap`

If `true`, wraps around to the first or last element when reaching the end.

Used by `getNextFocusable` and `getPreviousFocusable`.

## 📦 APIs

### `getFocusables`

Returns all focusable elements within the container.

```ts
getFocusables(container);
// => Element[]
//
// container (optional): Element (default: <body>)

// Traverses the composed tree (including shadow DOM; slower)
getFocusables(container, { composed: true });
```

### `getNextFocusable`

Returns the next focusable element within the container, starting from `document.activeElement`.

```ts
getNextFocusable(container);
// => Element | null
//
// container (optional): Element (default: <body>)

// Specifies the starting element
getNextFocusable(container, { active: document.querySelector('.button') });

// Traverses the composed tree (including shadow DOM; slower)
getNextFocusable(container, { composed: true });

// Wraps around to the first element when reaching the end
getNextFocusable(container, { wrap: true });
```

### `getPreviousFocusable`

Returns the previous focusable element within the container, starting from `document.activeElement`.

```ts
getPreviousFocusable(container);
// => Element | null
//
// container (optional): Element (default: <body>)

// Specifies the starting element
getPreviousFocusable(container, { active: document.querySelector('.button') });

// Traverses the composed tree (including shadow DOM; slower)
getPreviousFocusable(container, { composed: true });

//Wraps around to the last element when reaching the end
getPreviousFocusable(container, { wrap: true });

```

### `hasFocusable`

Returns whether the container contains at least one focusable element.

```ts
hasFocusable(container);
// => boolean
//
// container (optional): Element (default: <body>)

// Traverses the composed tree (including shadow DOM; slower)
hasFocusable(container, { composed: true });
```

### `isFocusable`

Returns whether the given element is focusable.

```ts
isFocusable(element);
// => boolean
//
// element: Element

```
