import React, { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Mascot } from '../components/Mascot';
import { Button, Screen } from '../components/ui';
import { FeelingPick, GoalsPick, ReminderPick, StepDots } from '../components/SetupSteps';
import { useAuth } from '../auth';
import { api } from '../api';
import { ensurePermission, syncReminders } from '../lib/notifications';
import { colors, fonts } from '../theme';

/** Shown once after signing in with Google, so Sunny still learns what email signup would have asked. */
export default function Setup() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState<string[]>([]);
  const [feeling, setFeeling] = useState('');
  const [reminder, setReminder] = useState({ remind: true, time: { hour: 20, minute: 0 } });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const home = () => router.replace('/(tabs)/home');
  const go = (n: number) => {
    setError('');
    setStep(n);
  };

  const save = async () => {
    setError('');
    setBusy(true);
    try {
      await api.setup({ goals, feeling: feeling || undefined, remind: reminder.remind, checkinTime: reminder.time });
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

  const first = user?.name?.split(' ')[0];

  return (
    <Screen>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <Mascot mood="joyful" size={90} />
          </View>
          <StepDots total={3} index={step} />
          {step === 0 ? (
            <>
              <GoalsPick value={goals} onChange={setGoals} title={first ? `Nice to meet you, ${first}` : undefined} />
              <Button title="Next" onPress={() => go(1)} style={{ marginTop: 28 }} />
              <Text style={styles.skip} onPress={home}>
                Skip for now
              </Text>
            </>
          ) : step === 1 ? (
            <>
              <FeelingPick value={feeling} onChange={setFeeling} />
              <Button title="Next" onPress={() => go(2)} style={{ marginTop: 28 }} />
              <Text style={styles.skip} onPress={() => go(0)}>
                Back
              </Text>
            </>
          ) : (
            <>
              <ReminderPick value={reminder} onChange={setReminder} />
              {!!error && <Text style={styles.error}>{error}</Text>}
              <Button title="Finish" onPress={save} loading={busy} style={{ marginTop: 28 }} />
              <Text style={styles.skip} onPress={() => go(1)}>
                Back
              </Text>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 28, paddingTop: 30, paddingBottom: 40 },
  error: { fontFamily: fonts.semi, color: colors.danger, textAlign: 'center', marginTop: 14 },
  skip: { textAlign: 'center', marginTop: 22, fontFamily: fonts.semi, color: colors.inkSoft, fontSize: 15 },
});
