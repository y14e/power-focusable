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
    if (!style) return true;
    if (this.hidden) return false;
    if (this.inert) return false;
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (style.opacity === '0') return false;
    return true;
  };
}

describe('Full Integration Test: tabindex + Shadow DOM + slots + fieldset + inert', () => {
  beforeEach(() => {
    //
    // Base Light DOM
    //
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
        <button disabled id="disabled-btn">Disabled</button>
        <div inert>
          <button id="inert-btn">Inert Button</button>
        </div>
      </section>
    `;

    //
    // Shadow DOM (root)
    //
    const host = document.getElementById('shadow-host')!;
    const shadow = host.attachShadow({ mode: 'open' });

    shadow.innerHTML = `
      <button id="shadow-btn-1">Shadow Button 1</button>
      <slot name="slot-a"></slot>
      <div id="nested-host"></div>
    `;

    //
    // Slotted elements for root shadow
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
    // Nested Shadow DOM
    //
    const nestedHost = shadow.getElementById('nested-host')!;
    const nestedShadow = nestedHost.attachShadow({ mode: 'open' });

    nestedShadow.innerHTML = `
      <button id="nested-btn-1">Nested Shadow Button</button>
      <slot name="slot-b"></slot>
    `;

    const slottedNested = Object.assign(document.createElement('button'), {
      textContent: 'Nested Slotted Button',
      slot: 'slot-b',
      id: 'slot-btn-nested',
    });
    document.body.appendChild(slottedNested);

    //
    // Disabled fieldset (legend exception)
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
  });

  //
  // Main composed focusable test
  //
  it('collects all focusable elements across Light DOM, Shadow DOM, slots, and nested shadows', () => {
    const list = getFocusables(document.body, { composed: true });
    const ids = list.map((el) => el.id || el.textContent?.trim());

    // Light DOM
    expect(ids).toContain('btn-1');
    expect(ids).toContain('btn-2');
    expect(ids).toContain('btn-3');
    expect(ids).toContain('div-1');

    // Shadow DOM + slots
    expect(ids).toContain('shadow-btn-1');
    expect(ids).toContain('slot-btn-a');
    expect(ids).toContain('slot-btn-b');
    expect(ids).toContain('nested-btn-1');
    expect(ids).toContain('slot-btn-nested');

    // Radio groups (normalized)
    expect(ids).toContain('radio-1-1'); // first in group1
    expect(ids).toContain('radio-2-2'); // checked in group2
    expect(ids).toContain('radio-3-2'); // first non-disabled in group3

    // Disabled / inert
    expect(ids).not.toContain('disabled-btn');
    expect(ids).not.toContain('inert-btn');

    // Fieldset disabled (legend exception)
    expect(ids).toContain('legend-ok');
    expect(ids).not.toContain('legend-ng');
  });

  //
  // Fieldset disabled rule
  //
  it('fieldset disabled: only elements inside the first legend remain focusable', () => {
    expect(isFocusable(document.getElementById('legend-ok')!)).toBe(true);
    expect(isFocusable(document.getElementById('legend-ng')!)).toBe(false);
  });

  //
  // Relative navigation
  //
  it('supports relative navigation with wrap', () => {
    const list = getFocusables(document.body, { composed: true });

    const first = list[0];
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
