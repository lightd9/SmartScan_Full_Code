import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { getHapticsEnabled } from './storage';

export async function vibrateSuccess() {
  if (!getHapticsEnabled()) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch (_e) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([40, 60, 40]);
    }
  }
}

export async function vibrateWarning() {
  if (!getHapticsEnabled()) return;
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch (_e) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100, 80, 100, 80, 150]);
    }
  }
}

export async function vibrateClick() {
  if (!getHapticsEnabled()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (_e) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(25);
    }
  }
}
