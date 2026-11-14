/**
 * ARES-NAV // CapCom Live Wi-Fi Telemetry Link & Offline ISO-18004 QR Code Generator
 *
 * Connects the DIY iPhone 3D Spacesuit Visor Goggles ("EVA Visor Transmitter") to the
 * Mission Control Laptop / Projector ("Mission Control Receiver") over Wi-Fi (SSE + HTTP)
 * or local BroadcastChannel with <20ms latency and zero external dependencies.
 */

window.ARES_CAPCOM = (function () {
  const SENDER_ID = 'ares_' + Math.random().toString(36).slice(2, 9);
  const BC_NAME = 'ares_capcom_v1';

  let role = 'mc'; // 'mc' (Mission Control Receiver), 'visor' (iPhone Transmitter), 'off'
  let serverAvailable = false;
  let serverInfo = null;
  let sse = null;
  let pollTimer = null;
  let bc = null;
  let onStateCallback = null;
  let onDirectiveCallback = null;
  let lastReceivedAt = 0;
  let lastLaserEventId = null;
  let lastDirectiveId = null;
  let lastSentAt = 0;
  let pendingSendTimer = null;

  // =========================================================================
  // 1. BUILT-IN ZERO-DEPENDENCY ISO/IEC 18004 QR CODE SVG GENERATOR (V1-V5, L)
  // =========================================================================
  const QR_VERSIONS = [
    null,
    { v: 1, size: 21, dataBytes: 19, ecBytes: 7, align: [] },
    { v: 2, size: 25, dataBytes: 34, ecBytes: 10, align: [6, 18] },
    { v: 3, size: 29, dataBytes: 55, ecBytes: 15, align: [6, 22] },
    { v: 4, size: 33, dataBytes: 80, ecBytes: 20, align: [6, 26] },
    { v: 5, size: 37, dataBytes: 108, ecBytes: 26, align: [6, 30] }
  ];

  const GF_EXP = new Uint8Array(512);
  const GF_LOG = new Uint8Array(256);
  (function initGaloisField() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) {
      GF_EXP[i] = GF_EXP[i - 255];
    }
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return GF_EXP[GF_LOG[a] + GF_LOG[b]];
  }

  function rsComputeEcBytes(data, ecLen) {
    let gen = [1];
    for (let i = 0; i < ecLen; i++) {
      const next = new Array(gen.length + 1).fill(0);
      const root = GF_EXP[i];
      for (let j = 0; j < gen.length; j++) {
        next[j] ^= gen[j];
        next[j + 1] ^= gfMul(gen[j], root);
      }
      gen = next;
    }

    const rem = new Uint8Array(ecLen);
    for (let i = 0; i < data.length; i++) {
      const factor = data[i] ^ rem[0];
      for (let j = 0; j < ecLen - 1; j++) {
        rem[j] = rem[j + 1] ^ gfMul(gen[j + 1], factor);
      }
      rem[ecLen - 1] = gfMul(gen[ecLen], factor);
    }
    return rem;
  }

  function generateQrSvg(text, pixelSize) {
    const bytes = new TextEncoder().encode(String(text || ''));
    let spec = QR_VERSIONS[5];
    for (let v = 1; v <= 5; v++) {
      if (bytes.length + 2 <= QR_VERSIONS[v].dataBytes) {
        spec = QR_VERSIONS[v];
        break;
      }
    }

    const maxPayload = spec.dataBytes - 2;
    const payload = bytes.length > maxPayload ? bytes.slice(0, maxPayload) : bytes;

    // Build bit buffer: 0100 (Byte mode) + 8-bit length + payload + terminator + pad bytes
    const bits = [];
    const pushBits = (val, len) => {
      for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
    };
    pushBits(0b0100, 4);
    pushBits(payload.length, 8);
    for (let i = 0; i < payload.length; i++) pushBits(payload[i], 8);

    const maxBits = spec.dataBytes * 8;
    const termLen = Math.min(4, maxBits - bits.length);
    for (let i = 0; i < termLen; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);

    const dataCodewords = new Uint8Array(spec.dataBytes);
    for (let i = 0; i < bits.length / 8; i++) {
      let b = 0;
      for (let k = 0; k < 8; k++) b = (b << 1) | bits[i * 8 + k];
      dataCodewords[i] = b;
    }
    const pads = [0xec, 0x11];
    for (let i = bits.length / 8, p = 0; i < spec.dataBytes; i++, p++) {
      dataCodewords[i] = pads[p % 2];
    }

    const ecCodewords = rsComputeEcBytes(dataCodewords, spec.ecBytes);
    const allCodewords = new Uint8Array(spec.dataBytes + spec.ecBytes);
    allCodewords.set(dataCodewords, 0);
    allCodewords.set(ecCodewords, spec.dataBytes);

    const size = spec.size;
    const modules = Array.from({ length: size }, () => new Uint8Array(size));
    const isFunc = Array.from({ length: size }, () => new Uint8Array(size));

    const setFunctionModule = (r, c, dark) => {
      if (r < 0 || r >= size || c < 0 || c >= size) return;
      modules[r][c] = dark ? 1 : 0;
      isFunc[r][c] = 1;
    };

    const drawFinder = (r0, c0) => {
      for (let dr = -1; dr <= 7; dr++) {
        for (let dc = -1; dc <= 7; dc++) {
          const r = r0 + dr;
          const c = c0 + dc;
          if (r < 0 || r >= size || c < 0 || c >= size) continue;
          const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
          const onRing = dr === 0 || dr === 6 || dc === 0 || dc === 6;
          const inCore = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
          setFunctionModule(r, c, inOuter && (onRing || inCore));
        }
      }
    };

    drawFinder(0, 0);
    drawFinder(0, size - 7);
    drawFinder(size - 7, 0);

    // Alignment patterns (V2-V5)
    if (spec.align.length > 0) {
      for (const ar of spec.align) {
        for (const ac of spec.align) {
          if (
            (ar === 6 && ac === 6) ||
            (ar === 6 && ac === size - 7) ||
            (ar === size - 7 && ac === 6)
          ) {
            continue;
          }
          for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
              const dist = Math.max(Math.abs(dr), Math.abs(dc));
              setFunctionModule(ar + dr, ac + dc, dist !== 1);
            }
          }
        }
      }
    }

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
      if (!isFunc[6][i]) setFunctionModule(6, i, i % 2 === 0);
      if (!isFunc[i][6]) setFunctionModule(i, 6, i % 2 === 0);
    }

    // Reserve Format Information slots & Dark Module
    for (let i = 0; i <= 8; i++) {
      if (!isFunc[8][i]) setFunctionModule(8, i, false);
      if (!isFunc[i][8]) setFunctionModule(i, 8, false);
    }
    for (let i = 0; i < 8; i++) {
      if (!isFunc[8][size - 1 - i]) setFunctionModule(8, size - 1 - i, false);
      if (!isFunc[size - 1 - i][8]) setFunctionModule(size - 1 - i, 8, false);
    }
    setFunctionModule(size - 8, 8, true); // Dark module

    // Place data + EC bits in standard upward/downward 2-column zigzag
    let bitIdx = 0;
    const totalDataBits = allCodewords.length * 8;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5; // Skip vertical timing column
      const upward = ((right + 1) & 2) === 0;
      for (let vert = 0; vert < size; vert++) {
        const r = upward ? size - 1 - vert : vert;
        for (let j = 0; j < 2; j++) {
          const c = right - j;
          if (!isFunc[r][c]) {
            let dark = false;
            if (bitIdx < totalDataBits) {
              dark = ((allCodewords[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1) !== 0;
              bitIdx++;
            }
            // Apply Mask 0: (r + c) % 2 === 0
            if ((r + c) % 2 === 0) dark = !dark;
            modules[r][c] = dark ? 1 : 0;
          }
        }
      }
    }

    // Write Format Information for EC Level L (01) + Mask 0 (000) -> 0x77c4
    const data5 = (0b01 << 3) | 0;
    let rem = data5 << 10;
    for (let i = 14; i >= 10; i--) {
      if ((rem >> i) & 1) rem ^= 0x537 << (i - 10);
    }
    const fmt = ((data5 << 10) | rem) ^ 0x5412;
    const getFmtBit = (bit) => ((fmt >> bit) & 1) !== 0;

    // Top-left copy (MSB bit 14 -> LSB bit 0)
    const tlCoords = [
      [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
      [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
    ];
    for (let i = 0; i < 15; i++) {
      const [r, c] = tlCoords[i];
      modules[r][c] = getFmtBit(14 - i) ? 1 : 0;
    }

    // Bottom-left + Top-right split copy
    for (let i = 0; i < 7; i++) {
      modules[size - 1 - i][8] = getFmtBit(14 - i) ? 1 : 0;
    }
    for (let i = 0; i < 8; i++) {
      modules[8][size - 8 + i] = getFmtBit(7 - i) ? 1 : 0;
    }

    const margin = 3;
    const total = size + margin * 2;
    const px = pixelSize || 176;
    let paths = '';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (modules[r][c]) {
          paths += `M${c + margin},${r + margin}h1v1h-1z`;
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${px}" height="${px}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#ffffff"/><path d="${paths}" fill="#0c0a09"/></svg>`;
  }

  // =========================================================================
  // 2. BI-DIRECTIONAL CO-OP TELEMETRY RELAY (HOUSTON MC <-> VISOR GOGGLES)
  // =========================================================================
  function handleIncomingPacket(pkt) {
    if (!pkt || pkt.senderId === SENDER_ID) return;

    // Direction A: Houston Mission Control ('mc') -> Astronaut Visor ('visor')
    if (pkt.mcDirective && pkt.mcDirective.id && pkt.mcDirective.id !== lastDirectiveId) {
      if (role === 'visor' || (pkt.role === 'mc' && role !== 'off')) {
        lastDirectiveId = pkt.mcDirective.id;
        lastReceivedAt = Date.now();
        if (onDirectiveCallback) {
          onDirectiveCallback(pkt.mcDirective);
        }
      }
    }

    // Direction B: Astronaut Visor ('visor') -> Houston Mission Control ('mc')
    if (role !== 'mc') return;
    if (pkt.role && pkt.role !== 'visor') return;

    lastReceivedAt = Date.now();
    let isNewLaser = false;
    if (pkt.laserEvent && pkt.laserEvent.id && pkt.laserEvent.id !== lastLaserEventId) {
      lastLaserEventId = pkt.laserEvent.id;
      isNewLaser = true;
    }
    pkt.isNewLaser = isNewLaser;

    if (onStateCallback) {
      onStateCallback(pkt, isNewLaser);
    }
  }

  function connectTransports() {
    // 1. Local multi-tab BroadcastChannel (works even on file://!)
    if (typeof BroadcastChannel !== 'undefined' && !bc) {
      try {
        bc = new BroadcastChannel(BC_NAME);
        bc.onmessage = (ev) => handleIncomingPacket(ev.data);
      } catch (_) {}
    }

    // 2. Wi-Fi CapCom Relay Server check (when served over http/https)
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
      fetch('/api/capcom/info', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((info) => {
          if (!info || !info.ok) return;
          serverAvailable = true;
          serverInfo = info;
          startServerStream();
          if (onStateCallback) onStateCallback(null, false);
        })
        .catch(() => {
          serverAvailable = false;
        });
    }
  }

  function startServerStream() {
    if (!serverAvailable) return;
    if (sse) {
      try {
        sse.close();
      } catch (_) {}
      sse = null;
    }

    if (typeof EventSource !== 'undefined') {
      try {
        sse = new EventSource('/api/capcom/stream');
        sse.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            handleIncomingPacket(data);
          } catch (_) {}
        };
      } catch (_) {}
    }

    // Lightweight 500ms fallback poll in case mobile Wi-Fi proxy buffers SSE
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      if (role === 'off' || !serverAvailable) return;
      if (Date.now() - lastReceivedAt < 350) return;
      fetch('/api/capcom/state', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((res) => {
          if (!res || !res.ok || !res.state) return;
          if (role === 'mc' && res.activeTransmitters > 0) {
            handleIncomingPacket(res.state);
          } else if (role === 'visor' && res.state.mcDirective) {
            handleIncomingPacket(res.state);
          }
        })
        .catch(() => {});
    }, 500);
  }

  function publishMcDirective(directivePayload, theaterKey) {
    if (role === 'off' || !directivePayload) return;
    const directive = Object.assign(
      {
        id: 'cmd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        ts: Date.now()
      },
      directivePayload
    );
    lastDirectiveId = directive.id;

    const pkt = {
      senderId: SENDER_ID,
      role: 'mc',
      theaterKey: theaterKey || 'jezero',
      mcDirective: directive
    };

    if (bc) {
      try {
        bc.postMessage(pkt);
      } catch (_) {}
    }

    if (serverAvailable || window.location.protocol.startsWith('http')) {
      fetch('/api/capcom/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pkt),
        keepalive: true
      }).catch(() => {});
    }
    return directive;
  }

  function publishState(state, laserEventPayload) {
    if (role !== 'visor') return;

    const now = Date.now();
    // Throttle continuous head-tracking to ~20 Hz (50ms), but never throttle laser shots!
    if (!laserEventPayload && now - lastSentAt < 48) {
      if (!pendingSendTimer) {
        pendingSendTimer = setTimeout(() => {
          pendingSendTimer = null;
          publishState(state, null);
        }, 50);
      }
      return;
    }
    lastSentAt = now;

    const pkt = {
      senderId: SENDER_ID,
      role: 'visor',
      theaterKey: state.theaterKey,
      selectedWaypointIdx: state.selectedWaypointIdx,
      hudYawDeg: +(state.hudYawDeg || 0).toFixed(1),
      hudPitchOffset: +(state.hudPitchOffset || 0).toFixed(3),
      hudZoom: +(state.hudZoom || 1).toFixed(2),
      visorFilterMode: state.visorFilterMode || 'natural',
      visorSyntheticVision: !!state.visorSyntheticVision,
      vrGogglesMode: !!state.vrGogglesMode,
      gazeDwellProgress: +(state.gazeDwellProgress || 0).toFixed(2)
    };
    if (laserEventPayload) {
      pkt.laserEvent = laserEventPayload;
    }

    if (bc) {
      try {
        bc.postMessage(pkt);
      } catch (_) {}
    }

    if (serverAvailable || window.location.protocol.startsWith('http')) {
      fetch('/api/capcom/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pkt),
        keepalive: true
      }).catch(() => {});
    }
  }

  function getVisorUrl() {
    if (serverInfo && serverInfo.visorUrl) {
      return serverInfo.visorUrl;
    }
    if (window.location.protocol.startsWith('http')) {
      const u = new URL(window.location.href);
      u.searchParams.set('visor', '1');
      return u.toString();
    }
    return 'http://192.168.1.X:8080/?visor=1 (Run START_ARES_CAPCOM.bat)';
  }

  function init(options) {
    onStateCallback = (options && options.onRemoteState) || null;
    onDirectiveCallback = (options && options.onMcDirective) || null;
    const params = new URLSearchParams(window.location.search || '');
    if (params.get('visor') === '1') {
      role = 'visor';
    }
    connectTransports();
    return {
      role,
      isVisorAutoLaunch: params.get('visor') === '1'
    };
  }

  function setRole(newRole) {
    role = newRole;
    return role;
  }

  function getStatus() {
    const isLinked = (role === 'mc' || role === 'visor') && Date.now() - lastReceivedAt < 6500;
    return {
      senderId: SENDER_ID,
      role,
      serverAvailable,
      serverInfo,
      visorUrl: getVisorUrl(),
      isLinked,
      msSinceLastPacket: lastReceivedAt ? Date.now() - lastReceivedAt : null
    };
  }

  return {
    init,
    setRole,
    getStatus,
    publishState,
    publishMcDirective,
    generateQrSvg,
    getVisorUrl
  };
})();
