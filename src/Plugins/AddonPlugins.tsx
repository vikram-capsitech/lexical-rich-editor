import { Stack } from "@fluentui/react";
import { Button } from "@fluentui/react-components";
import { LockClosedRegular } from "@fluentui/react-icons";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

const AddonActionPlugins = ({readonlyMode, clearEditorMode  } : { readonlyMode: boolean, clearEditorMode: boolean }) => {
    const [editor] = useLexicalComposerContext();
    
    return (
        <Stack horizontal horizontalAlign="end" tokens={{ childrenGap:4 }} style={{ position:'absolute', margin:10, bottom:245, right:20 }}>
          {/* {clearEditorMode &&
            <Button
                title="Clear editor is not working right now"
                aria-label={`read-only-mode`}    
                size="small"
                icon={<DeleteRegular style={{ color: '#216fdb' }} />}
                style={{ background: '#ebebeb', border: 'none', margin: 2 }}
                onClick={() => {
                    editor.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined);
                    editor.focus();
                }}
            />
          } */}
          {readonlyMode &&
          <Button
            title="Read-Only Mode"
            aria-label={`read-only-mode`}
            icon={<LockClosedRegular style={{ color: '#216fdb' }} />}
            style={{ background: '#ebebeb', border: 'none', margin: 2 }}
            onClick={() => {
                editor.setEditable(!editor.isEditable());
            }}
          />}
        </Stack>
    );
}

export default AddonActionPlugins;