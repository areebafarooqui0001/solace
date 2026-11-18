import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Mascot } from '../components/Mascot';
import { Button, Chip, Field, Screen } from '../components/ui';
import { FeelingPick, GoalsPick, ReminderPick, StepDots } from '../components/SetupSteps';
import { useAuth } from '../auth';
import { ensurePermission, syncReminders } from '../lib/notifications';
import { api } from '../api';
import { GoogleButton, OrDivider } from '../components/GoogleButton';
import { colors, fonts } from '../theme';


export default function Signup() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [goals, setGoals] = useState<string[]>([]);
  const [feeling, setFeeling] = useState('');
  const [reminder, setReminder] = useState({ remind: true, time: { hour: 20, minute: 0 } });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const edit = (setter: (v: string) => void) => (v: string) => {
    setError('');
    setter(v);
  };

  // Tell people right away if the email is taken, instead of after they have filled in every step.
  const next = async () => {
    setError('');
    setBusy(true);
    try {
      const { available } = await api.checkEmail(email);
      if (!available) return setError('An account with this email already exists. Try logging in instead.');
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const go = (n: number) => {
    setError('');
    setStep(n);
  };

  const create = async () => {
    setError('');
    setBusy(true);
    try {
      await signUp({ name, email, password, goals, feeling: feeling || undefined, remind: reminder.remind, checkinTime: reminder.time });
      // Ask for notification permission at a moment that makes sense, and schedule the default reminders.
      try {
        await ensurePermission();
        const { reminders } = await api.reminders();
        await syncReminders(reminders);
      } catch {}
      router.replace('/(tabs)/home');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not create account';
      setError(msg);
      // Only an email problem belongs on the first step; anything else (like a dropped connection) stays here.
      if (/email/i.test(msg)) setStep(0);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <Mascot mood={step === 0 ? 'calm' : 'joyful'} size={step === 0 ? 110 : 90} />
          </View>
          <StepDots total={4} index={step} />
          {step === 0 ? (
            <>
              <Text style={styles.title}>Let's get to know you</Text>
              <Text style={styles.sub}>It only takes a moment.</Text>
              <Field label="What should Sunny call you?" value={name} onChangeText={edit(setName)} autoCapitalize="words" placeholder="Your first name" />
              <Field label="Email" value={email} onChangeText={edit(setEmail)} keyboardType="email-address" placeholder="you@email.com" autoComplete="email" />
              <Field label="Password" value={password} onChangeText={edit(setPassword)} secureTextEntry placeholder="At least 6 characters" />
              {!!error && <Text style={styles.error}>{error}</Text>}
              <Button
                title="Continue"
                onPress={next}
                loading={busy}
                disabled={!name.trim() || !email.includes('@') || password.length < 6}
                style={{ marginTop: 8 }}
              />
              <OrDivider />
              <GoogleButton onError={setError} onDone={(isNew) => router.replace(isNew ? '/setup' : '/(tabs)/home')} />
              <Text style={styles.switch} onPress={() => router.replace('/login')}>
                Already have an account? <Text style={{ color: colors.primary, fontFamily: fonts.bold }}>Log in</Text>
              </Text>
            </>
          ) : step === 1 ? (
            <>
              <GoalsPick value={goals} onChange={setGoals} title={`Nice to meet you, ${name.trim().split(' ')[0]}`} />
              <Button title="Next" onPress={() => go(2)} style={{ marginTop: 28 }} />
              <Text style={styles.switch} onPress={() => go(0)}>
                Back
              </Text>
            </>
          ) : step === 2 ? (
            <>
              <FeelingPick value={feeling} onChange={setFeeling} />
              <Button title="Next" onPress={() => go(3)} style={{ marginTop: 28 }} />
              <Text style={styles.switch} onPress={() => go(1)}>
                Back
              </Text>
            </>
          ) : (
            <>
              <ReminderPick value={reminder} onChange={setReminder} />
              {!!error && <Text style={[styles.error, { marginTop: 14 }]}>{error}</Text>}
              <Button title="Create my space" onPress={create} loading={busy} style={{ marginTop: 28 }} />
              <Text style={styles.switch} onPress={() => go(2)}>
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
  wrap: { padding: 28, paddingTop: 24 },
  title: { fontFamily: fonts.heading, fontSize: 28, color: colors.ink, textAlign: 'center' },
  sub: { fontFamily: fonts.body, fontSize: 16, color: colors.inkSoft, textAlign: 'center', marginBottom: 24, marginTop: 4 },
  error: { fontFamily: fonts.semi, color: colors.danger, textAlign: 'center', marginBottom: 6 },
  q: { fontFamily: fonts.heading, fontSize: 19, color: colors.ink, textAlign: 'center', marginBottom: 12 },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, textAlign: 'center', marginTop: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  switch: { textAlign: 'center', marginTop: 22, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 15 },
});
