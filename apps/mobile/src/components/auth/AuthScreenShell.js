import React from 'react';
import { ScrollView, View } from 'react-native';
import { BackButton } from '../BackButton';

/**
 * Shared framing for auth/registration screens.
 *
 * Omit `onBack` for screens embedded in tab content (no header chrome at
 * all, e.g. the logged-out profile-tab landing) — do not also add
 * `paddingTop: insets.top` in that case, the tab navigator already accounts
 * for the safe area. Pass `onBack` for root-stack screens (login,
 * registration steps); `BackButton` then owns the safe-area top offset.
 */
export function AuthScreenShell({
  c,
  t,
  onBack,
  scroll = true,
  centered = false,
  grow = false,
  paddingHorizontal = scroll ? 24 : 20,
  paddingTop = scroll ? 24 : 0,
  paddingBottom = scroll ? 40 : 0,
  style,
  contentContainerStyle,
  children,
}) {
  const backButton = onBack ? <BackButton c={c} label={t('backBtn')} onPress={onBack} /> : null;

  if (!scroll) {
    return (
      <View
        style={[
          { flex: 1, paddingHorizontal, paddingTop, paddingBottom, justifyContent: centered ? 'center' : 'flex-start' },
          style,
        ]}
      >
        {backButton}
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        { paddingHorizontal, paddingTop, paddingBottom, gap: 16, flexGrow: grow ? 1 : undefined },
        contentContainerStyle,
      ]}
    >
      {backButton}
      {children}
    </ScrollView>
  );
}
