import AsyncStorage from '@react-native-async-storage/async-storage';
import { Trip } from '../types/models';

const KEY = 'golf-trip-app:v1';

export interface AppState {
  trips: Trip[];
}

export async function loadState(): Promise<AppState> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : { trips: [] };
}

export async function saveState(state: AppState): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}
