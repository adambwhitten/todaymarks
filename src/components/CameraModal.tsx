import { useEffect, useRef, useState } from "react";
import { CameraIcon, XIcon } from "./Icons";

interface CameraModalProps {
  onClose: () => void;
}

interface DeviceOption {
  deviceId: string;
  label: string;
}

export function CameraModal({ onClose }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [showCompliment, setShowCompliment] = useState(false);

  // (Re)start the stream whenever the chosen device changes.
  useEffect(() => {
    let cancelled = false;

    async function start() {
      setReady(false);
      setShowCompliment(false);
      setError(null);
      stop();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId ? { deviceId: { exact: deviceId } } : true,
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);

        // Populate the device list (labels are only available after permission).
        const all = await navigator.mediaDevices.enumerateDevices();
        const cams = all
          .filter((d) => d.kind === "videoinput")
          .map((d, i) => ({
            deviceId: d.deviceId,
            label: d.label || `Camera ${i + 1}`,
          }));
        if (!cancelled) {
          setDevices(cams);
          if (!deviceId && cams[0]) setDeviceId(cams[0].deviceId);
        }
      } catch (e) {
        if (cancelled) return;
        const err = e as DOMException;
        if (err.name === "NotAllowedError") {
          setError(
            "Camera access was denied. Enable Todaymarks under System Settings → Privacy → Camera."
          );
        } else if (err.name === "NotFoundError") {
          setError("No camera was found on this Mac.");
        } else {
          setError(err.message || "Couldn't start the camera.");
        }
      }
    }

    function stop() {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [deviceId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // After the preview settles, reassure the user. 🙂
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setShowCompliment(true), 1400);
    return () => clearTimeout(t);
  }, [ready]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal camera-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <CameraIcon size={17} />
            How do I look?
          </div>
          <button className="icon-btn" onClick={onClose}>
            <XIcon />
          </button>
        </div>

        <div className="camera-stage">
          {error ? (
            <div className="camera-error">{error}</div>
          ) : (
            <video
              ref={videoRef}
              className={"camera-video" + (ready ? " is-ready" : "")}
              autoPlay
              playsInline
              muted
            />
          )}
          {!error && !ready && <div className="camera-loading">Starting camera…</div>}
          {showCompliment && (
            <div className="camera-compliment">
              You look great! <span className="camera-compliment-emoji">😊</span>
            </div>
          )}
        </div>

        {devices.length > 1 && !error && (
          <div className="camera-footer">
            <select
              className="efield-select is-right"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              style={{ width: "100%", padding: "10px 12px" }}
            >
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
