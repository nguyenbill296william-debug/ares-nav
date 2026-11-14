#!/usr/bin/env python3
"""
ARES-NAV // CapCom Live Wi-Fi Telemetry Relay & High-Speed Asset Server
Zero external dependencies (Python 3 standard library only).

Streams live 20 Hz head-tracking yaw/pitch, waypoint switches, spectral filters,
and hands-free Gaze-Dwell SuperCam LIBS laser shots from the DIY iPhone 3D Visor
Goggles directly onto the Mission Control laptop / projector screen!
"""

import json
import mimetypes
import os
import queue
import re
import socket
import sys
import threading
import time
import webbrowser
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

# Ensure flight-grade MIME types on Windows
mimetypes.add_type("model/gltf-binary", ".glb")
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("application/json", ".json")
mimetypes.add_type("text/css", ".css")

STATE_LOCK = threading.Lock()
CAPCOM_STATE = {
    "seq": 0,
    "updatedAt": 0.0,
    "senderId": None,
    "theaterKey": "jezero",
    "selectedWaypointIdx": 0,
    "hudYawDeg": 65.0,
    "hudPitchOffset": 0.0,
    "hudZoom": 1.0,
    "visorFilterMode": "natural",
    "visorSyntheticVision": False,
    "vrGogglesMode": False,
    "gazeDwellProgress": 0.0,
    "laserEvent": None,
    "mcDirective": None,
}
SSE_SUBSCRIBERS = set()
ACTIVE_TRANSMITTERS = {}  # visor senderId -> last_seen_epoch
ACTIVE_COMMANDERS = {}    # mc senderId -> last_seen_epoch


def detect_lan_ip() -> str:
    """Detect active Wi-Fi / LAN IPv4 address without sending packets."""
    candidates = []
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.4)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        if ip and not ip.startswith("127."):
            candidates.append(ip)
    except Exception:
        pass

    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            ip = info[4][0]
            if ip and not ip.startswith("127.") and not ip.startswith("169.254."):
                if ip not in candidates:
                    candidates.append(ip)
    except Exception:
        pass

    # Prefer standard Wi-Fi private subnets (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    for ip in candidates:
        if ip.startswith("192.168.") or ip.startswith("10."):
            return ip
    return candidates[0] if candidates else "127.0.0.1"


LAN_IP = detect_lan_ip()
SERVER_PORT = 8080


class AresCapcomHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT_DIR, **kwargs)

    def log_message(self, fmt, *args):
        # Keep console clean; only log errors or key milestones
        pass

    def _send_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, payload: dict, status=HTTPStatus.OK):
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self._send_cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self._send_cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        route = parsed.path

        if route == "/api/capcom/info":
            now = time.time()
            with STATE_LOCK:
                alive = [k for k, ts in ACTIVE_TRANSMITTERS.items() if now - ts < 6.0]
                snap = dict(CAPCOM_STATE)
            self._send_json(
                {
                    "ok": True,
                    "lanIp": LAN_IP,
                    "port": SERVER_PORT,
                    "visorUrl": f"http://{LAN_IP}:{SERVER_PORT}/?visor=1",
                    "mcUrl": f"http://{LAN_IP}:{SERVER_PORT}/",
                    "sseSubscribers": len(SSE_SUBSCRIBERS),
                    "activeTransmitters": len(alive),
                    "state": snap,
                }
            )
            return

        if route == "/api/capcom/state":
            now = time.time()
            with STATE_LOCK:
                alive = [k for k, ts in ACTIVE_TRANSMITTERS.items() if now - ts < 6.0]
                cmd_alive = [k for k, ts in ACTIVE_COMMANDERS.items() if now - ts < 15.0]
                snap = dict(CAPCOM_STATE)
            self._send_json(
                {
                    "ok": True,
                    "activeTransmitters": len(alive),
                    "activeCommanders": len(cmd_alive),
                    "serverNow": now,
                    "state": snap,
                }
            )
            return

        if route == "/api/capcom/stream":
            self.send_response(HTTPStatus.OK)
            self._send_cors()
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache, no-transform")
            self.send_header("Connection", "keep-alive")
            self.send_header("X-Accel-Buffering", "no")
            self.end_headers()

            q = queue.Queue(maxsize=32)
            with STATE_LOCK:
                SSE_SUBSCRIBERS.add(q)
                init_payload = json.dumps(CAPCOM_STATE, separators=(",", ":"))

            try:
                self.wfile.write(f"data: {init_payload}\n\n".encode("utf-8"))
                self.wfile.flush()
                while True:
                    try:
                        msg = q.get(timeout=4.0)
                        self.wfile.write(f"data: {msg}\n\n".encode("utf-8"))
                        self.wfile.flush()
                    except queue.Empty:
                        self.wfile.write(b": keepalive\n\n")
                        self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, OSError):
                pass
            finally:
                with STATE_LOCK:
                    SSE_SUBSCRIBERS.discard(q)
            return

        # Support HTTP Range requests for .glb 3D assets and fast asset caching
        return super().do_GET()

    def end_headers(self):
        # Cache immutable optimized textures/GLBs on iPhone Safari for instant reload
        if hasattr(self, "path") and "/assets/optimized/" in self.path:
            self.send_header("Cache-Control", "public, max-age=3600")
        super().end_headers()

    def send_head(self):
        """Override to add HTTP Byte-Range support for large .glb models on iOS Safari."""
        path = self.translate_path(self.path)
        if os.path.isfile(path) and "Range" in self.headers:
            range_hdr = self.headers["Range"]
            m = re.match(r"bytes=(\d+)-(\d*)", range_hdr)
            if m:
                file_size = os.path.getsize(path)
                start = int(m.group(1))
                end = int(m.group(2)) if m.group(2) else file_size - 1
                end = min(end, file_size - 1)
                if start < file_size and start <= end:
                    length = end - start + 1
                    ctype = self.guess_type(path)
                    f = open(path, "rb")
                    f.seek(start)
                    self.send_response(HTTPStatus.PARTIAL_CONTENT)
                    self._send_cors()
                    self.send_header("Content-Type", ctype)
                    self.send_header("Accept-Ranges", "bytes")
                    self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
                    self.send_header("Content-Length", str(length))
                    self.end_headers()
                    self._range_slice = (f, length)
                    return f
        self._range_slice = None
        return super().send_head()

    def copyfile(self, source, outputfile):
        if getattr(self, "_range_slice", None):
            f, remaining = self._range_slice
            while remaining > 0:
                chunk = f.read(min(65536, remaining))
                if not chunk:
                    break
                outputfile.write(chunk)
                remaining -= len(chunk)
            return
        return super().copyfile(source, outputfile)

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api/capcom/state":
            self._send_json({"ok": False, "error": "Not found"}, HTTPStatus.NOT_FOUND)
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(min(length, 65536))
            incoming = json.loads(raw.decode("utf-8"))
        except Exception as exc:
            self._send_json({"ok": False, "error": str(exc)}, HTTPStatus.BAD_REQUEST)
            return

        now = time.time()
        visor_keys = (
            "theaterKey",
            "selectedWaypointIdx",
            "hudYawDeg",
            "hudPitchOffset",
            "hudZoom",
            "visorFilterMode",
            "visorSyntheticVision",
            "vrGogglesMode",
            "gazeDwellProgress",
            "laserEvent",
        )

        with STATE_LOCK:
            role = incoming.get("role")
            sender = incoming.get("senderId")
            if sender:
                CAPCOM_STATE["senderId"] = sender
            if role:
                CAPCOM_STATE["role"] = role

            if role == "mc":
                if "mcDirective" in incoming:
                    CAPCOM_STATE["mcDirective"] = incoming["mcDirective"]
                if "theaterKey" in incoming:
                    CAPCOM_STATE["theaterKey"] = incoming["theaterKey"]
                if sender:
                    ACTIVE_COMMANDERS[sender] = now
            else:
                for k in visor_keys:
                    if k in incoming:
                        CAPCOM_STATE[k] = incoming[k]
                if "mcDirective" in incoming:
                    CAPCOM_STATE["mcDirective"] = incoming["mcDirective"]
                if sender and role == "visor":
                    ACTIVE_TRANSMITTERS[sender] = now

            CAPCOM_STATE["seq"] = int(CAPCOM_STATE.get("seq", 0)) + 1
            CAPCOM_STATE["updatedAt"] = now

            encoded = json.dumps(CAPCOM_STATE, separators=(",", ":"))
            dead = []
            for q in SSE_SUBSCRIBERS:
                try:
                    if q.full():
                        try:
                            q.get_nowait()
                        except queue.Empty:
                            pass
                    q.put_nowait(encoded)
                except Exception:
                    dead.append(q)
            for q in dead:
                SSE_SUBSCRIBERS.discard(q)

        self._send_json({"ok": True, "seq": CAPCOM_STATE["seq"]})


class AresThreadingServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    global SERVER_PORT, LAN_IP
    no_browser = "--no-browser" in sys.argv
    port = 8080
    args = sys.argv[1:]
    for i, arg in enumerate(args):
        if arg == "--port" and i + 1 < len(args) and args[i + 1].isdigit():
            port = int(args[i + 1])
        elif arg.isdigit():
            port = int(arg)

    httpd = None
    for candidate in range(port, port + 10):
        try:
            httpd = AresThreadingServer(("0.0.0.0", candidate), AresCapcomHandler)
            SERVER_PORT = candidate
            break
        except OSError:
            continue

    if httpd is None:
        print("[ERROR] Could not bind ports 8080-8089.")
        sys.exit(1)

    LAN_IP = detect_lan_ip()
    mc_url = f"http://localhost:{SERVER_PORT}/"
    visor_url = f"http://{LAN_IP}:{SERVER_PORT}/?visor=1"

    print("=" * 72)
    print("  ARES-NAV // MISSION CONTROL & CAPCOM LIVE TELEMETRY SERVER ONLINE")
    print("=" * 72)
    print(f"  [LAPTOP / PROJECTOR] : {mc_url}")
    print(f"  [iPHONE 3D GOGGLES]  : {visor_url}")
    print("-" * 72)
    print("  1. Click [CAPCOM] in the top header on your laptop to display the QR code.")
    print("  2. Scan the QR code with your iPhone on the same Wi-Fi / Hotspot.")
    print("  3. Tap [3D GOGGLES] on iPhone -> live head/gaze telemetry streams to Laptop!")
    print("  Press Ctrl+C to stop server.")
    print("=" * 72)

    if not no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(mc_url)).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[ARES-CAPCOM] Shutting down telemetry relay.")
        httpd.server_close()


if __name__ == "__main__":
    main()
