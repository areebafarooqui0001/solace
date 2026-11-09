import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Mascot } from '../components/Mascot';
import { Button, Chip, Field, Screen } from '../components/ui';
import { TimeSheet, fmtTime } from '../components/TimeSheet';
import { useAuth } from '../auth';
import { ensurePermission, syncReminders } from '../lib/notifications';
import { api } from '../api';
import { FEELINGS, GOALS } from '../content';
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
  const [remind, setRemind] = useState(true);
  const [time, setTime] = useState({ hour: 20, minute: 0 });
  const [picking, setPicking] = useState(false);
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

  const toggle = (g: string) => setGoals((c) => (c.includes(g) ? c.filter((x) => x !== g) : [...c, g]));

  const create = async () => {
    setError('');
    setBusy(true);
    try {
      await signUp({ name, email, password, goals, feeling: feeling || undefined, remind, checkinTime: time });
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
            <Mascot mood={step === 0 ? 'calm' : 'joyful'} size={110} />
          </View>
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
              <Text style={styles.title}>Nice to meet you, {name.trim().split(' ')[0]}</Text>
              <Text style={styles.sub}>What would you like Solace to help with? Pick any.</Text>
              <View style={styles.chips}>
                {GOALS.map((g) => (
                  <Chip key={g} label={g} selected={goals.includes(g)} onPress={() => toggle(g)} />
                ))}
              </View>
              <Button title="Continue" onPress={() => { setError(''); setStep(2); }} style={{ marginTop: 28 }} />
              <Text style={styles.switch} onPress={() => { setError(''); setStep(0); }}>
                Back
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>Two last things</Text>
              <Text style={styles.sub}>So Sunny can meet you where you are.</Text>
              <Text style={styles.q}>How have you been feeling lately?</Text>
              <View style={styles.chips}>
                {FEELINGS.map((f) => (
                  <Chip key={f} label={f} selected={feeling === f} onPress={() => setFeeling(feeling === f ? '' : f)} />
                ))}
              </View>
              <Text style={[styles.q, { marginTop: 26 }]}>When should Sunny nudge you to check in?</Text>
              <View style={styles.chips}>
                {[{ l: 'Morning', h: 8 }, { l: 'Afternoon', h: 14 }, { l: 'Evening', h: 20 }].map((o) => (
                  <Chip key={o.l} label={`${o.l} · ${fmtTime(o.h, 0)}`} selected={remind && time.hour === o.h && time.minute === 0} onPress={() => { setRemind(true); setTime({ hour: o.h, minute: 0 }); }} />
                ))}
                <Chip label={remind ? `Custom · ${fmtTime(time.hour, time.minute)}` : 'Custom time'} selected={remind && ![8, 14, 20].includes(time.hour) || remind && time.minute !== 0} onPress={() => { setRemind(true); setPicking(true); }} />
                <Chip label="No reminders" selected={!remind} onPress={() => setRemind(false)} />
              </View>
              <Text style={styles.hint}>You can change this anytime in your profile.</Text>
              {!!error && <Text style={styles.error}>{error}</Text>}
              <Button title="Create my space" onPress={create} loading={busy} style={{ marginTop: 24 }} />
              <Text style={styles.switch} onPress={() => { setError(''); setStep(1); }}>
                Back
              </Text>
              <TimeSheet visible={picking} title="Check-in time" hour={time.hour} minute={time.minute} onClose={() => setPicking(false)} onSave={(hour, minute) => { setTime({ hour, minute }); setPicking(false); }} />
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
