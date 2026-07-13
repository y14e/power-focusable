import { describe, it, expect, beforeEach } from 'vitest';

import {
  getFocusables,
  getNextFocusable,
  getPreviousFocusable,
  isFocusable,
} from '../dist/index.js';

// Minimal checkVisibility polyfill for happy-dom / jsdom
if (!HTMLElement.prototype.checkVisibility) {
  HTMLElement.prototype.checkVisibility = function () {
    const style = this.ownerDocument?.defaultView?.getComputedStyle(this);

    if (!style) {
      return true;
    }

    if (this.hidden) {
      return false;
    }

    if (this.inert) {
      return false;
    }

    if (style.display === 'none') {
      return false;
    }

    if (style.visibility === 'hidden') {
      return false;
    }

    if (style.opacity === '0') {
      return false;
    }

    return true;
  };
}

describe('Full Integration Test', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <section>
        <button id="btn-1">Button 1</button>
        <button id="btn-2" tabindex="3">TabIndex 3</button>
        <button id="btn-3" tabindex="1">TabIndex 1</button>
        <div tabindex="0" id="div-1">Div focusable</div>
      </section>

      <section id="shadow-host"></section>

      <section>
        <div>
          <input type="radio" name="group1" id="radio-1-1" />
          <input type="radio" name="group1" id="radio-1-2" />
          <input type="radio" name="group1" id="radio-1-3" />
        </div>

        <div>
          <input type="radio" name="group2" id="radio-2-1" />
          <input type="radio" name="group2" id="radio-2-2" checked />
          <input type="radio" name="group2" id="radio-2-3" />
        </div>

        <div>
          <input type="radio" name="group3" id="radio-3-1" disabled />
          <input type="radio" name="group3" id="radio-3-2" />
          <input type="radio" name="group3" id="radio-3-3" />
        </div>
      </section>

      <section>
        <button disabled id="disabled-btn">
          Disabled
        </button>

        <div inert>
          <button id="inert-btn">
            Inert Button
          </button>
        </div>
      </section>
    `;

    //
    // Shadow DOM
    //
    const host = document.getElementById('shadow-host')!;

    const shadow = host.attachShadow({
      mode: 'open',
    });

    shadow.innerHTML = `
      <button id="shadow-btn-1">
        Shadow Button 1
      </button>

      <slot name="slot-a">
        <button id="fallback-btn">
          Fallback
        </button>
      </slot>

      <div id="nested-host"></div>
    `;

    //
    // Slotted
    //
    const slotted1 = Object.assign(document.createElement('button'), {
      textContent: 'Slotted Button A',
      slot: 'slot-a',
      id: 'slot-btn-a',
    });

    document.body.appendChild(slotted1);

    const slotted2 = Object.assign(document.createElement('button'), {
      textContent: 'Slotted Button B',
      slot: 'slot-a',
      id: 'slot-btn-b',
      tabIndex: 2,
    });

    document.body.appendChild(slotted2);

    //
    // Nested shadow
    //
    const nestedHost = shadow.getElementById('nested-host')!;

    const nestedShadow = nestedHost.attachShadow({
      mode: 'open',
    });

    nestedShadow.innerHTML = `
      <button id="nested-btn-1">
        Nested Shadow Button
      </button>

      <slot name="slot-b"></slot>
    `;

    const slottedNested = Object.assign(document.createElement('button'), {
      textContent: 'Nested Slotted Button',
      slot: 'slot-b',
      id: 'slot-btn-nested',
    });

    document.body.appendChild(slottedNested);

    //
    // Closed shadow
    //
    const closedHost = document.createElement('div');

    const closedShadow = closedHost.attachShadow({
      mode: 'closed',
    });

    closedShadow.innerHTML = `
      <button id="closed-btn">
        Closed Button
      </button>
    `;

    document.body.appendChild(closedHost);

    //
    // Disabled fieldset
    //
    const fs = document.createElement('fieldset');

    fs.disabled = true;

    const legend = document.createElement('legend');

    legend.textContent = 'Legend';

    fs.appendChild(legend);

    const okBtn = document.createElement('button');

    okBtn.id = 'legend-ok';
    okBtn.textContent = 'Inside Legend';

    legend.appendChild(okBtn);

    const ngBtn = document.createElement('button');

    ngBtn.id = 'legend-ng';
    ngBtn.textContent = 'Disabled by fieldset';

    fs.appendChild(ngBtn);

    document.body.appendChild(fs);

    //
    // Nested inert
    //
    const inertWrapper = document.createElement('div');

    inertWrapper.inert = true;

    inertWrapper.innerHTML = `
      <div>
        <div>
          <button id="deep-inert">
            Deep inert
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(inertWrapper);

    //
    // Visibility
    //
    const hidden = document.createElement('button');

    hidden.id = 'display-none';
    hidden.style.display = 'none';

    document.body.appendChild(hidden);

    const invisible = document.createElement('button');

    invisible.id = 'visibility-hidden';
    invisible.style.visibility = 'hidden';

    document.body.appendChild(invisible);

    const transparent = document.createElement('button');

    transparent.id = 'opacity-zero';
    transparent.style.opacity = '0';

    document.body.appendChild(transparent);
  });

  //
  // Exact order
  //
  it('collects focusables in exact order', () => {
    const ids = getFocusables(document.body, {
      composed: true,
    }).map((el) => el.id);

    expect(ids).toContain('slot-btn-a');
    expect(ids).toContain('slot-btn-b');
  });

  //
  // Closed shadow ignored
  //
  it('ignores closed shadow roots', () => {
    const ids = getFocusables(document.body, {
      composed: true,
    }).map((el) => el.id);

    expect(ids).not.toContain('closed-btn');
  });

  //
  // Slot fallback
  //
  it('uses slot fallback content when no assigned elements exist', () => {
    const host = document.createElement('div');

    const shadow = host.attachShadow({
      mode: 'open',
    });

    shadow.innerHTML = `
      <slot name="x">
        <button id="fallback-only">
          Fallback
        </button>
      </slot>
    `;

    document.body.appendChild(host);

    const ids = getFocusables(document.body, {
      composed: true,
    }).map((el) => el.id);

    expect(ids).toContain('fallback-only');
  });

  //
  // Fieldset
  //
  it('fieldset disabled: only first legend remains focusable', () => {
    expect(isFocusable(document.getElementById('legend-ok')!)).toBe(true);

    expect(isFocusable(document.getElementById('legend-ng')!)).toBe(false);
  });

  //
  // Nested inert
  //
  it('inherits inert through ancestors', () => {
    expect(isFocusable(document.getElementById('deep-inert')!)).toBe(false);
  });

  //
  // Visibility
  //
  it('ignores display:none', () => {
    expect(isFocusable(document.getElementById('display-none')!)).toBe(false);
  });

  it('ignores visibility:hidden', () => {
    expect(isFocusable(document.getElementById('visibility-hidden')!)).toBe(
      false,
    );
  });

  it('ignores opacity:0', () => {
    expect(isFocusable(document.getElementById('opacity-zero')!)).toBe(false);
  });

  //
  // Radio edge case
  //
  it('radio group skips disabled checked radio', () => {
    document.body.innerHTML = `
      <input
        type="radio"
        name="x"
        id="radio-a"
        checked
        disabled
      />

      <input
        type="radio"
        name="x"
        id="radio-b"
      />

      <input
        type="radio"
        name="x"
        id="radio-c"
      />
    `;

    const ids = getFocusables(document.body, {
      composed: true,
      skipNegativeTabIndexCheck: true,
    }).map((element) => element.id);

    expect(ids).toEqual(['radio-b']);
  });

  //
  // Nested activeElement traversal
  //
  it('tracks activeElement through nested shadow roots', () => {
    const host = document.createElement('div');

    const shadow = host.attachShadow({
      mode: 'open',
    });

    shadow.innerHTML = `
      <div id="nested"></div>
    `;

    const nested = shadow.getElementById('nested')!;

    const nestedShadow = nested.attachShadow({
      mode: 'open',
    });

    nestedShadow.innerHTML = `
      <button id="deep-btn">
        Deep Button
      </button>

      <button id="deep-btn-2">
        Deep Button 2
      </button>
    `;

    document.body.appendChild(host);

    const btn = nestedShadow.getElementById('deep-btn')!;

    btn.focus();

    const next = getNextFocusable(document.body, {
      composed: true,
      wrap: true,
    });

    expect(next?.id).toBe('deep-btn-2');
  });

  //
  // Relative navigation
  //
  it('supports relative navigation with wrap', () => {
    const list = getFocusables(document.body, {
      composed: true,
    });

    const first = list[0]!;

    first.focus();

    const next = getNextFocusable(document.body, {
      composed: true,
      wrap: true,
    });

    expect(next).toBe(list[1]);

    const prev = getPreviousFocusable(document.body, {
      composed: true,
      wrap: true,
    });

    expect(prev).toBe(list[list.length - 1]);
  });
});
