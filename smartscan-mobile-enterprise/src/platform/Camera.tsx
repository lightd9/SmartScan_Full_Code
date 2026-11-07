import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import {
  Camera as CameraIcon,
  Image,
  LoaderCircle,
  Pause,
  ScanLine,
  SwitchCamera,
  Zap,
} from "lucide-react";
import { ErrorNote } from "../design/ui";

function cameraError(error: unknown) {
  const text = String(error);
  if (/NotAllowed|Permission|Security/i.test(text))
    return "Camera access was blocked. Allow camera access for this site, then try again.";
  if (/NotFound|DevicesNotFound/i.test(text))
    return "No camera was found. Use a photo or enter the serial below.";
  return "The camera could not start. Close other camera apps and try again, or enter the serial.";
}
export default function Camera({
  onCode,
  paused,
}: {
  onCode(code: string): Promise<void>;
  paused: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const id = `reader-${uid}`;
  const [enabled, setEnabled] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [facing, setFacing] = useState("environment");
  const [state, setState] = useState<"idle" | "starting" | "ready" | "error">(
    "idle",
  );
  const [error, setError] = useState("");
  const [torch, setTorch] = useState(false);
  const [supportsTorch, setSupportsTorch] = useState(false);
  const [reading, setReading] = useState(false);
  const scanner = useRef<Html5Qrcode>();
  const chain = useRef(Promise.resolve());
  const callback = useRef(onCode);
  callback.current = onCode;
  const photo = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const previous = useRef({ code: "", at: 0 });
  const hint = useRef<HTMLSpanElement>(null);
  const lastReady = useRef(false);
  useLayoutEffect(() => {
    const ready = state === "ready";
    if (lastReady.current === ready) return;
    lastReady.current = ready;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = hint.current?.animate(
      [{ opacity: 0 }, { opacity: 0, offset: 0.8 }, { opacity: 1 }],
      { duration: 450, easing: "ease-out" },
    );
    return () => animation?.cancel();
  }, [state]);
  useEffect(() => {
    const visibility = () => {
      if (document.visibilityState !== "visible") {
        setEnabled(false);
        setState("idle");
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);
  useEffect(() => {
    if (!enabled || paused || reading) {
      setState("idle");
      return;
    }
    let disposed = false;
    let instance: Html5Qrcode | undefined;
    const start = chain.current
      .catch(() => {})
      .then(async () => {
        if (disposed) return;
        setState("starting");
        setError("");
        setTorch(false);
        setSupportsTorch(false);
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          setState("error");
          setError(
            "Camera access needs HTTPS. Open the secure preview address, or use a photo or serial.",
          );
          return;
        }
        try {
          const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import(
            "html5-qrcode"
          );
          if (disposed) return;
          instance = new Html5Qrcode(id, {
            formatsToSupport: [
              Html5QrcodeSupportedFormats.QR_CODE,
              Html5QrcodeSupportedFormats.CODE_128,
            ],
            verbose: false,
          });
          scanner.current = instance;
          await instance.start(
            { facingMode: facing },
            { fps: 10 },
            (code) => {
              if (
                disposed ||
                busy.current ||
                (previous.current.code === code &&
                  Date.now() - previous.current.at < 2200)
              )
                return;
              previous.current = { code, at: Date.now() };
              busy.current = true;
              void callback.current(code).finally(() => {
                busy.current = false;
              });
            },
            () => {},
          );
          if (!disposed) {
            setState("ready");
            try {
              setSupportsTorch(
                Boolean(
                  (
                    instance.getRunningTrackCapabilities() as {
                      torch?: boolean;
                    }
                  ).torch,
                ),
              );
            } catch {
              /* Optional capability. */
            }
          }
        } catch (e) {
          if (!disposed) {
            setState("error");
            setError(cameraError(e));
          }
        }
      });
    chain.current = start;
    return () => {
      disposed = true;
      chain.current = start
        .catch(() => {})
        .then(async () => {
          if (instance && [2, 3].includes(instance.getState()))
            await instance.stop().catch(() => {});
          try {
            instance?.clear();
          } catch {
            /* Camera is stopped even after its view unmounts. */
          }
          if (scanner.current === instance) scanner.current = undefined;
        });
    };
  }, [enabled, paused, facing, id, attempt, reading]);
  async function readPhoto(file?: File) {
    if (!file) return;
    setReading(true);
    setEnabled(false);
    setError("");
    let instance: Html5Qrcode | undefined;
    try {
      // Give effect cleanup a chance to serialize closure before decoding a file.
      await new Promise((resolve) => setTimeout(resolve, 0));
      await chain.current;
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import(
        "html5-qrcode"
      );
      instance = new Html5Qrcode(`photo-${uid}`, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
        ],
        verbose: false,
      });
      const code = await instance.scanFile(file, false);
      await callback.current(code);
    } catch {
      setError(
        "No supported code was found. Try a clearer photo or enter the serial.",
      );
    } finally {
      try {
        instance?.clear();
      } catch {
        /* Optional detached decode view. */
      }
      setReading(false);
      if (photo.current) photo.current.value = "";
    }
  }
  return (
    <div className="camera-section">
      <div className={`camera-panel ${state === "ready" ? "live" : ""}`}>
        <div className="camera-ambient" />
        <div id={id} className="camera-reader" />
        <div className="camera-shade" />
        <div className="camera-top">
          <span>
            {state === "ready" ? "Camera ready" : "Scan a product code"}
          </span>
          {state === "ready" && (
            <button
              aria-label="Pause camera"
              onClick={() => {
                setEnabled(false);
                setState("idle");
              }}
            >
              <Pause size={17} />
            </button>
          )}
        </div>
        <div className="camera-target" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <ScanLine size={38} strokeWidth={1} />
        </div>
        <div className={`camera-hint ${state === "ready" ? "scanning" : ""}`}>
          <span className="camera-hint-track" aria-hidden="true">
            <ScanLine size={19} />
          </span>
          <span className="camera-hint-copy" ref={hint}>
            {reading
              ? "Reading your photo…"
              : "Place the code inside the frame"}
          </span>
        </div>
        {state !== "ready" && (
          <button
            className="camera-enable"
            disabled={state === "starting" || reading || paused}
            onClick={() => {
              setEnabled(true);
              setAttempt((a) => a + 1);
            }}
          >
            {state === "starting" || reading ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <CameraIcon size={16} />
            )}
            {state === "starting"
              ? "Opening camera…"
              : state === "error"
                ? "Try camera"
                : "Enable camera"}
          </button>
        )}
      </div>
      <div className="camera-tools">
        <button
          disabled={!supportsTorch || state !== "ready"}
          aria-pressed={torch}
          onClick={async () => {
            try {
              await scanner.current?.applyVideoConstraints({
                advanced: [{ torch: !torch } as MediaTrackConstraintSet],
              });
              setTorch(!torch);
            } catch {
              setError("Flashlight is unavailable on this camera.");
            }
          }}
        >
          <Zap size={18} />
          Flashlight
        </button>
        <button onClick={() => photo.current?.click()} disabled={reading}>
          <Image size={18} />
          Photo
        </button>
        <button
          aria-label="Flip camera"
          disabled={state === "starting" || reading}
          onClick={() => {
            setFacing((f) => (f === "environment" ? "user" : "environment"));
            setEnabled(true);
          }}
        >
          <SwitchCamera size={18} />
          Flip
        </button>
      </div>
      <input
        ref={photo}
        type="file"
        accept="image/*"
        hidden
        aria-label="Upload code photo"
        onChange={(e) => void readPhoto(e.target.files?.[0])}
      />
      <div id={`photo-${uid}`} hidden />
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}
