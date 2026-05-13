import { Stack } from "@fluentui/react";
import { ToolbarToggleButton } from "@fluentui/react-components";
import { TextBulletListLtrRegular, TextNumberListLtrRegular } from "@fluentui/react-icons";
import {
    INSERT_ORDERED_LIST_COMMAND,
    INSERT_UNORDERED_LIST_COMMAND,
    REMOVE_LIST_COMMAND
} from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { getSelectedBtnProps } from "../Utils/Index";
interface IListPluginProps {
  selectNodeType: string;
}
export const ListItemNodePlugin = (props: IListPluginProps) => {
const [editor] = useLexicalComposerContext();

    return (
        <Stack horizontal>
            <ToolbarToggleButton
                name="textOptions"
                appearance="subtle"
                key={'unordered-list'}
                value={'unordered-list'}
                title={'Un-ordered-list'}
                icon={<TextBulletListLtrRegular style={{color: '#333333'}}/>}
                onClick={() => {
                    if (props.selectNodeType === "ul") {
                        editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
                    } else {
                        editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
                    }
                }}
                {...getSelectedBtnProps(props.selectNodeType === "ul")}
            />
            <ToolbarToggleButton
                name="textOptions"
                key='ordered-list'
                value='ordered-list'
                title='Ordered List'
                appearance="subtle"
                icon={<TextNumberListLtrRegular style={{color: '#333333'}} /> }
                onClick={() => { 
                    if (props.selectNodeType === "ol") {
                        editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
                    } else {
                        editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
                    }
                }}
                {...getSelectedBtnProps(props.selectNodeType === "ol")}
            />
        </Stack>
    );
}
