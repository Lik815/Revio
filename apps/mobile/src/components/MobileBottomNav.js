import React from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { RADIUS } from '../utils/app-utils';

function BottomNavIcon({ tab, active, color }) {
  if (tab.key === 'options') {
    return (
      <MaterialCommunityIcons
        name={active ? 'account-cog' : 'account-cog-outline'}
        size={24}
        color={color}
      />
    );
  }

  return (
    <Ionicons
      name={active ? tab.icon : `${tab.icon}-outline`}
      size={22}
      color={color}
    />
  );
}

/**
 * Props:
 *   tabs           – array of { key, labelKey, icon }
 *   activeTab      – currently active tab key (string)
 *   onTabPress     – (tabKey: string) => void
 *   c              – color theme object
 *   t              – translation function (labelKey) => string
 *   badgeCount     – number of unread notifications (renders badge on profile tab for therapists)
 *   showBadge      – boolean – whether to show the badge at all (only for logged-in therapists)
 */
export function MobileBottomNav({ tabs, activeTab, onTabPress, c, t, badgeCount = 0, showBadge = false }) {
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        elevation: 20,
        borderTopWidth: 1,
        borderTopColor: c.border,
        backgroundColor: c.nav,
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 8,
        paddingHorizontal: 8,
      }}
    >
      {tabs.map((tab) => {
        const active = tab.key === activeTab;
        const showTabBadge = showBadge && tab.key === 'profile' && badgeCount > 0;

        return (
          <Pressable
            key={tab.key}
            onPress={() => onTabPress(tab.key)}
            style={{ alignItems: 'center', gap: 4, flex: 1, paddingVertical: 10, minHeight: 44 }}
          >
            <View
              style={{
                borderRadius: RADIUS.full,
                paddingHorizontal: 16,
                paddingVertical: 8,
                minHeight: 38,
                minWidth: 54,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? c.primaryBg : 'transparent',
              }}
            >
              <View style={{ position: 'relative' }}>
                <BottomNavIcon tab={tab} active={active} color={active ? c.primary : c.muted} />
                {showTabBadge && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -3,
                      right: -5,
                      backgroundColor: '#E53E3E',
                      borderRadius: 6,
                      minWidth: 12,
                      height: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 2,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 8, fontWeight: '800', lineHeight: 12 }}>
                      {badgeCount}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={{ fontSize: 12, fontWeight: '600', letterSpacing: 0.2, color: active ? c.primary : c.muted }}>
              {t(tab.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
