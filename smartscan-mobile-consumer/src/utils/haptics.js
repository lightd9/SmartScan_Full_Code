import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export async function vibrateSuccess() {
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch (_e) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([40, 60, 40]);
    }
  }
}

export async function vibrateWarning() {
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch (_e) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100, 80, 100, 80, 150]);
    }
  }
}

export async function vibrateClick() {
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (_e) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(25);
    }
  }
}
