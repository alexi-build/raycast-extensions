import { LocalStorage } from "@raycast/api";
import { STORAGE_KEYS } from "../constants";
import type { ActiveState } from "../types";

const DEFAULT_STATE: Omit<ActiveState, "lastCheckTime"> = {
  accumulatedActiveSeconds: 0,
  sessionCount: 0,
  isIdle: false,
  shouldNotify: false,
};

export async function getActiveState(): Promise<ActiveState> {
  const stored = await LocalStorage.getItem<string>(STORAGE_KEYS.ACTIVE_STATE);
  if (!stored) return { ...DEFAULT_STATE, lastCheckTime: Date.now() };

  try {
    return JSON.parse(stored);
  } catch {
    return { ...DEFAULT_STATE, lastCheckTime: Date.now() };
  }
}

export async function saveActiveState(state: ActiveState): Promise<void> {
  await LocalStorage.setItem(STORAGE_KEYS.ACTIVE_STATE, JSON.stringify(state));
}

export async function resetActiveState(): Promise<void> {
  const newState: ActiveState = {
    ...DEFAULT_STATE,
    lastCheckTime: Date.now(),
  };
  await saveActiveState(newState);
}
