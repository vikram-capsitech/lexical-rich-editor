import type { DOMConversionMap, DOMConversionOutput, LexicalNode } from 'lexical';
import { $isTextNode } from 'lexical';

/**
 * Lexical's own default `<span>` importer (see `convertSpanElement` /
 * `applyTextFormatFromStyle` in lexical core) only reads a `style` attribute
 * to derive format FLAGS (bold/italic/underline/strikethrough/sub/superscript
 * — the properties Google Docs paste uses). It never restores arbitrary CSS
 * text like `font-family`, `font-size`, `color`, or `background-color` onto
 * the TextNode's own `style` string — the exact four properties this
 * package's FontFamily/FontSize/ColorBar toolbar plugins set via
 * `$patchStyleText`. Without this override, any of those styles survive an
 * in-session edit fine but are silently dropped the moment the content goes
 * through an HTML round-trip (setValue(), paste, or a fresh mount seeded via
 * the `value` prop) — exactly the getValue()->setValue() cycle a consuming
 * app's view-switch/autosave performs.
 *
 * Registered as `initialConfig.html.import` in ContentEditorComponent — at
 * equal `priority`, Lexical's conversion cache prefers the last-registered
 * entry for a tag (see `getConversionFunction` in @lexical/html), and
 * editor-config conversions are always added after every node class's own
 * `importDOM()`, so this transparently wins over (rather than replaces) the
 * built-in span conversion.
 */
const PRESERVED_STYLE_PROPS: Array<[keyof CSSStyleDeclaration, string]> = [
  ['fontFamily', 'font-family'],
  ['fontSize', 'font-size'],
  ['color', 'color'],
  ['backgroundColor', 'background-color'],
];

const $convertSpanElementWithStyle = (domNode: HTMLElement): DOMConversionOutput => {
  const style = domNode.style;

  const cssParts: string[] = [];
  for (const [domProp, cssProp] of PRESERVED_STYLE_PROPS) {
    const value = style[domProp];
    if (value) cssParts.push(`${cssProp}: ${value}`);
  }
  const cssText = cssParts.length > 0 ? `${cssParts.join('; ')};` : '';

  // Mirrors lexical core's own applyTextFormatFromStyle exactly, so
  // Google-Docs-paste-style format detection keeps working unchanged.
  const fontWeight = style.fontWeight;
  const textDecoration = style.textDecoration.split(' ');
  const hasBoldFontWeight = fontWeight === '700' || fontWeight === 'bold';
  const hasLinethroughTextDecoration = textDecoration.includes('line-through');
  const hasItalicFontStyle = style.fontStyle === 'italic';
  const hasUnderlineTextDecoration = textDecoration.includes('underline');
  const verticalAlign = style.verticalAlign;

  return {
    node: null,
    forChild: (lexicalNode: LexicalNode) => {
      if (!$isTextNode(lexicalNode)) return lexicalNode;

      if (cssText) lexicalNode.setStyle(cssText);

      if (hasBoldFontWeight && !lexicalNode.hasFormat('bold')) lexicalNode.toggleFormat('bold');
      if (hasLinethroughTextDecoration && !lexicalNode.hasFormat('strikethrough')) lexicalNode.toggleFormat('strikethrough');
      if (hasItalicFontStyle && !lexicalNode.hasFormat('italic')) lexicalNode.toggleFormat('italic');
      if (hasUnderlineTextDecoration && !lexicalNode.hasFormat('underline')) lexicalNode.toggleFormat('underline');
      if (verticalAlign === 'sub' && !lexicalNode.hasFormat('subscript')) lexicalNode.toggleFormat('subscript');
      if (verticalAlign === 'super' && !lexicalNode.hasFormat('superscript')) lexicalNode.toggleFormat('superscript');

      return lexicalNode;
    },
  };
};

export const preserveTextStyleImportMap: DOMConversionMap = {
  span: () => ({
    conversion: $convertSpanElementWithStyle,
    priority: 0,
  }),
};
