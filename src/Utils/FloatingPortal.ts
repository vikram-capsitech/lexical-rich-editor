import type { LexicalEditor } from 'lexical';
import { useEffect, useState } from 'react';

/**
 * Mounts a `position: fixed` overlay host inside the closest Fluent
 * Panel/Layer (or document.body) rather than deep inside the editor's own
 * DOM tree, so floating UI isn't clipped/hidden by a host Panel/Layer's own
 * stacking context or an ancestor's `overflow`.
 */
export function useFloatingPortalContainer(editor: LexicalEditor): HTMLElement | null {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) return;

    const panelOrLayer =
      (root.closest('.ms-Panel-main') as HTMLElement | null) ||
      (root.closest('.ms-Panel') as HTMLElement | null) ||
      (root.closest('.ms-Layer') as HTMLElement | null) ||
      document.body;

    const host = document.createElement('div');
    host.className = 'lexical-floating-ui-host';
    panelOrLayer.appendChild(host);
    setContainer(host);

    return () => {
      host.remove();
      setContainer(null);
    };
  }, [editor]);

  return container;
}

/**
 * A host Panel/Layer that animates with a CSS transform (slide-in panels,
 * Fluent's Panel included) creates a new containing block for its
 * `position: fixed` descendants — per spec, `fixed` then resolves against
 * that ancestor's padding box instead of the viewport. Since our floating
 * elements compute their target top/left from `getBoundingClientRect()`
 * (viewport coordinates), we have to subtract that ancestor's own rect to
 * land in the right place; otherwise the popup renders offset toward
 * whatever corner the transformed ancestor happens to start at.
 */
export function getFixedPositionOrigin(fromElement: HTMLElement): { top: number; left: number } {
  let node: HTMLElement | null = fromElement.parentElement;

  while (node && node !== document.body && node !== document.documentElement) {
    const style = getComputedStyle(node);
    const createsContainingBlock =
      (style.transform && style.transform !== 'none') ||
      (style.perspective && style.perspective !== 'none') ||
      (style.filter && style.filter !== 'none') ||
      (style.backdropFilter && style.backdropFilter !== 'none') ||
      (style.willChange && /transform|perspective|filter/.test(style.willChange)) ||
      (style.contain && /paint|layout|strict|content/.test(style.contain));

    if (createsContainingBlock) {
      const rect = node.getBoundingClientRect();
      return { top: rect.top, left: rect.left };
    }
    node = node.parentElement;
  }

  return { top: 0, left: 0 };
}
