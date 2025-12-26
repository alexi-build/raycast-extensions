import { getPreferenceValues, open, showHUD } from "@raycast/api";

/**
 * Triggers a custom Raycast notification and celebration when an interval is complete.
 */
export async function triggerIntervalCompleteNotification(minutes: number): Promise<void> {
  const { enableConfetti } = getPreferenceValues<Preferences>();
  try {
    await showHUD(`🩷 You have been active for ${minutes} minutes`);
    if (enableConfetti) {
      await open("raycast://extensions/raycast/raycast/confetti?emojis=🩷");
    }
  } catch (error) {
    console.error("Failed to trigger notification:", error);
  }
}
