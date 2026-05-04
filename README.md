# Power Focusable

High-precision focus management utility with shadow DOM support. Handles complex focus rules.

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

## 📦 APIs

### `getFocusables`

Returns all focusable elements within the container.

```ts
getFocusables(container);
// => HTMLElement[]
//
// container (optional): HTMLElement (default: document.body)

// Traverses the composed tree (includes shadow DOM; slower)
getFocusables(container, { composed: true });
```

### `getNextFocusable`

Returns the next focusable element within the container, starting from `document.activeElement`.

```ts
getNextFocusable(container);
// => HTMLElement | null
//
// container (optional): HTMLElement (default: document.body)

// Starting from a specific element
getNextFocusable(container, { active: document.querySelector('.button') });

// Traverses the composed tree (includes shadow DOM; slower)
getNextFocusable(container, { composed: true });

// Wrap to the first element if necessary
getNextFocusable(container, { wrap: true });
```

### `getPreviousFocusable`

Returns the previous focusable element within the container, starting from `document.activeElement`.

```ts
getPreviousFocusable(container);
// => HTMLElement | null
//
// container (optional): HTMLElement (default: document.body)

// Starting from a specific element
getPreviousFocusable(container, { active: document.querySelector('.button') });

// Traverses the composed tree (includes shadow DOM; slower)
getPreviousFocusable(container, { composed: true });

// Wrap to the last element if necessary
getPreviousFocusable(container, { wrap: true });

```

### `hasFocusable`

Returns whether the container contains at least one focusable element.

```ts
hasFocusable(container);
// => boolean
//
// container (optional): HTMLElement (default: document.body)
```

### `isFocusable`

Returns whether the given element is focusable.

```ts
isFocusable(element);
// => boolean
//
// element: HTMLElement

```
