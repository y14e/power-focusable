export function focusElement(element: Element): void {
  'focus' in element && typeof element.focus === 'function' && element.focus();
}

export function getActiveElement(): Element | null {
  let current = document.activeElement;

  while (current?.shadowRoot?.activeElement) {
    current = current.shadowRoot.activeElement;
  }

  return current;
}

export function getTabIndex(element: Element): number {
  return 'tabIndex' in element ? Number(element.tabIndex) : 0;
}

export function isDisabled(element: Element): boolean {
  return 'disabled' in element && !!element.disabled;
}

export function isFormControl(element: Element): boolean {
  return ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName);
}

export function isInert(element: Element): boolean {
  return 'inert' in element && !!element.inert;
}

export function isUngroupedRadio(element: HTMLInputElement): boolean {
  return element.type === 'radio' && !!element.name;
}
