import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

/**
 * Title/subtitle block shared by auth/registration screens.
 *
 * `align="center"` is for entry screens (landing, login) and supports an
 * optional collapsible `expandable` note. `align="left"` is for
 * registration-step headers and has no expandable slot.
 */
export function AuthHero({ align = 'left', title, subtitle, expandable, c, style }) {
  const [expanded, setExpanded] = useState(false);
  const centered = align === 'center';

  return (
    <View
      style={[
        { alignItems: centered ? 'center' : 'flex-start', paddingTop: centered ? 12 : 8, paddingBottom: centered ? 28 : 20 },
        style,
      ]}
    >
      <Text
        style={{
          fontSize: centered ? 24 : 22,
          fontWeight: '800',
          color: c.text,
          marginBottom: centered ? 8 : 0,
          textAlign: centered ? 'center' : 'left',
        }}
      >
        {title}
      </Text>

      {subtitle ? (
        <Text
          style={{
            fontSize: 14,
            color: c.muted,
            marginTop: centered ? 0 : 4,
            lineHeight: 20,
            textAlign: centered ? 'center' : 'left',
          }}
        >
          {subtitle}
        </Text>
      ) : null}

      {expandable ? (
        <>
          <Pressable
            onPress={() => setExpanded((v) => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}
          >
            <Text style={{ fontSize: 13, color: c.muted }}>{expandable.label}</Text>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color={c.muted} />
          </Pressable>
          {expanded && (
            <View
              style={{
                backgroundColor: c.mutedBg,
                borderRadius: 12,
                padding: 14,
                marginTop: 10,
                borderWidth: 1,
                borderColor: c.border,
              }}
            >
              <Text style={{ fontSize: 13, color: c.muted, lineHeight: 20, textAlign: 'center' }}>
                {expandable.body}
              </Text>
            </View>
          )}
        </>
      ) : null}
    </View>
  );
}
