import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * Google sign-in is optional. It only appears when an Android OAuth client ID was provided at build time
 * (EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID in eas.json) and the app is a real build. Expo Go cannot receive the
 * sign-in redirect, so the button stays hidden there and email login keeps working.
 */
export const GOOGLE_CLIENT_ID = (process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '').trim();

export const googleAvailable =
  Platform.OS === 'android' && !!GOOGLE_CLIENT_ID && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

/** Google's Android clients redirect back to "<package name>:/oauthredirect". */
export const GOOGLE_REDIRECT_URI = `${Constants.expoConfig?.android?.package ?? 'com.solace.wellness'}:/oauthredirect`;
