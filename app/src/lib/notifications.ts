import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Reminder } from '../api';

const CHANNEL = 'reminders';

/** Where each reminder kind sends the user when tapped. */
export const ROUTE_FOR_KIND: Record<string, string> = {
  checkin: '/checkin',
  affirmation: '/activity/affirmation',
  breathing: '/breathe',
  selfcare: '/activity/selfcare',
  custom: '/(tabs)/home',
};

const COPY: Record<string, { title: string; body: string }> = {
  checkin: { title: 'How are you feeling?', body: 'Take a gentle moment to check in with yourself.' },
  affirmation: { title: 'Your affirmation for today', body: 'A small thought to carry with you.' },
  breathing: { title: 'Time for a breather', body: 'One minute of slow breathing. Sunny will count with you.' },
  selfcare: { title: 'Wind down, softly', body: 'You did enough today. Want a calm moment before rest?' },
};

export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Gentle reminders',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#B9A8EC',
    });
  }
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted || cur.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return true;
  if (!cur.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return next.granted;
}

/**
 * Rebuilds every local schedule from the server list. Local daily triggers keep firing
 * when the app is backgrounded or closed, and re-syncing on launch keeps them correct.
 */
export async function syncReminders(reminders: Reminder[]) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const active = reminders.filter((r) => r.enabled);
  if (!active.length) return;
  if (!(await ensurePermission())) return;

  for (const r of active) {
    const copy = COPY[r.kind] ?? { title: r.label, body: 'A gentle nudge from Solace.' };
    await Notifications.scheduleNotificationAsync({
      content: {
        title: copy.title,
        body: r.kind === 'custom' ? r.label : copy.body,
        data: { url: ROUTE_FOR_KIND[r.kind] ?? '/(tabs)/home', reminderId: r.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: r.hour,
        minute: r.minute,
        channelId: CHANNEL,
      },
    });
  }
}

export const clearAllReminders = () => Notifications.cancelAllScheduledNotificationsAsync();

export async function sendTestNotification() {
  if (!(await ensurePermission())) return false;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Hi from Sunny',
      body: 'Tap me to open your check-in.',
      data: { url: '/checkin' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL },
  });
  return true;
}
