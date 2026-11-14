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

  const imgCache = {};

  const cam = {
    yawDeg: -28,
    pitchDeg: 44,
    distance: 2.15,
    panX: 0,
    panZ: 0,
    vertExag: 2.2,
    flyActive: false,
    flyProgress: 0.0,
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

      // Base Martian surface albedo (HiRISE photo-drape on HTTP, procedural MRO hypsometric rock on file://)
      vec3 baseCol;
      if (u_hasBaseTex > 0.5) {
        baseCol = texture2D(u_baseTex, v_uv).rgb;
        // Boost warm Martian contrast slightly
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

      // Crisp 12-meter topographic contour isolines
      float contourFactor = 0.0;
      if (u_showContours > 0.5) {
        float cPhase = fract(v_relElevM / 12.0);
        float cLine = 1.0 - smoothstep(0.0, 0.055, min(cPhase, 1.0 - cPhase));
        contourFactor = cLine * 0.38;
      }
      baseCol = mix(baseCol, vec3(0.99, 0.86, 0.35), contourFactor);

      // Steep >25 deg cliff scarp subtle warning highlight
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

    baseTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, baseTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    sciTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, sciTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    builtTheaterKey = null;
    baseTexUrl = '';
    sciTexKey = '';
    return true;
  }

  function rebuildTerrainMeshIfNeeded(state) {
    const grid = window.ARES_ENGINE && window.ARES_ENGINE.getGrid ? window.ARES_ENGINE.getGrid() : null;
    if (!grid || !grid.length || !gl) return;
    if (builtTheaterKey === state.theaterKey && builtSepStorm === !!state.sepStormActive) return;

    const theater = window.ARES_THEATERS[state.theaterKey];
    baseElevRef = theater ? theater.baseElevM : -2185;
    const gh = grid.length;
    const gw = grid[0].length;
    const numVerts = gw * gh;

    const posArr = new Float32Array(numVerts * 3);
    const normArr = new Float32Array(numVerts * 3);
    const uvArr = new Float32Array(numVerts * 2);
    const metaArr = new Float32Array(numVerts * 3);

    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const idx = y * gw + x;
        const c = grid[y][x];
        const wx = (c.nx - 0.5) * 2.0;
        const wz = (c.ny - 0.5) * 1.36;
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

        uvArr[idx * 2 + 0] = c.nx;
        uvArr[idx * 2 + 1] = c.ny;

        metaArr[idx * 3 + 0] = clamp(c.slopeDeg / 35.0, 0, 1);
        metaArr[idx * 3 + 1] = clamp(c.crismIndex, 0, 1);
        metaArr[idx * 3 + 2] = clamp(c.thermalInertia / 465.0, 0, 1);
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

    if (url && url !== baseTexUrl) {
      let img = imgCache[url];
      if (!img) {
        img = new Image();
        img.onload = () => {
          baseTexUrl = '';
          if (requestRedraw) requestRedraw();
        };
        img.src = url;
        imgCache[url] = img;
      }
      if (img.complete && img.naturalWidth > 0) {
        try {
          gl.bindTexture(gl.TEXTURE_2D, baseTex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
          baseTexValid = true;
          baseTexUrl = url;
        } catch (_) {
          // Graceful procedural hypsometric fallback if strict file:// blocks texImage2D
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

    // Compute Camera Eye & Target (Orbit Table Mode vs Autonomous Canyon Fly-Through Mode)
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

    const proj = mat4Perspective((46 * Math.PI) / 180, w / h, 0.05, 14.0);
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
    // 4. 3D VECTOR HOLOGRAPHIC HUD OVERLAY (RIBBONS, CURTAINS, UHF, INGENUITY)
    // =========================================================================
    const ctx = hudCanvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const theater = window.ARES_THEATERS[state.theaterKey];
    if (!theater) {
      ctx.restore();
      return;
    }

    // 4A. Holographic Terrain Table Base Skirt Frame
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

    // Helper: Draw 3D terrain-draped polyline + optional vertical elevation curtain
    const draw3dRoute = (pts, liftY, lineCol, lineW, dashed, curtainCol) => {
      if (!pts || pts.length < 2) return;
      const screenUpper = [];
      const screenGround = [];
      for (let i = 0; i < pts.length; i += 2) {
        const wpt = normToWorld(pts[i].nx, pts[i].ny, state);
        const su = projectPoint(mvp, wpt.wx, wpt.wy + liftY, wpt.wz, w, h);
        const sg = projectPoint(mvp, wpt.wx, wpt.wy + 0.002, wpt.wz, w, h);
        if (su && sg) {
          screenUpper.push(su);
          screenGround.push(sg);
        }
      }
      if (screenUpper.length < 2) return;

      if (curtainCol) {
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
      screenUpper.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();

      ctx.strokeStyle = lineCol;
      ctx.lineWidth = lineW;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    };

    // 4B. 3D Walk-Back Safety Dome Perimeter on Surface
    const habWp = theater.waypoints[0];
    const stats = (state.routeResult && state.routeResult.stats) || {};
    if (habWp && stats.walkBackNormRx) {
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
        state.routingMode === 'rad_shelter'
          ? '#22c55e'
          : state.routingMode === 'direct'
          ? '#fb7185'
          : '#38bdf8';
      const cCol =
        state.routingMode === 'rad_shelter'
          ? 'rgba(34, 197, 94, 0.22)'
          : 'rgba(56, 189, 248, 0.22)';
      draw3dRoute(path, 0.022, aCol, contingency ? 2.0 : 3.2, null, contingency ? null : cCol);
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
        ctx.save();
        ctx.strokeStyle = uhfOk ? 'rgba(52, 211, 153, 0.72)' : 'rgba(192, 132, 252, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(pHabAnt.x, pHabAnt.y);
        ctx.lineTo(pEv1Ant.x, pEv1Ant.y);
        ctx.stroke();
        ctx.setLineDash([]);

        const mx = (pHabAnt.x + pEv1Ant.x) * 0.5;
        const my = (pHabAnt.y + pEv1Ant.y) * 0.5;
        ctx.font = '700 8.5px "JetBrains Mono", monospace';
        ctx.fillStyle = uhfOk ? '#6ee7b7' : '#e9d5ff';
        ctx.textAlign = 'center';
        ctx.fillText(
          uhfOk
            ? `401MHz UHF LOS (+${ev1Cell ? ev1Cell.uhfMarginDb : 24}dB)`
            : 'UHF RIDGE OCCLUSION',
          mx,
          my - 5
        );
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

        ctx.font = '700 9px "JetBrains Mono", monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(state.buddyFaultSim ? 'EV-1 (TOW FAULT)' : 'EV-1 LEAD', pEv1Ant.x, pEv1Ant.y - 11);
        ctx.restore();
      }
    }

    // 4E. 3D Hovering Ingenuity Helicopter + LiDAR Terrain Scan Cone
    if (state.ingenuityScoutActive) {
      const allWps = theater.waypoints.concat(state.customWaypoints || []);
      const tgtWp = allWps[allWps.length - 1] || theater.waypoints[0];
      const t = state.ingenuityPhase || 0;
      const lerp = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.4));
      const cNx = state._crewNx ?? habWp.x;
      const cNy = state._crewNy ?? habWp.y;
      const hNx = clamp(cNx + (tgtWp.x - cNx) * lerp - (tgtWp.y - cNy) * 0.14 * Math.cos(t * 2.8), 0.04, 0.96);
      const hNy = clamp(cNy + (tgtWp.y - cNy) * lerp + (tgtWp.x - cNx) * 0.14 * Math.cos(t * 2.8), 0.04, 0.96);

      const hSurf = normToWorld(hNx, hNy, state);
      const pHeli = projectPoint(mvp, hSurf.wx, hSurf.wy + 0.14, hSurf.wz, w, h);
      const pGnd = projectPoint(mvp, hSurf.wx, hSurf.wy + 0.004, hSurf.wz, w, h);
      if (pHeli && pGnd) {
        ctx.save();
        // Translucent 3D LiDAR Cone down to canyon surface
        const coneGrad = ctx.createLinearGradient(pHeli.x, pHeli.y, pGnd.x, pGnd.y);
        coneGrad.addColorStop(0, 'rgba(251, 191, 36, 0.48)');
        coneGrad.addColorStop(1, 'rgba(249, 115, 22, 0.08)');
        ctx.fillStyle = coneGrad;
        ctx.beginPath();
        ctx.moveTo(pHeli.x, pHeli.y);
        ctx.lineTo(pGnd.x - 26, pGnd.y);
        ctx.lineTo(pGnd.x + 26, pGnd.y);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(pGnd.x, pGnd.y, 26, 9, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Coaxial Rotor Disc
        ctx.strokeStyle = '#fde68a';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.ellipse(pHeli.x, pHeli.y - 4, 18, 5, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(pHeli.x - 4, pHeli.y - 3, 8, 7);

        ctx.font = '700 8.5px "JetBrains Mono", monospace';
        ctx.fillStyle = '#fde68a';
        ctx.textAlign = 'center';
        ctx.fillText('INGENUITY • 12m AGL LIDAR', pHeli.x, pHeli.y - 14);
        ctx.restore();
      }
    }

    // 4F. 3D Waypoint Pylons, Custom EVA Pins & Bi-Directional CapCom Target Diamond
    clickableBeacons = [];
    theater.waypoints.forEach((wp, idx) => {
      const wpt = normToWorld(wp.x, wp.y, state);
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
      : `JPL ONSIGHT 3D DEM TABLE (13,266 TRIS) • ${ltstFmt} • τ=${dustTau.toFixed(2)} • DRAG TO ORBIT / SCROLL ZOOM`;
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
      cam.pitchDeg = clamp(cam.pitchDeg + dy * 0.28, 12, 82);
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
        cam.distance = clamp(cam.distance * factor, 0.72, 3.6);
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
        cam.pitchDeg = clamp(cam.pitchDeg + dy * 0.28, 12, 82);
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
    if (cam.flyActive && cam.flyProgress >= 0.98) {
      cam.flyProgress = 0.0;
    }
    return cam.flyActive;
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
    const idx = opts.findIndex((v) => Math.abs(v - cam.vertExag) < 0.2);
    cam.vertExag = opts[(idx + 1) % opts.length];
    return cam.vertExag;
  }

  function resetCamera() {
    cam.flyActive = false;
    cam.yawDeg = -28;
    cam.pitchDeg = 44;
    cam.distance = 2.15;
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
    stepFly,
    cycleVertExag,
    resetCamera,
    invalidateTextures
  };
})();
