import React, { useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Press } from './ui';
import { colors, fonts, radius } from '../theme';

const LINES = [
  { name: 'Tele-MANAS (India)', detail: 'Free mental health support, 24x7', number: '14416', label: '14416' },
  { name: 'Emergency (India)', detail: 'If you or someone is in immediate danger', number: '112', label: '112' },
  { name: '988 Lifeline (US)', detail: 'Call or text, 24/7', number: '988', label: '988' },
];

const dial = (n: string) => Linking.openURL(`tel:${n}`).catch(() => {});

/** Always-available way to reach a real person. Opens a helpline sheet. */
export function CrisisButton({ variant = 'pill', label }: { variant?: 'pill' | 'wide'; label?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Press onPress={() => setOpen(true)} style={variant === 'pill' ? styles.pill : styles.wide}>
        <Ionicons name="call" size={variant === 'pill' ? 15 : 18} color="#fff" />
        <Text style={styles.pillText}>{label ?? 'Help'}</Text>
      </Press>

      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.title}>You're not alone</Text>
            <Text style={styles.sub}>Talking to a real person can help, right now. Pick whichever fits where you are.</Text>
            {LINES.map((l) => (
              <Press key={l.number} onPress={() => dial(l.number)} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{l.name}</Text>
                  <Text style={styles.rowDetail}>{l.detail}</Text>
                </View>
                <View style={styles.call}>
                  <Ionicons name="call" size={16} color="#fff" />
                  <Text style={styles.callText}>{l.label}</Text>
                </View>
              </Press>
            ))}
            <Text style={styles.note}>Solace is a companion, not a clinician or emergency service.</Text>
            <Press onPress={() => setOpen(false)} style={styles.close}>
              <Text style={styles.closeText}>Close</Text>
            </Press>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E5584F', paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill },
  wide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#E5584F', height: 52, borderRadius: radius.pill, paddingHorizontal: 22 },
  pillText: { fontFamily: fonts.bold, fontSize: 14, color: '#fff' },
  backdrop: { flex: 1, backgroundColor: 'rgba(23,56,43,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 36, gap: 10 },
  title: { fontFamily: fonts.heading, fontSize: 26, color: colors.ink },
  sub: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.md, padding: 14, gap: 10 },
  rowName: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  rowDetail: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  call: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill },
  callText: { fontFamily: fonts.bold, color: '#fff', fontSize: 14 },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, textAlign: 'center', marginTop: 6 },
  close: { alignItems: 'center', paddingVertical: 12 },
  closeText: { fontFamily: fonts.semi, fontSize: 15, color: colors.primary },
});
