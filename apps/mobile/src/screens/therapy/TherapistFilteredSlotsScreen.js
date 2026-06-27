import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TherapistTimeline } from '../../components/SlotComposer';
import { DeleteFreeSlotsModal } from '../../modals/DeleteFreeSlotsModal';

const FILTER_LIST_TITLES = {
  free: 'Freie Termine',
  booked: 'Gebuchte Termine',
  pending: 'Anfragen',
};

const shouldShowSectionLoading = (isLoading, lastLoadedAt) => isLoading && lastLoadedAt === 0;

export function TherapistFilteredSlotsScreen({
  filterListKind, freeSlots, mySlots, incomingBookings, deletingSlotIds,
  onClose, onCancelSlot, onRespond, onTherapistCancel, onOpenDetail, onBulkDeleteSlots,
  slotsLoading, incomingBookingsLoading, slotsLastLoadedAt, incomingBookingsLastLoadedAt,
  c, styles,
}) {
  const insets = useSafeAreaInsets();
  const [showDeleteFreeSlotsModal, setShowDeleteFreeSlotsModal] = useState(false);
  const [deleteFreeSlotsLoading, setDeleteFreeSlotsLoading] = useState(false);

  const handleDeleteAllFreeSlots = () => {
    if (freeSlots.length === 0) return;
    setShowDeleteFreeSlotsModal(true);
  };

  const handleConfirmDeleteAllFreeSlots = async () => {
    const ids = freeSlots.map((s) => s.id);
    if (ids.length === 0 || deleteFreeSlotsLoading) return;
    setDeleteFreeSlotsLoading(true);
    try {
      await onBulkDeleteSlots?.(ids);
      setShowDeleteFreeSlotsModal(false);
    } finally {
      setDeleteFreeSlotsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <DeleteFreeSlotsModal
        visible={showDeleteFreeSlotsModal}
        count={freeSlots.length}
        loading={deleteFreeSlotsLoading}
        onClose={() => setShowDeleteFreeSlotsModal(false)}
        onConfirm={handleConfirmDeleteAllFreeSlots}
        c={c}
      />
      <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: 10, backgroundColor: c.background }}>
        <Pressable
          onPress={onClose}
          style={{ alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Ionicons name="chevron-back" size={16} color={c.primary} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: c.primary }}>Zurück</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[styles.headerTitle, { color: c.text }]}>{FILTER_LIST_TITLES[filterListKind]}</Text>
          {filterListKind === 'free' && freeSlots.length > 0 ? (
            <Pressable
              onPress={handleDeleteAllFreeSlots}
              hitSlop={{ top: 14, right: 14, bottom: 14, left: 14 }}
              style={{ minHeight: 40, paddingLeft: 14, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: c.error }}>Alle löschen</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 32, paddingTop: 8 }]}
        showsVerticalScrollIndicator={false}
      >
        <TherapistTimeline
          c={c}
          mySlots={mySlots}
          incomingBookings={incomingBookings}
          activeFilter={filterListKind}
          deletingSlotIds={deletingSlotIds}
          onCancelSlot={onCancelSlot}
          onRespond={onRespond}
          onTherapistCancel={onTherapistCancel}
          onOpenDetail={onOpenDetail}
          slotsLoading={shouldShowSectionLoading(slotsLoading, slotsLastLoadedAt)}
          incomingLoading={shouldShowSectionLoading(incomingBookingsLoading, incomingBookingsLastLoadedAt)}
        />
      </ScrollView>
    </View>
  );
}
