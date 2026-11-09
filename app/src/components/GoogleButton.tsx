import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { Press } from './ui';
import { useAuth } from '../auth';
import { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI, googleAvailable } from '../lib/google';
import { colors, fonts, radius } from '../theme';

WebBrowser.maybeCompleteAuthSession();

const DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

export function OrDivider() {
  if (!googleAvailable) return null;
  return (
    <View style={styles.orRow}>
      <View style={styles.line} />
      <Text style={styles.orText}>or</Text>
      <View style={styles.line} />
    </View>
  );
}

type Props = { onDone: (isNew: boolean) => void; onError: (message: string) => void };

/** Renders nothing unless Google sign-in is configured, so it can never break the email flow. */
export function GoogleButton(props: Props) {
  return googleAvailable ? <GoogleButtonInner {...props} /> : null;
}

function GoogleButtonInner({ onDone, onError }: Props) {
  const { googleSignIn } = useAuth();
  const [busy, setBusy] = useState(false);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      redirectUri: GOOGLE_REDIRECT_URI,
      scopes: ['openid', 'profile', 'email'],
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      prompt: AuthSession.Prompt.SelectAccount,
    },
    DISCOVERY
  );

  useEffect(() => {
    if (!response) return;
    if (response.type === 'error') {
      setBusy(false);
      return onError("Google sign-in didn't work. Please try again, or use your email.");
    }
    if (response.type !== 'success') return setBusy(false); // cancelled or dismissed
    (async () => {
      try {
        const token = await AuthSession.exchangeCodeAsync(
          {
            clientId: GOOGLE_CLIENT_ID,
            code: response.params.code,
            redirectUri: GOOGLE_REDIRECT_URI,
            extraParams: { code_verifier: request?.codeVerifier ?? '' },
          },
          DISCOVERY
        );
        if (!token.idToken) throw new Error('No ID token');
        onDone(await googleSignIn(token.idToken));
      } catch (e) {
        onError(e instanceof Error && e.message !== 'No ID token' ? e.message : "Google sign-in didn't work. Please try again, or use your email.");
      } finally {
        setBusy(false);
      }
    })();
  }, [response]);

  return (
    <Press
      disabled={!request || busy}
      onPress={() => {
        onError('');
        setBusy(true);
        promptAsync().catch(() => setBusy(false));
      }}
      style={styles.btn}
    >
      {busy ? <ActivityIndicator color={colors.ink} /> : <Ionicons name="logo-google" size={20} color={colors.ink} />}
      <Text style={styles.text}>Continue with Google</Text>
    </Press>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E7DCC3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  text: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  line: { flex: 1, height: 1, backgroundColor: '#E7DCC3' },
  orText: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
});
