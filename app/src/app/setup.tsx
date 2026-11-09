import React, { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Mascot } from '../components/Mascot';
import { Button, Chip, Screen } from '../components/ui';
import { TimeSheet, fmtTime } from '../components/TimeSheet';
import { useAuth } from '../auth';
import { api } from '../api';
import { FEELINGS, GOALS } from '../content';
import { ensurePermission, syncReminders } from '../lib/notifications';
import { colors, fonts } from '../theme';

/** Shown once after signing in with Google, so Sunny still learns what email signup would have asked. */
export default function Setup() {
  const router = useRouter();
  const { user } = useAuth();
  const [goals, setGoals] = useState<string[]>([]);
  const [feeling, setFeeling] = useState('');
  const [remind, setRemind] = useState(true);
  const [time, setTime] = useState({ hour: 20, minute: 0 });
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggle = (g: string) => setGoals((c) => (c.includes(g) ? c.filter((x) => x !== g) : [...c, g]));
  const home = () => router.replace('/(tabs)/home');

  const save = async () => {
    setError('');
    setBusy(true);
    try {
      await api.setup({ goals, feeling: feeling || undefined, remind, checkinTime: time });
      try {
        await ensurePermission();
        await syncReminders((await api.reminders()).reminders);
      } catch {}
      home();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <Mascot mood="joyful" size={100} />
          </View>
          <Text style={styles.title}>Nice to meet you{user ? `, ${user.name}` : ''}</Text>
          <Text style={styles.sub}>A few quick things so Sunny can meet you where you are.</Text>

          <Text style={styles.q}>What would you like help with?</Text>
          <View style={styles.chips}>
            {GOALS.map((g) => (
              <Chip key={g} label={g} selected={goals.includes(g)} onPress={() => toggle(g)} />
            ))}
          </View>

          <Text style={[styles.q, { marginTop: 24 }]}>How have you been feeling lately?</Text>
          <View style={styles.chips}>
            {FEELINGS.map((f) => (
              <Chip key={f} label={f} selected={feeling === f} onPress={() => setFeeling(feeling === f ? '' : f)} />
            ))}
          </View>

          <Text style={[styles.q, { marginTop: 24 }]}>When should Sunny nudge you to check in?</Text>
          <View style={styles.chips}>
            {[{ l: 'Morning', h: 8 }, { l: 'Afternoon', h: 14 }, { l: 'Evening', h: 20 }].map((o) => (
              <Chip
                key={o.l}
                label={`${o.l} · ${fmtTime(o.h, 0)}`}
                selected={remind && time.hour === o.h && time.minute === 0}
                onPress={() => { setRemind(true); setTime({ hour: o.h, minute: 0 }); }}
              />
            ))}
            <Chip
              label={remind && ![8, 14, 20].includes(time.hour) ? `Custom · ${fmtTime(time.hour, time.minute)}` : 'Custom time'}
              selected={remind && (![8, 14, 20].includes(time.hour) || time.minute !== 0)}
              onPress={() => { setRemind(true); setPicking(true); }}
            />
            <Chip label="No reminders" selected={!remind} onPress={() => setRemind(false)} />
          </View>
          <Text style={styles.hint}>You can change all of this anytime in your profile.</Text>

          {!!error && <Text style={styles.error}>{error}</Text>}
          <Button title="Continue" onPress={save} loading={busy} style={{ marginTop: 20 }} />
          <Text style={styles.skip} onPress={home}>
            Skip for now
          </Text>
          <TimeSheet visible={picking} title="Check-in time" hour={time.hour} minute={time.minute} onClose={() => setPicking(false)} onSave={(hour, minute) => { setTime({ hour, minute }); setPicking(false); }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 28, paddingTop: 30, paddingBottom: 48 },
  title: { fontFamily: fonts.heading, fontSize: 30, color: colors.ink, textAlign: 'center' },
  sub: { fontFamily: fonts.body, fontSize: 15, color: colors.inkSoft, textAlign: 'center', marginBottom: 24, marginTop: 4 },
  q: { fontFamily: fonts.heading, fontSize: 19, color: colors.ink, textAlign: 'center', marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, textAlign: 'center', marginTop: 14 },
  error: { fontFamily: fonts.semi, color: colors.danger, textAlign: 'center', marginTop: 12 },
  skip: { textAlign: 'center', marginTop: 18, fontFamily: fonts.semi, color: colors.inkSoft, fontSize: 15 },
});
