import type { ActiveState } from "../types";
import { getIdleTimeSeconds } from "../utils/idle";
import { getParsedPreferences } from "../utils/preferences";
import { getActiveState, saveActiveState } from "../utils/storage";

export async function processActiveState(): Promise<ActiveState> {
  const { activeIntervalSeconds, idleThresholdSeconds } = getParsedPreferences();
  const state = await getActiveState();

  const currentIdleSeconds = await getIdleTimeSeconds();
  const isIdle = currentIdleSeconds > idleThresholdSeconds;

  if (isIdle) {
    state.accumulatedActiveSeconds = 0;
    state.lastCheckTime = Date.now();
    state.isIdle = true;
    state.shouldNotify = false;

    await saveActiveState(state);
    return state;
  }

  const now = Date.now();
  const timeSinceLastCheck = Math.floor((now - state.lastCheckTime) / 1000); // Convert milliseconds to seconds

  const activeTimeToAdd = timeSinceLastCheck;
  const previousMilestones = Math.floor(state.accumulatedActiveSeconds / activeIntervalSeconds);

  state.accumulatedActiveSeconds += activeTimeToAdd;
  state.lastCheckTime = Date.now();
  state.isIdle = false;

  const currentMilestones = Math.floor(state.accumulatedActiveSeconds / activeIntervalSeconds);
  state.shouldNotify = currentMilestones > previousMilestones;

  if (state.shouldNotify) {
    state.sessionCount += 1;
  }

  await saveActiveState(state);
  return state;
}
