/**
 * ARES-NAV // Ultra-Realistic 360° 3D WebGL Mars Globe & Orbital GPS Constellation
 * Uses custom GLSL Raycasted Sphere + Bump Relief + Atmospheric Scattering + 3D Orbiters
 * Exact orthogonal World <-> View rotation parity so planetary landmarks stay pixel-locked
 */

window.ARES_GLOBE = (function () {
  let gl = null;
  let program = null;
  let texColor = null;
  let texBump = null;
  let texMola = null;
  let texturesReady = false;

  const globeState = {
    rotLonDeg: 105,       // Centered squarely between Jezero (+77.2°E) and Gale (+137.8°E)
    rotLatDeg: 8,
    zoomRadius: 1.0,
    autoRotate: true,
    useMolaTexture: false,
    sunAngleRad: 0.65,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    orbitTime: 0,
    selectedLandmark: null
  };

  // Planetary Landmarks & EVA Sectors on the 3D Globe
  const PLANET_PINS = [
    {
      id: 'jezero',
      isSector: true,
      name: 'JEZERO CRATER // SITE 093',
      sub: 'Perseverance (45.25 km Traverse)',
      lat: 18.4356,
      lon: 77.2332,
      elev: '-1,936 m',
      color: '#f97316'
    },
    {
      id: 'gale',
      isSector: true,
      name: 'GALE CRATER // BOXWORK',
      sub: 'Curiosity (PIA26696)',
      lat: -5.0846,
      lon: 137.8512,
      elev: '-3,940 m',
      color: '#f59e0b'
    },
    {
      id: 'olympus',
      isSector: false,
      name: 'OLYMPUS MONS (+21.2 km)',
      sub: 'Highest Planetary Shield Volcano',
      lat: 18.65,
      lon: -133.8,
      elev: '+21,229 m',
      color: '#d6d3d1'
    },
    {
      id: 'valles',
      isSector: false,
      name: 'VALLES MARINERIS (-7.0 km)',
      sub: '4,000 km Tectonic Rift Canyon',
      lat: -13.9,
      lon: -59.2,
      elev: '-7,000 m',
      color: '#d6d3d1'
    },
    {
      id: 'hellas',
      isSector: false,
      name: 'HELLAS BASIN (-7.1 km)',
      sub: 'Deepest Impact Basin on Mars',
      lat: -42.4,
      lon: 70.5,
      elev: '-7,152 m',
      color: '#a8a29e'
    }
  ];

  // NASA Orbital GPS / Telemetry Relay Constellation
  const ORBITERS = [
    {
      name: 'MRO (HiRISE / CRISM)',
      altKm: 300,
      incDeg: 93,
      ascNodeDeg: 42,
      speed: 0.75,
      phase: 0.2,
      color: '#f97316',
      role: '0.25m/px DEM & Spectral Relay'
    },
    {
      name: 'ODYSSEY (THEMIS IR)',
      altKm: 400,
      incDeg: 93.1,
      ascNodeDeg: 148,
      speed: 0.62,
      phase: 2.1,
      color: '#fbbf24',
      role: 'Thermal Inertia & UHF EVA Comms'
    },
    {
      name: 'MAVEN (SEP / RAD)',
      altKm: 620,
      incDeg: 74.2,
      ascNodeDeg: 255,
      speed: 0.48,
      phase: 4.0,
      color: '#a855f7',
      role: 'Solar Energetic Particle Early Warning'
    }
  ];

  const VS_SOURCE = `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
      v_uv = a_pos;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `;

  const FS_SOURCE = `
    precision highp float;
    varying vec2 v_uv;
    uniform vec2 u_res;
    uniform vec2 u_centerOffset;
    uniform float u_radius;
    uniform float u_rotLon;
    uniform float u_rotLat;
    uniform float u_sunAngle;
    uniform float u_useMola;
    uniform sampler2D u_texColor;
    uniform sampler2D u_texBump;
    uniform sampler2D u_texMola;

    const float PI = 3.14159265359;

    void main() {
      vec2 p = (v_uv * u_res - u_centerOffset) / u_radius;
      float r2 = dot(p, p);

      // Deep space background + outer atmospheric dust corona
      if (r2 > 1.0) {
        float dist = sqrt(r2);
        float halo = exp(-(dist - 1.0) * 14.0) * 0.62;
        vec3 sunDir = normalize(vec3(sin(u_sunAngle), 0.18, cos(u_sunAngle)));
        vec3 limbVec = normalize(vec3(p, 0.0));
        float sunSide = max(0.15, dot(limbVec, sunDir) * 0.6 + 0.4);
        vec3 atmoColor = mix(vec3(0.85, 0.36, 0.14), vec3(0.18, 0.55, 0.85), 0.18);
        gl_FragColor = vec4(atmoColor * halo * sunSide, halo);
        return;
      }

      // Ray-sphere intersection normal in view space (+X right, +Y up, +Z toward viewer)
      float z = sqrt(1.0 - r2);
      vec3 viewNormal = normalize(vec3(p.x, p.y, z));

      // Exact orthogonal inverse of projectLatLonToView:
      // View -> World: R_y(+u_rotLon) * R_x(+u_rotLat) * viewNormal
      float cLat = cos(u_rotLat), sLat = sin(u_rotLat);
      float cLon = cos(u_rotLon), sLon = sin(u_rotLon);

      vec3 v1 = vec3(
        viewNormal.x,
        viewNormal.y * cLat + viewNormal.z * sLat,
        -viewNormal.y * sLat + viewNormal.z * cLat
      );

      vec3 worldPos = vec3(
        v1.x * cLon + v1.z * sLon,
        v1.y,
        -v1.x * sLon + v1.z * cLon
      );

      // Convert planetary XYZ to seamless equirectangular UV (lon=0° at u=0.5, +90°N at v=0.0)
      float lat = asin(clamp(worldPos.y, -1.0, 1.0));
      float lon = atan(worldPos.x, worldPos.z);
      vec2 uv = vec2(fract(lon / (2.0 * PI) + 0.5), clamp(0.5 - lat / PI, 0.001, 0.999));

      // Sample 8K Mars color / MOLA and compute seamless bump-mapped surface normal perturbation
      vec3 colDay = texture2D(u_texColor, uv).rgb;
      vec3 colMola = texture2D(u_texMola, uv).rgb;
      vec3 baseAlbedo = mix(colDay, colMola, u_useMola);

      // Finite-difference normal mapping from 8K marsBump
      vec2 eps = vec2(1.0 / 2048.0, 1.0 / 1024.0);
      float hC = texture2D(u_texBump, uv).r;
      float hR = texture2D(u_texBump, vec2(fract(uv.x + eps.x), uv.y)).r;
      float hU = texture2D(u_texBump, vec2(uv.x, clamp(uv.y - eps.y, 0.001, 0.999))).r;
      vec3 bumpPerturb = vec3((hC - hR) * 3.8, (hC - hU) * 3.8, 0.0);
      vec3 bumpedViewNormal = normalize(viewNormal + bumpPerturb * (1.0 - u_useMola * 0.5));

      // Directional sunlight & golden-hour terminator scattering
      vec3 sunDir = normalize(vec3(sin(u_sunAngle), 0.16, cos(u_sunAngle)));
      float ndotl = dot(bumpedViewNormal, sunDir);
      float diffuse = smoothstep(-0.22, 0.85, ndotl);

      // Camera-aligned orbital fill light so rotating the planet never leaves a black void
      float cameraFill = max(0.0, viewNormal.z) * 0.24 + 0.12;

      // Warm orange dust scattering along the terminator band
      float terminatorBand = exp(-pow((ndotl + 0.04) * 4.5, 2.0)) * 0.28;
      vec3 terminatorGlow = vec3(0.95, 0.36, 0.10) * terminatorBand;

      // Subtle specular sheen on polar ice caps & smooth plains
      vec3 halfVec = normalize(sunDir + vec3(0.0, 0.0, 1.0));
      float spec = pow(max(0.0, dot(bumpedViewNormal, halfVec)), 28.0) * 0.14 * max(0.0, ndotl);

      // Fresnel atmospheric limb scattering
      float fresnel = pow(1.0 - z, 3.2);
      vec3 limbAtmo = mix(vec3(0.92, 0.48, 0.22), vec3(0.25, 0.72, 0.95), 0.25) * fresnel * max(0.22, diffuse + 0.25);

      // Combine sunlit side, orbital camera fill, terminator dust glow, and limb scattering
      float lightFactor = max(cameraFill, 0.16 + 0.92 * diffuse);
      vec3 finalRgb = baseAlbedo * lightFactor + spec + terminatorGlow + limbAtmo;

      gl_FragColor = vec4(finalRgb, 1.0);
    }
  `;

  function compileShader(glCtx, type, src) {
    const sh = glCtx.createShader(type);
    glCtx.shaderSource(sh, src);
    glCtx.compileShader(sh);
    return sh;
  }

  function createTextureFromDataUri(glCtx, dataUri, onDone) {
    const tex = glCtx.createTexture();
    const img = new Image();
    img.onload = () => {
      glCtx.bindTexture(glCtx.TEXTURE_2D, tex);
      glCtx.texImage2D(glCtx.TEXTURE_2D, 0, glCtx.RGBA, glCtx.RGBA, glCtx.UNSIGNED_BYTE, img);
      glCtx.texParameteri(glCtx.TEXTURE_2D, glCtx.TEXTURE_WRAP_S, glCtx.REPEAT);
      glCtx.texParameteri(glCtx.TEXTURE_2D, glCtx.TEXTURE_WRAP_T, glCtx.CLAMP_TO_EDGE);
      glCtx.texParameteri(glCtx.TEXTURE_2D, glCtx.TEXTURE_MIN_FILTER, glCtx.LINEAR);
      glCtx.texParameteri(glCtx.TEXTURE_2D, glCtx.TEXTURE_MAG_FILTER, glCtx.LINEAR);
      onDone();
    };
    img.src = dataUri;
    return tex;
  }

  function initWebGL(webglCanvas) {
    if (gl || !webglCanvas) return;
    gl = webglCanvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
    if (!gl) return;

    const vs = compileShader(gl, gl.VERTEX_SHADER, VS_SOURCE);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FS_SOURCE);
    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const aPos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const texData = window.ARES_GLOBE_TEXTURES;
    if (texData) {
      let loadedCount = 0;
      const checkReady = () => {
        loadedCount++;
        if (loadedCount === 3) texturesReady = true;
      };
      texColor = createTextureFromDataUri(gl, texData.marsColor || texData.marsDay, checkReady);
      texBump = createTextureFromDataUri(gl, texData.marsBump, checkReady);
      texMola = createTextureFromDataUri(gl, texData.marsMola, checkReady);
    }
  }

  function projectLatLonToView(latDeg, lonDeg, cx, cy, radiusPx) {
    const lat = (latDeg * Math.PI) / 180;
    const lon = (lonDeg * Math.PI) / 180;
    const wx = Math.cos(lat) * Math.sin(lon);
    const wy = Math.sin(lat);
    const wz = Math.cos(lat) * Math.cos(lon);

    const rLon = (globeState.rotLonDeg * Math.PI) / 180;
    const rLat = (globeState.rotLatDeg * Math.PI) / 180;

    // Step 1: Rotate around Y by -rLon so target longitude faces +Z
    const x1 = wx * Math.cos(rLon) - wz * Math.sin(rLon);
    const y1 = wy;
    const z1 = wx * Math.sin(rLon) + wz * Math.cos(rLon);

    // Step 2: Rotate around X by -rLat so target latitude faces +Z
    const x2 = x1;
    const y2 = y1 * Math.cos(rLat) - z1 * Math.sin(rLat);
    const z2 = y1 * Math.sin(rLat) + z1 * Math.cos(rLat);

    return {
      x: cx + x2 * radiusPx,
      y: cy - y2 * radiusPx,
      z: z2,
      visible: z2 > 0.05
    };
  }

  function smoothFocusTo(targetLat, targetLon, durationMs) {
    globeState.autoRotate = false;
    const btnSpin = document.getElementById('btnGlobeSpin');
    if (btnSpin) btnSpin.textContent = 'AUTO-ROTATE 360°';

    const startLat = globeState.rotLatDeg;
    let deltaLon = ((targetLon - globeState.rotLonDeg + 540) % 360) - 180;
    const startLon = globeState.rotLonDeg;
    const startTime = performance.now();
    const dur = durationMs || 520;

    function tick(now) {
      const t = Math.min(1, (now - startTime) / dur);
      const ease = 1 - Math.pow(1 - t, 3);
      globeState.rotLatDeg = startLat + (targetLat - startLat) * ease;
      globeState.rotLonDeg = startLon + deltaLon * ease;
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function renderPlanetView(webglCanvas, hudCanvas, appState) {
    if (!webglCanvas || !hudCanvas) return;
    initWebGL(webglCanvas);

    const rect = webglCanvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(360, Math.floor(rect.width));
    const h = Math.max(280, Math.floor(rect.height));

    if (webglCanvas.width !== w * dpr || webglCanvas.height !== h * dpr) {
      webglCanvas.width = w * dpr;
      webglCanvas.height = h * dpr;
      hudCanvas.width = w * dpr;
      hudCanvas.height = h * dpr;
    }

    // Frame-rate independent delta time (normalized to 60 FPS)
    const nowMs = performance.now();
    const dtSec = globeState._lastTimeMs
      ? Math.min(0.1, Math.max(0.001, (nowMs - globeState._lastTimeMs) / 1000))
      : 1 / 60;
    globeState._lastTimeMs = nowMs;
    const dt60 = dtSec * 60;

    globeState.orbitTime += 0.010 * dt60;
    if (globeState.autoRotate && !globeState.isDragging) {
      // Gently oscillate across the Jezero (+77°E) & Gale (+138°E) hemisphere
      globeState.rotLonDeg = 105 + Math.sin(globeState.orbitTime * 0.45) * 20;
    }

    // Position the 3D Mars Globe slightly left of center on wide screens so the MARS telemetry panel sits cleanly on the right
    const cx = w >= 1024 ? w * 0.40 : w * 0.50;
    const cy = h * 0.51;
    const radiusPx = Math.min(w * 0.34, h * 0.40) * globeState.zoomRadius;

    // 1. Render WebGL 3D Raycasted Mars Sphere
    if (gl && texturesReady) {
      gl.viewport(0, 0, w * dpr, h * dpr);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);

      gl.uniform2f(gl.getUniformLocation(program, 'u_res'), w * 0.5, h * 0.5);
      gl.uniform2f(
        gl.getUniformLocation(program, 'u_centerOffset'),
        cx - w * 0.5,
        h * 0.5 - cy
      );
      gl.uniform1f(gl.getUniformLocation(program, 'u_radius'), radiusPx);
      gl.uniform1f(
        gl.getUniformLocation(program, 'u_rotLon'),
        (globeState.rotLonDeg * Math.PI) / 180
      );
      gl.uniform1f(
        gl.getUniformLocation(program, 'u_rotLat'),
        (globeState.rotLatDeg * Math.PI) / 180
      );
      gl.uniform1f(gl.getUniformLocation(program, 'u_sunAngle'), globeState.sunAngleRad);
      gl.uniform1f(
        gl.getUniformLocation(program, 'u_useMola'),
        globeState.useMolaTexture ? 1.0 : 0.0
      );

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texColor);
      gl.uniform1i(gl.getUniformLocation(program, 'u_texColor'), 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, texBump);
      gl.uniform1i(gl.getUniformLocation(program, 'u_texBump'), 1);

      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, texMola);
      gl.uniform1i(gl.getUniformLocation(program, 'u_texMola'), 2);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // 2. Render 2D Orbital GPS Satellites, Landing Beacons & Relay Lock Telemetry
    const ctx = hudCanvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Subtle orbital equatorial & polar GPS rings
    ctx.save();
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.16)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, radiusPx * 1.24, radiusPx * 0.36, -0.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, radiusPx * 0.42, radiusPx * 1.22, 0.12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    const activePin = PLANET_PINS.find((p) => p.id === appState.theaterKey) || PLANET_PINS[0];
    const activePt = projectLatLonToView(activePin.lat, activePin.lon, cx, cy, radiusPx);

    let satsInView = 0;

    // Render 3 Orbiting GPS / Telemetry Relay Satellites
    ORBITERS.forEach((sat) => {
      const ang = globeState.orbitTime * sat.speed + sat.phase;
      const orbitR = radiusPx * (1.16 + sat.altKm / 2400);
      const inc = (sat.incDeg * Math.PI) / 180;
      const node = (sat.ascNodeDeg * Math.PI) / 180;

      const ox = Math.cos(ang) * Math.cos(node) - Math.sin(ang) * Math.cos(inc) * Math.sin(node);
      const oy = Math.sin(ang) * Math.sin(inc);
      const oz = Math.cos(ang) * Math.sin(node) + Math.sin(ang) * Math.cos(inc) * Math.cos(node);

      const sx = cx + ox * orbitR;
      const sy = cy - oy * orbitR;
      const distFromCenter = Math.hypot(sx - cx, sy - cy);
      if (oz < 0 && distFromCenter < radiusPx * 0.98) return;

      satsInView++;

      ctx.save();
      ctx.fillStyle = sat.color;
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fill();

      // Solar panel wings
      ctx.strokeStyle = sat.color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(sx - 9, sy - 3);
      ctx.lineTo(sx + 9, sy + 3);
      ctx.stroke();

      // Downlink telemetry beam to active EVA landing sector (if visible) or nadir sub-point
      const targetX = activePt.visible ? activePt.x : cx + ox * radiusPx * 0.96;
      const targetY = activePt.visible ? activePt.y : cy - oy * radiusPx * 0.96;
      ctx.strokeStyle = activePt.visible
        ? 'rgba(249, 115, 22, 0.34)'
        : 'rgba(249, 115, 22, 0.20)';
      ctx.lineWidth = 1.1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#e7e5e4';
      const satLbl = `SAT // ${sat.name}`;
      const satTw = ctx.measureText(satLbl).width;
      const satX = Math.min(w - satTw - 14, Math.max(14, sx + 10));
      ctx.fillText(satLbl, satX, sy + 3);
      ctx.restore();
    });

    // Render Planetary Pins & Clickable EVA Landing Sectors
    PLANET_PINS.forEach((pin) => {
      const pt = projectLatLonToView(pin.lat, pin.lon, cx, cy, radiusPx);
      pin._screenX = pt.x;
      pin._screenY = pt.y;
      pin._visible = pt.visible;
      if (!pt.visible) return;

      const isActiveSector = pin.id === appState.theaterKey;
      const isFocusedLandmark = globeState.selectedLandmark && globeState.selectedLandmark.id === pin.id;

      ctx.save();
      if (pin.isSector || isFocusedLandmark) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, isActiveSector ? 15 : 11, 0, Math.PI * 2);
        ctx.fillStyle = isActiveSector ? 'rgba(249, 115, 22, 0.30)' : 'rgba(245, 158, 11, 0.20)';
        ctx.fill();
        ctx.strokeStyle = pin.color;
        ctx.lineWidth = isActiveSector ? 2.2 : 1.5;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pin.isSector ? 5.5 : 3.8, 0, Math.PI * 2);
      ctx.fillStyle = pin.color;
      ctx.fill();
      ctx.strokeStyle = '#0c0a09';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const offsetX = pt.x >= cx ? 22 : -22;
      const offsetY = pin.id === 'jezero' ? -24 : pin.isSector ? 20 : -16;

      ctx.font = pin.isSector
        ? '700 10.5px "JetBrains Mono", monospace'
        : '600 9.5px "JetBrains Mono", monospace';
      const label = pin.isSector ? `${pin.name} [DESCEND →]` : pin.name;
      const tw = ctx.measureText(label).width + 16;
      const rawBx = pt.x >= cx ? pt.x + offsetX : pt.x + offsetX - tw;
      const bx = Math.max(14, Math.min(w - tw - 14, rawBx));
      const by = Math.max(14, Math.min(h - 48, pt.y + offsetY - 11));

      pin._boxX = bx;
      pin._boxY = by;
      pin._boxW = tw;
      pin._boxH = 22;

      ctx.strokeStyle = pin.color;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x >= cx ? bx : bx + tw, by + 11);
      ctx.stroke();

      ctx.fillStyle = 'rgba(12, 10, 9, 0.92)';
      ctx.fillRect(bx, by, tw, 22);
      ctx.strokeStyle = pin.color;
      ctx.strokeRect(bx, by, tw, 22);

      ctx.fillStyle = pin.isSector ? '#ffffff' : '#d6d3d1';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, bx + 8, by + 11);
      ctx.restore();
    });

    // Bottom-Left Live Orbital Triangulation & HDOP Status Bar
    const hdop = satsInView >= 3 ? '0.38m' : satsInView === 2 ? '0.62m' : '1.15m';
    const centerLatStr = `${Math.abs(globeState.rotLatDeg).toFixed(1)}°${globeState.rotLatDeg >= 0 ? 'N' : 'S'}`;
    const normLon = ((((globeState.rotLonDeg + 180) % 360) + 360) % 360) - 180;
    const centerLonStr = `${Math.abs(normLon).toFixed(1)}°${normLon >= 0 ? 'E' : 'W'}`;
    const statusStr = `ORBITAL PNT TRIANGULATION: ${Math.max(2, satsInView)}/3 RELAYS LOCKED • HDOP ${hdop} • SUB-POINT ${centerLatStr}, ${centerLonStr}`;

    ctx.save();
    ctx.font = '700 10px "JetBrains Mono", monospace';
    const stW = ctx.measureText(statusStr).width + 24;
    ctx.fillStyle = 'rgba(18, 16, 14, 0.88)';
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.45)';
    ctx.lineWidth = 1;
    ctx.fillRect(24, h - 38, stW, 24);
    ctx.strokeRect(24, h - 38, stW, 24);
    ctx.fillStyle = '#fb923c';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(statusStr, 36, h - 26);
    ctx.restore();

    ctx.restore();
  }

  function bindGlobeEvents(hudCanvas, onSelectSector) {
    if (!hudCanvas) return;

    let downX = 0;
    let downY = 0;

    function checkPinClick(mx, my) {
      for (const pin of PLANET_PINS) {
        if (!pin._visible) continue;
        const hitDot = Math.hypot(mx - pin._screenX, my - pin._screenY) < 26;
        const hitBox =
          pin._boxW &&
          mx >= pin._boxX &&
          mx <= pin._boxX + pin._boxW &&
          my >= pin._boxY &&
          my <= pin._boxY + pin._boxH;
        if (hitDot || hitBox) {
          if (pin.isSector) {
            onSelectSector(pin.id);
          } else {
            globeState.selectedLandmark = pin;
            smoothFocusTo(pin.lat, pin.lon, 540);
          }
          return true;
        }
      }
      return false;
    }

    hudCanvas.addEventListener('mousedown', (e) => {
      downX = e.clientX;
      downY = e.clientY;
      globeState.isDragging = true;
      globeState.dragStartX = e.clientX;
      globeState.dragStartY = e.clientY;
    });

    hudCanvas.addEventListener('mousemove', (e) => {
      if (!globeState.isDragging) return;
      const dx = e.clientX - globeState.dragStartX;
      const dy = e.clientY - globeState.dragStartY;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 4) {
        globeState.autoRotate = false;
        const btnSpin = document.getElementById('btnGlobeSpin');
        if (btnSpin) btnSpin.textContent = 'AUTO-ROTATE 360°';
      }
      globeState.rotLonDeg = (globeState.rotLonDeg - dx * 0.35) % 360;
      globeState.rotLatDeg = Math.max(-78, Math.min(78, globeState.rotLatDeg + dy * 0.32));
      globeState.dragStartX = e.clientX;
      globeState.dragStartY = e.clientY;
    });

    hudCanvas.addEventListener('mouseup', (e) => {
      const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
      globeState.isDragging = false;
      if (moved < 6) {
        const rect = hudCanvas.getBoundingClientRect();
        checkPinClick(e.clientX - rect.left, e.clientY - rect.top);
      }
    });

    window.addEventListener('mouseup', () => {
      globeState.isDragging = false;
    });

    // Touch drag & tap support for mobile / iPad / iPhone
    hudCanvas.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 1) {
          downX = e.touches[0].clientX;
          downY = e.touches[0].clientY;
          globeState.isDragging = true;
          globeState.dragStartX = downX;
          globeState.dragStartY = downY;
        }
      },
      { passive: true }
    );

    hudCanvas.addEventListener(
      'touchmove',
      (e) => {
        if (!globeState.isDragging || e.touches.length !== 1) return;
        const tx = e.touches[0].clientX;
        const ty = e.touches[0].clientY;
        const dx = tx - globeState.dragStartX;
        const dy = ty - globeState.dragStartY;
        globeState.autoRotate = false;
        globeState.rotLonDeg = (globeState.rotLonDeg - dx * 0.38) % 360;
        globeState.rotLatDeg = Math.max(-78, Math.min(78, globeState.rotLatDeg + dy * 0.35));
        globeState.dragStartX = tx;
        globeState.dragStartY = ty;
      },
      { passive: true }
    );

    hudCanvas.addEventListener('touchend', (e) => {
      globeState.isDragging = false;
      const t = e.changedTouches && e.changedTouches[0];
      if (t && Math.hypot(t.clientX - downX, t.clientY - downY) < 10) {
        const rect = hudCanvas.getBoundingClientRect();
        checkPinClick(t.clientX - rect.left, t.clientY - rect.top);
      }
    });

    hudCanvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.08 : 0.92;
        globeState.zoomRadius = Math.max(0.7, Math.min(1.65, globeState.zoomRadius * factor));
      },
      { passive: false }
    );
  }

  return {
    state: globeState,
    renderPlanetView,
    bindGlobeEvents,
    focusLatLon(lat, lon) {
      globeState.rotLatDeg = 8;
      globeState.rotLonDeg = 105; // Keep both Jezero (+77.2°E) and Gale (+137.8°E) visible on the front hemisphere
      globeState.zoomRadius = 1.0;
    },
    animateDescentTo(lat, lon, onComplete) {
      globeState.autoRotate = false;
      const startLat = globeState.rotLatDeg;
      const startLon = globeState.rotLonDeg;
      const deltaLon = ((lon - startLon + 540) % 360) - 180;
      const startZoom = globeState.zoomRadius;
      const targetLat = lat;
      const targetZoom = 2.45;
      const startTime = performance.now();
      const duration = 680;

      function step(now) {
        const t = Math.min(1, (now - startTime) / duration);
        const ease = 1 - Math.pow(1 - t, 3);
        globeState.rotLatDeg = startLat + (targetLat - startLat) * ease;
        globeState.rotLonDeg = startLon + deltaLon * ease;
        globeState.zoomRadius = startZoom + (targetZoom - startZoom) * ease;
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          globeState.zoomRadius = 1.0;
          if (onComplete) onComplete();
        }
      }
      requestAnimationFrame(step);
    }
  };
})();
