// src/types.ts
export interface ActiveState {
  accumulatedActiveSeconds: number;
  lastCheckTime: number;
  sessionCount: number;
  isIdle: boolean;
  shouldNotify: boolean;
}

export interface Preferences {
  activeInterval: string;
  idleThreshold: string;
}
