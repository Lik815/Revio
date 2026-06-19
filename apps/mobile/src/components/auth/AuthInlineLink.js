import React from 'react';
import { Pressable, Text } from 'react-native';

/**
 * "Lead text + action text" link, e.g. "Bereits ein Konto? Anmelden".
 * `accentAction` colors the action phrase with `c.primary`; without it both
 * phrases render in `c.muted` (matches the original AccountCreateStep look).
 */
export function AuthInlineLink({ lead, action, onPress, accentAction = false, c, style }) {
  return (
    <Pressable style={[{ alignSelf: 'flex-end' }, style]} onPress={onPress}>
      <Text style={{ color: c.muted, fontSize: 13 }}>
        {lead ? `${lead} ` : ''}
        <Text style={{ color: accentAction ? c.primary : c.muted, fontWeight: accentAction ? '600' : '400' }}>
          {action}
        </Text>
      </Text>
    </Pressable>
  );
}
