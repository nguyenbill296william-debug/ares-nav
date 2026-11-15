/**
 * ARES-NAV // Mode 2B: Interactive WebGL 3D Holographic DEM Terrain Digital Twin & Drone Fly-Through
 * Extrudes real 100x68 NASA MRO HiRISE / MOLA DEM heightfields (13,266 triangles) with satellite &
 * CRISM/THEMIS/Slope raster draping, dynamic LTST sun shadows, Dust (tau) fog, 3D A* vs Direct
 * elevation curtains, 3D UHF Line-of-Sight laser rays, 3D Ingenuity LiDAR cone & Canyon Chase Camera.
 */

window.ARES_TERRAIN3D = (function () {
  let gl = null;
  let program = null;
  let vboPos = null;
  let vboNorm = null;
  let vboUv = null;
  let vboMeta = null;
  let ibo = null;
  let indexCount = 0;

  let baseTex = null;
  let baseTexUrl = '';
  let baseTexValid = false;
  let sciTex = null;
  let sciTexKey = '';
  let hasSciTex = false;

  let builtTheaterKey = null;
  let builtSepStorm = null;
  let baseElevRef = -2185;

  // True 3D NASA JPL Ingenuity Helicopter WebGL Shader & Decoded CAD Buffers
  let heliProgram = null;
  let heliParts = null; // { airframe, rotorUpper, rotorLower, rotorDisc }

  const imgCache = {};

  const cam = {
    yawDeg: -26,
    pitchDeg: 44,
    distance: 2.05,
    panX: 0,
    panZ: 0,
    vertExag: 2.2,
    flyActive: false,
    flyProgress: 0.0,
    heliChase: false,
    savedDistance: 2.05,
    savedPitchDeg: 44,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    downX: 0,
    downY: 0
  };

  let clickableBeacons = [];

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  // =========================================================================
  // 1. COMPACT 4x4 MATRIX & RAY-PROJECTION MATH (EXACT WEBGL <-> HUD PARITY)
  // =========================================================================
  function mat4Perspective(fovyRad, aspect, near, far) {
    const f = 1.0 / Math.tan(fovyRad * 0.5);
    const nf = 1.0 / (near - far);
    const out = new Float32Array(16);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[14] = 2 * far * near * nf;
    return out;
  }

  function mat4LookAt(eye, target, up) {
    let zx = eye[0] - target[0];
    let zy = eye[1] - target[1];
    let zz = eye[2] - target[2];
    let len = Math.hypot(zx, zy, zz) || 1;
    zx /= len;
    zy /= len;
    zz /= len;

    let xx = up[1] * zz - up[2] * zy;
    let xy = up[2] * zx - up[0] * zz;
    let xz = up[0] * zy - up[1] * zx;
    len = Math.hypot(xx, xy, xz) || 1;
    xx /= len;
    xy /= len;
    xz /= len;

    const yx = zy * xz - zz * xy;
    const yy = zz * xx - zx * xz;
    const yz = zx * xy - zy * xx;

    const out = new Float32Array(16);
    out[0] = xx;
    out[1] = yx;
    out[2] = zx;
    out[3] = 0;
    out[4] = xy;
    out[5] = yy;
    out[6] = zy;
    out[7] = 0;
    out[8] = xz;
    out[9] = yz;
    out[10] = zz;
    out[11] = 0;
    out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    out[15] = 1;
    return out;
  }

  function mat4Mul(a, b) {
    const out = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        out[c * 4 + r] =
          a[0 * 4 + r] * b[c * 4 + 0] +
          a[1 * 4 + r] * b[c * 4 + 1] +
          a[2 * 4 + r] * b[c * 4 + 2] +
          a[3 * 4 + r] * b[c * 4 + 3];
      }
    }
    return out;
  }

  function projectPoint(mvp, wx, wy, wz, w, h) {
    const cx = mvp[0] * wx + mvp[4] * wy + mvp[8] * wz + mvp[12];
    const cy = mvp[1] * wx + mvp[5] * wy + mvp[9] * wz + mvp[13];
    const cz = mvp[2] * wx + mvp[6] * wy + mvp[10] * wz + mvp[14];
    const cw = mvp[3] * wx + mvp[7] * wy + mvp[11] * wz + mvp[15];
    if (cw <= 0.02) return null;
    const ndcX = cx / cw;
    const ndcY = cy / cw;
    return {
      x: (ndcX * 0.5 + 0.5) * w,
      y: (0.5 - ndcY * 0.5) * h,
      depth: cz / cw,
      w: cw
    };
  }

  function normToWorld(nx, ny, state) {
    const wx = (nx - 0.5) * 2.0;
    const wz = (ny - 0.5) * 1.36;
    const cell = window.ARES_ENGINE && window.ARES_ENGINE.sampleAt ? window.ARES_ENGINE.sampleAt(nx, ny) : null;
    const relM = cell ? cell.elevM - baseElevRef : 20;
    const wy = (relM / 800) * cam.vertExag;
    return { wx, wy, wz, elevM: cell ? cell.elevM : baseElevRef };
  }

  // =========================================================================
  // 2. WEBGL SHADERS & REAL 100x68 DEM TRIANGULATED TOPOGRAPHIC MESH
  // =========================================================================
  const VS_SRC = `
    attribute vec3 a_pos;
    attribute vec3 a_norm;
    attribute vec2 a_uv;
    attribute vec3 a_meta;

    uniform mat4 u_mvp;
    uniform float u_vertExag;

    varying vec3 v_worldPos;
    varying vec3 v_norm;
    varying vec2 v_uv;
    varying vec3 v_meta;
    varying float v_relElevM;

    void main() {
      vec3 p = vec3(a_pos.x, a_pos.y * u_vertExag, a_pos.z);
      v_worldPos = p;
      v_norm = normalize(vec3(a_norm.x * u_vertExag, a_norm.y, a_norm.z * u_vertExag));
      v_uv = a_uv;
      v_meta = a_meta;
      v_relElevM = a_pos.y * 800.0;
      gl_Position = u_mvp * vec4(p, 1.0);
    }
  `;

  const FS_SRC = `
    precision mediump float;

    varying vec3 v_worldPos;
    varying vec3 v_norm;
    varying vec2 v_uv;
    varying vec3 v_meta;
    varying float v_relElevM;

    uniform sampler2D u_baseTex;
    uniform sampler2D u_sciTex;
    uniform float u_hasBaseTex;
    uniform float u_hasSciTex;
    uniform vec3 u_sunDir;
    uniform vec3 u_eyePos;
    uniform float u_twilight;
    uniform float u_dustTau;
    uniform float u_showContours;

    void main() {
      vec3 N = normalize(v_norm);
      vec3 L = normalize(u_sunDir);
      vec3 V = normalize(u_eyePos - v_worldPos);

      // Base Martian surface albedo (CORS-clean HiRISE photo-drape on both file:// and http://)
      vec3 baseCol;
      if (u_hasBaseTex > 0.5) {
        baseCol = texture2D(u_baseTex, v_uv).rgb;
        // Extract subtle 1-meter HiRISE rock & fracture micro-relief normal perturbation
        float lR = dot(texture2D(u_baseTex, v_uv + vec2(0.000625, 0.0)).rgb, vec3(0.333));
        float lL = dot(texture2D(u_baseTex, v_uv - vec2(0.000625, 0.0)).rgb, vec3(0.333));
        float lD = dot(texture2D(u_baseTex, v_uv + vec2(0.0, 0.00092)).rgb, vec3(0.333));
        float lU = dot(texture2D(u_baseTex, v_uv - vec2(0.0, 0.00092)).rgb, vec3(0.333));
        N = normalize(N + vec3((lL - lR) * 0.42, 0.0, (lU - lD) * 0.42));
        // Natural warm Martian HiRISE albedo without shadow clipping
        baseCol = pow(baseCol, vec3(0.95)) * vec3(1.06, 0.99, 0.94);
      } else {
        float hFrac = clamp(v_relElevM / 125.0, 0.0, 1.0);
        vec3 valley = vec3(0.36, 0.22, 0.15);
        vec3 bench = vec3(0.58, 0.35, 0.22);
        vec3 ridge = vec3(0.76, 0.53, 0.36);
        baseCol = mix(valley, bench, smoothstep(0.0, 0.55, hFrac));
        baseCol = mix(baseCol, ridge, smoothstep(0.50, 1.0, hFrac));
        float grain = fract(sin(dot(v_uv * 240.0, vec2(12.9898, 78.233))) * 43758.5453);
        baseCol *= (0.93 + 0.14 * grain);
      }

      // Composite live Scientific Layer Raster (Slope, CRISM, THEMIS, Radiation/UHF)
      if (u_hasSciTex > 0.5) {
        vec4 sci = texture2D(u_sciTex, v_uv);
        baseCol = mix(baseCol, sci.rgb, sci.a * 0.85);
      }

      // Crisp 12-meter topographic contour isolines (only when Slope+Contours layer is active)
      float contourFactor = 0.0;
      if (u_showContours > 0.8) {
        float cPhase = fract(v_relElevM / 12.0);
        float cLine = 1.0 - smoothstep(0.0, 0.055, min(cPhase, 1.0 - cPhase));
        contourFactor = cLine * 0.38;
      }
      baseCol = mix(baseCol, vec3(0.99, 0.86, 0.35), contourFactor);

      // Steep >24.5 deg cliff scarp tactical crimson highlight (JPL OnSight style)
      float slopeDeg = v_meta.x * 35.0;
      if (slopeDeg >= 24.5) {
        baseCol = mix(baseCol, vec3(0.92, 0.26, 0.24), 0.28);
      }

      // Diurnal Martian Solar Lighting + Rim Scatter
      float ndotl = max(dot(N, L), 0.0);
      vec3 ambient = mix(vec3(0.34, 0.28, 0.26), vec3(0.16, 0.12, 0.22), u_twilight);
      vec3 sunColor = mix(vec3(1.04, 0.96, 0.88), vec3(1.12, 0.58, 0.28), u_twilight);
      float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.18;

      vec3 lit = baseCol * (ambient + sunColor * (0.78 * ndotl)) + vec3(0.95, 0.55, 0.28) * rim;

      // Martian Dust Storm (tau) Mie-scattering distance fog
      float dist = length(u_eyePos - v_worldPos);
      float fogDensity = 0.06 + max(0.0, u_dustTau - 0.42) * 0.24;
      float fog = clamp(1.0 - exp(-dist * fogDensity), 0.0, 0.86);
      vec3 dustColor = mix(vec3(0.58, 0.36, 0.22), vec3(0.28, 0.17, 0.16), u_twilight * 0.7);
      lit = mix(lit, dustColor, fog);

      gl_FragColor = vec4(lit, 1.0);
    }
  `;

  // =========================================================================
  // 2B. TRUE 3D NASA INGENUITY MARS HELICOPTER PBR-LITE SHADER & CAD BUFFERS
  // =========================================================================
  const HELI_VS_SRC = `
    attribute vec3 a_pos;
    attribute vec3 a_norm;
    attribute vec4 a_col;

    uniform mat4 u_mvp;
    uniform mat3 u_heliBasis;
    uniform mat3 u_heliRot;
    uniform vec3 u_heliPos;
    uniform float u_rotorSpin;

    varying vec3 v_worldPos;
    varying vec3 v_norm;
    varying vec3 v_localPos;
    varying vec4 v_col;

    void main() {
      float cs = cos(u_rotorSpin);
      float sn = sin(u_rotorSpin);
      vec3 lp = vec3(a_pos.x * cs - a_pos.z * sn, a_pos.y, a_pos.x * sn + a_pos.z * cs);
      vec3 ln = vec3(a_norm.x * cs - a_norm.z * sn, a_norm.y, a_norm.x * sn + a_norm.z * cs);
      vec3 wp = u_heliPos + u_heliBasis * lp;
      v_worldPos = wp;
      v_norm = normalize(u_heliRot * ln);
      v_localPos = lp;
      v_col = a_col;
      gl_Position = u_mvp * vec4(wp, 1.0);
    }
  `;

  const HELI_FS_SRC = `
    precision mediump float;

    varying vec3 v_worldPos;
    varying vec3 v_norm;
    varying vec3 v_localPos;
    varying vec4 v_col;

    uniform vec3 u_sunDir;
    uniform vec3 u_eyePos;
    uniform float u_alpha;

    void main() {
      vec3 N = normalize(v_norm);
      vec3 L = normalize(u_sunDir);
      vec3 V = normalize(u_eyePos - v_worldPos);
      // Two-sided normal for thin carbon-fiber rotor airfoils & solar substrate
      if (dot(N, V) < 0.0) N = -N;

      vec3 alb = v_col.rgb;
      float metallic = v_col.a;

      // Sub-millimeter SolAero photovoltaic cell grid & busbars on top solar array
      if (alb.b > 0.32 && alb.r < 0.14) {
        float gx = abs(fract(v_localPos.x * 38.0) - 0.5);
        float gz = abs(fract(v_localPos.z * 30.0) - 0.5);
        if (gx > 0.455 || gz > 0.455) {
          alb = vec3(0.74, 0.78, 0.84);
          metallic = 0.90;
        } else {
          float irid = pow(1.0 - max(dot(N, V), 0.0), 2.2);
          alb = mix(vec3(0.08, 0.16, 0.34), vec3(0.16, 0.34, 0.62), irid);
        }
      }

      float ndotl = max(dot(N, L), 0.0);
      vec3 H = normalize(L + V);
      float ndoth = max(dot(N, H), 0.0);

      // Sky hemisphere + warm Martian canyon floor bounce on silver/gold Kapton belly
      vec3 skyAmb = vec3(0.36, 0.31, 0.30) * (0.5 + 0.5 * N.y);
      vec3 groundBounce = vec3(0.50, 0.28, 0.16) * (0.5 - 0.5 * N.y);
      vec3 ambient = skyAmb + groundBounce * (0.45 + 0.55 * metallic);

      float shininess = mix(20.0, 68.0, metallic);
      float specMag = pow(ndoth, shininess) * mix(0.28, 1.25, metallic) * (0.25 + 0.75 * ndotl);
      vec3 specTint = mix(vec3(1.0, 0.97, 0.92), alb * 1.25 + vec3(0.22), metallic * 0.65);

      vec3 diffCol = alb * mix(1.0, 0.52, metallic);
      vec3 lit = alb * ambient + diffCol * vec3(1.12, 1.02, 0.92) * (0.90 * ndotl) + specTint * specMag;

      gl_FragColor = vec4(lit, u_alpha);
    }
  `;

  function decodeB64Bytes(b64) {
    const bin = window.atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function initHeliWebGL(glCtx) {
    if (!window.ARES_INGENUITY_MESH) return;
    const vs = compileShader(glCtx, glCtx.VERTEX_SHADER, HELI_VS_SRC);
    const fs = compileShader(glCtx, glCtx.FRAGMENT_SHADER, HELI_FS_SRC);
    if (!vs || !fs) return;

    heliProgram = glCtx.createProgram();
    glCtx.attachShader(heliProgram, vs);
    glCtx.attachShader(heliProgram, fs);
    glCtx.linkProgram(heliProgram);
    if (!glCtx.getProgramParameter(heliProgram, glCtx.LINK_STATUS)) {
      heliProgram = null;
      return;
    }

    const uploadPart = (partData) => {
      const vBytes = decodeB64Bytes(partData.vboB64);
      const iBytes = decodeB64Bytes(partData.iboB64);
      const vbo = glCtx.createBuffer();
      glCtx.bindBuffer(glCtx.ARRAY_BUFFER, vbo);
      glCtx.bufferData(glCtx.ARRAY_BUFFER, new Float32Array(vBytes.buffer), glCtx.STATIC_DRAW);
      const iboBuf = glCtx.createBuffer();
      glCtx.bindBuffer(glCtx.ELEMENT_ARRAY_BUFFER, iboBuf);
      glCtx.bufferData(glCtx.ELEMENT_ARRAY_BUFFER, new Uint16Array(iBytes.buffer), glCtx.STATIC_DRAW);
      return { vbo, ibo: iboBuf, indexCount: partData.indexCount };
    };

    // Build translucent 2,537 RPM coaxial tip-vortex / motion-blur sweep rings
    const buildRotorSweepDisc = () => {
      const segs = 72;
      const planes = [0.145, 0.045];
      const verts = [];
      const inds = [];
      let base = 0;
      planes.forEach((py) => {
        for (let i = 0; i <= segs; i++) {
          const ang = (i / segs) * Math.PI * 2;
          const c = Math.cos(ang);
          const s = Math.sin(ang);
          // Inner hub ring (r=0.10) & outer Mach-0.7 smoked carbon-graphite tip blur (r=0.555)
          verts.push(c * 0.10, py, s * 0.10, 0, 1, 0, 0.14, 0.15, 0.17, 0.25);
          verts.push(c * 0.555, py, s * 0.555, 0, 1, 0, 0.28, 0.29, 0.32, 0.50);
        }
        for (let i = 0; i < segs; i++) {
          const i0 = base + i * 2;
          inds.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
        }
        base += (segs + 1) * 2;
      });
      const vbo = glCtx.createBuffer();
      glCtx.bindBuffer(glCtx.ARRAY_BUFFER, vbo);
      glCtx.bufferData(glCtx.ARRAY_BUFFER, new Float32Array(verts), glCtx.STATIC_DRAW);
      const iboBuf = glCtx.createBuffer();
      glCtx.bindBuffer(glCtx.ELEMENT_ARRAY_BUFFER, iboBuf);
      glCtx.bufferData(glCtx.ELEMENT_ARRAY_BUFFER, new Uint16Array(inds), glCtx.STATIC_DRAW);
      return { vbo, ibo: iboBuf, indexCount: inds.length };
    };

    const m = window.ARES_INGENUITY_MESH;
    heliParts = {
      airframe: uploadPart(m.airframe),
      rotorUpper: uploadPart(m.rotorUpper),
      rotorLower: uploadPart(m.rotorLower),
      rotorDisc: buildRotorSweepDisc()
    };
  }

  function computeIngenuityFlightState(state, theater) {
    if (!state.ingenuityScoutActive || !theater) return null;
    const habWp = theater.waypoints[0];
    const allWps = theater.waypoints.concat(state.customWaypoints || []);
    const tgtWp = allWps[allWps.length - 1] || habWp;
    const t = state.ingenuityPhase || 0;

    let cNx = state._crewNx ?? habWp.x;
    let cNy = state._crewNy ?? habWp.y;
    const path = (state.routeResult && state.routeResult.path) || [];
    const contingency =
      state.emergencyAbortActive && state.routeResult ? state.routeResult.contingency : null;
    const activeTrack =
      contingency && contingency.leg1Path && contingency.leg1Path.length > 1
        ? contingency.leg1Path
        : path;
    if (activeTrack && activeTrack.length > 1) {
      const prog = contingency
        ? clamp(state.emergencyProgress ?? 0, 0, 1)
        : clamp(state.traverseProgress ?? 0, 0, 1);
      const f = prog * (activeTrack.length - 1);
      const i0 = Math.floor(f);
      const i1 = Math.min(activeTrack.length - 1, i0 + 1);
      const u = f - i0;
      cNx = activeTrack[i0].nx + (activeTrack[i1].nx - activeTrack[i0].nx) * u;
      cNy = activeTrack[i0].ny + (activeTrack[i1].ny - activeTrack[i0].ny) * u;
      state._crewNx = cNx;
      state._crewNy = cNy;
    }

    const evalTrack = (phaseVal) => {
      const lerp = 0.30 + 0.40 * (0.5 + 0.5 * Math.sin(phaseVal * 1.3));
      const lat = 0.24 + 0.12 * Math.cos(phaseVal * 2.4);
      const nx = clamp(
        cNx + (tgtWp.x - cNx) * lerp - (tgtWp.y - cNy) * lat,
        0.06,
        0.94
      );
      const ny = clamp(
        cNy + (tgtWp.y - cNy) * lerp + (tgtWp.x - cNx) * lat,
        0.06,
        0.94
      );
      return { nx, ny };
    };

    const p0 = evalTrack(t);
    const p1 = evalTrack(t + 0.025);
    const p2 = evalTrack(t + 0.05);
    const surf = normToWorld(p0.nx, p0.ny, state);

    const vx = (p1.nx - p0.nx) * 2.0;
    const vz = (p1.ny - p0.ny) * 1.36;
    const vx2 = (p2.nx - p1.nx) * 2.0;
    const vz2 = (p2.ny - p1.ny) * 1.36;
    const speed = Math.hypot(vx, vz);
    const heading = speed > 1e-5 ? Math.atan2(vx, vz) : 0.4;
    const h2 = Math.hypot(vx2, vz2) > 1e-5 ? Math.atan2(vx2, vz2) : heading;
    let dHead = h2 - heading;
    while (dHead > Math.PI) dHead -= Math.PI * 2;
    while (dHead < -Math.PI) dHead += Math.PI * 2;

    const pitch = clamp(speed * 18.0, 0.06, 0.16); // Forward cyclic pitch into flight
    const roll = clamp(-dHead * 5.5, -0.22, 0.22); // Smooth coordinated bank into turns
    const scale = cam.heliChase ? 0.145 : 0.185;
    const hoverBob = Math.sin(t * 5.4) * 0.004;
    const wx = surf.wx;
    const wy = surf.wy + 0.155 + hoverBob;
    const wz = surf.wz;

    // Build orthonormal 3x3 rotation matrix: Yaw(heading) * Pitch(pitch) * Roll(roll)
    const cy = Math.cos(heading), sy = Math.sin(heading);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cr = Math.cos(roll), sr = Math.sin(roll);

    // Column-major 3x3 for WebGL uniformMatrix3fv
    const r00 = cy * cr + sy * sp * sr;
    const r10 = cp * sr;
    const r20 = -sy * cr + cy * sp * sr;

    const r01 = -cy * sr + sy * sp * cr;
    const r11 = cp * cr;
    const r21 = sy * sr + cy * sp * cr;

    const r02 = sy * cp;
    const r12 = -sp;
    const r22 = cy * cp;

    const rotMat = new Float32Array([r00, r10, r20, r01, r11, r21, r02, r12, r22]);
    const basisMat = new Float32Array([
      r00 * scale, r10 * scale, r20 * scale,
      r01 * scale, r11 * scale, r21 * scale,
      r02 * scale, r12 * scale, r22 * scale
    ]);

    return {
      wx,
      wy,
      wz,
      surfWy: surf.wy,
      scale,
      heading,
      rotorAngle: t * 68.0,
      rotMat,
      basisMat
    };
  }

  function compileShader(glCtx, type, src) {
    const sh = glCtx.createShader(type);
    glCtx.shaderSource(sh, src);
    glCtx.compileShader(sh);
    if (!glCtx.getShaderParameter(sh, glCtx.COMPILE_STATUS)) {
      glCtx.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function initWebGL(canvas) {
    if (gl && gl.canvas === canvas) return true;
    gl =
      canvas.getContext('webgl', { antialias: true, alpha: false }) ||
      canvas.getContext('experimental-webgl');
    if (!gl) return false;

    const vs = compileShader(gl, gl.VERTEX_SHADER, VS_SRC);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FS_SRC);
    if (!vs || !fs) return false;

    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;

    vboPos = gl.createBuffer();
    vboNorm = gl.createBuffer();
    vboUv = gl.createBuffer();
    vboMeta = gl.createBuffer();
    ibo = gl.createBuffer();

    const anisoExt =
      gl.getExtension('EXT_texture_filter_anisotropic') ||
      gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
    const maxAniso = anisoExt
      ? Math.min(16, gl.getParameter(anisoExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 4)
      : 1;

    baseTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, baseTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (anisoExt && maxAniso > 1) {
      gl.texParameterf(gl.TEXTURE_2D, anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, maxAniso);
    }

    sciTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, sciTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (anisoExt && maxAniso > 1) {
      gl.texParameterf(gl.TEXTURE_2D, anisoExt.TEXTURE_MAX_ANISOTROPY_EXT, maxAniso);
    }

    builtTheaterKey = null;
    baseTexUrl = '';
    sciTexKey = '';
    initHeliWebGL(gl);
    return true;
  }

  function rebuildTerrainMeshIfNeeded(state) {
    const grid = window.ARES_ENGINE && window.ARES_ENGINE.getGrid ? window.ARES_ENGINE.getGrid() : null;
    if (!grid || !grid.length || !gl) return;
    if (builtTheaterKey === state.theaterKey && builtSepStorm === !!state.sepStormActive) return;

    const theater = window.ARES_THEATERS[state.theaterKey];
    baseElevRef = theater ? theater.baseElevM : -2185;
    const srcH = grid.length;
    const srcW = grid[0].length;
    const gw = 160;
    const gh = 108;
    const numVerts = gw * gh;

    const posArr = new Float32Array(numVerts * 3);
    const normArr = new Float32Array(numVerts * 3);
    const uvArr = new Float32Array(numVerts * 2);
    const metaArr = new Float32Array(numVerts * 3);

    const sampleGridField = (fx, fy) => {
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = Math.min(srcW - 1, x0 + 1);
      const y1 = Math.min(srcH - 1, y0 + 1);
      const tx = fx - x0;
      const ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx);
      const sy = ty * ty * (3 - 2 * ty);
      const c00 = grid[y0][x0];
      const c10 = grid[y0][x1];
      const c01 = grid[y1][x0];
      const c11 = grid[y1][x1];
      const bilerp = (k, fallback) => {
        const v00 = c00[k] ?? fallback;
        const v10 = c10[k] ?? fallback;
        const v01 = c01[k] ?? fallback;
        const v11 = c11[k] ?? fallback;
        const top = v00 + (v10 - v00) * sx;
        const bot = v01 + (v11 - v01) * sx;
        return top + (bot - top) * sy;
      };
      return {
        elevM: bilerp('elevM', baseElevRef),
        dzdx: bilerp('dzdx', 0),
        dzdy: bilerp('dzdy', 0),
        visSlope: bilerp('visualSlopeDeg', c00.slopeDeg || 0),
        crism: bilerp('crismIndex', 0.25),
        ti: bilerp('thermalInertia', 280)
      };
    };

    for (let y = 0; y < gh; y++) {
      const uny = y / (gh - 1);
      const fy = uny * (srcH - 1);
      for (let x = 0; x < gw; x++) {
        const unx = x / (gw - 1);
        const fx = unx * (srcW - 1);
        const idx = y * gw + x;
        const c = sampleGridField(fx, fy);
        const wx = (unx - 0.5) * 2.0;
        const wz = (uny - 0.5) * 1.36;
        const wy = (c.elevM - baseElevRef) / 800.0;

        posArr[idx * 3 + 0] = wx;
        posArr[idx * 3 + 1] = wy;
        posArr[idx * 3 + 2] = wz;

        // Surface normal in un-exaggerated world coordinates
        const nx = -c.dzdx;
        const ny = 1.0;
        const nz = -c.dzdy;
        const inv = 1.0 / (Math.hypot(nx, ny, nz) || 1.0);
        normArr[idx * 3 + 0] = nx * inv;
        normArr[idx * 3 + 1] = ny * inv;
        normArr[idx * 3 + 2] = nz * inv;

        uvArr[idx * 2 + 0] = unx;
        uvArr[idx * 2 + 1] = uny;

        metaArr[idx * 3 + 0] = clamp(c.visSlope / 35.0, 0, 1);
        metaArr[idx * 3 + 1] = clamp(c.crism, 0, 1);
        metaArr[idx * 3 + 2] = clamp(c.ti / 465.0, 0, 1);
      }
    }

    const indices = new Uint16Array((gw - 1) * (gh - 1) * 6);
    let ptr = 0;
    for (let y = 0; y < gh - 1; y++) {
      for (let x = 0; x < gw - 1; x++) {
        const i00 = y * gw + x;
        const i10 = i00 + 1;
        const i01 = (y + 1) * gw + x;
        const i11 = i01 + 1;
        indices[ptr++] = i00;
        indices[ptr++] = i01;
        indices[ptr++] = i10;
        indices[ptr++] = i10;
        indices[ptr++] = i01;
        indices[ptr++] = i11;
      }
    }
    indexCount = indices.length;

    gl.bindBuffer(gl.ARRAY_BUFFER, vboPos);
    gl.bufferData(gl.ARRAY_BUFFER, posArr, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, vboNorm);
    gl.bufferData(gl.ARRAY_BUFFER, normArr, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, vboUv);
    gl.bufferData(gl.ARRAY_BUFFER, uvArr, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, vboMeta);
    gl.bufferData(gl.ARRAY_BUFFER, metaArr, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    builtTheaterKey = state.theaterKey;
    builtSepStorm = !!state.sepStormActive;
  }

  function syncTextures(state, requestRedraw) {
    if (!gl) return;
    const theater = window.ARES_THEATERS[state.theaterKey];
    const url = state.customBasemapUrl || (theater && theater.basemapImg) || '';
    const resolvedUrl =
      (window.ARES_BASEMAP_DATA_URLS && window.ARES_BASEMAP_DATA_URLS[url]) || url;

    if (url && url !== baseTexUrl) {
      let img = imgCache[url];
      if (!img) {
        img = new Image();
        img.onload = () => {
          baseTexUrl = '';
          if (requestRedraw) requestRedraw();
        };
        img.src = resolvedUrl;
        imgCache[url] = img;
      }
      if (img.complete && img.naturalWidth > 0) {
        try {
          gl.bindTexture(gl.TEXTURE_2D, baseTex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
          baseTexValid = true;
          baseTexUrl = url;
        } catch (_) {
          baseTexValid = false;
          baseTexUrl = url;
        }
      }
    }

    // Sync scientific raster overlay texture (generated purely from numeric DEM grid -> never tainted!)
    const layers = state.layers || {};
    const key = [
      state.theaterKey,
      state.sepStormActive ? '1' : '0',
      layers.topoSlope ? '1' : '0',
      layers.crismSpectral ? '1' : '0',
      layers.thermalInertia ? '1' : '0',
      layers.radiationWeather ? '1' : '0'
    ].join('|');

    if (key !== sciTexKey && window.ARES_GIS && window.ARES_GIS.getScientificRasterCanvas) {
      const sciCanvas = window.ARES_GIS.getScientificRasterCanvas(state);
      if (sciCanvas) {
        try {
          gl.bindTexture(gl.TEXTURE_2D, sciTex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sciCanvas);
          hasSciTex = true;
        } catch (_) {
          hasSciTex = false;
        }
      } else {
        hasSciTex = false;
      }
      sciTexKey = key;
    }
  }

  // =========================================================================
  // 3. MAIN 3D WEBGL + VECTOR HOLOGRAPHIC HUD RENDERER
  // =========================================================================
  function renderTerrain3d(webglCanvas, hudCanvas, state, requestRedraw) {
    if (!webglCanvas || !hudCanvas) return;
    const rect = webglCanvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(280, Math.floor(rect.width));
    const h = Math.max(220, Math.floor(rect.height));

    if (webglCanvas.width !== Math.floor(w * dpr) || webglCanvas.height !== Math.floor(h * dpr)) {
      webglCanvas.width = Math.floor(w * dpr);
      webglCanvas.height = Math.floor(h * dpr);
    }
    if (hudCanvas.width !== Math.floor(w * dpr) || hudCanvas.height !== Math.floor(h * dpr)) {
      hudCanvas.width = Math.floor(w * dpr);
      hudCanvas.height = Math.floor(h * dpr);
    }

    if (!initWebGL(webglCanvas)) return;
    rebuildTerrainMeshIfNeeded(state);
    syncTextures(state, requestRedraw);

    const theater = window.ARES_THEATERS[state.theaterKey];
    if (!theater) return;

    if (!state.ingenuityScoutActive && cam.heliChase) {
      cam.heliChase = false;
      cam.distance = cam.savedDistance || 2.05;
      cam.pitchDeg = cam.savedPitchDeg || 44;
    }
    const heliFlight = computeIngenuityFlightState(state, theater);

    // Compute Camera Eye & Target (Orbit Table vs Heli Chase vs Autonomous Canyon Fly-Through)
    let eye = [0, 1.2, 1.8];
    let target = [cam.panX, 0.08 * cam.vertExag, cam.panZ];
    const path = (state.routeResult && state.routeResult.path) || [];

    if (cam.flyActive && path.length > 4) {
      const fIdx = clamp(cam.flyProgress, 0, 0.999) * (path.length - 1);
      const i0 = Math.floor(fIdx);
      const i1 = Math.min(path.length - 1, i0 + 1);
      const t = fIdx - i0;
      const curNx = path[i0].nx + (path[i1].nx - path[i0].nx) * t;
      const curNy = path[i0].ny + (path[i1].ny - path[i0].ny) * t;

      const lookIdx = Math.min(path.length - 1, i0 + 14);
      const lookNx = path[lookIdx].nx;
      const lookNy = path[lookIdx].ny;

      const pCur = normToWorld(curNx, curNy, state);
      const pLook = normToWorld(lookNx, lookNy, state);
      let dx = pLook.wx - pCur.wx;
      let dz = pLook.wz - pCur.wz;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;

      // Drone chase camera hovering ~45m behind and ~38m above canyon floor
      eye = [pCur.wx - dx * 0.24, pCur.wy + 0.14 + 0.03 * cam.vertExag, pCur.wz - dz * 0.24];
      target = [pLook.wx, pLook.wy + 0.04, pLook.wz];
    } else if (cam.heliChase && heliFlight) {
      target = [heliFlight.wx, heliFlight.wy, heliFlight.wz];
      const yawR = (cam.yawDeg * Math.PI) / 180;
      const pitchR = (cam.pitchDeg * Math.PI) / 180;
      const horiz = cam.distance * Math.cos(pitchR);
      eye = [
        target[0] + Math.sin(yawR) * horiz,
        Math.max(heliFlight.surfWy + 0.028, target[1] + cam.distance * Math.sin(pitchR)),
        target[2] + Math.cos(yawR) * horiz
      ];
    } else {
      const yawR = (cam.yawDeg * Math.PI) / 180;
      const pitchR = (cam.pitchDeg * Math.PI) / 180;
      const horiz = cam.distance * Math.cos(pitchR);
      eye = [
        target[0] + Math.sin(yawR) * horiz,
        target[1] + cam.distance * Math.sin(pitchR),
        target[2] + Math.cos(yawR) * horiz
      ];
    }

    const proj = mat4Perspective((46 * Math.PI) / 180, w / h, 0.015, 14.0);
    const view = mat4LookAt(eye, target, [0, 1, 0]);
    const mvp = mat4Mul(proj, view);

    // Diurnal Sun Vector from LTST (06:00 East -> 12:30 Zenith -> 19:00 West)
    const ltst = typeof state.ltstHour === 'number' ? state.ltstHour : 13.5;
    const dustTau = typeof state.dustTau === 'number' ? state.dustTau : 0.42;
    const dayFrac = clamp((ltst - 5.5) / 14.0, 0, 1);
    const sunElev = Math.max(0.06, Math.sin(dayFrac * Math.PI) * 1.18);
    const sunAz = dayFrac * Math.PI;
    const sunDir = [
      Math.cos(sunAz) * Math.cos(sunElev),
      Math.sin(sunElev),
      Math.sin(sunAz) * 0.45 * Math.cos(sunElev)
    ];
    const twilight = clamp(1 - Math.sin(dayFrac * Math.PI) * 1.45, 0, 1);

    // Clear WebGL viewport with Martian atmospheric horizon tone
    gl.viewport(0, 0, webglCanvas.width, webglCanvas.height);
    const bgR = 0.05 + clamp((dustTau - 0.42) * 0.08, 0, 0.18) * (1 - twilight * 0.5);
    const bgG = 0.04 + clamp((dustTau - 0.42) * 0.045, 0, 0.10) * (1 - twilight * 0.5);
    const bgB = 0.04 + twilight * 0.03;
    gl.clearColor(bgR, bgG, bgB, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    if (indexCount > 0) {
      for (let i = 0; i < 6; i++) gl.disableVertexAttribArray(i);
      gl.useProgram(program);

      const bindAttr = (buf, name, size) => {
        const loc = gl.getAttribLocation(program, name);
        if (loc < 0) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      };

      bindAttr(vboPos, 'a_pos', 3);
      bindAttr(vboNorm, 'a_norm', 3);
      bindAttr(vboUv, 'a_uv', 2);
      bindAttr(vboMeta, 'a_meta', 3);

      gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_mvp'), false, mvp);
      gl.uniform1f(gl.getUniformLocation(program, 'u_vertExag'), cam.vertExag);
      gl.uniform3fv(gl.getUniformLocation(program, 'u_sunDir'), sunDir);
      gl.uniform3fv(gl.getUniformLocation(program, 'u_eyePos'), eye);
      gl.uniform1f(gl.getUniformLocation(program, 'u_twilight'), twilight);
      gl.uniform1f(gl.getUniformLocation(program, 'u_dustTau'), dustTau);
      gl.uniform1f(
        gl.getUniformLocation(program, 'u_showContours'),
        state.layers && state.layers.topoSlope ? 1.0 : 0.45
      );

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, baseTex);
      gl.uniform1i(gl.getUniformLocation(program, 'u_baseTex'), 0);
      gl.uniform1f(gl.getUniformLocation(program, 'u_hasBaseTex'), baseTexValid ? 1.0 : 0.0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, sciTex);
      gl.uniform1i(gl.getUniformLocation(program, 'u_sciTex'), 1);
      gl.uniform1f(gl.getUniformLocation(program, 'u_hasSciTex'), hasSciTex ? 1.0 : 0.0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
    }

    // =========================================================================
    // 3B. TRUE 3D NASA INGENUITY MARS HELICOPTER (9,124-TRI CAD MESH IN WEBGL)
    // =========================================================================
    if (heliFlight && heliProgram && heliParts) {
      for (let i = 0; i < 6; i++) gl.disableVertexAttribArray(i);
      gl.useProgram(heliProgram);

      gl.uniformMatrix4fv(gl.getUniformLocation(heliProgram, 'u_mvp'), false, mvp);
      gl.uniformMatrix3fv(gl.getUniformLocation(heliProgram, 'u_heliBasis'), false, heliFlight.basisMat);
      gl.uniformMatrix3fv(gl.getUniformLocation(heliProgram, 'u_heliRot'), false, heliFlight.rotMat);
      gl.uniform3fv(gl.getUniformLocation(heliProgram, 'u_heliPos'), [
        heliFlight.wx,
        heliFlight.wy,
        heliFlight.wz
      ]);
      gl.uniform3fv(gl.getUniformLocation(heliProgram, 'u_sunDir'), sunDir);
      gl.uniform3fv(gl.getUniformLocation(heliProgram, 'u_eyePos'), eye);
      gl.uniform1f(gl.getUniformLocation(heliProgram, 'u_alpha'), 1.0);

      const posLoc = gl.getAttribLocation(heliProgram, 'a_pos');
      const normLoc = gl.getAttribLocation(heliProgram, 'a_norm');
      const colLoc = gl.getAttribLocation(heliProgram, 'a_col');
      const spinLoc = gl.getUniformLocation(heliProgram, 'u_rotorSpin');

      const drawHeliPart = (part, spinRad) => {
        if (!part || !part.indexCount) return;
        gl.uniform1f(spinLoc, spinRad);
        gl.bindBuffer(gl.ARRAY_BUFFER, part.vbo);
        if (posLoc >= 0) {
          gl.enableVertexAttribArray(posLoc);
          gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 40, 0);
        }
        if (normLoc >= 0) {
          gl.enableVertexAttribArray(normLoc);
          gl.vertexAttribPointer(normLoc, 3, gl.FLOAT, false, 40, 12);
        }
        if (colLoc >= 0) {
          gl.enableVertexAttribArray(colLoc);
          gl.vertexAttribPointer(colLoc, 4, gl.FLOAT, false, 40, 24);
        }
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, part.ibo);
        gl.drawElements(gl.TRIANGLES, part.indexCount, gl.UNSIGNED_SHORT, 0);
      };

      // Opaque CAD sub-meshes: Kapton MLI fuselage + splayed landing gear + counter-rotating 1.2m rotors
      drawHeliPart(heliParts.airframe, 0.0);
      drawHeliPart(heliParts.rotorUpper, heliFlight.rotorAngle);
      drawHeliPart(heliParts.rotorLower, -heliFlight.rotorAngle);

      // Translucent 2,537 RPM coaxial rotor tip motion-blur sweep
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.uniform1f(gl.getUniformLocation(heliProgram, 'u_alpha'), 0.09);
      drawHeliPart(heliParts.rotorDisc, 0.0);
      gl.depthMask(true);
      gl.disable(gl.BLEND);

      for (let i = 0; i < 6; i++) gl.disableVertexAttribArray(i);
    }

    // =========================================================================
    // 4. 3D VECTOR HOLOGRAPHIC HUD OVERLAY (RIBBONS, CURTAINS, UHF, INGENUITY)
    // =========================================================================
    const ctx = hudCanvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    clickableBeacons = [];

    // 4A. Holographic Terrain Table Base Skirt Frame (suppressed in close-up HELI CAM)
    if (!cam.heliChase) {
      const corners = [
        [-1.0, -0.03, -0.68, 'NW'],
        [1.0, -0.03, -0.68, 'NE'],
        [1.0, -0.03, 0.68, 'SE'],
        [-1.0, -0.03, 0.68, 'SW']
      ];
      ctx.save();
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.32)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      let started = false;
      corners.forEach((c, idx) => {
        const sp = projectPoint(mvp, c[0], c[1], c[2], w, h);
        if (sp) {
          if (!started) {
            ctx.moveTo(sp.x, sp.y);
            started = true;
          } else {
            ctx.lineTo(sp.x, sp.y);
          }
        }
        if (idx === corners.length - 1) {
          const sp0 = projectPoint(mvp, corners[0][0], corners[0][1], corners[0][2], w, h);
          if (sp0 && started) ctx.lineTo(sp0.x, sp0.y);
        }
      });
      ctx.stroke();
      ctx.restore();
    }

    // 3D Ray-Ellipsoid Occlusion Helper: prevents 2D HUD overlays from painting over foreground 3D helicopter
    const isOccludedByHeli = (wx, wy, wz) => {
      if (!heliFlight) return false;
      const vx = wx - eye[0];
      const vy = wy - eye[1];
      const vz = wz - eye[2];
      const len = Math.hypot(vx, vy, vz);
      if (len < 1e-4) return false;
      const dx = vx / len;
      const dy = vy / len;
      const dz = vz / len;
      const ux = heliFlight.wx - eye[0];
      const uy = heliFlight.wy - eye[1];
      const uz = heliFlight.wz - eye[2];
      const tProj = ux * dx + uy * dy + uz * dz;
      if (tProj <= 0 || tProj >= len) return false;
      const qx = eye[0] + dx * tProj - heliFlight.wx;
      const qy = eye[1] + dy * tProj - heliFlight.wy;
      const qz = eye[2] + dz * tProj - heliFlight.wz;
      const s = heliFlight.scale;
      const rCanopy =
        (qx * qx + qz * qz) / ((0.54 * s) * (0.54 * s)) +
        ((qy - 0.11 * s) * (qy - 0.11 * s)) / ((0.16 * s) * (0.16 * s));
      if (rCanopy < 1.0) return true;
      const rBody =
        (qx * qx + qz * qz) / ((0.24 * s) * (0.24 * s)) +
        ((qy + 0.08 * s) * (qy + 0.08 * s)) / ((0.18 * s) * (0.18 * s));
      return rBody < 1.0;
    };

    // Helper: Draw 3D terrain-draped polyline + optional vertical elevation curtain
    const draw3dRoute = (pts, liftY, lineCol, lineW, dashed, curtainCol) => {
      if (!pts || pts.length < 2) return;
      const screenUpper = [];
      const screenGround = [];
      for (let i = 0; i < pts.length; i += 2) {
        const wpt = normToWorld(pts[i].nx, pts[i].ny, state);
        const occ = cam.heliChase && isOccludedByHeli(wpt.wx, wpt.wy + liftY, wpt.wz);
        const su = projectPoint(mvp, wpt.wx, wpt.wy + liftY, wpt.wz, w, h);
        const sg = projectPoint(mvp, wpt.wx, wpt.wy + 0.002, wpt.wz, w, h);
        if (su && sg) {
          su.occ = occ;
          screenUpper.push(su);
          screenGround.push(sg);
        }
      }
      if (screenUpper.length < 2) return;

      if (curtainCol && !cam.heliChase) {
        ctx.save();
        ctx.fillStyle = curtainCol;
        ctx.beginPath();
        screenUpper.forEach((p, idx) => {
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        for (let k = screenGround.length - 1; k >= 0; k--) {
          ctx.lineTo(screenGround[k].x, screenGround[k].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (dashed) ctx.setLineDash(dashed);
      ctx.strokeStyle = 'rgba(12, 10, 9, 0.85)';
      ctx.lineWidth = lineW + 2.4;
      ctx.beginPath();
      let penDown = false;
      screenUpper.forEach((p) => {
        if (p.occ) {
          penDown = false;
        } else if (!penDown) {
          ctx.moveTo(p.x, p.y);
          penDown = true;
        } else {
          ctx.lineTo(p.x, p.y);
        }
      });
      ctx.stroke();

      ctx.strokeStyle = lineCol;
      ctx.lineWidth = lineW;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    };

    // 4B. 3D Walk-Back Safety Dome Perimeter on Surface (suppressed in close-up HELI CAM)
    const habWp = theater.waypoints[0];
    const stats = (state.routeResult && state.routeResult.stats) || {};
    if (!cam.heliChase && habWp && stats.walkBackNormRx) {
      const ringPts = [];
      for (let a = 0; a <= 48; a++) {
        const ang = (a / 48) * Math.PI * 2;
        const nx = clamp(habWp.x + Math.cos(ang) * stats.walkBackNormRx, 0.01, 0.99);
        const ny = clamp(habWp.y + Math.sin(ang) * stats.walkBackNormRy, 0.01, 0.99);
        ringPts.push({ nx, ny });
      }
      draw3dRoute(ringPts, 0.008, 'rgba(245, 158, 11, 0.55)', 1.5, [6, 5], null);
    }

    // 4C. Red Dashed Direct Scarp-Climbing Baseline vs Glowing A* Canyon Ribbon
    const directPath = state.routeResult && state.routeResult.directPath;
    const contingency = state.emergencyAbortActive ? state.routeResult.contingency : null;
    if (directPath && state.routingMode !== 'direct' && !contingency) {
      draw3dRoute(
        directPath,
        0.014,
        'rgba(244, 63, 94, 0.88)',
        2.0,
        [5, 4],
        'rgba(244, 63, 94, 0.12)'
      );
    }

    if (path && path.length > 1) {
      const aCol =
        state.routingMode === 'direct'
          ? '#fb7185'
          : state.routingMode === 'science'
          ? '#38bdf8'
          : '#22c55e';
      const cCol =
        state.routingMode === 'direct'
          ? 'rgba(251, 113, 133, 0.20)'
          : state.routingMode === 'science'
          ? 'rgba(56, 189, 248, 0.24)'
          : 'rgba(34, 197, 94, 0.24)';
      draw3dRoute(path, 0.022, aCol, contingency ? 2.0 : 3.4, null, contingency ? null : cCol);
    }

    if (contingency) {
      draw3dRoute(contingency.leg2Path, 0.020, '#10b981', 2.2, [5, 4], null);
      draw3dRoute(
        contingency.leg1Path,
        0.026,
        '#ef4444',
        3.6,
        null,
        'rgba(239, 68, 68, 0.28)'
      );
    }

    // 4D. 3D UHF 401 MHz Line-of-Sight Ray (HAB-01 Rover Mast -> EV-1 Crew) + Dual Crew Beacons
    const activeTrack =
      contingency && contingency.leg1Path && contingency.leg1Path.length > 1
        ? contingency.leg1Path
        : path;
    const prog = contingency
      ? clamp(state.emergencyProgress ?? 0, 0, 1)
      : clamp(state.traverseProgress ?? 0, 0, 1);

    // Pre-register primary waypoint pill rectangles so UHF / EV-1 / Ingenuity tags never collide
    const placedRects = [];
    ctx.font = '700 9.5px "JetBrains Mono", monospace';
    theater.waypoints.forEach((wp) => {
      const wpt = normToWorld(wp.x, wp.y, state);
      const pTop = projectPoint(mvp, wpt.wx, wpt.wy + 0.075, wpt.wz, w, h);
      if (pTop) {
        const tw = ctx.measureText(`${wp.code} (${Math.round(wpt.elevM)}m)`).width + 14;
        placedRects.push({ x1: pTop.x - tw / 2, y1: pTop.y - 19, x2: pTop.x + tw / 2, y2: pTop.y + 2 });
      }
    });
    const resolveLabelPos = (cx, cy, bw, bh) => {
      const candidates = [
        [0, 0],
        [0, -18],
        [-54, -4],
        [54, -4],
        [0, 20],
        [-64, 14],
        [64, 14]
      ];
      for (let i = 0; i < candidates.length; i++) {
        const tx = clamp(cx + candidates[i][0], bw / 2 + 8, w - bw / 2 - 8);
        const ty = clamp(cy + candidates[i][1], 46, h - 42);
        const r = { x1: tx - bw / 2 - 3, y1: ty - bh / 2 - 2, x2: tx + bw / 2 + 3, y2: ty + bh / 2 + 2 };
        const hit = placedRects.some((p) => !(r.x2 < p.x1 || r.x1 > p.x2 || r.y2 < p.y1 || r.y1 > p.y2));
        if (!hit) {
          placedRects.push(r);
          return { x: tx, y: ty };
        }
      }
      return { x: cx, y: cy };
    };

    let crewWorld = null;
    if (activeTrack && activeTrack.length > 1) {
      const sampleTrack = (u) => {
        const f = clamp(u, 0, 1) * (activeTrack.length - 1);
        const i0 = Math.floor(f);
        const i1 = Math.min(activeTrack.length - 1, i0 + 1);
        const t = f - i0;
        return {
          nx: activeTrack[i0].nx + (activeTrack[i1].nx - activeTrack[i0].nx) * t,
          ny: activeTrack[i0].ny + (activeTrack[i1].ny - activeTrack[i0].ny) * t
        };
      };

      const ev1Norm = sampleTrack(prog);
      const ev2Norm = sampleTrack(Math.max(0, prog - 0.034));
      crewWorld = normToWorld(ev1Norm.nx, ev1Norm.ny, state);
      const ev2World = normToWorld(ev2Norm.nx, ev2Norm.ny, state);
      const habWorld = normToWorld(habWp.x, habWp.y, state);

      const ev1Cell = window.ARES_ENGINE.sampleAt(ev1Norm.nx, ev1Norm.ny);
      const uhfOk = !ev1Cell || ev1Cell.uhfLos;

      // 3D UHF Laser Link from HAB-01 Mast (+0.035) to EV-1 Helmet (+0.028)
      const pHabAnt = projectPoint(mvp, habWorld.wx, habWorld.wy + 0.042, habWorld.wz, w, h);
      const pEv1Ant = projectPoint(mvp, crewWorld.wx, crewWorld.wy + 0.034, crewWorld.wz, w, h);
      if (pHabAnt && pEv1Ant) {
        const linkScreenDist = Math.hypot(pHabAnt.x - pEv1Ant.x, pHabAnt.y - pEv1Ant.y);
        ctx.save();
        if (linkScreenDist > 18) {
          ctx.strokeStyle = uhfOk ? 'rgba(52, 211, 153, 0.72)' : 'rgba(192, 132, 252, 0.85)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(pHabAnt.x, pHabAnt.y);
          ctx.lineTo(pEv1Ant.x, pEv1Ant.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        if (linkScreenDist > 88) {
          const uhfTxt = uhfOk
            ? `401MHz UHF LOS (+${ev1Cell ? ev1Cell.uhfMarginDb : 24}dB)`
            : 'UHF RIDGE OCCLUSION';
          ctx.font = '700 8.5px "JetBrains Mono", monospace';
          const utw = ctx.measureText(uhfTxt).width + 8;
          const uPos = resolveLabelPos((pHabAnt.x + pEv1Ant.x) * 0.5, (pHabAnt.y + pEv1Ant.y) * 0.5 - 8, utw, 14);
          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
          ctx.shadowBlur = 5;
          ctx.fillStyle = uhfOk ? '#6ee7b7' : '#e9d5ff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(uhfTxt, uPos.x, uPos.y);
          ctx.restore();
        }
        ctx.restore();
      }

      // Draw EV-2 Scout + Buddy Link + EV-1 Lead
      const pEv2 = projectPoint(mvp, ev2World.wx, ev2World.wy + 0.028, ev2World.wz, w, h);
      if (pEv1Ant && pEv2) {
        ctx.save();
        ctx.strokeStyle = state.buddyFaultSim ? '#ef4444' : '#34d399';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pEv1Ant.x, pEv1Ant.y);
        ctx.lineTo(pEv2.x, pEv2.y);
        ctx.stroke();

        ctx.fillStyle = state.buddyFaultSim ? '#ef4444' : '#38bdf8';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(pEv2.x, pEv2.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(pEv1Ant.x, pEv1Ant.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        placedRects.push({ x1: pEv1Ant.x - 9, y1: pEv1Ant.y - 9, x2: pEv1Ant.x + 9, y2: pEv1Ant.y + 9 });
        placedRects.push({ x1: pEv2.x - 8, y1: pEv2.y - 8, x2: pEv2.x + 8, y2: pEv2.y + 8 });
        const evLbl = state.buddyFaultSim ? 'EV-1 (TOW FAULT)' : 'EV-1 LEAD';
        ctx.font = '700 9px "JetBrains Mono", monospace';
        const etw = ctx.measureText(evLbl).width + 8;
        const ePos = resolveLabelPos(pEv1Ant.x, prog < 0.04 ? pEv1Ant.y + 17 : pEv1Ant.y - 16, etw, 14);
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
        ctx.shadowBlur = 5;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(evLbl, ePos.x, ePos.y);
        ctx.restore();
        ctx.restore();
      }
    }

    // 4E. 3D Ingenuity Garmin LiDAR-Lite v3 Nadir Beam & Terrain Footprint (3D CAD Mesh Drawn in 3B)
    if (heliFlight) {
      const pNadir = projectPoint(
        mvp,
        heliFlight.wx,
        heliFlight.wy - 0.155 * heliFlight.scale,
        heliFlight.wz,
        w,
        h
      );
      const pTopAnt = projectPoint(
        mvp,
        heliFlight.wx,
        heliFlight.wy + 0.31 * heliFlight.scale,
        heliFlight.wz,
        w,
        h
      );
      const pGnd = projectPoint(mvp, heliFlight.wx, heliFlight.surfWy + 0.003, heliFlight.wz, w, h);

      // Project true 3D perspective ring on canyon surface beneath Ingenuity
      const scanR = 0.046;
      const ringPts = [];
      let minRx = Infinity;
      let maxRx = -Infinity;
      for (let i = 0; i <= 24; i++) {
        const ang = (i / 24) * Math.PI * 2;
        const rx = heliFlight.wx + Math.cos(ang) * scanR;
        const rz = heliFlight.wz + Math.sin(ang) * scanR;
        const rnx = clamp((rx + 1.0) * 0.5, 0.01, 0.99);
        const rny = clamp((rz + 0.68) / 1.36, 0.01, 0.99);
        const rSurf = normToWorld(rnx, rny, state);
        const sp = projectPoint(mvp, rx, rSurf.wy + 0.003, rz, w, h);
        if (sp) {
          ringPts.push(sp);
          if (sp.x < minRx) minRx = sp.x;
          if (sp.x > maxRx) maxRx = sp.x;
        }
      }

      if (pNadir && pGnd) {
        ctx.save();
        // Subtle nadir optical/LiDAR scan cone from fuselage belly to canyon floor
        if (ringPts.length > 8 && maxRx > minRx) {
          const coneAlpha = cam.heliChase ? 0.11 : 0.22;
          const coneGrad = ctx.createLinearGradient(pNadir.x, pNadir.y, pGnd.x, pGnd.y);
          coneGrad.addColorStop(0, `rgba(251, 191, 36, ${coneAlpha})`);
          coneGrad.addColorStop(1, 'rgba(249, 115, 22, 0.02)');
          ctx.fillStyle = coneGrad;
          ctx.beginPath();
          ctx.moveTo(pNadir.x, pNadir.y);
          ctx.lineTo(minRx, pGnd.y);
          ctx.lineTo(maxRx, pGnd.y);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = cam.heliChase
            ? 'rgba(251, 191, 36, 0.42)'
            : 'rgba(251, 191, 36, 0.62)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ringPts.forEach((pt, idx) => {
            if (idx === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          });
          ctx.stroke();
        }

        // Laser altimeter nadir plumb line
        ctx.strokeStyle = 'rgba(253, 230, 138, 0.55)';
        ctx.lineWidth = 1.0;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(pNadir.x, pNadir.y);
        ctx.lineTo(pGnd.x, pGnd.y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(pGnd.x, pGnd.y, 2.5, 0, Math.PI * 2);
        ctx.fill();

        const cx = (pNadir.x + (pTopAnt ? pTopAnt.x : pNadir.x)) * 0.5;
        const cy = (pNadir.y + (pTopAnt ? pTopAnt.y : pNadir.y)) * 0.5;
        clickableBeacons.push({ type: 'heli', x: cx, y: cy });

        // Keep overview callout above UHF whip; suppress floating label during close-up HELI CAM
        if (!cam.heliChase && pTopAnt) {
          const spanPx = Math.max(26, Math.abs(pNadir.y - pTopAnt.y) * 1.4);
          placedRects.push({
            x1: cx - spanPx,
            y1: Math.min(pTopAnt.y, pNadir.y) - 6,
            x2: cx + spanPx,
            y2: Math.max(pTopAnt.y, pNadir.y) + 6
          });
          const ingTxt = 'INGENUITY • 12m AGL • 2,537 RPM';
          ctx.font = '700 8.5px "JetBrains Mono", monospace';
          const itw = ctx.measureText(ingTxt).width + 10;
          const iPos = resolveLabelPos(pTopAnt.x, pTopAnt.y - 14, itw, 14);
          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
          ctx.shadowBlur = 5;
          ctx.fillStyle = '#fde68a';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(ingTxt, iPos.x, iPos.y);
          ctx.restore();
        }
        ctx.restore();
      }
    }

    // 4F. 3D Waypoint Pylons, Custom EVA Pins & Bi-Directional CapCom Target Diamond
    theater.waypoints.forEach((wp, idx) => {
      const wpt = normToWorld(wp.x, wp.y, state);
      if (
        cam.heliChase &&
        (isOccludedByHeli(wpt.wx, wpt.wy + 0.075, wpt.wz) ||
          isOccludedByHeli(wpt.wx, wpt.wy, wpt.wz))
      ) {
        return;
      }
      const pBase = projectPoint(mvp, wpt.wx, wpt.wy, wpt.wz, w, h);
      const pTop = projectPoint(mvp, wpt.wx, wpt.wy + 0.075, wpt.wz, w, h);
      if (!pBase || !pTop) return;

      const isSel = idx === state.selectedWaypointIdx;
      const col =
        wp.role === 'habitat'
          ? '#f97316'
          : wp.role === 'shelter'
          ? '#22c55e'
          : isSel
          ? '#ffffff'
          : '#f59e0b';

      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = isSel ? 2.2 : 1.5;
      ctx.beginPath();
      ctx.moveTo(pBase.x, pBase.y);
      ctx.lineTo(pTop.x, pTop.y);
      ctx.stroke();

      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(pBase.x, pBase.y, 3.5, 0, Math.PI * 2);
      ctx.fill();

      const tag = `${wp.code} (${Math.round(wpt.elevM)}m)`;
      ctx.font = '700 9.5px "JetBrains Mono", monospace';
      const tw = ctx.measureText(tag).width + 12;
      ctx.fillStyle = isSel ? '#ea580c' : 'rgba(18, 16, 14, 0.92)';
      ctx.fillRect(pTop.x - tw / 2, pTop.y - 17, tw, 17);
      ctx.strokeStyle = isSel ? '#ffffff' : col;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(pTop.x - tw / 2, pTop.y - 17, tw, 17);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tag, pTop.x, pTop.y - 8.5);
      ctx.restore();

      clickableBeacons.push({ type: 'wp', idx, x: pTop.x, y: pTop.y - 8 });
    });

    (state.customWaypoints || []).forEach((cwp, cIdx) => {
      const wpt = normToWorld(cwp.x, cwp.y, state);
      const pBase = projectPoint(mvp, wpt.wx, wpt.wy, wpt.wz, w, h);
      const pTop = projectPoint(mvp, wpt.wx, wpt.wy + 0.068, wpt.wz, w, h);
      if (!pBase || !pTop) return;

      ctx.save();
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(pBase.x, pBase.y);
      ctx.lineTo(pTop.x, pTop.y);
      ctx.stroke();

      const tag = `${cwp.code} • ${cwp.slopeDeg}°`;
      ctx.font = '700 9px "JetBrains Mono", monospace';
      const tw = ctx.measureText(tag).width + 10;
      ctx.fillStyle = 'rgba(18, 16, 14, 0.94)';
      ctx.fillRect(pTop.x - tw / 2, pTop.y - 16, tw, 16);
      ctx.strokeStyle = '#fb7185';
      ctx.strokeRect(pTop.x - tw / 2, pTop.y - 16, tw, 16);
      ctx.fillStyle = '#ffe4e6';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tag, pTop.x, pTop.y - 8);
      ctx.restore();

      clickableBeacons.push({ type: 'custom', idx: cIdx, x: pTop.x, y: pTop.y - 8 });
    });

    if (state.capcomTarget) {
      const tgt = state.capcomTarget;
      const wpt = normToWorld(tgt.nx, tgt.ny, state);
      const pBase = projectPoint(mvp, wpt.wx, wpt.wy, wpt.wz, w, h);
      const pTop = projectPoint(mvp, wpt.wx, wpt.wy + 0.095, wpt.wz, w, h);
      if (pBase && pTop) {
        ctx.save();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(pBase.x, pBase.y);
        ctx.lineTo(pTop.x, pTop.y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.save();
        ctx.translate(pTop.x, pTop.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = 'rgba(14, 165, 233, 0.45)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.fillRect(-7, -7, 14, 14);
        ctx.strokeRect(-7, -7, 14, 14);
        ctx.restore();

        const mTag = `◆ CAPCOM MARK (${tgt.bearingDeg || 0}° • ${tgt.distM || 0}m)`;
        ctx.font = '700 9.5px "JetBrains Mono", monospace';
        const tw = ctx.measureText(mTag).width + 12;
        ctx.fillStyle = 'rgba(8, 28, 42, 0.94)';
        ctx.fillRect(pTop.x - tw / 2, pTop.y - 28, tw, 16);
        ctx.strokeStyle = '#38bdf8';
        ctx.strokeRect(pTop.x - tw / 2, pTop.y - 28, tw, 16);
        ctx.fillStyle = '#e0f2fe';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(mTag, pTop.x, pTop.y - 20);
        ctx.restore();
      }
    }

    // 4G. Bottom-Left 3D Digital Twin Status Bar
    ctx.save();
    const ltstH = Math.floor(ltst);
    const ltstM = Math.round((ltst - ltstH) * 60);
    const ltstFmt = `${String(ltstH).padStart(2, '0')}:${String(ltstM).padStart(2, '0')} LTST`;
    const barTxt = cam.flyActive
      ? `DRONE CANYON CHASE CAM (${Math.round(cam.flyProgress * 100)}%) • ${ltstFmt} • τ=${dustTau.toFixed(2)} • VERT EXAG ${cam.vertExag.toFixed(1)}x`
      : cam.heliChase
      ? `INGENUITY 3D AERIAL SCOUT CAM (12.0m AGL • 2,537 RPM COAXIAL) • DRAG TO ORBIT 360° / SCROLL ZOOM`
      : `JPL ONSIGHT 3D DEM TABLE (34,026 TRIS) • ${ltstFmt} • τ=${dustTau.toFixed(2)} • DRAG TO ORBIT / SCROLL ZOOM`;
    ctx.font = '700 9.5px "JetBrains Mono", monospace';
    const bw = Math.min(w - 24, ctx.measureText(barTxt).width + 20);
    ctx.fillStyle = 'rgba(14, 12, 11, 0.88)';
    ctx.fillRect(12, h - 32, bw, 20);
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.55)';
    ctx.strokeRect(12, h - 32, bw, 20);
    ctx.fillStyle = '#fed7aa';
    ctx.textBaseline = 'middle';
    ctx.fillText(barTxt, 22, h - 22);
    ctx.restore();

    ctx.restore();
  }

  function bindEvents(hudCanvas, handlers) {
    if (!hudCanvas) return;

    hudCanvas.addEventListener('mousedown', (e) => {
      cam.isDragging = true;
      cam.dragStartX = e.clientX;
      cam.dragStartY = e.clientY;
      cam.downX = e.clientX;
      cam.downY = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!cam.isDragging) return;
      const dx = e.clientX - cam.dragStartX;
      const dy = e.clientY - cam.dragStartY;
      cam.dragStartX = e.clientX;
      cam.dragStartY = e.clientY;
      if (cam.flyActive) {
        cam.flyActive = false;
        if (handlers && handlers.onFlyStop) handlers.onFlyStop();
      }
      cam.yawDeg = (cam.yawDeg - dx * 0.38) % 360;
      cam.pitchDeg = clamp(cam.pitchDeg + dy * 0.28, cam.heliChase ? -18 : 12, 82);
      if (handlers && handlers.onRedraw) handlers.onRedraw();
    });

    window.addEventListener('mouseup', (e) => {
      if (!cam.isDragging) return;
      cam.isDragging = false;
      const dist = Math.hypot(e.clientX - cam.downX, e.clientY - cam.downY);
      if (dist < 6) {
        const rect = hudCanvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        for (let i = 0; i < clickableBeacons.length; i++) {
          const b = clickableBeacons[i];
          if (b.type === 'heli' && Math.hypot(mx - b.x, my - b.y) < 30) {
            if (handlers && handlers.onSelectHeli) handlers.onSelectHeli();
            return;
          }
          if (b.type === 'wp' && Math.hypot(mx - b.x, my - b.y) < 26) {
            if (handlers && handlers.onSelectWaypoint) handlers.onSelectWaypoint(b.idx);
            return;
          }
        }
      }
    });

    hudCanvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 0.90 : 1.11;
        cam.distance = clamp(cam.distance * factor, 0.14, 3.6);
        if (handlers && handlers.onRedraw) handlers.onRedraw();
      },
      { passive: false }
    );

    // Touch orbit support
    hudCanvas.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 1) {
          cam.isDragging = true;
          cam.dragStartX = e.touches[0].clientX;
          cam.dragStartY = e.touches[0].clientY;
        }
      },
      { passive: true }
    );
    hudCanvas.addEventListener(
      'touchmove',
      (e) => {
        if (!cam.isDragging || e.touches.length !== 1) return;
        const dx = e.touches[0].clientX - cam.dragStartX;
        const dy = e.touches[0].clientY - cam.dragStartY;
        cam.dragStartX = e.touches[0].clientX;
        cam.dragStartY = e.touches[0].clientY;
        cam.flyActive = false;
        cam.yawDeg = (cam.yawDeg - dx * 0.38) % 360;
        cam.pitchDeg = clamp(cam.pitchDeg + dy * 0.28, cam.heliChase ? -18 : 12, 82);
        if (handlers && handlers.onRedraw) handlers.onRedraw();
      },
      { passive: true }
    );
    hudCanvas.addEventListener('touchend', () => {
      cam.isDragging = false;
    });
  }

  function toggleFlyRoute() {
    cam.flyActive = !cam.flyActive;
    if (cam.flyActive) {
      if (cam.heliChase) {
        cam.heliChase = false;
        cam.distance = cam.savedDistance || 2.05;
        cam.pitchDeg = cam.savedPitchDeg || 44;
      }
      if (cam.flyProgress >= 0.98) {
        cam.flyProgress = 0.0;
      }
    }
    return cam.flyActive;
  }

  function toggleHeliChase(forceState) {
    const next = typeof forceState === 'boolean' ? forceState : !cam.heliChase;
    if (next && !cam.heliChase) {
      cam.savedDistance = cam.distance;
      cam.savedPitchDeg = cam.pitchDeg;
      cam.flyActive = false;
      cam.heliChase = true;
      cam.distance = 0.25;
      cam.pitchDeg = 22;
      cam.yawDeg = -32;
    } else if (!next && cam.heliChase) {
      cam.heliChase = false;
      cam.distance = Math.max(0.72, cam.savedDistance || 2.05);
      cam.pitchDeg = clamp(cam.savedPitchDeg || 44, 14, 80);
    }
    return cam.heliChase;
  }

  function stepFly(dt60) {
    if (!cam.flyActive) return false;
    cam.flyProgress += 0.0018 * dt60;
    if (cam.flyProgress >= 1.0) {
      cam.flyProgress = 0.0;
    }
    return true;
  }

  function cycleVertExag() {
    const opts = [1.0, 2.2, 3.4];
    const idx = opts.findIndex((v) => Math.abs(v - cam.vertExag) < 0.25);
    cam.vertExag = opts[(idx + 1) % opts.length];
    return cam.vertExag;
  }

  function resetCamera() {
    cam.flyActive = false;
    cam.heliChase = false;
    cam.yawDeg = -26;
    cam.pitchDeg = 44;
    cam.distance = 2.05;
    cam.panX = 0;
    cam.panZ = 0;
  }

  function invalidateTextures() {
    baseTexUrl = '';
    sciTexKey = '';
  }

  return {
    cam,
    renderTerrain3d,
    bindEvents,
    toggleFlyRoute,
    toggleHeliChase,
    stepFly,
    cycleVertExag,
    resetCamera,
    invalidateTextures
  };
})();
