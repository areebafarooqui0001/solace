import React, { useCallback, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Field, Press, Screen, select } from '../../components/ui';
import { TimeSheet, fmtTime } from '../../components/TimeSheet';
import { useAuth } from '../../auth';
import { api, Memory, Reminder } from '../../api';
import { clearAllReminders, sendTestNotification, syncReminders } from '../../lib/notifications';
import { colors, fonts, radius } from '../../theme';

const fmt = fmtTime;

const ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  checkin: 'happy-outline',
  affirmation: 'sparkles-outline',
  breathing: 'cloudy-outline',
  selfcare: 'moon-outline',
  custom: 'alarm-outline',
};

export default function Profile() {
  const router = useRouter();
  const { user, setUser, signOut } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [newTime, setNewTime] = useState({ hour: 18, minute: 0 });
  const [pickingNew, setPickingNew] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, m] = await Promise.all([api.reminders(), api.memories()]);
      setReminders(r.reminders);
      setMemories(m.memories);
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const apply = async (next: Reminder[]) => {
    setReminders(next);
    await syncReminders(next).catch(() => {});
  };

  const patch = async (r: Reminder, b: Partial<{ hour: number; minute: number; enabled: boolean }>) => {
    select();
    const optimistic = reminders.map((x) => (x.id === r.id ? { ...x, ...b, enabled: b.enabled === undefined ? x.enabled : b.enabled ? 1 : 0 } : x));
    await apply(optimistic);
    try {
      await api.updateReminder(r.id, b);
    } catch {
      load();
    }
  };

  const addCustom = async () => {
    if (!newLabel.trim()) return;
    try {
      const { reminder } = await api.addReminder({ label: newLabel.trim(), hour: newTime.hour, minute: newTime.minute, kind: 'custom' });
      await apply([...reminders, reminder]);
      setNewLabel('');
      setAdding(false);
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Could not add');
    }
  };

  const removeReminder = async (r: Reminder) => {
    await apply(reminders.filter((x) => x.id !== r.id));
    api.deleteReminder(r.id).catch(load);
  };

  const toggleMemory = async (on: boolean) => {
    try {
      const { user: u } = await api.updateMe({ memoryEnabled: on });
      setUser(u);
    } catch {}
  };

  const forget = (m: Memory) => {
    setMemories((c) => c.filter((x) => x.id !== m.id));
    api.deleteMemory(m.id).catch(load);
  };

  const clearAll = () =>
    Alert.alert('Clear everything Sunny remembers?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          setMemories([]);
          await api.clearMemories().catch(load);
        },
      },
    ]);

  const test = async () => {
    const ok = await sendTestNotification().catch(() => false);
    setNote(ok ? 'Sent. Lock your phone or switch apps, then tap it in 5 seconds.' : 'Notifications are blocked. Enable them in system settings.');
  };

  const deleteAccount = () =>
    Alert.alert(
      'Delete your account?',
      'This permanently removes your chats, memories, check-ins and reminders. It cannot be undone.',
      [
        { text: 'Keep my account', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteAccount();
              await clearAllReminders().catch(() => {});
              await signOut();
              router.replace('/login');
            } catch (e) {
              Alert.alert("Couldn't delete your account", e instanceof Error ? e.message : 'Please try again.');
            }
          },
        },
      ]
    );

  const logout = async () => {
    await clearAllReminders().catch(() => {});
    await signOut();
    router.replace('/login');
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        {!!user?.goals.length && (
          <View style={styles.goals}>
            {user.goals.map((g) => (
              <Text key={g} style={styles.goal}>
                {g}
              </Text>
            ))}
          </View>
        )}

        <Text style={styles.section}>Gentle reminders</Text>
        <Card style={{ padding: 6 }}>
          {reminders.map((r, i) => (
            <View key={r.id} style={[styles.rem, i > 0 && styles.sep]}>
              <Ionicons name={ICON[r.kind] ?? 'alarm-outline'} size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.remLabel} numberOfLines={1}>
                  {r.label}
                </Text>
                <Press onPress={() => setEditing(r)} style={styles.time}>
                  <Ionicons name="time-outline" size={18} color={colors.inkSoft} />
                  <Text style={styles.timeText}>{fmt(r.hour, r.minute)}</Text>
                  <Text style={styles.timeEdit}>Change</Text>
                </Press>
              </View>
              {r.kind === 'custom' && (
                <Press onPress={() => removeReminder(r)} style={{ padding: 6 }}>
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Press>
              )}
              <Switch
                value={!!r.enabled}
                onValueChange={(v) => patch(r, { enabled: v })}
                trackColor={{ true: colors.primaryLight, false: '#E4DCEC' }}
                thumbColor={r.enabled ? colors.primary : '#fff'}
              />
            </View>
          ))}
        </Card>

        {adding ? (
          <Card>
            <Field label="Remind me to..." value={newLabel} onChangeText={setNewLabel} placeholder="Call mom, stretch, journal" autoCapitalize="sentences" />
            <Press onPress={() => setPickingNew(true)} style={styles.time}>
              <Ionicons name="time-outline" size={18} color={colors.inkSoft} />
              <Text style={styles.timeText}>{fmt(newTime.hour, newTime.minute)}</Text>
              <Text style={styles.timeEdit}>Change time</Text>
            </Press>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <Button title="Add" onPress={addCustom} style={{ flex: 1 }} />
              <Button title="Cancel" variant="soft" onPress={() => setAdding(false)} style={{ flex: 1 }} />
            </View>
          </Card>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Add reminder" variant="soft" onPress={() => setAdding(true)} style={{ flex: 1 }} />
            <Button title="Send test" variant="soft" onPress={test} style={{ flex: 1 }} />
          </View>
        )}
        {!!note && <Text style={styles.note}>{note}</Text>}

        <Text style={styles.section}>What Sunny remembers</Text>
        <Card>
          <View style={styles.memHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.remLabel}>Personalized memory</Text>
              <Text style={styles.memSub}>Sunny uses past chats and check-ins to feel more personal. Off means a fresh start every time.</Text>
            </View>
            <Switch
              value={!!user?.memoryEnabled}
              onValueChange={toggleMemory}
              trackColor={{ true: colors.primaryLight, false: '#E4DCEC' }}
              thumbColor={user?.memoryEnabled ? colors.primary : '#fff'}
            />
          </View>
          {memories.length === 0 ? (
            <Text style={styles.memEmpty}>Nothing saved yet. As you chat, helpful details will show up here, and you can remove any of them.</Text>
          ) : (
            <View style={{ marginTop: 10 }}>
              {memories.map((m) => (
                <View key={m.id} style={styles.mem}>
                  <Text style={styles.memText}>{m.fact}</Text>
                  <Press onPress={() => forget(m)} style={{ padding: 4 }}>
                    <Ionicons name="close" size={18} color={colors.inkSoft} />
                  </Press>
                </View>
              ))}
              <Text style={styles.clear} onPress={clearAll}>
                Clear all
              </Text>
            </View>
          )}
        </Card>

        <Button title="Log out" variant="ghost" onPress={logout} style={{ marginTop: 10 }} />
        <Text
          style={styles.replay}
          onPress={async () => {
            await SecureStore.deleteItemAsync('solace_onboarded').catch(() => {});
            router.push('/onboarding');
          }}
        >
          Replay the welcome tour
        </Text>
        <Text style={styles.danger} onPress={deleteAccount}>
          Delete my account and data
        </Text>
      </ScrollView>
      <TimeSheet
        visible={!!editing}
        title={editing?.label ?? ''}
        hour={editing?.hour ?? 9}
        minute={editing?.minute ?? 0}
        onClose={() => setEditing(null)}
        onSave={(hour, minute) => {
          if (editing) patch(editing, { hour, minute });
          setEditing(null);
        }}
      />
      <TimeSheet
        visible={pickingNew}
        title="Reminder time"
        hour={newTime.hour}
        minute={newTime.minute}
        onClose={() => setPickingNew(false)}
        onSave={(hour, minute) => {
          setNewTime({ hour, minute });
          setPickingNew(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 22, paddingBottom: 50, gap: 14 },
  title: { fontFamily: fonts.heading, fontSize: 32, color: colors.ink },
  email: { fontFamily: fonts.body, fontSize: 15, color: colors.inkSoft, marginTop: -10 },
  goals: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goal: { fontFamily: fonts.semi, fontSize: 13, color: colors.primary, backgroundColor: colors.primarySoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, overflow: 'hidden' },
  section: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink, marginTop: 8 },
  rem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  sep: { borderTopWidth: 1, borderTopColor: colors.line },
  remLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  time: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  timeEdit: { fontFamily: fonts.semi, fontSize: 12, color: colors.primary },
  timeText: { fontFamily: fonts.semi, fontSize: 14, color: colors.inkSoft, },
  note: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft, textAlign: 'center' },
  memHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  memSub: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginTop: 2, lineHeight: 18 },
  replay: { fontFamily: fonts.semi, fontSize: 13, color: colors.primary, textAlign: 'center', paddingTop: 14 },
  danger: { fontFamily: fonts.semi, fontSize: 13, color: colors.danger, textAlign: 'center', paddingVertical: 10 },
  memEmpty: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft, marginTop: 12, lineHeight: 20 },
  mem: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.bg, borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 12, marginTop: 6 },
  memText: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  clear: { fontFamily: fonts.semi, color: colors.danger, textAlign: 'center', marginTop: 12 },
});
