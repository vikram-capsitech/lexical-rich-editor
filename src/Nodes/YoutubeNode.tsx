import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  ElementFormatType,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  Spread,
} from 'lexical';

import {
  DecoratorBlockNode,
  SerializedDecoratorBlockNode,
} from '@lexical/react/LexicalDecoratorBlockNode';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { mergeRegister } from '@lexical/utils';
import {
  $getNodeByKey,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  FORMAT_ELEMENT_COMMAND,
} from 'lexical';
import * as React from 'react';

const DEFAULT_WIDTH = 560;
const DEFAULT_HEIGHT = 315;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 113;

// ─── Resize handles ───────────────────────────────────────────────────────────

const handleBase: React.CSSProperties = {
  position: 'absolute',
  width: 10,
  height: 10,
  background: '#0078d4',
  border: '2px solid #fff',
  borderRadius: 2,
  zIndex: 10,
  boxShadow: '0 0 2px rgba(0,0,0,0.4)',
};

// All 8 compass directions.
type ResizeDir = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

interface ResizeState {
  startX: number;
  startY: number;
  startW: number;
  startH: number;
  ratio: number;
  dir: ResizeDir;
}

function VideoResizer({
  containerRef,
  onResizeStart,
  onResizeEnd,
}: {
  containerRef: React.RefObject<HTMLDivElement>;
  onResizeStart: () => void;
  onResizeEnd: (w: number, h: number) => void;
}) {
  const resizeState = React.useRef<ResizeState | null>(null);

  const startResize = (e: React.PointerEvent<HTMLDivElement>, dir: ResizeDir) => {
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;

    const { width, height } = container.getBoundingClientRect();
    resizeState.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: width,
      startH: height,
      ratio: width / height,
      dir,
    };
    onResizeStart();

    const onMove = (ev: PointerEvent) => {
      const rs = resizeState.current;
      if (!rs || !container) return;

      const dx = ev.clientX - rs.startX;
      const dy = ev.clientY - rs.startY;
      let newW = rs.startW;
      let newH = rs.startH;

      // Right-side corners: drag right → wider (proportional)
      if (dir === 'se' || dir === 'ne') {
        newW = Math.max(MIN_WIDTH, rs.startW + dx);
        newH = newW / rs.ratio;
      // Left-side corners: drag left → wider (negate dx; proportional)
      } else if (dir === 'nw' || dir === 'sw') {
        newW = Math.max(MIN_WIDTH, rs.startW - dx);
        newH = newW / rs.ratio;
      // Right edge: width only
      } else if (dir === 'e') {
        newW = Math.max(MIN_WIDTH, rs.startW + dx);
      // Left edge: negate dx so dragging left grows width
      } else if (dir === 'w') {
        newW = Math.max(MIN_WIDTH, rs.startW - dx);
      // Bottom edge: height only
      } else if (dir === 's') {
        newH = Math.max(MIN_HEIGHT, rs.startH + dy);
      // Top edge: negate dy so dragging up grows height
      } else if (dir === 'n') {
        newH = Math.max(MIN_HEIGHT, rs.startH - dy);
      }

      container.style.width = `${newW}px`;
      container.style.height = `${newH}px`;
    };

    const onUp = () => {
      if (!container) return;
      const { width, height } = container.getBoundingClientRect();
      resizeState.current = null;
      onResizeEnd(width, height);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  return (
    <>
      {/* North – top centre */}
      <div
        style={{ ...handleBase, top: -5, left: '50%', transform: 'translateX(-50%)', cursor: 'n-resize' }}
        onPointerDown={(e) => startResize(e, 'n')}
        title='Resize height'
      />
      {/* North-East – top right */}
      <div
        style={{ ...handleBase, top: -5, right: -5, cursor: 'ne-resize' }}
        onPointerDown={(e) => startResize(e, 'ne')}
        title='Resize (proportional)'
      />
      {/* East – right centre */}
      <div
        style={{ ...handleBase, top: '50%', right: -5, transform: 'translateY(-50%)', cursor: 'ew-resize' }}
        onPointerDown={(e) => startResize(e, 'e')}
        title='Resize width'
      />
      {/* South-East – bottom right */}
      <div
        style={{ ...handleBase, bottom: -5, right: -5, cursor: 'se-resize' }}
        onPointerDown={(e) => startResize(e, 'se')}
        title='Resize (proportional)'
      />
      {/* South – bottom centre */}
      <div
        style={{ ...handleBase, bottom: -5, left: '50%', transform: 'translateX(-50%)', cursor: 's-resize' }}
        onPointerDown={(e) => startResize(e, 's')}
        title='Resize height'
      />
      {/* South-West – bottom left */}
      <div
        style={{ ...handleBase, bottom: -5, left: -5, cursor: 'sw-resize' }}
        onPointerDown={(e) => startResize(e, 'sw')}
        title='Resize (proportional)'
      />
      {/* West – left centre */}
      <div
        style={{ ...handleBase, top: '50%', left: -5, transform: 'translateY(-50%)', cursor: 'ew-resize' }}
        onPointerDown={(e) => startResize(e, 'w')}
        title='Resize width'
      />
      {/* North-West – top left */}
      <div
        style={{ ...handleBase, top: -5, left: -5, cursor: 'nw-resize' }}
        onPointerDown={(e) => startResize(e, 'nw')}
        title='Resize (proportional)'
      />
    </>
  );
}

// ─── YouTube component ────────────────────────────────────────────────────────

type YouTubeComponentProps = Readonly<{
  format: ElementFormatType | null;
  nodeKey: NodeKey;
  videoID: string;
  width: number;
  height: number;
  editor: LexicalEditor;
}>;

function YouTubeComponent({
  format,
  nodeKey,
  videoID,
  width,
  height,
  editor,
}: YouTubeComponentProps) {
  const wrapperRef   = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const iframeRef    = React.useRef<HTMLIFrameElement>(null);
  // Synchronous ref so onMouseLeave always reads the current resize state.
  const isResizingRef = React.useRef(false);

  const [isNodeSelected, setNodeSelected, clearNodeSelection] = useLexicalNodeSelection(nodeKey);
  const [isHovered,  setIsHovered]  = React.useState(false);
  const [isResizing, setIsResizing] = React.useState(false);
  // When true the thumbnail is replaced by the live <iframe> in-place.
  const [isPlaying,  setIsPlaying]  = React.useState(false);

  // ── Lexical command registration ──────────────────────────────────────────
  React.useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        FORMAT_ELEMENT_COMMAND,
        (formatType: ElementFormatType) => {
          if (isNodeSelected) {
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if ($isYouTubeNode(node)) node.setFormat(formatType);
            });
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
      // Select this node on click.  When the thumbnail is shown the <img> is
      // in the parent DOM so CLICK_COMMAND fires naturally.  When the iframe is
      // live, clicks land in the iframe's browsing context — the node stays
      // selected via wrapperRef boundary detection on the wrapper div.
      editor.registerCommand(
        CLICK_COMMAND,
        (event: MouseEvent) => {
          if (wrapperRef.current?.contains(event.target as Node)) {
            if (!event.shiftKey) clearNodeSelection();
            setNodeSelected(true);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor, isNodeSelected, nodeKey, clearNodeSelection, setNodeSelected]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      node?.remove();
    });
  };

  const handleResizeStart = () => {
    isResizingRef.current = true;
    setIsResizing(true);
    // Disable iframe pointer-events immediately so pointermove events during
    // the drag are not swallowed by the iframe's browsing context.
    if (iframeRef.current) iframeRef.current.style.pointerEvents = 'none';
  };

  const handleResizeEnd = (w: number, h: number) => {
    isResizingRef.current = false;
    setIsResizing(false);
    if (iframeRef.current) iframeRef.current.style.pointerEvents = '';
    // Keep controls visible so the user can resize again without re-hovering.
    setIsHovered(true);
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isYouTubeNode(node)) node.setSize(Math.round(w), Math.round(h));
    });
  };

  // Shared style for the small action buttons (delete / stop).
  const actionBtnStyle = (side: 'left' | 'right'): React.CSSProperties => ({
    position: 'absolute',
    top: 8,
    [side]: 8,
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.65)',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontSize: side === 'right' ? 18 : 14,
    lineHeight: 1,
    padding: 0,
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={wrapperRef} style={{ display: 'block', textAlign: format || undefined }}>
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          display: 'inline-block',
          width,
          height,
          lineHeight: 0,
          outline: isNodeSelected ? '2px solid #0078d4' : undefined,
          outlineOffset: 2,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          if (!isResizingRef.current) setIsHovered(false);
        }}>

        {isPlaying ? (
          /* ── Playing state ─────────────────────────────────────────────────
           * Show the real YouTube iframe in-place at the same dimensions.
           * autoplay=1 starts playback immediately.
           * pointer-events are set to 'none' during resize (handleResizeStart)
           * so drag events are not lost to the iframe's browsing context.     */
          <iframe
            ref={iframeRef}
            width='100%'
            height='100%'
            src={`https://www.youtube.com/embed/${videoID}?autoplay=1`}
            sandbox='allow-same-origin allow-scripts allow-popups allow-presentation'
            allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
            allowFullScreen={true}
            title='YouTube video'
            style={{ display: 'block', border: 'none' }}
          />
        ) : (
          /* ── Thumbnail state ───────────────────────────────────────────────
           * Static <img> keeps all clicks in the parent DOM so Lexical's
           * CLICK_COMMAND fires correctly and the node can be selected.
           * Clicking the red ▶ badge switches to playing state.              */
          <>
            <img
              src={`https://img.youtube.com/vi/${videoID}/hqdefault.jpg`}
              alt='YouTube video'
              draggable={false}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                userSelect: 'none',
                cursor: 'pointer',
              }}
            />

            {/* Red play badge — no stopPropagation so CLICK_COMMAND still
                fires and the node is selected at the same time. */}
            <div
              role='button'
              aria-label='Play video'
              onClick={() => setIsPlaying(true)}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 56,
                height: 56,
                background: 'rgba(255, 0, 0, 0.85)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}>
              <span style={{ color: '#fff', fontSize: 20, lineHeight: 1, marginLeft: 5 }}>▶</span>
            </div>
          </>
        )}

        {/* Controls — shown on hover or during a resize drag.
            VideoResizer is hidden while the iframe is live so that resize
            handles don't interfere with normal video interaction; the user
            should stop playback first, then resize.                          */}
        {(isHovered || isResizing) && (
          <>
            {/* Delete — always top-right */}
            <button
              type='button'
              onClick={handleDelete}
              title='Remove video'
              style={actionBtnStyle('right')}>
              ×
            </button>

            {/* Stop button (top-left) — shown only while the iframe is live */}
            {isPlaying && (
              <button
                type='button'
                onClick={(e) => { e.stopPropagation(); setIsPlaying(false); }}
                title='Stop video'
                style={actionBtnStyle('left')}>
                ⏹
              </button>
            )}

            {/* Open in browser — always visible in controls */}
            <button
              type='button'
              onClick={(e) => {
                e.stopPropagation();
                window.open(`https://www.youtube.com/watch?v=${videoID}`, '_blank', 'noopener,noreferrer');
              }}
              title='Open in browser'
              style={{
                ...actionBtnStyle('left'),
                top: isPlaying ? 44 : 8,   // stack below stop button when playing
                fontSize: 13,
              }}>
              ↗
            </button>

            {/* Resize handles — shown in both thumbnail and playing states.
                handleResizeStart disables iframe pointer-events via iframeRef
                so drag events are not lost to the iframe's browsing context. */}
            <VideoResizer
              containerRef={containerRef}
              onResizeStart={handleResizeStart}
              onResizeEnd={handleResizeEnd}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Serialized type ──────────────────────────────────────────────────────────

export type SerializedYouTubeNode = Spread<
  {
    videoID: string;
    width: number;
    height: number;
    type: 'youtube';
    version: 1;
  },
  SerializedDecoratorBlockNode
>;

// ─── DOM helpers ──────────────────────────────────────────────────────────────

function extractYouTubeIdFromSrc(src: string): string | null {
  const m = src.match(/youtube\.com\/embed\/([^?&/]+)/i);
  return m?.[1] ?? null;
}

function convertYouTubeIframe(domNode: Node): DOMConversionOutput | null {
  if (!(domNode instanceof HTMLIFrameElement)) return null;
  const src = domNode.getAttribute('src') || '';
  const id = extractYouTubeIdFromSrc(src);
  if (!id) return null;
  const w = parseInt(domNode.getAttribute('width') || '560', 10) || DEFAULT_WIDTH;
  const h = parseInt(domNode.getAttribute('height') || '315', 10) || DEFAULT_HEIGHT;
  return { node: $createYouTubeNode(id, w, h) };
}

// ─── Node class ───────────────────────────────────────────────────────────────

export class YouTubeNode extends DecoratorBlockNode {
  __id: string;
  __width: number;
  __height: number;

  static getType(): string {
    return 'youtube';
  }

  static clone(node: YouTubeNode): YouTubeNode {
    return new YouTubeNode(node.__id, node.__width, node.__height, node.__format, node.__key);
  }

  static importJSON(serializedNode: SerializedYouTubeNode): YouTubeNode {
    const node = $createYouTubeNode(
      serializedNode.videoID,
      serializedNode.width ?? DEFAULT_WIDTH,
      serializedNode.height ?? DEFAULT_HEIGHT,
    );
    node.setFormat(serializedNode.format);
    return node;
  }

  exportJSON(): SerializedYouTubeNode {
    return {
      ...super.exportJSON(),
      type: 'youtube',
      version: 1,
      videoID: this.__id,
      width: this.__width,
      height: this.__height,
    };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      iframe: () => ({
        conversion: convertYouTubeIframe,
        priority: 2,
      }),
    };
  }

  exportDOM(): DOMExportOutput {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('width', String(this.__width));
    iframe.setAttribute('height', String(this.__height));
    iframe.style.border = 'none';
    // sandbox must be on the exported HTML too — not just the in-editor player —
    // so that when consumers render the saved HTML the iframe is sandboxed.
    iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-popups allow-presentation');
    iframe.setAttribute(
      'allow',
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
    );
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.setAttribute('title', 'YouTube video');
    iframe.setAttribute('src', `https://www.youtube.com/embed/${this.__id}`);
    iframe.setAttribute('data-lexical-youtube', this.__id);
    return { element: iframe };
  }

  constructor(
    id: string,
    width: number = DEFAULT_WIDTH,
    height: number = DEFAULT_HEIGHT,
    format?: ElementFormatType,
    key?: NodeKey,
  ) {
    super(format, key);
    this.__id = id;
    this.__width = width;
    this.__height = height;
  }

  updateDOM(): false {
    return false;
  }

  getId(): string {
    return this.__id;
  }

  setSize(width: number, height: number): void {
    const writable = this.getWritable();
    writable.__width = width;
    writable.__height = height;
  }

  decorate(_editor: LexicalEditor, _config: EditorConfig): JSX.Element {
    return (
      <YouTubeComponent
        format={this.__format}
        nodeKey={this.getKey()}
        videoID={this.__id}
        width={this.__width}
        height={this.__height}
        editor={_editor}
      />
    );
  }

  isTopLevel(): true {
    return true;
  }
}

// ─── Factories / guards ───────────────────────────────────────────────────────

export function $createYouTubeNode(
  videoID: string,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
): YouTubeNode {
  return new YouTubeNode(videoID, width, height);
}

export function $isYouTubeNode(
  node: YouTubeNode | LexicalNode | null | undefined,
): node is YouTubeNode {
  return node instanceof YouTubeNode;
}
