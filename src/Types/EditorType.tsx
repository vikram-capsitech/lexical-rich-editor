import { ContentEditorLevel } from '../ContentEditorComponent.types';

export enum RichTextPluginsType {
  Undo = 'undo', //
  Redo = 'redo', //
  Bold = 'bold',
  Italic = 'italic',
  Underline = 'underline',
  Link = 'link',
  Strikethrough = 'strike',
  Superscript = 'superscript',
  Subscript = 'subscript',
  Highlight = 'highlight',
  Code = 'code', //
  LeftAlign = 'leftAlign',
  CenterAlign = 'centerAlign',
  RightAlign = 'rightAlign',
  JustifyAlign = 'justifyAlign',
  Divider = 'divider', //
  Lowercase = 'lowercase',
  Uppercase = 'uppercase',
  Capitalize = 'capitalize',
}

export const HEADING_OPTION = [
  { key: 'h1', text: 'Heading 1' },
  { key: 'h2', text: 'Heading 2' },
  { key: 'h3', text: 'Heading 3' },
  { key: 'h4', text: 'Heading 4' },
  { key: 'h5', text: 'Heading 5' },
  { key: 'h6', text: 'Heading 6' },
];

export const LOW_PRIORIRTY = 1;

export interface IEditorProps {
  readOnly?: boolean;
  level: ContentEditorLevel;
}
