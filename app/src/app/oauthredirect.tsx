import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../components/ui';
import { colors } from '../theme';

/**
 * Google sends people back to "<package>:/oauthredirect". The sign-in code reads that link itself, but the router
 * also sees it, so this quiet screen stands in for it. A successful sign-in replaces it with Home within a moment;
 * if nothing does (cancelled or failed), it steps back to where the person was.
 */
export default function OAuthRedirect() {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/login')), 4000);
    return () => clearTimeout(t);
  }, []);
  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    </Screen>
  );
}
