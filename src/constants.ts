export const FOCUSABLE_SELECTOR =
  ':is(a[href], area[href], button, embed, iframe, input:not([type="hidden" i]), object, select, details > summary:first-of-type, textarea, [contenteditable]:not([contenteditable="false" i]), [controls], [tabindex]):not(:disabled, [hidden], [inert], [tabindex="-1"])';

export const FOCUSABLE_SELECTOR_WITH_NEGATIVE_TABINDEX =
  FOCUSABLE_SELECTOR.replace(/(,\s*)?\[tabindex="-1"\]/g, '');
