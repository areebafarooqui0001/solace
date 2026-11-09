import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Press, select } from './ui';
import { colors, fonts, radius } from '../theme';

export const fmtTime = (h: number, m: number) => {
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

function Column({ label, onUp, onDown }: { label: string; onUp: () => void; onDown: () => void }) {
  return (
    <View style={styles.col}>
      <Press onPress={() => { select(); onUp(); }} style={styles.arrow}>
        <Ionicons name="chevron-up" size={26} color={colors.primary} />
      </Press>
      <Text style={styles.big}>{label}</Text>
      <Press onPress={() => { select(); onDown(); }} style={styles.arrow}>
        <Ionicons name="chevron-down" size={26} color={colors.primary} />
      </Press>
    </View>
  );
}

/** A small, calm time picker: tap the arrows for hour and minute, toggle AM/PM. No native module needed. */
export function TimeSheet({
  visible,
  title,
  hour,
  minute,
  onSave,
  onClose,
}: {
  visible: boolean;
  title: string;
  hour: number;
  minute: number;
  onSave: (hour: number, minute: number) => void;
  onClose: () => void;
}) {
  const [h, setH] = useState(hour);
  const [m, setM] = useState(minute);

  useEffect(() => {
    if (visible) {
      setH(hour);
      setM(minute);
    }
  }, [visible, hour, minute]);

  const h12 = h % 12 === 0 ? 12 : h % 12;
  const pm = h >= 12;
  const stepHour = (d: number) => setH((c) => (c + d + 24) % 24);
  const stepMin = (d: number) => setM((c) => (c + d + 60) % 60);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <View style={styles.row}>
            <Column label={String(h12)} onUp={() => stepHour(1)} onDown={() => stepHour(-1)} />
            <Text style={styles.colon}>:</Text>
            <Column label={String(m).padStart(2, '0')} onUp={() => stepMin(5)} onDown={() => stepMin(-5)} />
            <View style={styles.ampm}>
              {['AM', 'PM'].map((p) => {
                const on = (p === 'PM') === pm;
                return (
                  <Press key={p} onPress={() => { select(); setH((c) => (p === 'PM' ? (c % 12) + 12 : c % 12)); }} style={[styles.apBtn, on && styles.apOn]}>
                    <Text style={[styles.apText, on && { color: '#fff' }]}>{p}</Text>
                  </Press>
                );
              })}
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <Button title="Cancel" variant="soft" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Save" onPress={() => onSave(h, m)} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(40,30,20,0.35)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: '#FFFDF6', borderRadius: radius.lg, padding: 22, gap: 12 },
  title: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
  col: { alignItems: 'center', width: 74 },
  arrow: { padding: 8 },
  big: { fontFamily: fonts.heading, fontSize: 48, color: colors.ink, lineHeight: 56 },
  colon: { fontFamily: fonts.heading, fontSize: 44, color: colors.inkSoft, marginHorizontal: -2 },
  ampm: { marginLeft: 12, gap: 8 },
  apBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: '#fff', borderWidth: 1, borderColor: '#EADFC8' },
  apOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  apText: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
});
