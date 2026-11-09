import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Mascot } from '../components/Mascot';
import { Button, Field, Screen } from '../components/ui';
import { useAuth } from '../auth';
import { GoogleButton, OrDivider } from '../components/GoogleButton';
import { colors, fonts } from '../theme';

export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      await signIn(email, password);
      router.replace('/(tabs)/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <Mascot mood="joyful" size={120} />
          </View>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.sub}>Sunny has been waiting for you.</Text>
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@email.com" autoComplete="email" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Your password" />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Button title="Log in" onPress={submit} loading={busy} disabled={!email || !password} style={{ marginTop: 8 }} />
          <OrDivider />
          <GoogleButton onError={setError} onDone={(isNew) => router.replace(isNew ? '/setup' : '/(tabs)/home')} />
          <Text style={styles.switch} onPress={() => router.replace('/signup')}>
            New here? <Text style={{ color: colors.primary, fontFamily: fonts.bold }}>Create an account</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 28, paddingTop: 40 },
  title: { fontFamily: fonts.heading, fontSize: 32, color: colors.ink, textAlign: 'center' },
  sub: { fontFamily: fonts.body, fontSize: 16, color: colors.inkSoft, textAlign: 'center', marginBottom: 28, marginTop: 4 },
  error: { fontFamily: fonts.semi, color: colors.danger, textAlign: 'center', marginBottom: 6 },
  switch: { textAlign: 'center', marginTop: 22, fontFamily: fonts.body, color: colors.inkSoft, fontSize: 15 },
});
