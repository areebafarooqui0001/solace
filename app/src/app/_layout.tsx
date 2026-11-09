import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useFonts } from 'expo-font';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../auth';
import { api } from '../api';
import { ToastProvider } from '../components/Toast';
import { configureNotifications, syncReminders } from '../lib/notifications';
import { colors } from '../theme';

configureNotifications();

/** Routes a notification tap to its screen, whether the app was open, backgrounded or closed. */
function NotificationRouter() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const last = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (loading || !user) return;
    if (!last || last.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const url = last.notification.request.content.data?.url;
    if (typeof url === 'string') router.push(url as never);
    Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }, [last, loading, user, router]);

  return null;
}

/** Re-schedules local reminders whenever a user is signed in (fresh login, app relaunch, new phone). */
function ReminderSync() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    api.reminders().then((r) => syncReminders(r.reminders)).catch(() => {});
  }, [user?.id]);
  return null;
}

export default function RootLayout() {
  const [loaded] = useFonts({ Fraunces_600SemiBold, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold });

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <NotificationRouter />
          <ReminderSync />
          <ToastProvider>
          <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="chat/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="checkin" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="breathe" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
            <Stack.Screen name="activity/[kind]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          </Stack>
          </ToastProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
