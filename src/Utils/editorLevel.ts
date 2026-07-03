import { ContentEditorLevel } from '../ContentEditorComponent.types';

export function getToolbarGroupsByLevel(level: ContentEditorLevel): string[][] {
  switch (level) {
    case ContentEditorLevel.None:
      return [];

    case ContentEditorLevel.Basic:
      return [
        // ['undo', 'redo', '|'],
        ['Bold', 'Italic', 'Underline', '|'],
        ['ColorPicker', '|'],
        ['Heading', '|'],
        ['FontFamily', '|'],
        ['FontSize', '|'],
        ['Link', '|'],
        ['Decorators', '|'],
        ['Align'],
      ];

    case ContentEditorLevel.Standard:
      return [
        // ['undo', 'redo', '|'],
        ['Bold', 'Italic', 'Underline', '|'],
        ['ColorPicker', '|'],
        ['Link', '|'],
        ['Insert', '|'],
        ['Heading', '|'],
        ['FontFamily', '|'],
        ['FontSize', '|'],
        ['Decorators', '|'],
        ['Align', '|'],
        ['PageSetup'],
      ];

    case ContentEditorLevel.Pro:
    default:
      return [
        // ['undo', 'redo', '|'],
        ['Bold', 'Italic', 'Underline', '|'],
        ['ColorPicker', '|'],
        ['Link', '|'],
        ['Insert', '|'],
        ['Heading', '|'],
        ['FontFamily', '|'],
        ['FontSize', '|'],
        ['Decorators', '|'],
        ['Align', '|'],
        ['PageSetup'],
      ];
  }
}
