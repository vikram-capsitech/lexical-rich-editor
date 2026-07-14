import {
  Button,
  Menu,
  MenuDivider,
  MenuGroup,
  MenuGroupHeader,
  MenuItemRadio,  
  MenuList,
  MenuPopover,
  MenuTrigger,
} from '@fluentui/react-components';
import { DocumentRegular } from '@fluentui/react-icons';
import * as React from 'react';
import {
  MARGIN_OPTIONS,
  PAGE_SIZE_OPTIONS,
  PageMargin,
  PageOrientation,
  PageSetupValue,
  PageSize,
} from '../Types/PageSetup';

interface PageSetupPluginProps {
  disabled?: boolean;
  value: PageSetupValue;
  onChange: (value: PageSetupValue) => void;
}

export function PageSetupPlugin({ disabled, value, onChange }: PageSetupPluginProps) {
  const sizeLabel =
    value.size === 'pageless'
      ? 'Pageless'
      : (PAGE_SIZE_OPTIONS.find((o) => o.key === value.size)?.label ?? 'Pageless');

  const isPaged = value.size !== 'pageless';

  return (
    <Menu
      checkedValues={{
        size: [value.size],
        orientation: [value.orientation],
        margin: [value.margin],
      }}
      onCheckedValueChange={(_, data) => {
        const selected = data.checkedItems[0];
        if (!selected) return;
        if (data.name === 'size') onChange({ ...value, size: selected as PageSize });
        else if (data.name === 'orientation')
          onChange({ ...value, orientation: selected as PageOrientation });
        else if (data.name === 'margin') onChange({ ...value, margin: selected as PageMargin });
      }}>
      <MenuTrigger disableButtonEnhancement>
        <Button
          appearance='subtle'
          size='small'
          disabled={disabled}
          icon={<DocumentRegular />}
          title='Page setup'
          style={{ minWidth: 'auto' }}>
          {sizeLabel}
        </Button>
      </MenuTrigger>

      <MenuPopover style={{ minWidth: 220 }}>
        <MenuList>
          <MenuGroup>
            <MenuGroupHeader>Page size</MenuGroupHeader>
            <MenuItemRadio name='size' value='pageless'>
              Pageless
            </MenuItemRadio>
            {PAGE_SIZE_OPTIONS.map((opt) => (
              <MenuItemRadio key={opt.key} name='size' value={opt.key}>
                {opt.label}
              </MenuItemRadio>
            ))}
          </MenuGroup>

          <MenuDivider />

          <MenuGroup>
            <MenuGroupHeader>Orientation</MenuGroupHeader>
            <MenuItemRadio name='orientation' value='portrait' disabled={!isPaged}>
              Portrait
            </MenuItemRadio>
            <MenuItemRadio name='orientation' value='landscape' disabled={!isPaged}>
              Landscape
            </MenuItemRadio>
          </MenuGroup>

          <MenuDivider />
          <MenuGroup>
            <MenuGroupHeader>Margins</MenuGroupHeader>
            {MARGIN_OPTIONS.map((opt) => (
              <MenuItemRadio key={opt.key} name='margin' value={opt.key} disabled={!isPaged}>
                {opt.label}
              </MenuItemRadio>
            ))}
          </MenuGroup>
        </MenuList>
      </MenuPopover>
    </Menu>
  );
} 
