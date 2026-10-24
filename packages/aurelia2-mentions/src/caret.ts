import type { MentionAnchor } from './state.js';

const copied = [
  'direction',
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderTopStyle',
  'borderRightStyle',
  'borderBottomStyle',
  'borderLeftStyle',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',
  'fontFeatureSettings',
  'fontKerning',
  'textAlign',
  'textTransform',
  'textIndent',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
  'wordBreak',
  'overflowWrap',
  'unicodeBidi',
] as const;
const clamp = (value: number, min: number, max: number) =>
  max < min ? min : Math.min(Math.max(value, min), max);

/**
 * Estimate the viewport rectangle of the character at `index` in a textarea or text input.
 * A hidden copy of the field duplicates its font, padding, borders, wrapping, scroll position and
 * direction. The result is an approximation: it ignores transforms on ancestors, browser zoom
 * differences in sub-pixel rounding, and bidirectional reordering within a line.
 */
export function getCaretRect(
  field: HTMLTextAreaElement | HTMLInputElement,
  index: number,
): MentionAnchor {
  const document = field.ownerDocument;
  const view = document.defaultView;
  const rect = field.getBoundingClientRect();
  const style = view?.getComputedStyle(field);
  const mirror = document.createElement('div');
  const target = mirror.style as unknown as Record<string, string>;
  const source = style as unknown as Record<string, string> | undefined;
  for (const property of copied) target[property] = source?.[property] ?? '';
  const multiline = field.nodeName === 'TEXTAREA';
  target.position = 'absolute';
  target.visibility = 'hidden';
  target.top = '0';
  target.left = '-9999px';
  target.whiteSpace = multiline ? 'pre-wrap' : 'pre';
  target.overflowWrap = multiline ? 'break-word' : 'normal';
  if (!multiline) target.height = 'auto';
  if (multiline && field.scrollHeight > field.clientHeight) target.overflowY = 'scroll';
  const value = field.value;
  mirror.textContent = value.slice(0, index);
  const marker = document.createElement('span');
  marker.textContent = value.slice(index) || '.';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  try {
    const fontSize = parseFloat(source?.fontSize ?? '') || 16;
    const lineHeight = parseFloat(source?.lineHeight ?? '') || fontSize * 1.2;
    const borderTop = parseFloat(source?.borderTopWidth ?? '') || 0;
    const borderLeft = parseFloat(source?.borderLeftWidth ?? '') || 0;
    // Keep the anchor inside the field when the trigger has scrolled out of view.
    const top = clamp(
      rect.top + borderTop + marker.offsetTop - field.scrollTop,
      rect.top,
      rect.bottom - lineHeight,
    );
    const left = clamp(
      rect.left + borderLeft + marker.offsetLeft - field.scrollLeft,
      rect.left,
      rect.right,
    );
    return { top, left, height: lineHeight, bottom: top + lineHeight };
  } finally {
    mirror.remove();
  }
}
