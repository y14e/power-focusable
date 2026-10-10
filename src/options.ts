import type { PowerFocusableOptions as Options } from '@/types';
import { getActiveElement } from '@/utils';

export function resolveOptions(options: Partial<Options>): Options {
  let {
    anchor = getActiveElement(),
    composed = false,
    filter,
    include,
    skipNegativeTabIndexCheck = false,
    skipVisibilityCheck = false,
    wrap = false,
  } = options;

  if (!(anchor instanceof Element)) {
    const active = getActiveElement();

    if (active instanceof Element) {
      console.warn('Invalid anchor element. Fallback: active element.');
      anchor = active;
    }
  }

  if (typeof composed !== 'boolean') {
    console.warn('Invalid composed option. Fallback: false.');
    composed = false;
  }

  if (filter !== undefined && typeof filter !== 'function') {
    console.warn(
      'Invalid filter function. Fallback: no filter function (undefined).',
    );
    filter = undefined;
  }

  if (include !== undefined && typeof include !== 'function') {
    console.warn(
      'Invalid include function. Fallback: no include function (undefined).',
    );
    include = undefined;
  }

  if (typeof skipNegativeTabIndexCheck !== 'boolean') {
    console.warn('Invalid skipNegativeTabIndexCheck option. Fallback: false.');
    skipNegativeTabIndexCheck = false;
  }

  if (typeof skipVisibilityCheck !== 'boolean') {
    console.warn('Invalid skipVisibilityCheck option. Fallback: false.');
    skipVisibilityCheck = false;
  }

  if (typeof wrap !== 'boolean') {
    console.warn('Invalid wrap option. Fallback: false.');
    wrap = false;
  }

  return {
    anchor,
    composed,
    filter,
    include,
    skipNegativeTabIndexCheck,
    skipVisibilityCheck,
    wrap,
  };
}
