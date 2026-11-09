import * as SecureStore from 'expo-secure-store';

// Set EXPO_PUBLIC_API_URL at build time (see eas.json). 10.0.2.2 is the Android emulator's host loopback.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000').replace(/\/$/, '');

const TOKEN_KEY = 'solace_token';
let token: string | null = null;

export const tokenStore = {
  async load() {
    token = await SecureStore.getItemAsync(TOKEN_KEY);
    return token;
  },
  async set(t: string | null) {
    token = t;
    if (t) await SecureStore.setItemAsync(TOKEN_KEY, t);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  },
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// AI endpoints can legitimately take a while, and a free host may need ~30s to wake up; everything else still fails fast enough for the app to say it is offline
// instead of hanging until the phone's own (very long) network timeout.
const SLOW = /\/messages$|\/daily\/(note|challenge)/;

async function request<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SLOW.test(path) ? 60000 : 25000);
  try {
    res = await fetch(API_URL + path, {
      method: opts.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        // lets the server treat "today" and streaks in the user's own timezone
        'x-tz-offset': String(new Date().getTimezoneOffset()),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError("Can't reach Solace right now. Check your connection and try again.", 0);
  } finally {
    clearTimeout(timer);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(data.error ?? 'Something went wrong', res.status);
  return data as T;
}

// ---------- Types ----------
export type User = { id: number; email: string; name: string; goals: string[]; memoryEnabled: boolean };
export type Suggestion = { kind: string; why: string };
export type ChatMessage = {
  id: number | string;
  role: 'user' | 'assistant';
  content: string;
  mood?: string | null;
  suggestion?: Suggestion | null;
  created_at?: string;
};
export type ConversationSummary = { id: number; title: string; updated_at: string; preview: string | null };
export type MoodEntry = { id: number; score: number; tags: string[]; note: string | null; created_at: string };
export type Reminder = {
  id: number;
  kind: string;
  label: string;
  hour: number;
  minute: number;
  enabled: number;
};
export type Memory = { id: number; fact: string; created_at: string };
export type Progress = {
  streak: number;
  activeDays: string[];
  stats: { checkins: number; breathing: number; conversations: number; challenges: number };
  weekAvg: number | null;
  badges: { id: string; label: string; earned: boolean }[];
  xp: number;
  level: number;
  levelName: string;
  xpInLevel: number;
  xpForNext: number;
};
export type Award = {
  gained: number;
  totalXp: number;
  level: number;
  levelName: string;
  xpInLevel: number;
  leveledUp: boolean;
};
export type AssessmentRow = { id: number; type: 'mood' | 'anxiety' | 'selflove'; score: number; label: string; created_at: string };

export type DailyNote = {
  affirmation: string;
  note: string;
  suggestion: { kind: string; why: string } | null;
  personalised: boolean;
};
export type Challenge = { title: string; detail: string; done: boolean; xp?: number };
export type SignupBody = {
  name: string;
  email: string;
  password: string;
  goals: string[];
  feeling?: string;
  checkinTime?: { hour: number; minute: number };
  remind?: boolean;
};

// ---------- Endpoints ----------
export const api = {
  signup: (b: SignupBody) =>
    request<{ token: string; user: User }>('/auth/signup', { method: 'POST', body: b }),
  checkEmail: (email: string) => request<{ available: boolean }>('/auth/check-email', { method: 'POST', body: { email } }),
  google: (idToken: string) => request<{ token: string; user: User; isNew: boolean }>('/auth/google', { method: 'POST', body: { idToken } }),
  setup: (b: { goals?: string[]; feeling?: string; checkinTime?: { hour: number; minute: number }; remind?: boolean }) =>
    request<{ user: User }>('/me/setup', { method: 'POST', body: b }),
  login: (b: { email: string; password: string }) =>
    request<{ token: string; user: User }>('/auth/login', { method: 'POST', body: b }),
  me: () => request<{ user: User }>('/me'),
  updateMe: (b: Partial<{ name: string; goals: string[]; memoryEnabled: boolean }>) =>
    request<{ user: User }>('/me', { method: 'PATCH', body: b }),

  conversations: () => request<{ conversations: ConversationSummary[] }>('/conversations'),
  createConversation: () => request<{ conversation: { id: number } }>('/conversations', { method: 'POST' }),
  messages: (id: number | string) => request<{ messages: ChatMessage[] }>(`/conversations/${id}/messages`),
  sendMessage: (id: number | string, content: string) =>
    request<{ message: ChatMessage }>(`/conversations/${id}/messages`, { method: 'POST', body: { content } }),
  deleteConversation: (id: number) => request<{ ok: true }>(`/conversations/${id}`, { method: 'DELETE' }),

  memories: () => request<{ memories: Memory[] }>('/memories'),
  deleteMemory: (id: number) => request<{ ok: true }>(`/memories/${id}`, { method: 'DELETE' }),
  clearMemories: () => request<{ ok: true }>('/memories', { method: 'DELETE' }),

  addMood: (b: { score: number; tags: string[]; note?: string }) =>
    request<{ ok: true; award: Award }>('/moods', { method: 'POST', body: b }),
  moods: (days = 30) => request<{ moods: MoodEntry[] }>(`/moods?days=${days}`),
  logActivity: (kind: string, detail?: string) =>
    request<{ ok: true; award: Award }>('/activities', { method: 'POST', body: { kind, detail } }),
  submitAssessment: (b: { type: string; answers: number[]; label: string }) =>
    request<{ score: number; award: Award }>('/assessments', { method: 'POST', body: b }),
  assessments: (limit = 5) => request<{ assessments: AssessmentRow[] }>(`/assessments?limit=${limit}`),
  progress: () => request<Progress>('/progress'),
  daily: () => request<{ affirmation: string }>('/daily'),
  dailyNote: () => request<DailyNote>('/daily/note'),
  deleteAccount: () => request<{ ok: boolean }>('/auth/account', { method: 'DELETE' }),
  challenge: () => request<Challenge>('/daily/challenge'),
  completeChallenge: () => request<Challenge & { award: Award }>('/daily/challenge/complete', { method: 'POST' }),

  reminders: () => request<{ reminders: Reminder[] }>('/reminders'),
  addReminder: (b: { label: string; hour: number; minute: number; kind?: string }) =>
    request<{ reminder: Reminder }>('/reminders', { method: 'POST', body: b }),
  updateReminder: (id: number, b: Partial<{ label: string; hour: number; minute: number; enabled: boolean }>) =>
    request<{ reminder: Reminder }>(`/reminders/${id}`, { method: 'PATCH', body: b }),
  deleteReminder: (id: number) => request<{ ok: true }>(`/reminders/${id}`, { method: 'DELETE' }),
};

/** Server timestamps are UTC 'YYYY-MM-DD HH:MM:SS'. */
export const parseServerDate = (s: string) => new Date(s.replace(' ', 'T') + 'Z');
