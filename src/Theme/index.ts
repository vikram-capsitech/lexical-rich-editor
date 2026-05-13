import { EditorThemeClasses } from 'lexical';
import './codeEditor.css';
import './index.css';
export const theme: EditorThemeClasses = {
  text: {
    underline: 'underline',
    strikethrough: 'strikethrough',
    underlineStrikethrough: 'underlineStrikethrough',
    italic: 'italic',
    code: 'code',
    capitalize: 'capitalize',
    lowercase: 'lowercase',
    uppercase: 'uppercase',
  },
  // table: 'table',
  // tableCell: 'tableCell',
  // tableCellHeader: 'tableCellHeader',
  code: 'editorCode',
  image: 'editor-image',
  quote: 'quote',
  inlineImage: 'inline-editor-image',
  codeHighlight: {
    atrule: 'editorTokenAttr',
    attr: 'editorTokenAttr',
    boolean: 'editorTokenProperty',
    builtin: 'editorTokenSelector',
    cdata: 'editorTokenComment',
    char: 'editorTokenSelector',
    class: 'editorTokenFunction', // class constructor
    comment: 'editorTokenComment', // comment
    constant: 'editorTokenProperty',
    deleted: 'editorTokenProperty',
    doctype: 'editorTokenComment',
    entity: 'editorTokenOperator',
    function: 'editorTokenFunction', // es5 function
    important: 'editorTokenVariable',
    inserted: 'editorTokenSelector',
    keyword: 'editorTokenAttr', // variable keyword like const/let
    namespace: 'editorTokenVariable',
    number: 'editorTokenProperty', // number values
    operator: 'editorTokenOperator', // operator like +/*-
    prolog: 'editorTokenComment',
    property: 'editorTokenProperty',
    punctuation: 'editorTokenPunctuation', // brackets of array, object
    regex: 'editorTokenVariable',
    selector: 'editorTokenSelector',
    string: 'editorTokenSelector', // string values
    symbol: 'editorTokenProperty',
    tag: 'editorTokenProperty',
    url: 'editorTokenOperator',
    variable: 'editorTokenVariable',
  },
  table: 'lexical-table',
  tableRow: 'lexical-table-row',
  tableCell: 'lexical-table-cell',
  tableCellHeader: 'lexical-table-cell-header',

  tableCellSelected: 'lexical-table-cell-selected',
  tableCellPrimarySelected: 'lexical-table-cell-primary-selected',
  tableCellEditing: 'lexical-table-cell-editing',

  tableCellResizer: 'lexical-table-cell-resizer',
};
