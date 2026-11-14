/**
 * ARES-NAV // Flight-Ready Martian GPS & xEVA Controller
 * Modes: 1. 360° Planet Mars (3D Orbital GPS) | 2. Surface GPS Map | 3. 360° Visor HUD | 4. Science Log
 */

(function () {
  const state = {
    theaterKey: 'jezero',
    activeMode: 'globe',           // 'globe' | 'map' | 'visor' | 'science'
    routingMode: 'optimal',        // 'optimal' | 'rad_shelter' | 'direct'
    selectedWaypointIdx: 2,
    customBasemapUrl: null,

    layers: {
      topoSlope: false,
      crismSpectral: false,
      thermalInertia: false,
      radiationWeather: false,
      m20Traverse: false
    },

    consumables: {
      o2Pct: 86,
      scrubberPct: 80,
      batteryPct: 90,
      muleAssisted: true
    },

    sepStormActive: false,
    emergencyAbortActive: false,
    emergencyProgress: 0,
    emergencyOrigin: null,

    // Map Pan/Zoom, 3D Holographic Terrain, Bi-Directional CapCom Mark, LTST/Dust τ, Buddy Rule & Walk Sim
    zoom: 1.0,
    panX: 0,
    panY: 0,
    isDraggingMap: false,
    dragStartX: 0,
    dragStartY: 0,
    simRunning: false,
    traverseProgress: 0.36,
    plotPinMode: false,
    capcomMarkMode: false,
    capcomTarget: null,
    terrain3dActive: false,
    ltstHour: 13.5,
    dustTau: 0.42,
    visorSyntheticVision: false,
    buddyFaultSim: false,
    customWaypoints: [],
    ingenuityScoutActive: false,
    ingenuityPhase: 0,
    hoverProbe: null,
    scrubScope: 'rim',             // 'rim' | 'full'
    scrubGpsCoord: null,

    // Visor Panorama 360°, 3D Goggles, Gyro & SuperCam LIBS Laser State
    visorSourceMode: 'pano',
    visorFilterMode: 'natural',
    vrGogglesMode: false,
    gyroActive: false,
    gyroYawOffset: 0,
    gyroPitchZero: 0,
    _gyroCalibrated: false,
    _rawCompassHeading: null,
    hideArPins: false,
    dockTab: 'station',
    customHudImage: null,
    customHudTitle: null,
    customHudBadge: null,
    hudYawDeg: 110,
    hudPitchOffset: 0,
    hudZoom: 1.0,
    hudDecluttered: false,
    isDraggingHud: false,
    hudDragStartX: 0,
    hudDragStartY: 0,
    laserAimMode: false,
    laserPulseFrames: 0,
    laserResultActive: false,
    laserFiredAtMs: 0,
    laserTargetX: 0.5,
    laserTargetY: 0.5,
    lastLaserOxides: null,
    lastLaserBiosig: 91,
    lastLaserRockName: '',
    lastLaserMeta: '',
    suitVoiceEnabled: false,
    voiceCmdActive: false,
    drawerMode: 'elev',

    // CapCom Live Wi-Fi Telemetry Link State
    capcomRole: 'mc',
    capcomLinked: false,

    // Logged Samples
    loggedSamples: [
      {
        id: 'SMP-01',
        stationCode: 'WP-02',
        theater: 'Gale Crater (PIA26696)',
        name: 'Boxwork Cemented Fracture Core #01',
        mineral: 'Cemented Sulfate-Silica Vein',
        sol: 'Sol 4462',
        coords: '5.0794°S, 137.8558°E',
        thumb: 'assets/optimized/PIA26696_mount_sharp_boxwork_thumb.webp',
        notes: 'Polygonal boxwork ridge core capturing diagenetic fluid suture.'
      },
      {
        id: 'SMP-02',
        stationCode: 'WP-02',
        theater: 'Jezero Site 093',
        name: 'Bright Angel Hydrated Vein Core #2023-A',
        mineral: 'Hydrated Silica & Smectite Clay',
        sol: 'Sol 2023',
        coords: '18.3874°N, 77.5849°E',
        thumb: 'assets/optimized/m2020_sol2023_sherloc_watson_micro_thumb.webp',
        notes: 'Paired with SHERLOC ACI sequence N0930000SRLC02503.'
      }
    ],
    checkedSteps: {},
    edrFilter: 'ALL',
    routeResult: { path: [], profile: [], stats: {} }
  };

  window.ARES_STATE = state;

  function speakSuitVoice(message) {
    if (!state.suitVoiceEnabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(message);
      utter.rate = 1.06;
      utter.pitch = 0.95;
      utter.volume = 0.9;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      // Ignore speech synthesis errors on restricted contexts
    }
  }

  let audioCtx = null;
  function playLaserAcousticSnap() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const dur = 0.085;
      const buf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * dur), audioCtx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const env = Math.exp(-i / (audioCtx.sampleRate * 0.012));
        data[i] = (Math.random() * 2 - 1) * env;
      }

      const src = audioCtx.createBufferSource();
      src.buffer = buf;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1850;
      filter.Q.value = 1.8;

      const gain = audioCtx.createGain();
      gain.gain.value = 0.65;

      src.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      src.start();
    } catch (e) {
      // Ignore audio errors
    }
  }

  const LIBS_ROCK_PROFILES = [
    {
      name: 'FERRUGINOUS MUDSTONE BEDROCK',
      mineral: 'Authigenic Ferric-Silica Mudstone',
      oxides: { SiO2: 52.8, FeOT: 19.4, MgO: 8.6, Al2O3: 9.2, SO3: 7.4 },
      baseBiosig: 93
    },
    {
      name: 'CA-SULFATE DIAGENETIC VEIN',
      mineral: 'Hydrated Bassanite / Gypsum Fracture Vein',
      oxides: { SiO2: 31.4, FeOT: 6.8, MgO: 4.2, Al2O3: 3.9, SO3: 38.6 },
      baseBiosig: 96
    },
    {
      name: 'OLIVINE-CARBONATE CUMULATE',
      mineral: 'Magnesite-Olivine Altered Lakebed Margin',
      oxides: { SiO2: 41.2, FeOT: 22.6, MgO: 19.8, Al2O3: 5.4, SO3: 3.1 },
      baseBiosig: 84
    },
    {
      name: 'SMECTITE CLAY & SILICA NODULE',
      mineral: 'Fe/Mg Phyllosilicate with Redox Reaction Rim',
      oxides: { SiO2: 61.5, FeOT: 11.2, MgO: 7.9, Al2O3: 12.8, SO3: 5.2 },
      baseBiosig: 97
    },
    {
      name: 'VESICULAR BASALTIC FLOAT ROCK',
      mineral: 'Pyroxene-Plagioclase Igneous Caprock',
      oxides: { SiO2: 47.9, FeOT: 17.5, MgO: 11.4, Al2O3: 10.6, SO3: 2.2 },
      baseBiosig: 68
    }
  ];

  function broadcastVisorTelemetry(laserEventPayload) {
    if (window.ARES_CAPCOM && state.capcomRole === 'visor') {
      window.ARES_CAPCOM.publishState(state, laserEventPayload || null);
    }
  }

  function broadcastMcDirective(directiveObj) {
    if (window.ARES_CAPCOM && state.capcomRole === 'mc') {
      window.ARES_CAPCOM.publishMcDirective(directiveObj, state.theaterKey);
    }
  }

  function playQuindarTone(isIntro) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = isIntro ? 2525 : 2475; // Authentic NASA Apollo/Artemis CapCom PTT Quindar Tone
      g.gain.setValueAtTime(0.001, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.18, audioCtx.currentTime + 0.012);
      g.gain.setValueAtTime(0.18, audioCtx.currentTime + 0.145);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.175);
      osc.connect(g);
      g.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.18);
    } catch (e) {}
  }

  function formatLtst(hrVal) {
    const hNum = typeof hrVal === 'number' ? hrVal : 13.5;
    const hh = Math.floor(hNum);
    const mm = Math.round((hNum - hh) * 60) % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  function getCurrentCrewNormPos() {
    const path = (state.routeResult && state.routeResult.path) || [];
    if (path.length >= 2) {
      const fIdx = Math.max(0, Math.min(1, state.traverseProgress || 0)) * (path.length - 1);
      const i0 = Math.floor(fIdx);
      const i1 = Math.min(path.length - 1, i0 + 1);
      const t = fIdx - i0;
      return {
        nx: path[i0].nx + (path[i1].nx - path[i0].nx) * t,
        ny: path[i0].ny + (path[i1].ny - path[i0].ny) * t
      };
    }
    const theater = window.ARES_THEATERS[state.theaterKey];
    const wp = (theater && theater.waypoints[state.selectedWaypointIdx]) || { x: 0.5, y: 0.5 };
    return { nx: wp.x, ny: wp.y };
  }

  function fireLaserAt(normX, normY, isRemoteTrigger) {
    const theater = window.ARES_THEATERS[state.theaterKey];
    const wp = theater.waypoints[state.selectedWaypointIdx] || theater.waypoints[0];
    state.laserTargetX = Math.max(0.08, Math.min(0.92, normX));
    state.laserTargetY = Math.max(0.12, Math.min(0.86, normY));
    state.laserPulseFrames = 65;
    state.laserResultActive = true;
    state.laserFiredAtMs = Date.now();

    // Pick a distinct geological target profile based on world azimuth + aim point
    const worldAz = Math.round((state.hudYawDeg + (normX - 0.5) * 90 + 360) % 360);
    const elevDeg = +((0.5 - normY) * 42).toFixed(1);
    const rangeM = +(2.1 + Math.max(0, (0.88 - normY) * 5.4)).toFixed(1);
    const profileIdx =
      Math.abs(Math.floor(worldAz / 28) + Math.floor(normX * 13) + Math.floor(normY * 19)) %
      LIBS_ROCK_PROFILES.length;
    const prof = LIBS_ROCK_PROFILES[profileIdx];
    const micro = Math.sin(normX * 57.3 + normY * 83.1 + state.hudYawDeg * 0.17);

    state.lastLaserRockName = prof.name;
    state.lastLaserMineral = prof.mineral;
    state.lastLaserMeta = `AZ ${String(worldAz).padStart(3, '0')}° • EL ${elevDeg >= 0 ? '+' : ''}${elevDeg}° • RANGE ${rangeM}m • ${prof.mineral.toUpperCase()}`;
    state.lastLaserOxides = {
      SiO2: +(prof.oxides.SiO2 + micro * 1.9).toFixed(1),
      FeOT: +(prof.oxides.FeOT - micro * 1.4).toFixed(1),
      MgO: +(prof.oxides.MgO + micro * 1.1).toFixed(1),
      Al2O3: +(prof.oxides.Al2O3 - micro * 0.7).toFixed(1),
      SO3: +(prof.oxides.SO3 + micro * 1.6).toFixed(1)
    };
    state.lastLaserBiosig = Math.min(99, Math.max(62, Math.round(prof.baseBiosig + micro * 3)));

    playLaserAcousticSnap();
    speakSuitVoice(
      `SuperCam LIBS target: ${prof.name}. Silica ${state.lastLaserOxides.SiO2} percent. Sulfate ${state.lastLaserOxides.SO3} percent. Biosignature index ${state.lastLaserBiosig} percent.`
    );
    if (!isRemoteTrigger) {
      broadcastVisorTelemetry({
        id: 'lz_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        normX: state.laserTargetX,
        normY: state.laserTargetY,
        rockName: state.lastLaserRockName
      });
    }
    requestRedraw();
  }

  function recomputeRoute() {
    window.ARES_ENGINE.buildTerrainGrid(state.theaterKey, state.sepStormActive);
    const emergencyArg =
      state.emergencyAbortActive && state.emergencyOrigin
        ? {
            active: true,
            startNx: state.emergencyOrigin.nx,
            startNy: state.emergencyOrigin.ny
          }
        : null;
    state.routeResult = window.ARES_ENGINE.computeTraverseRoute(
      state.theaterKey,
      state.routingMode,
      state.consumables,
      state.sepStormActive,
      state.customWaypoints,
      emergencyArg,
      {
        ltstHour: state.ltstHour,
        dustTau: state.dustTau,
        buddyFaultSim: state.buddyFaultSim
      }
    );
    syncAllUI();
    const dr = document.getElementById('elevProfileDrawer');
    if (dr && !dr.classList.contains('hidden')) {
      renderElevProfile();
    }
    requestRedraw();
  }

  function setTheater(theaterKey) {
    if (!window.ARES_THEATERS[theaterKey]) return;
    state.theaterKey = theaterKey;
    state.selectedWaypointIdx = 2;
    state.customHudImage = null;
    state.customBasemapUrl = null;
    state.customWaypoints = [];
    state.capcomTarget = null;
    state.zoom = 1.0;
    state.panX = 0;
    state.panY = 0;
    const clrBtn = document.getElementById('btnClearPins');
    if (clrBtn) clrBtn.classList.add('hidden');
    if (window.ARES_TERRAIN3D) {
      window.ARES_TERRAIN3D.invalidateTextures();
    }
    const theater = window.ARES_THEATERS[theaterKey];
    const wp = theater.waypoints[2];
    state.hudYawDeg = wp ? wp.hudHeadingDeg : 110;
    state.hudPitchOffset = 0;
    state.hudZoom = 1.0;

    if (window.ARES_GLOBE) {
      window.ARES_GLOBE.focusLatLon(theater.baseLat, theater.baseLon);
    }

    const sel = document.getElementById('theaterSelect');
    if (sel && sel.value !== theaterKey) sel.value = theaterKey;

    recomputeRoute();
  }

  function setBasemapVariant(url) {
    state.customBasemapUrl = url;
    if (window.ARES_TERRAIN3D) {
      window.ARES_TERRAIN3D.invalidateTextures();
    }
    syncAllUI();
    requestRedraw();
  }

  function setMode(mode) {
    if (mode !== 'visor' && state.vrGogglesMode && window.ARES_APP && window.ARES_APP.toggleVrGogglesMode) {
      window.ARES_APP.toggleVrGogglesMode();
    }
    state.activeMode = mode;
    ['globe', 'map', 'visor', 'science'].forEach((m) => {
      const view = document.getElementById(`view_${m}`);
      const tab = document.getElementById(`tab_${m}`);
      if (view) view.classList.toggle('hidden', m !== mode);
      if (tab) tab.classList.toggle('active', m === mode);
    });

    if (mode === 'map') {
      ensureDefault3dViewersMounted();
    }
    if (mode === 'science') {
      renderScienceAndManifest();
    }
    requestRedraw();
  }

  function selectWaypoint(idx) {
    const theater = window.ARES_THEATERS[state.theaterKey];
    const clamped = Math.max(0, Math.min(theater.waypoints.length - 1, idx));
    state.selectedWaypointIdx = clamped;
    state.customHudImage = null;
    state.laserResultActive = false;
    if (!state.simRunning && theater.waypoints.length > 1) {
      state.traverseProgress = clamped / (theater.waypoints.length - 1);
    }
    const wp = theater.waypoints[clamped];
    if (wp) {
      state.hudYawDeg = wp.hudHeadingDeg;
      state.hudPitchOffset = 0;
      speakSuitVoice(
        `Waypoint ${wp.code} selected. ${wp.name}. Slope ${wp.slopeDeg} degrees.`
      );
    }
    syncAllUI();
    broadcastVisorTelemetry();
    requestRedraw();
  }

  function toggleLayer(layerKey) {
    state.layers[layerKey] = !state.layers[layerKey];
    syncAllUI();
    requestRedraw();
  }

  function cycleLayers() {
    const presets = [
      { topoSlope: false, crismSpectral: false, thermalInertia: false, radiationWeather: false, m20Traverse: false },
      { topoSlope: true, crismSpectral: false, thermalInertia: false, radiationWeather: false, m20Traverse: true },
      { topoSlope: false, crismSpectral: true, thermalInertia: false, radiationWeather: true, m20Traverse: true },
      { topoSlope: true, crismSpectral: true, thermalInertia: true, radiationWeather: true, m20Traverse: true }
    ];
    state._presetIdx = ((state._presetIdx || 0) + 1) % presets.length;
    state.layers = Object.assign({}, presets[state._presetIdx]);
    syncAllUI();
    requestRedraw();
  }

  function setVisorSource(srcMode) {
    state.visorSourceMode = srcMode;
    state.customHudImage = null;
    ['pano', 'butler360', 'vert50m', 'closeup', 'alt'].forEach((k) => {
      const btn = document.getElementById(`visorSrc_${k}`);
      if (btn) {
        btn.className =
          k === srcMode
            ? 'px-2 py-1 rounded text-[10px] font-mono-tech font-bold bg-orange-600 text-white transition'
            : 'px-2 py-1 rounded text-[10px] font-mono-tech font-semibold text-stone-300 hover:text-white bg-[#1c1917] border border-[#3f3a36] transition';
      }
    });
    requestRedraw();
  }

  function toggleDeclutter() {
    state.hudDecluttered = !state.hudDecluttered;
    if (state.hudDecluttered) state.laserResultActive = false;
    const visorContainer = document.getElementById('view_visor');
    if (visorContainer) {
      visorContainer.classList.toggle('hud-decluttered', state.hudDecluttered);
    }
    const btn = document.getElementById('btnDeclutter');
    if (btn) {
      btn.textContent = state.hudDecluttered ? 'RESTORE [SPACE]' : 'DECLUTTER [SPACE]';
      btn.classList.toggle('bg-orange-600', state.hudDecluttered);
      btn.classList.toggle('text-white', state.hudDecluttered);
    }
    requestRedraw();
  }

  function logCurrentStationSample() {
    const theater = window.ARES_THEATERS[state.theaterKey];
    const wp = theater.waypoints[state.selectedWaypointIdx];
    if (!wp) return;

    const newId = `SMP-0${state.loggedSamples.length + 1}`;
    state.loggedSamples.unshift({
      id: newId,
      stationCode: wp.code,
      theater: theater.shortName,
      name: `${wp.name} Core Sample`,
      mineral: wp.crismMineral,
      sol: wp.metaBadge.sol,
      coords: wp.metaBadge.coords,
      thumb: wp.thumbUrl,
      notes: wp.outcropNotes
    });

    const btn = document.getElementById('btnLogSample');
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = '✓ SAMPLE LOGGED';
      btn.classList.add('bg-emerald-600', 'text-white');
      setTimeout(() => {
        btn.innerHTML = orig;
        btn.classList.remove('bg-emerald-600', 'text-white');
      }, 1400);
    }
    syncAllUI();
  }

  function syncAllUI() {
    const theater = window.ARES_THEATERS[state.theaterKey];
    const wp = theater.waypoints[state.selectedWaypointIdx] || theater.waypoints[0];
    const nextWp =
      theater.waypoints[Math.min(theater.waypoints.length - 1, state.selectedWaypointIdx + 1)];
    const stats = state.routeResult.stats || {};
    const contingency = state.routeResult.contingency;
    const weather = theater.medaWeather;

    const isShelteredNow =
      state.emergencyAbortActive && contingency && (state.emergencyProgress || 0) >= 0.98;
    const unshieldedRad = state.sepStormActive ? +(wp.radMsvHr * 4.5).toFixed(3) : wp.radMsvHr;
    const liveRadMsv = isShelteredNow
      ? +(unshieldedRad * (1 - (contingency.shieldingPct || 74) / 100)).toFixed(3)
      : unshieldedRad;

    // Header Status Pill
    document.getElementById('hdrSolBadge').textContent = wp.metaBadge.sol;
    document.getElementById('hdrO2Badge').textContent = `O₂ ${state.consumables.o2Pct}%`;
    const hdrRad = document.getElementById('hdrRadBadge');
    if (hdrRad) {
      hdrRad.textContent = isShelteredNow
        ? `${liveRadMsv} mSv/hr (SHIELDED)`
        : `${liveRadMsv} mSv/hr`;
      hdrRad.className = isShelteredNow
        ? 'text-amber-300 font-bold hidden 2xl:inline'
        : state.sepStormActive
        ? 'text-red-400 font-bold animate-pulse hidden 2xl:inline'
        : 'text-emerald-400 font-semibold hidden 2xl:inline';
    }

    // Routing Mode Selector Sync
    const rmSel = document.getElementById('routingModeSelect');
    if (rmSel && rmSel.value !== state.routingMode) {
      rmSel.value = state.routingMode;
    }
    const chkMule = document.getElementById('chkMuleAssist');
    if (chkMule) chkMule.checked = !!state.consumables.muleAssisted;
    const rngO2 = document.getElementById('rngO2');
    if (rngO2) rngO2.value = state.consumables.o2Pct;

    // Turn-by-Turn GPS Banner & Emergency Contingency Readout on Surface Map
    const legDistM = Math.round(
      Math.hypot((nextWp.x - wp.x) * 1600, (nextWp.y - wp.y) * 1088)
    );
    const legEtaMin = Math.max(2, Math.round(legDistM / 52));
    const gpsNextEl = document.getElementById('gpsTurnInstruction');
    const cautionTxt = document.getElementById('cautionStatusText');
    if (state.emergencyAbortActive && contingency) {
      const remM = Math.max(0, Math.round(contingency.distToShelterM * (1 - (state.emergencyProgress || 0))));
      if (isShelteredNow) {
        if (gpsNextEl) {
          gpsNextEl.textContent = `✓ SHELTERED AT ${contingency.shelterCode} (-${contingency.shieldingPct}% SEP DOSE) • STAGE 2 HAB-01 WALK-BACK (${contingency.distShelterToHabM}m) READY`;
        }
        if (cautionTxt) {
          cautionTxt.textContent = `CREW SAFE INSIDE ${contingency.shelterCode} BASALT OVERHANG (-${contingency.shieldingPct}% PROTON FLUX) • AWAITING SOLAR DECAY FOR HAB-01 WALK-BACK`;
        }
      } else {
        if (gpsNextEl) {
          gpsNextEl.textContent = `⚠ EMERGENCY SPRINT ${remM}m → ${contingency.shelterCode} ${contingency.shelterName.toUpperCase()} (${contingency.etaShelterMin} MIN ETA)`;
        }
        if (cautionTxt) {
          cautionTxt.textContent = `SUIT O₂ REGULATOR LEAK + SEP STORM • DIVERTING ${remM}m TO ${contingency.shelterCode} SHELTER (-${contingency.shieldingPct}% DOSE), THEN HAB-01`;
        }
      }
    } else if (gpsNextEl) {
      gpsNextEl.textContent =
        wp.id === nextWp.id
          ? `ARRIVED AT FINAL OVERLOOK (${wp.code}) • PREPARE WALK-BACK`
          : `PROCEED ${legDistM}m HDG ${String(wp.hudHeadingDeg).padStart(3, '0')}° → ${nextWp.code} (${legEtaMin} MIN ETA)`;
    }

    // Layer Pills
    Object.keys(state.layers).forEach((k) => {
      const pill = document.getElementById(`pill_${k}`);
      if (pill) pill.classList.toggle('active', state.layers[k]);
    });

    // Basemap Variant Dropdown Selector
    const bmSelect = document.getElementById('basemapSelect');
    if (bmSelect && theater.basemapVariants) {
      const activeUrl = state.customBasemapUrl || theater.basemapImg;
      bmSelect.innerHTML = theater.basemapVariants
        .map(
          (v) =>
            `<option value="${v.url}" ${v.url === activeUrl ? 'selected' : ''}>${v.label}</option>`
        )
        .join('');
    }

    // Map Right Dock
    document.getElementById('dockStationCode').textContent = wp.code;
    document.getElementById('dockStationName').textContent = wp.name;
    document.getElementById('dockPhoto').src = wp.photoUrl;
    document.getElementById('dockMetaInstrument').textContent = wp.metaBadge.instrument;
    document.getElementById('dockMetaSol').textContent = wp.metaBadge.sol;
    document.getElementById('dockMetaSite').textContent = wp.metaBadge.siteDrive;
    document.getElementById('dockMetaCoords').textContent = wp.metaBadge.coords;
    document.getElementById('dockMineral').textContent = wp.crismMineral;
    document.getElementById('dockSlope').textContent = `${wp.slopeDeg}° (${wp.slopeDeg >= 15 ? 'CAUTION' : 'SAFE'})`;
    document.getElementById('dockTi').textContent = `${wp.thermalInertia} TIU`;
    document.getElementById('dockNotes').textContent = wp.outcropNotes;

    const stepper = document.getElementById('waypointStepper');
    if (stepper) {
      stepper.innerHTML = theater.waypoints
        .map((wItem, idx) => {
          const active = idx === state.selectedWaypointIdx;
          return `
            <button
              onclick="window.ARES_APP.selectWaypoint(${idx})"
              class="flex-1 py-1.5 px-1 rounded text-center font-mono-tech text-xs font-bold border transition ${
                active
                  ? 'bg-orange-600 text-white border-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.35)]'
                  : 'bg-[#141210] text-stone-300 border-[#292524] hover:border-[#44403c]'
              }"
            >
              ${wItem.code}
            </button>
          `;
        })
        .join('');
    }

    document.getElementById('lblO2').textContent = `${state.consumables.o2Pct}%`;
    document.getElementById('lblScrubber').textContent = `${state.consumables.scrubberPct}%`;
    document.getElementById('lblBattery').textContent = `${state.consumables.batteryPct}%`;
    document.getElementById('lblAbortRadius').textContent = `${stats.walkBackRadiusM}m (${stats.limitingSource})`;
    document.getElementById('lblRouteStats').textContent = `${stats.totalDistM}m • ${stats.totalMissionMin} min • ${stats.metabolicRateKcalHr} kcal/hr`;

    // Live Astronaut Biometrics & Walk-Back Reserve Margin (Sensitive to 0.38g Mule Assist & Slope)
    const slopeFactor = Math.max(0, wp.slopeDeg || 6);
    const stormBoost = state.sepStormActive ? (isShelteredNow ? 6 : 18) : 0;
    const simBoost = state.simRunning ? 12 : 0;
    const muleRelief = state.consumables.muleAssisted ? 0 : 19;
    const liveHrBpm = Math.min(168, Math.round(76 + slopeFactor * 2.3 + stormBoost + simBoost + muleRelief));
    const liveO2Lpm = +(
      0.64 +
      slopeFactor * 0.036 +
      (state.simRunning ? 0.14 : 0) +
      (state.consumables.muleAssisted ? 0 : 0.28)
    ).toFixed(2);
    const walkBackMaxM = stats.walkBackRadiusM || 1200;
    const distToHabM =
      state._liveDistToHabM !== undefined
        ? state._liveDistToHabM
        : Math.round(Math.hypot((wp.x - theater.waypoints[0].x) * 1600, (wp.y - theater.waypoints[0].y) * 1088));
    const marginPct = Math.round(((walkBackMaxM - distToHabM) / Math.max(1, walkBackMaxM)) * 100);

    const hrEl = document.getElementById('lblBioHr');
    if (hrEl) hrEl.textContent = `${liveHrBpm} BPM`;
    const o2RateEl = document.getElementById('lblBioO2Rate');
    if (o2RateEl) o2RateEl.textContent = `${liveO2Lpm} L/m`;
    const marginEl = document.getElementById('lblBioMargin');
    if (marginEl) {
      marginEl.textContent = marginPct >= 0 ? `+${marginPct}% SAFE` : `${marginPct}% OVER`;
      marginEl.className =
        marginPct < 20
          ? 'text-red-400 font-extrabold animate-pulse'
          : marginPct < 40
          ? 'text-amber-300 font-bold'
          : 'text-emerald-400 font-bold';
    }

    // MEDA Weather, Solar LTST & Dust Optical Depth (τ) Badges + Dual-Crew Buddy Status
    const ltstStr = formatLtst(state.ltstHour);
    const dayPhase = Math.max(0, Math.min(1, ((state.ltstHour || 13.5) - 5.5) / 14.0));
    const liveAirTempC = Math.round(-72 + Math.sin(dayPhase * Math.PI) * 54 - (state.dustTau > 1.5 ? 6 : 0));
    const tauNum = +(state.dustTau || 0.42).toFixed(2);
    const mapMeda = document.getElementById('mapMedaBadge');
    if (mapMeda && weather) {
      mapMeda.textContent = `LTST ${ltstStr} • ${liveAirTempC}°C • ${weather.pressureMbar} mbar • τ ${tauNum}`;
    }
    const visorMeda = document.getElementById('visorMedaLine');
    if (visorMeda && weather) {
      visorMeda.textContent = `LTST ${ltstStr} • ${liveAirTempC}°C • ${weather.pressureMbar} mbar • Wind ${weather.windSpeedMps} m/s • τ=${tauNum} • ${liveRadMsv} mSv/hr`;
    }
    const lblLtst = document.getElementById('lblLtstVal');
    if (lblLtst) lblLtst.textContent = ltstStr;
    const rngLtst = document.getElementById('rngLtst');
    if (rngLtst && Math.abs(Number(rngLtst.value) - state.ltstHour) > 0.05) {
      rngLtst.value = String(state.ltstHour);
    }
    const lblTau = document.getElementById('lblDustTauVal');
    if (lblTau) {
      const tier = tauNum >= 2.4 ? 'WHITEOUT' : tauNum >= 1.3 ? 'HAZE' : 'CLEAR';
      lblTau.textContent = `${tauNum.toFixed(2)} (${tier})`;
    }
    const rngTau = document.getElementById('rngDustTau');
    if (rngTau && Math.abs(Number(rngTau.value) - state.dustTau) > 0.02) {
      rngTau.value = String(state.dustTau);
    }

    const buddyCheck = state.routeResult && state.routeResult.buddyCheck;
    const buddyBadge = document.getElementById('lblBuddySafetyBadge');
    if (buddyBadge && buddyCheck) {
      if (state.buddyFaultSim) {
        buddyBadge.textContent = buddyCheck.buddyTowSafe
          ? `⚠ EV-2 TOW ACTIVE • END O₂ ${buddyCheck.endBuddyTowO2Pct}% (>15% SAFE)`
          : `⚠ EV-2 TOW REDLINE BREACH • END O₂ ${buddyCheck.endBuddyTowO2Pct}% (<15%!)`;
        buddyBadge.className = buddyCheck.buddyTowSafe
          ? 'px-2 py-0.5 rounded bg-amber-950/90 border border-amber-400 text-amber-200 font-extrabold'
          : 'px-2 py-0.5 rounded bg-red-950/95 border border-red-500 text-red-200 font-extrabold animate-pulse';
      } else {
        buddyBadge.textContent = `EV-1 + EV-2 TETHER (26m) • TOW MARGIN ${buddyCheck.endBuddyTowO2Pct}% O₂`;
        buddyBadge.className =
          'px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-extrabold';
      }
    }

    // Visor Panorama Peripheral Readouts
    document.getElementById('visorTitle').textContent =
      state.customHudTitle || `${wp.code}: ${wp.name}`;
    document.getElementById('visorMetaBadge').textContent =
      state.customHudBadge ||
      `Instrument: ${wp.metaBadge.instrument} | ${wp.metaBadge.sol} | ${wp.metaBadge.siteDrive} | ${wp.metaBadge.coords}`;

    document.getElementById('visorO2').textContent = `${state.consumables.o2Pct}%`;
    document.getElementById('visorScrubber').textContent = `${state.consumables.scrubberPct}%`;
    document.getElementById('visorBattery').textContent = `${state.consumables.batteryPct}%`;
    document.getElementById('visorAbort').textContent = `${stats.walkBackRadiusM}m`;

    const sampleCountBadge = document.getElementById('sampleCountBadge');
    if (sampleCountBadge) sampleCountBadge.textContent = state.loggedSamples.length;
  }

  function renderScienceAndManifest() {
    const theater = window.ARES_THEATERS[state.theaterKey];
    const wp = theater.waypoints[state.selectedWaypointIdx] || theater.waypoints[0];

    const logEl = document.getElementById('sampleLogContainer');
    if (logEl) {
      logEl.innerHTML = state.loggedSamples
        .map(
          (smp) => `
          <div class="bg-[#1c1917] border border-[#292524] rounded-lg p-3 flex items-start gap-3">
            <img src="${smp.thumb}" alt="${smp.id}" class="w-16 h-14 object-cover rounded border border-[#3f3a36] flex-shrink-0" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-2">
                <span class="font-mono-tech text-xs font-bold text-emerald-400">${smp.id} • ${smp.stationCode}</span>
                <span class="font-mono-tech text-[10px] text-stone-400">${smp.sol} | ${smp.coords}</span>
              </div>
              <div class="text-sm font-bold text-stone-100 mt-0.5">${smp.name}</div>
              <div class="text-xs text-orange-400 font-mono-tech">${smp.mineral}</div>
              <p class="text-xs text-stone-400 mt-1 leading-snug">${smp.notes}</p>
            </div>
          </div>
        `
        )
        .join('');
    }

    const protoEl = document.getElementById('sciProtocolList');
    if (protoEl) {
      protoEl.innerHTML = wp.samplingProtocol
        .map((step, idx) => {
          const k = `${wp.id}_${idx}`;
          const done = !!state.checkedSteps[k];
          return `
            <label class="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#1c1917] border border-[#292524] hover:border-[#3f3a36] cursor-pointer text-xs">
              <input
                type="checkbox"
                ${done ? 'checked' : ''}
                onchange="window.ARES_APP.toggleStep('${k}')"
                class="mt-0.5 w-4 h-4 accent-orange-500"
              />
              <span class="${done ? 'line-through text-stone-500' : 'text-stone-200'}">${step}</span>
            </label>
          `;
        })
        .join('');
    }

    const oxEl = document.getElementById('sciOxidesGrid');
    if (oxEl) {
      oxEl.innerHTML = Object.entries(wp.oxides)
        .map(
          ([ox, val]) => `
          <div class="bg-[#1c1917] border border-[#292524] rounded-lg p-2.5">
            <div class="flex justify-between font-mono-tech text-xs">
              <span class="text-stone-400 font-bold">${ox}</span>
              <span class="text-orange-400 font-extrabold">${val}%</span>
            </div>
            <div class="w-full h-1.5 bg-[#292524] rounded overflow-hidden mt-1.5">
              <div class="h-full bg-orange-500" style="width:${Math.min(100, val * 1.8)}%"></div>
            </div>
          </div>
        `
        )
        .join('');
    }

    const manifest = window.MISSION_MANIFEST;
    if (!manifest || !manifest.images) return;

    const filtered = manifest.images.filter((img) => {
      if (state.edrFilter === 'ALL') return true;
      const sub = (img.metadata && img.metadata.subsystem_code) || '';
      if (state.edrFilter === 'CURIOSITY') {
        return ['MASTCAM', 'MASTCAM_PANO', 'HIRISE_DEM', 'CRISM'].includes(sub);
      }
      return sub === state.edrFilter;
    });

    document.getElementById('manifestCountLabel').textContent =
      `Showing ${filtered.length} of ${manifest.summary.total_files_indexed} Real Local NASA Files (${manifest.summary.total_original_mb} MB Raw -> ${manifest.summary.total_optimized_mb} MB WebP)`;

    const gridEl = document.getElementById('manifestImageGrid');
    if (gridEl) {
      gridEl.innerHTML = filtered
        .slice(0, 120)
        .map((item) => {
          const m = item.metadata || {};
          const badge = `${m.instrument_label || m.subsystem_code || 'NASA'} | Sol ${m.sol || 'N/A'} | ${m.site_drive || ''}`;
          const coords = m.coords || '';
          const panoPath = item.pano_webp || item.thumb_webp;
          return `
            <div
              onclick="window.ARES_APP.inspectManifestImage('${panoPath}', '${(m.title || item.filename).replace(/'/g, '')}', '${badge} | ${coords}')"
              class="bg-[#1c1917] border border-[#292524] hover:border-orange-500 rounded-lg overflow-hidden cursor-pointer transition group flex flex-col"
            >
              <div class="relative h-36 bg-[#0c0a09] overflow-hidden">
                <img src="${item.thumb_webp}" loading="lazy" alt="${item.filename}" class="w-full h-full object-cover group-hover:scale-105 transition" />
                <span class="absolute top-1.5 left-1.5 px-2 py-0.5 rounded bg-[#141210]/95 border border-orange-500/50 font-mono-tech text-[10px] font-bold text-orange-300">
                  ${m.subsystem_code || 'EDR'}
                </span>
                <span class="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-[#141210]/95 font-mono-tech text-[9px] text-amber-300">
                  Sol ${m.sol || '—'}
                </span>
              </div>
              <div class="p-2.5 flex-1 flex flex-col justify-between">
                <div>
                  <div class="text-xs font-bold text-stone-100 truncate" title="${m.title || item.filename}">${m.title || item.filename}</div>
                  <div class="text-[10px] font-mono-tech text-stone-400 truncate mt-0.5">${item.filename}</div>
                </div>
                <div class="text-[10px] font-mono-tech text-orange-400/90 mt-2 pt-1.5 border-t border-[#292524] truncate">
                  ${m.site_drive || 'Planetary'} • ${coords}
                </div>
              </div>
            </div>
          `;
        })
        .join('');
    }
  }

  function setupEvents() {
    // Bind 3D Planet Globe Events (with Smooth Google-Earth Descent Animation)
    if (window.ARES_GLOBE) {
      window.ARES_GLOBE.bindGlobeEvents(
        document.getElementById('globeHudCanvas'),
        (sectorId) => {
          window.ARES_APP.descendToSector(sectorId);
        }
      );
    }

    // Bind Map Canvas Interactions (Drag ALWAYS enabled + Click-to-Plot Custom GPS Pins + Zoom)
    const mapCanvas = document.getElementById('gisMapCanvas');
    let mapDownClientX = 0;
    let mapDownClientY = 0;
    if (mapCanvas) {
      mapCanvas.addEventListener('mousedown', (e) => {
        mapDownClientX = e.clientX;
        mapDownClientY = e.clientY;
        state.isDraggingMap = true;
        state.dragStartX = e.clientX - state.panX;
        state.dragStartY = e.clientY - state.panY;
      });

      mapCanvas.addEventListener('mousemove', (e) => {
        if (state.isDraggingMap) {
          state.panX = e.clientX - state.dragStartX;
          state.panY = e.clientY - state.dragStartY;
          requestRedraw();
          return;
        }
        if (window.ARES_GIS && window.ARES_GIS.clientToMapNorm) {
          const norm = window.ARES_GIS.clientToMapNorm(mapCanvas, e.clientX, e.clientY, state);
          if (norm.inBounds) {
            const cell = window.ARES_ENGINE.sampleAt(norm.nx, norm.ny);
            if (cell) {
              state.hoverProbe = {
                nx: norm.nx,
                ny: norm.ny,
                lat: cell.lat,
                lon: cell.lon,
                elevM: cell.elevM,
                slopeDeg: cell.slopeDeg,
                thermalInertia: cell.thermalInertia,
                crismMineral: cell.crismMineral,
                uhfLos: cell.uhfLos,
                uhfMarginDb: cell.uhfMarginDb
              };
              requestRedraw();
            }
          } else if (state.hoverProbe) {
            state.hoverProbe = null;
            requestRedraw();
          }
        }
      });

      mapCanvas.addEventListener('mouseleave', () => {
        if (state.hoverProbe) {
          state.hoverProbe = null;
          requestRedraw();
        }
      });

      mapCanvas.addEventListener('mouseup', (e) => {
        const moveDist = Math.hypot(e.clientX - mapDownClientX, e.clientY - mapDownClientY);
        state.isDraggingMap = false;
        // Only treat as a click (waypoint select or pin plot) if user did not drag the map
        if (moveDist > 6) return;

        const rect = mapCanvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // 0. Check if user clicked an existing CapCom Priority Target diamond -> clear it
        if (state.capcomTarget && state.capcomTarget._screenX !== undefined) {
          const tx = (state.capcomTarget._screenX - rect.width / 2) * state.zoom + rect.width / 2 + state.panX;
          const ty = (state.capcomTarget._screenY - rect.height / 2) * state.zoom + rect.height / 2 + state.panY;
          if (Math.hypot(mx - tx, my - ty) < 24 && !state.capcomMarkMode) {
            state.capcomTarget = null;
            playQuindarTone(false);
            broadcastMcDirective({ type: 'clear_mark', target: null });
            speakSuitVoice('CapCom priority target cleared.');
            requestRedraw();
            return;
          }
        }

        // 0B. If Bi-Directional CapCom Mark Mode is armed (or Alt-Click), drop 3D AR Target Diamond & beam to Visor!
        if (state.capcomMarkMode || e.altKey) {
          const worldX = (mx - rect.width / 2 - state.panX) / state.zoom + rect.width / 2;
          const worldY = (my - rect.height / 2 - state.panY) / state.zoom + rect.height / 2;
          const nx = Math.max(0.03, Math.min(0.97, worldX / rect.width));
          const ny = Math.max(0.03, Math.min(0.97, worldY / rect.height));
          const cell = window.ARES_ENGINE.sampleAt(nx, ny) || {
            slopeDeg: 6.4,
            elevM: -2015,
            crismMineral: 'Authigenic Carbonate-Silica'
          };
          const crew = getCurrentCrewNormPos();
          const dxM = (nx - crew.nx) * 1600;
          const dyM = (ny - crew.ny) * 1088;
          const distM = Math.max(2, Math.round(Math.hypot(dxM, dyM)));
          const bearingDeg = Math.round(((Math.atan2(dxM, -dyM) * 180) / Math.PI + 360) % 360);

          state.capcomTarget = {
            nx,
            ny,
            label: 'CAPCOM PRIORITY TARGET',
            mineral: cell.crismMineral,
            slopeDeg: cell.slopeDeg,
            elevM: cell.elevM,
            distM,
            bearingDeg,
            ts: Date.now()
          };
          if (state.capcomMarkMode) {
            window.ARES_APP.toggleCapcomMarkMode();
          }
          playQuindarTone(true);
          broadcastMcDirective({
            type: 'mark',
            target: state.capcomTarget,
            dustTau: state.dustTau,
            ltstHour: state.ltstHour
          });
          speakSuitVoice(
            `CapCom directive transmitted. Priority science outcrop marked at bearing ${bearingDeg} degrees, range ${distM} meters. ${cell.crismMineral}.`
          );
          requestRedraw();
          return;
        }

        // 1. Check if user clicked an existing custom EVA pin -> remove it immediately
        for (let c = 0; c < state.customWaypoints.length; c++) {
          const cwp = state.customWaypoints[c];
          if (cwp._screenX !== undefined) {
            const csx = (cwp._screenX - rect.width / 2) * state.zoom + rect.width / 2 + state.panX;
            const csy = (cwp._screenY - rect.height / 2) * state.zoom + rect.height / 2 + state.panY;
            if (Math.hypot(mx - csx, my - csy) < 24) {
              const removedCode = cwp.code;
              state.customWaypoints.splice(c, 1);
              state.customWaypoints.forEach((item, idx) => {
                item.code = `EVA-0${idx + 1}`;
                item.name = `Custom EVA Target ${item.code}`;
              });
              const clrBtn = document.getElementById('btnClearPins');
              if (clrBtn && state.customWaypoints.length === 0) clrBtn.classList.add('hidden');
              recomputeRoute();
              speakSuitVoice(`Custom pin ${removedCode} removed.`);
              return;
            }
          }
        }

        // 2. Check if user clicked an existing mission waypoint beacon
        const theater = window.ARES_THEATERS[state.theaterKey];
        for (let i = 0; i < theater.waypoints.length; i++) {
          const wp = theater.waypoints[i];
          if (wp._screenX !== undefined) {
            const sx = (wp._screenX - rect.width / 2) * state.zoom + rect.width / 2 + state.panX;
            const sy = (wp._screenY - rect.height / 2) * state.zoom + rect.height / 2 + state.panY;
            if (Math.hypot(mx - sx, my - sy) < 22) {
              selectWaypoint(i);
              return;
            }
          }
        }

        // 3. If Plot Pin Mode is active (or Shift-Click), drop a custom EVA waypoint at world (nx, ny)
        if (state.plotPinMode || e.shiftKey) {
          plotCustomPinAt(mx, my, rect);
        }
      });

      // Double-click anywhere on the map to immediately plot a custom EVA waypoint
      mapCanvas.addEventListener('dblclick', (e) => {
        const rect = mapCanvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        plotCustomPinAt(mx, my, rect);
      });

      function plotCustomPinAt(mx, my, rect) {
        const worldX = (mx - rect.width / 2 - state.panX) / state.zoom + rect.width / 2;
        const worldY = (my - rect.height / 2 - state.panY) / state.zoom + rect.height / 2;
        const nx = Math.max(0.04, Math.min(0.96, worldX / rect.width));
        const ny = Math.max(0.04, Math.min(0.96, worldY / rect.height));
        const cell = window.ARES_ENGINE.sampleAt(nx, ny) || {
          slopeDeg: 6.4,
          elevM: -2150,
          thermalInertia: 310,
          crismMineral: 'Carbonate-Silica Outcrop'
        };
        const pinIdx = state.customWaypoints.length + 1;
        const code = `EVA-0${pinIdx}`;
        state.customWaypoints.push({
          id: `custom_${Date.now()}`,
          code,
          name: `Custom EVA Target ${code}`,
          role: 'science',
          x: nx,
          y: ny,
          dwellMins: 18,
          slopeDeg: cell.slopeDeg,
          thermalInertia: cell.thermalInertia,
          crismMineral: cell.crismMineral
        });
        const clrBtn = document.getElementById('btnClearPins');
        if (clrBtn) clrBtn.classList.remove('hidden');
        // Automatically exit plotPinMode after placing a pin so dragging the map remains effortless
        if (state.plotPinMode) {
          window.ARES_APP.togglePlotPinMode();
        }
        recomputeRoute();
        speakSuitVoice(
          `Custom GPS pin ${code} plotted. Local slope ${cell.slopeDeg} degrees. Optimal route updated.`
        );
      }

      mapCanvas.addEventListener(
        'wheel',
        (e) => {
          e.preventDefault();
          const factor = e.deltaY < 0 ? 1.12 : 0.89;
          state.zoom = Math.max(1.0, Math.min(3.0, state.zoom * factor));
          if (state.zoom <= 1.02) {
            state.panX = 0;
            state.panY = 0;
          }
          requestRedraw();
        },
        { passive: false }
      );
    }

    // Bind Visor Panorama Drag, Click-to-Aim 50m Nadir Radar, Click-to-Zap Laser & Wheel Zoom
    let isAimingRadar = false;
    function aimFromNadirRadar(canvasEl, clientX, clientY) {
      if (!canvasEl || !state._nadirRadarBounds) return false;
      const rect = canvasEl.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const { cx, cy, r } = state._nadirRadarBounds;
      if (Math.hypot(mx - cx, my - cy) <= r) {
        const angRad = Math.atan2(my - cy, mx - cx);
        state.hudYawDeg = ((angRad * 180) / Math.PI + 90 + 360) % 360;
        broadcastVisorTelemetry();
        requestRedraw();
        return true;
      }
      return false;
    }

    function bindVisorCanvasEvents(canvasEl, allowRadarAim) {
      if (!canvasEl) return;
      canvasEl.addEventListener('mousedown', (e) => {
        if (state.laserResultActive && canvasEl._libsCloseBounds) {
          const rect = canvasEl.getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          const b = canvasEl._libsCloseBounds;
          if (mx >= b.x - 6 && mx <= b.x + b.w + 6 && my >= b.y - 6 && my <= b.y + b.h + 6) {
            state.laserResultActive = false;
            requestRedraw();
            return;
          }
        }
        if (allowRadarAim && !state.hudDecluttered && aimFromNadirRadar(canvasEl, e.clientX, e.clientY)) {
          isAimingRadar = true;
          return;
        }
        if (state.laserAimMode) {
          const rect = canvasEl.getBoundingClientRect();
          const nx = (e.clientX - rect.left) / rect.width;
          const ny = (e.clientY - rect.top) / rect.height;
          fireLaserAt(nx, ny);
          return;
        }
        state.isDraggingHud = true;
        state.hudDragStartX = e.clientX;
        state.hudDragStartY = e.clientY;
      });

      canvasEl.addEventListener('mousemove', (e) => {
        if (allowRadarAim && isAimingRadar) {
          aimFromNadirRadar(canvasEl, e.clientX, e.clientY);
          return;
        }
        if (!state.isDraggingHud) return;
        const dx = e.clientX - state.hudDragStartX;
        const dy = e.clientY - state.hudDragStartY;
        state.hudYawDeg = (state.hudYawDeg - dx * 0.28 + 360) % 360;
        state.hudPitchOffset = Math.max(-0.35, Math.min(0.35, state.hudPitchOffset + dy * 0.0015));
        state.hudDragStartX = e.clientX;
        state.hudDragStartY = e.clientY;
        broadcastVisorTelemetry();
        requestRedraw();
      });

      canvasEl.addEventListener('dblclick', (e) => {
        const rect = canvasEl.getBoundingClientRect();
        fireLaserAt((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
      });

      canvasEl.addEventListener(
        'wheel',
        (e) => {
          e.preventDefault();
          const factor = e.deltaY < 0 ? 1.12 : 0.90;
          state.hudZoom = Math.max(1.0, Math.min(3.0, +(state.hudZoom * factor).toFixed(2)));
          const zoomBadge = document.getElementById('visorZoomBadge');
          if (zoomBadge) zoomBadge.textContent = `${state.hudZoom.toFixed(1)}x ZOOM`;
          broadcastVisorTelemetry();
          requestRedraw();
        },
        { passive: false }
      );

      // Mobile / iPhone touch drag, LIBS card close & double-tap laser support inside 3D Visor
      let lastTapMs = 0;
      canvasEl.addEventListener(
        'touchstart',
        (e) => {
          if (e.touches.length === 1) {
            const rect = canvasEl.getBoundingClientRect();
            const tx = e.touches[0].clientX - rect.left;
            const ty = e.touches[0].clientY - rect.top;
            if (state.laserResultActive && canvasEl._libsCloseBounds) {
              const cb = canvasEl._libsCloseBounds;
              if (tx >= cb.x && tx <= cb.x + cb.w && ty >= cb.y && ty <= cb.y + cb.h) {
                state.laserResultActive = false;
                requestRedraw();
                return;
              }
            }
            const now = Date.now();
            if (now - lastTapMs < 290) {
              fireLaserAt(tx / Math.max(1, rect.width), ty / Math.max(1, rect.height));
              lastTapMs = 0;
              return;
            }
            lastTapMs = now;
            state.isDraggingHud = true;
            state.hudDragStartX = e.touches[0].clientX;
            state.hudDragStartY = e.touches[0].clientY;
          }
        },
        { passive: true }
      );
      canvasEl.addEventListener(
        'touchmove',
        (e) => {
          if (!state.isDraggingHud || e.touches.length !== 1) return;
          const dx = e.touches[0].clientX - state.hudDragStartX;
          const dy = e.touches[0].clientY - state.hudDragStartY;
          state.hudYawDeg = (state.hudYawDeg - dx * 0.28 + 360) % 360;
          state.hudPitchOffset = Math.max(-0.35, Math.min(0.35, state.hudPitchOffset + dy * 0.0015));
          state.hudDragStartX = e.touches[0].clientX;
          state.hudDragStartY = e.touches[0].clientY;
          broadcastVisorTelemetry();
          requestRedraw();
        },
        { passive: true }
      );
      canvasEl.addEventListener('touchend', () => {
        state.isDraggingHud = false;
      });
    }

    bindVisorCanvasEvents(document.getElementById('visorHudCanvas'), true);

    // Bind JPL OnSight WebGL 3D Holographic Terrain Table Events
    if (window.ARES_TERRAIN3D) {
      window.ARES_TERRAIN3D.bindEvents(document.getElementById('terrain3dHudCanvas'), {
        onRedraw: requestRedraw,
        onSelectWaypoint: selectWaypoint,
        onFlyStop() {
          const fBtn = document.getElementById('btnFlyRoute');
          if (fBtn) {
            fBtn.innerHTML = '&#9654; FLY ROUTE';
            fBtn.classList.remove('bg-emerald-600', 'text-white');
            fBtn.classList.add('bg-emerald-600/25', 'text-emerald-300');
          }
        }
      });
    }

    window.addEventListener('mouseup', () => {
      state.isDraggingMap = false;
      state.isDraggingHud = false;
      isAimingRadar = false;
    });

    // Keyboard Shortcuts: 1=Globe, 2=Map, 3=Visor, 4=Science, T=3D Terrain, S=Synthetic Vision, L=Laser Aim, Tab=Layers, Space=Declutter
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.key === '1') {
        setMode('globe');
      } else if (e.key === '2') {
        setMode('map');
      } else if (e.key === '3') {
        setMode('visor');
      } else if (e.key === '4') {
        setMode('science');
      } else if (e.key === 't' || e.key === 'T') {
        if (state.activeMode === 'map') {
          window.ARES_APP.toggleTerrain3d();
        }
      } else if (e.key === 's' || e.key === 'S') {
        if (state.activeMode === 'visor') {
          window.ARES_APP.toggleVisorSyntheticVision();
        }
      } else if (e.key === 'l' || e.key === 'L') {
        if (state.activeMode === 'visor') {
          window.ARES_APP.toggleLaserAimMode();
        }
      } else if (e.key === 'v' || e.key === 'V') {
        if (state.activeMode !== 'visor') setMode('visor');
        window.ARES_APP.toggleVrGogglesMode();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        cycleLayers();
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (state.activeMode === 'visor') {
          toggleDeclutter();
        } else if (state.activeMode === 'globe') {
          window.ARES_GLOBE.state.autoRotate = !window.ARES_GLOBE.state.autoRotate;
        } else {
          window.ARES_APP.toggleSimWalk();
        }
      } else if (state.activeMode === 'visor') {
        if (e.key === 'ArrowLeft') {
          state.hudYawDeg = (state.hudYawDeg - 6 + 360) % 360;
          requestRedraw();
        } else if (e.key === 'ArrowRight') {
          state.hudYawDeg = (state.hudYawDeg + 6) % 360;
          requestRedraw();
        } else if (e.key === 'ArrowUp') {
          state.hudPitchOffset = Math.max(-0.35, state.hudPitchOffset - 0.04);
          requestRedraw();
        } else if (e.key === 'ArrowDown') {
          state.hudPitchOffset = Math.min(0.35, state.hudPitchOffset + 0.04);
          requestRedraw();
        }
      }
    });
  }

  function requestRedraw() {
    if (state.activeMode === 'map') {
      if (state.terrain3dActive && window.ARES_TERRAIN3D) {
        window.ARES_TERRAIN3D.renderTerrain3d(
          document.getElementById('terrain3dWebglCanvas'),
          document.getElementById('terrain3dHudCanvas'),
          state,
          requestRedraw
        );
      } else {
        window.ARES_GIS.renderStrategicMap(
          document.getElementById('gisMapCanvas'),
          state,
          requestRedraw
        );
      }
    } else if (state.activeMode === 'visor') {
      window.ARES_HUD.renderVisorHUD(
        document.getElementById('visorHudCanvas'),
        state,
        requestRedraw
      );
    }
  }

  let lastMasterTimeMs = 0;
  let lastGazeYaw = 0;
  let lastGazePitch = 0;
  let gazeCooldownSec = 0;
  let lastCapcomCheckMs = 0;

  function refreshCapcomUiIndicators() {
    if (!window.ARES_CAPCOM) return;
    const st = window.ARES_CAPCOM.getStatus();
    const prevLinked = state.capcomLinked;
    state.capcomLinked = st.isLinked;

    const dot = document.getElementById('capcomLinkDot');
    if (dot) {
      if (st.role === 'visor') {
        dot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-ping';
      } else if (st.isLinked) {
        dot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
      } else {
        dot.className = 'w-2 h-2 rounded-full bg-amber-400';
      }
    }

    const badge = document.getElementById('capcomStatusBadge');
    if (badge) {
      if (st.role === 'visor') {
        badge.textContent = 'VISOR TX ACTIVE • STREAMING 20Hz IMU & LASER';
        badge.className =
          'px-2 py-0.5 rounded bg-emerald-600/25 border border-emerald-500/60 text-emerald-300 text-[10px] font-extrabold';
      } else if (st.isLinked) {
        badge.textContent = 'LIVE VISOR LINKED • 20Hz TELEMETRY LOCKED';
        badge.className =
          'px-2 py-0.5 rounded bg-emerald-600/25 border border-emerald-500/60 text-emerald-300 text-[10px] font-extrabold';
      } else if (st.serverAvailable) {
        badge.textContent = 'WI-FI RELAY ONLINE • SCAN QR ON iPHONE';
        badge.className =
          'px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[10px] font-extrabold';
      } else {
        badge.textContent = 'LOCAL BROADCAST READY (RUN START_ARES_CAPCOM.bat FOR WI-FI)';
        badge.className =
          'px-2 py-0.5 rounded bg-stone-800 border border-stone-600 text-stone-300 text-[10px] font-bold';
      }
    }

    if (prevLinked !== state.capcomLinked) {
      requestRedraw();
    }
  }

  function masterLoop(nowMs) {
    const tNow = nowMs || performance.now();
    const dtSec = lastMasterTimeMs
      ? Math.min(0.1, Math.max(0.001, (tNow - lastMasterTimeMs) / 1000))
      : 1 / 60;
    lastMasterTimeMs = tNow;
    // Normalized 60 FPS multiplier so 60Hz, 120Hz, 144Hz, and 240Hz displays run at identical physical speeds
    const dt60 = dtSec * 60;

    if (tNow - lastCapcomCheckMs > 1200) {
      lastCapcomCheckMs = tNow;
      refreshCapcomUiIndicators();
    }

    if (state.activeMode === 'globe' && window.ARES_GLOBE) {
      window.ARES_GLOBE.renderPlanetView(
        document.getElementById('globeWebglCanvas'),
        document.getElementById('globeHudCanvas'),
        state
      );
    }
    let dirty = false;

    // 2-Stage Contingency Sprint Animation into WP-03 Basalt Shelter
    if (state.emergencyAbortActive && state.emergencyProgress < 1.0) {
      state.emergencyProgress = Math.min(1.0, (state.emergencyProgress || 0) + 0.0042 * dt60);
      dirty = true;
      if (state.emergencyProgress >= 1.0 && !state._shelterReachedAnnounced) {
        state._shelterReachedAnnounced = true;
        syncAllUI();
        speakSuitVoice(
          'Crew safely inside Waypoint 3 Basalt Overhang Shelter. Solar proton flux attenuated by 74 percent. Standing by for Habitat walk-back.'
        );
      } else if (Math.random() < 0.25 * dt60) {
        syncAllUI();
      }
    } else if (state.simRunning && !state.emergencyAbortActive) {
      state.traverseProgress += 0.0012 * dt60;
      if (state.traverseProgress > 1.0) state.traverseProgress = 0.0;
      dirty = true;
      // Keep Walk-Back Margin & Biometrics live while crew moves along the 2D GPS route
      if (Math.random() < 0.22 * dt60) syncAllUI();
    }

    if (state.ingenuityScoutActive) {
      state.ingenuityPhase = (state.ingenuityPhase || 0) + 0.013 * dt60;
      dirty = true;
    }
    if (state.activeMode === 'map' && state.terrain3dActive && window.ARES_TERRAIN3D) {
      if (window.ARES_TERRAIN3D.stepFly(dt60)) {
        dirty = true;
      }
    }
    if (state.activeMode === 'map' && state.capcomTarget) {
      dirty = true;
    }
    if (
      state.activeMode === 'visor' &&
      (state.dustTau >= 1.5 || state.visorSyntheticVision || state.capcomTarget)
    ) {
      dirty = true;
    }
    if (state.laserPulseFrames > 0) {
      state.laserPulseFrames = Math.max(0, state.laserPulseFrames - dt60);
      dirty = true;
    }

    // Auto-clear LIBS overlay card in 3D Goggles after 6.5s so stereo vision stays unobstructed
    if (
      state.vrGogglesMode &&
      state.laserResultActive &&
      state.laserPulseFrames <= 0 &&
      state.laserFiredAtMs &&
      Date.now() - state.laserFiredAtMs > 6500
    ) {
      state.laserResultActive = false;
      dirty = true;
    }

    // Target-Locked Hands-Free Gaze-Dwell Laser (only charges when aimed onto a Science/CapCom Target!)
    if (state.activeMode === 'visor' && (state.vrGogglesMode || state.gyroActive)) {
      if (gazeCooldownSec > 0) {
        gazeCooldownSec = Math.max(0, gazeCooldownSec - dtSec);
        state.gazeDwellProgress = 0;
      } else if (state.laserPulseFrames <= 0) {
        const theater = window.ARES_THEATERS[state.theaterKey];
        const wp = (theater && theater.waypoints[state.selectedWaypointIdx]) || { arPins: [] };
        const heading = (((state.hudYawDeg || 0) % 360) + 360) % 360;
        let lockedKey = null;

        if (state.capcomTarget) {
          const curPos = getCrewCurrentMapPos();
          const dxM = (state.capcomTarget.nx - curPos.nx) * 1600;
          const dyM = (state.capcomTarget.ny - curPos.ny) * 1088;
          const cBrg =
            Math.hypot(dxM, dyM) > 1
              ? ((Math.atan2(dxM, -dyM) * 180) / Math.PI + 360) % 360
              : state.capcomTarget.bearingDeg || 110;
          const diff = Math.abs(((cBrg - heading + 540) % 360) - 180);
          if (diff < 11) lockedKey = 'capcom_' + (state.capcomTarget.label || 'tgt');
        }

        if (
          !lockedKey &&
          !state.hideArPins &&
          !state.customHudImage &&
          (state.visorSourceMode === 'pano' || state.visorSourceMode === 'butler360')
        ) {
          const pinYaws =
            state.visorSourceMode === 'butler360'
              ? [68, 112, 164, 292]
              : (wp.arPins || []).map((p) => p.yawDeg);
          for (let i = 0; i < pinYaws.length; i++) {
            const diff = Math.abs(((pinYaws[i] - heading + 540) % 360) - 180);
            if (diff < 11) {
              lockedKey = `pin_${state.visorSourceMode}_${wp.code}_${i}`;
              break;
            }
          }
        }

        if (lockedKey && lockedKey === state._lastGazeFiredKey) {
          // Already assayed this target; wait until user looks away before re-arming
          lockedKey = null;
        } else if (!lockedKey && state._lastGazeFiredKey) {
          // Reset lock memory once user looks >14° away
          const dAway = Math.abs(((state.hudYawDeg - lastGazeYaw + 540) % 360) - 180);
          if (dAway > 14) state._lastGazeFiredKey = null;
        }

        const dYaw = Math.abs(((state.hudYawDeg - lastGazeYaw + 540) % 360) - 180);
        const dPitch = Math.abs(state.hudPitchOffset - lastGazePitch);
        if (lockedKey && dYaw < 2.2 && dPitch < 0.05) {
          state.gazeDwellProgress = (state.gazeDwellProgress || 0) + dtSec / 2.0;
          dirty = true;
          broadcastVisorTelemetry();
          if (state.gazeDwellProgress >= 1.0) {
            state.gazeDwellProgress = 0;
            gazeCooldownSec = 3.5;
            state._lastGazeFiredKey = lockedKey;
            lastGazeYaw = state.hudYawDeg;
            fireLaserAt(0.5, 0.5);
          }
        } else {
          lastGazeYaw = state.hudYawDeg;
          lastGazePitch = state.hudPitchOffset;
          if (state.gazeDwellProgress > 0) {
            state.gazeDwellProgress = 0;
            broadcastVisorTelemetry();
            dirty = true;
          }
        }
      }
    }

    if (dirty) requestRedraw();
    requestAnimationFrame(masterLoop);
  }

  // Audio, 3D GLB Blob URLs, 3D Hotspots, Elevation Drawer & Raw Sequence State
  let marsAudioEl = null;
  let marsAudioPlaying = false;
  const glbBlobUrls = {};
  let seqTimer = null;
  let seqFrameIdx = 0;
  let activeSeqKey = 'FHAZ_ARM';
  let activeScrubIdx = 27;
  let active3dAssetKey = 'jezero_crater';

  const GLB_HOTSPOTS = {
    jezero_crater: [
      {
        code: 'HS-LANDING',
        label: 'Butler Landing (Sol 0)',
        sub: 'MOLA ELEV -2,570m • 18.44°N, 77.45°E',
        title: 'Octavia E. Butler Landing Site (360° Mastcam-Z Anchor)',
        desc: 'Touchdown site of Perseverance & Ingenuity. Anchors the 29,517×8,199 Mastcam-Z 360° panorama and 50m vertical nadir projection.',
        pos: '0.15m 0.05m 0.12m',
        orbit: '25deg 58deg 85%'
      },
      {
        code: 'HS-DELTA',
        label: 'Western Fan Delta',
        sub: 'ELEV -2,490m • SMECTITE & CARBONATE',
        title: 'Jezero Ancient Lakebed Western Sedimentary Fan Delta',
        desc: '3.7-billion-year-old river delta front containing fine-grained lacustrine mudstones and marginal authigenic carbonates.',
        pos: '-0.08m 0.08m 0.02m',
        orbit: '-35deg 62deg 78%'
      },
      {
        code: 'HS-NERETVA',
        label: 'Neretva Vallis (Site 093)',
        sub: 'ELEV -1,936m • CHEYAVA FALLS CORE',
        title: 'Neretva Vallis Inlet Channel & Bright Angel Outcrop',
        desc: 'Inlet canyon feeding Jezero Crater where the Sapphire Canyon biosignature core (leopard-spot redox nodules) was collected.',
        pos: '-0.24m 0.14m -0.08m',
        orbit: '-75deg 52deg 72%'
      },
      {
        code: 'HS-RIM',
        label: 'Western Crater Rim',
        sub: 'ELEV -1,895m • 45.25 KM TRAVERSE',
        title: 'Jezero Western Rim Noachian Basement Overlook',
        desc: 'High-elevation impact megabreccia and hydrothermal fracture zone offering panoramic line-of-sight to MRO orbital relays.',
        pos: '-0.35m 0.22m -0.15m',
        orbit: '-115deg 48deg 70%'
      }
    ],
    martian_terrain: [
      {
        code: 'HS-OUTCROP',
        label: 'Polygonal Vein Outcrop',
        sub: 'SLOPE 7.2° • HYDRATED SILICA & SULFATE',
        title: 'Fractured Bedrock & Diagenetic Calcium-Sulfate Suture',
        desc: 'Primary SHERLOC/PIXL target exhibiting millimeter-scale Ca-sulfate veins and iron-phosphate reaction rims.',
        pos: '0.0m 0.12m 0.08m',
        orbit: '15deg 65deg 75%'
      },
      {
        code: 'HS-RIPPLE',
        label: 'Aeolian Sand Drift',
        sub: 'THEMIS <130 TIU • SLIP CAUTION',
        title: 'Unconsolidated Aeolian Basaltic Ripple Hollow',
        desc: 'Low-thermal-inertia fine dust and sand pocket bypassed by the A* autonomous rover planner to prevent wheel sinkage.',
        pos: '0.22m 0.02m -0.12m',
        orbit: '85deg 70deg 80%'
      },
      {
        code: 'HS-SHELTER',
        label: 'SPE Basalt Overhang',
        sub: '2.8m REGOLITH SHIELD • -74% DOSE',
        title: 'Natural Fractured Basalt Alcove (Radiation Shelter)',
        desc: 'Provides immediate geometric mass shielding against Solar Energetic Particle (SEP) proton flux within a 3-minute walk.',
        pos: '-0.20m 0.18m -0.05m',
        orbit: '-65deg 60deg 72%'
      }
    ],
    xemu_suit: [
      {
        code: 'HS-VISOR',
        label: 'xEVA AR Helmet Visor',
        sub: '110° FOV • WAVEGUIDE HUD OPTICS',
        title: 'Polycarbonate Bubble Helmet & Gold IR/UV Protective Visor',
        desc: 'Projects spatial AR waypoint beacons, 360° azimuth compass tape, and SuperCam LIBS spectrograms without obstructing central vision.',
        pos: '0.0m 0.68m 0.14m',
        orbit: '0deg 75deg 68%'
      },
      {
        code: 'HS-PLSS',
        label: 'PLSS 2.5 Backpack',
        sub: '4.3 PSI PURE O₂ • RCA CO₂ SCRUBBER',
        title: 'Primary Life Support System (PLSS) & Thermal Loop',
        desc: 'Dual-bed Rapid Cycle Amine (RCA) CO₂/H₂O swingbed scrubber, high-pressure O₂ tanks, and Spacesuit Water Membrane Evaporator.',
        pos: '0.0m 0.35m -0.22m',
        orbit: '180deg 75deg 75%'
      },
      {
        code: 'HS-HUT',
        label: 'Hard Upper Torso & DCM',
        sub: 'REAR-ENTRY HATCH • BIOMETRIC HUB',
        title: 'Composite Hard Upper Torso (HUT) & Display Control Module',
        desc: 'Rear-entry dust-lock architecture with chest-mounted glove-friendly physical overrides, suit voice comms, and ECG/O₂ telemetry.',
        pos: '0.0m 0.32m 0.18m',
        orbit: '22deg 78deg 72%'
      },
      {
        code: 'HS-BOOTS',
        label: 'Planetary Walking Boots',
        sub: 'RATED TO -110°C • HIGH-TRACTION LUGS',
        title: 'Abrasion-Resistant Martian Regolith Walking Boots',
        desc: 'Aerogel thermal barrier sole and ankle flex bearings engineered for 15°–25° rocky crater rim ascents.',
        pos: '0.08m -0.65m 0.10m',
        orbit: '35deg 95deg 82%'
      }
    ],
    perseverance: [
      {
        code: 'HS-SUPERCAM',
        label: 'SuperCam & Mastcam-Z',
        sub: '1064nm LIBS LASER • 110mm STEREO ZOOM',
        title: 'Remote Sensing Mast (SuperCam LIBS/RMI/Mic & Mastcam-Z)',
        desc: 'Fires 1064nm pulsed laser shots out to 7m to vaporize rock into 10,000K plasma while capturing 242-MP 360° stereo panoramas.',
        pos: '0.08m 0.85m 0.35m',
        orbit: '28deg 70deg 70%'
      },
      {
        code: 'HS-TURRET',
        label: 'SHERLOC / PIXL Turret',
        sub: '2.1m ROBOTIC ARM • CORING DRILL',
        title: '5-DOF Robotic Arm Turret (SHERLOC, WATSON, PIXL & Drill)',
        desc: 'Deploys deep-UV Raman/ luminescence spectroscopy and micro-focus X-ray fluorescence alongside the rotary-percussive core drill.',
        pos: '0.0m 0.25m 0.85m',
        orbit: '0deg 80deg 68%'
      },
      {
        code: 'HS-MMRTG',
        label: 'MMRTG Nuclear Power',
        sub: '4.8 KG PuO₂ • 110W CONTINUOUS',
        title: 'Multi-Mission Radioisotope Thermoelectric Generator',
        desc: 'Provides continuous all-weather electrical power and warm freon thermal regulation across day/night Martian cycles.',
        pos: '0.0m 0.42m -0.75m',
        orbit: '165deg 72deg 76%'
      },
      {
        code: 'HS-WHEELS',
        label: 'Titanium Rocker-Bogie',
        sub: '52.5 CM Ø • 48 GROUSER CLEATS',
        title: 'Machined Titanium Wheels & Rocker-Bogie Suspension',
        desc: 'Curved titanium cleats distribute 1,025 kg rover mass across sharp boxwork ridges and loose Neretva Vallis drifts.',
        pos: '0.45m -0.25m 0.20m',
        orbit: '65deg 85deg 78%'
      }
    ],
    ingenuity: [
      {
        code: 'HS-ROTORS',
        label: '1.2m Carbon-Fiber Rotors',
        sub: '2,537 RPM • MACH 0.7 TIP SPEED',
        title: 'Counter-Rotating Coaxial Carbon-Fiber Foam-Core Blades',
        desc: 'Spins at 2,537 RPM to generate lift in Mars’s 0.6 kPa CO₂ atmosphere (~1% of Earth sea-level air density).',
        pos: '0.0m 0.28m 0.0m',
        orbit: '25deg 65deg 75%'
      },
      {
        code: 'HS-SOLAR',
        label: 'Solar Array & Li-Ion',
        sub: '35-40 Wh PACK • 72 FLIGHT SORTIES',
        title: 'High-Efficiency Upper Solar Panel & 6-Cell Li-Ion Pack',
        desc: 'Powers both avionics warmers through -80°C Martian nights and 90-second autonomous forward-reconnaissance flights.',
        pos: '0.0m 0.42m 0.0m',
        orbit: '0deg 45deg 72%'
      },
      {
        code: 'HS-NAVCAM',
        label: 'RTE & Navcam Optics',
        sub: '13 MP COLOR RTE • GARMIN LIDAR',
        title: 'Downward Navcam + 13 MP Return-to-Earth (RTE) Aerial Camera',
        desc: 'Scouts impassable >25° scarps and sand traps ahead of the astronaut crew and transmits high-res ortho-imagery.',
        pos: '0.0m 0.05m 0.12m',
        orbit: '15deg 85deg 70%'
      }
    ]
  };

  function render3dHotspots(assetKey) {
    active3dAssetKey = assetKey;
    const list = GLB_HOTSPOTS[assetKey] || GLB_HOTSPOTS.jezero_crater;
    const pillsEl = document.getElementById('sandboxHotspotPills');
    if (pillsEl) {
      pillsEl.innerHTML = list
        .map(
          (hs, idx) => `
          <button
            id="hsPill_${idx}"
            onclick="window.ARES_APP.select3dHotspot('${assetKey}', ${idx})"
            class="px-2 py-0.5 rounded font-mono-tech text-[10px] font-bold transition ${
              idx === 0
                ? 'bg-orange-600 text-white'
                : 'bg-[#1c1917] text-stone-300 border border-[#3f3a36] hover:text-white'
            }"
          >
            ${hs.label}
          </button>
        `
        )
        .join('');
    }

    const sbViewer = document.getElementById('sandbox3dViewer');
    if (sbViewer) {
      // Ensure zero floating in-mesh hotspot buttons cluttering the 3D model
      sbViewer.querySelectorAll('.ares-3d-hotspot').forEach((el) => el.remove());
    }

    select3dHotspot(assetKey, 0);
  }

  function select3dHotspot(assetKey, hsIdx) {
    const list = GLB_HOTSPOTS[assetKey] || GLB_HOTSPOTS.jezero_crater;
    const hs = list[hsIdx] || list[0];
    if (!hs) return;

    const codeEl = document.getElementById('hsCardCode');
    const subEl = document.getElementById('hsCardSub');
    const titleEl = document.getElementById('hsCardTitle');
    const descEl = document.getElementById('hsCardDesc');
    if (codeEl) codeEl.textContent = hs.code;
    if (subEl) subEl.textContent = hs.sub;
    if (titleEl) titleEl.textContent = hs.title;
    if (descEl) descEl.textContent = hs.desc;

    list.forEach((_, idx) => {
      const p = document.getElementById(`hsPill_${idx}`);
      if (p) {
        p.className =
          idx === hsIdx
            ? 'px-2 py-0.5 rounded font-mono-tech text-[10px] font-bold bg-orange-600 text-white transition'
            : 'px-2 py-0.5 rounded font-mono-tech text-[10px] font-bold bg-[#1c1917] text-stone-300 border border-[#3f3a36] hover:text-white transition';
      }
    });

    const sbViewer = document.getElementById('sandbox3dViewer');
    if (sbViewer && hs.orbit) {
      sbViewer.cameraOrbit = hs.orbit;
    }
  }

  let glbScriptLoading = null;
  let default3dMounted = false;

  function resolveGlbUrlAsync(assetKey) {
    if (glbBlobUrls[assetKey]) return Promise.resolve(glbBlobUrls[assetKey]);
    if (window.location.protocol !== 'file:') {
      const directUrl = `assets/optimized/${assetKey}.glb`;
      glbBlobUrls[assetKey] = directUrl;
      return Promise.resolve(directUrl);
    }

    // Over file:// protocol, lazily load nasa_glb_blobs.js once in the background without blocking startup
    if (!glbScriptLoading) {
      glbScriptLoading = new Promise((resolve) => {
        if (window.NASA_GLB_B64) {
          resolve(true);
          return;
        }
        const sc = document.createElement('script');
        sc.src = 'js/nasa_glb_blobs.js';
        sc.async = true;
        sc.onload = () => resolve(true);
        sc.onerror = () => resolve(false);
        document.body.appendChild(sc);
      });
    }

    return glbScriptLoading.then(() => {
      const b64 = window.NASA_GLB_B64 && window.NASA_GLB_B64[assetKey];
      if (!b64) return `assets/optimized/${assetKey}.glb`;
      return fetch('data:model/gltf-binary;base64,' + b64)
        .then((r) => r.blob())
        .then((blob) => {
          glbBlobUrls[assetKey] = URL.createObjectURL(blob);
          return glbBlobUrls[assetKey];
        })
        .catch(() => `assets/optimized/${assetKey}.glb`);
    });
  }

  function ensureDefault3dViewersMounted() {
    if (default3dMounted) return;
    default3dMounted = true;
    resolveGlbUrlAsync('perseverance').then((url) => {
      const viewer = document.getElementById('nasa3dViewer');
      if (viewer && !viewer.src) viewer.src = url;
    });
    resolveGlbUrlAsync('jezero_crater').then((url) => {
      const sbViewer = document.getElementById('sandbox3dViewer');
      if (sbViewer && !sbViewer.src) sbViewer.src = url;
    });
  }

  function init3dModels() {
    render3dHotspots('jezero_crater');
    // Skip eager 3D GLB mesh fetch when launched on iPhone Visor Goggles (?visor=1) to keep mobile RAM ultra-low
    const isVisorLaunch = new URLSearchParams(window.location.search || '').get('visor') === '1';
    if (!isVisorLaunch && window.innerWidth >= 900) {
      setTimeout(ensureDefault3dViewersMounted, 120);
    }
  }

  function getActiveScrubWaypoints() {
    if (!window.M20_GPS_DATA) return [];
    return state.scrubScope === 'full'
      ? window.M20_GPS_DATA.milestoneWaypoints || []
      : window.M20_GPS_DATA.site88to93Waypoints || [];
  }

  function renderElevProfile() {
    const canvas = document.getElementById('elevProfileCanvas');
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 480;
    const h = canvas.clientHeight || 96;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#0c0a09';
    ctx.fillRect(0, 0, w, h);

    const rdEl = document.getElementById('gpsScrubReadout');

    // TAB 3: DUAL-CREW PLSS CONSUMABLES BURN-DOWN & NASA 15% RESERVE REDLINE
    if (state.drawerMode === 'plss') {
      const timeline = (state.routeResult && state.routeResult.plssTimeline) || [];
      const buddy = (state.routeResult && state.routeResult.buddyCheck) || {};
      if (!timeline.length) return;

      const yPct = (pct) => h - 14 - (Math.max(0, Math.min(100, pct)) / 100) * (h - 24);

      // 15% NASA Flight Rule Reserve Redline Zone
      const yRed = yPct(15);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.10)';
      ctx.fillRect(12, yRed, w - 24, h - 10 - yRed);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.3;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(12, yRed);
      ctx.lineTo(w - 12, yRed);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#fca5a5';
      ctx.font = '700 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText('15% NASA FLIGHT RULE REDLINE', w - 16, yRed - 3);

      const drawCurve = (key, col, width, dashed) => {
        ctx.save();
        ctx.strokeStyle = col;
        ctx.lineWidth = width;
        if (dashed) ctx.setLineDash([4, 3]);
        ctx.beginPath();
        timeline.forEach((pt, idx) => {
          const x = 12 + (idx / Math.max(1, timeline.length - 1)) * (w - 24);
          const y = yPct(pt[key]);
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.restore();
      };

      drawCurve('batteryPct', '#fbbf24', 1.6, false);
      drawCurve('scrubberPct', '#38bdf8', 1.6, false);
      drawCurve('buddyTowO2Pct', '#ef4444', state.buddyFaultSim ? 2.4 : 1.3, !state.buddyFaultSim);
      drawCurve('o2Pct', '#10b981', 2.2, false);

      // Live EVA Progress Cursor
      const progX = 12 + Math.max(0, Math.min(1, state.traverseProgress || 0)) * (w - 24);
      ctx.strokeStyle = '#fafaf9';
      ctx.lineWidth = 1.3;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(progX, 6);
      ctx.lineTo(progX, h - 8);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#a8a29e';
      ctx.font = '600 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('MET 00:00 (HAB-01)', 14, h - 3);
      ctx.textAlign = 'right';
      const endMin = timeline[timeline.length - 1].min || 180;
      ctx.fillText(`MET +${endMin} MIN`, w - 14, h - 3);

      if (rdEl) {
        rdEl.textContent = `END O₂: ${buddy.endNominalO2Pct ?? 52}% • EV-2 BUDDY-TOW END O₂: ${buddy.endBuddyTowO2Pct ?? 36}% (${buddy.buddyTowSafe !== false ? 'SAFE >15%' : 'BREACH <15%!'})`;
      }
      return;
    }

    // TAB 4: MARTIAN DIURNAL SOLAR IRRADIANCE (LTST), DUST ATTENUATION (τ) & ORBITAL UHF RELAY PASSES
    if (state.drawerMode === 'atmos') {
      const hMin = 6.0;
      const hMax = 19.5;
      const tau = state.dustTau || 0.42;

      // Shaded MRO / MAVEN / ODYSSEY Orbital UHF Relay Pass Windows
      const passes = [
        { s: 8.2, e: 9.4, lbl: 'MRO PASS (2 Mbps)' },
        { s: 12.8, e: 14.3, lbl: 'MAVEN RELAY' },
        { s: 17.0, e: 18.2, lbl: 'ODYSSEY DUSK' }
      ];
      passes.forEach((p) => {
        const x0 = 12 + ((p.s - hMin) / (hMax - hMin)) * (w - 24);
        const x1 = 12 + ((p.e - hMin) / (hMax - hMin)) * (w - 24);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.13)';
        ctx.fillRect(x0, 8, x1 - x0, h - 22);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.strokeRect(x0, 8, x1 - x0, h - 22);
        ctx.fillStyle = '#38bdf8';
        ctx.font = '700 7.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(p.lbl, (x0 + x1) / 2, 18);
      });

      // Solar Flux Curve (W/m², Mars perihelion/mean ~590 W/m² TOA attenuated by Beer-Lambert exp(-tau/sin(elev)))
      ctx.beginPath();
      let curFluxWm2 = 0;
      const steps = 90;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const hr = hMin + u * (hMax - hMin);
        const sinEl = Math.max(0.02, Math.sin(((hr - 5.5) / 14.0) * Math.PI));
        const flux = 590 * sinEl * Math.exp((-0.38 * tau) / Math.max(0.18, sinEl));
        if (Math.abs(hr - state.ltstHour) < 0.18) curFluxWm2 = Math.round(flux);
        const x = 12 + u * (w - 24);
        const y = h - 14 - (flux / 560) * (h - 28);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Current LTST Sun Cursor
      const sunX = 12 + ((state.ltstHour - hMin) / (hMax - hMin)) * (w - 24);
      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(sunX, 6);
      ctx.lineTo(sunX, h - 12);
      ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(sunX, 12, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#a8a29e';
      ctx.font = '600 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('06:00 DAWN (-72°C)', 14, h - 3);
      ctx.textAlign = 'center';
      ctx.fillText('13:00 SOLAR ZENITH', w / 2, h - 3);
      ctx.textAlign = 'right';
      ctx.fillText('19:30 TERMINATOR DUSK', w - 14, h - 3);

      const inPass = passes.find((p) => state.ltstHour >= p.s && state.ltstHour <= p.e);
      if (rdEl) {
        rdEl.textContent = `LTST ${formatLtst(state.ltstHour)} • SOLAR ${curFluxWm2} W/m² • τ=${tau.toFixed(2)} • ${
          inPass ? `ORB LINK: ${inPass.lbl}` : 'UHF STORE-AND-FORWARD'
        }`;
      }
      return;
    }

    if (!window.M20_GPS_DATA) return;
    const pts = getActiveScrubWaypoints();
    if (!pts.length) return;

    const curIdx = Math.max(0, Math.min(pts.length - 1, activeScrubIdx));
    const cx = 12 + (curIdx / Math.max(1, pts.length - 1)) * (w - 24);

    if (state.drawerMode === 'rimfax') {
      // RIMFAX 150-1200 MHz Subsurface Ground-Penetrating Radargram (0 to -15m depth)
      const strata = [
        { depthLabel: '-2.5m Regolith', yFrac: 0.22, color: 'rgba(249, 115, 22, 0.85)', amp: 3.5, freq: 0.25 },
        { depthLabel: '-6.5m Delta Clay', yFrac: 0.48, color: 'rgba(34, 197, 94, 0.85)', amp: 5.2, freq: 0.42 },
        { depthLabel: '-11.0m Carbonate', yFrac: 0.72, color: 'rgba(251, 191, 36, 0.85)', amp: 4.5, freq: 0.31 },
        { depthLabel: '-14.5m Megabreccia', yFrac: 0.90, color: 'rgba(244, 63, 94, 0.75)', amp: 3.0, freq: 0.55 }
      ];

      // Subtle dielectric radar speckle background
      for (let rx = 12; rx < w - 12; rx += 6) {
        for (let ry = 8; ry < h - 8; ry += 5) {
          const v = Math.abs(Math.sin(rx * 0.13 + ry * 0.29));
          ctx.fillStyle = `rgba(249, 115, 22, ${v * 0.12})`;
          ctx.fillRect(rx, ry, 4, 3);
        }
      }

      // Draw dipping subsurface radar reflector horizons
      strata.forEach((st, sIdx) => {
        ctx.beginPath();
        for (let x = 12; x <= w - 12; x += 4) {
          const norm = (x - 12) / (w - 24);
          const dip = Math.sin(norm * Math.PI * 2.2 + sIdx) * st.amp + norm * 6;
          const y = h * st.yFrac + dip;
          if (x === 12) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = st.color;
        ctx.lineWidth = 1.8;
        ctx.stroke();

        ctx.fillStyle = st.color;
        ctx.font = '700 8.5px "JetBrains Mono", monospace';
        ctx.fillText(st.depthLabel, 16, h * st.yFrac - 3);
      });

      // Vertical RIMFAX radar beam cursor at active rover scrub position
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cx, 4);
      ctx.lineTo(cx, h - 4);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }

    // Standard MOLA / HiRISE Surface Elevation Cross-Section
    const elevs = pts.map((p) => p.elev);
    const minE = Math.min(...elevs) - 4;
    const maxE = Math.max(...elevs) + 4;

    ctx.beginPath();
    pts.forEach((p, idx) => {
      const x = 12 + (idx / Math.max(1, pts.length - 1)) * (w - 24);
      const y = h - 12 - ((p.elev - minE) / Math.max(1, maxE - minE)) * (h - 24);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.stroke();

    const cp = pts[curIdx];
    const cy = h - 12 - ((cp.elev - minE) / Math.max(1, maxE - minE)) * (h - 24);

    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  window.ARES_APP = {
    setTheater,
    setBasemapVariant,
    setMode,
    selectWaypoint,
    toggleLayer,
    cycleLayers,
    setVisorSource,
    toggleDeclutter,
    logCurrentStationSample,
    descendToSector(sectorKey) {
      const theater = window.ARES_THEATERS[sectorKey];
      setTheater(sectorKey);
      if (state.activeMode === 'globe' && window.ARES_GLOBE && theater) {
        window.ARES_GLOBE.animateDescentTo(theater.baseLat, theater.baseLon, () => {
          setMode('map');
        });
      } else {
        setMode('map');
      }
    },
    toggleMarsAudio() {
      if (!marsAudioEl) {
        marsAudioEl = new Audio(
          window.MARS_AUDIO_B64 || 'assets/optimized/mars_wind_perseverance.mp3'
        );
        marsAudioEl.loop = true;
        marsAudioEl.volume = 0.75;
      }
      marsAudioPlaying = !marsAudioPlaying;
      const btn = document.getElementById('btnMarsAudio');
      if (marsAudioPlaying) {
        marsAudioEl.play().catch(() => {});
        if (btn) {
          btn.textContent = 'AUDIO: ON';
          btn.classList.add('bg-orange-600', 'text-white');
          btn.classList.remove('bg-[#292524]', 'text-amber-300');
        }
      } else {
        marsAudioEl.pause();
        if (btn) {
          btn.textContent = 'AUDIO';
          btn.classList.remove('bg-orange-600', 'text-white');
          btn.classList.add('bg-[#292524]', 'text-amber-300');
        }
      }
    },
    set3dAsset(assetKey) {
      resolveGlbUrlAsync(assetKey).then((url) => {
        const viewer = document.getElementById('nasa3dViewer');
        if (viewer) viewer.src = url;
        const sbViewer = document.getElementById('sandbox3dViewer');
        if (sbViewer) sbViewer.src = url;
      });

      const titles = {
        perseverance: 'Perseverance Mars Rover (25042_Perseverance.glb)',
        ingenuity: 'Ingenuity Mars Helicopter (Ingenuity Mars Helicopter.glb)',
        xemu_suit: 'NASA Extravehicular Mobility Unit Spacesuit (Extravehicular Mobility Unit.glb)',
        jezero_crater: 'Jezero Crater 3D Orbital DEM Mesh (jezero_crater_mars.glb)',
        martian_terrain: 'High-Resolution Martian Outcrop Terrain (martian_terrain.glb)'
      };
      const sbTitle = document.getElementById('sandbox3dTitle');
      if (sbTitle && titles[assetKey]) sbTitle.textContent = titles[assetKey];

      const att = document.getElementById('attitudeBadge');
      if (att) {
        if (assetKey === 'xemu_suit') {
          att.innerHTML = '<span>PLSS: 4.3 PSI</span><span>O₂: 86% NOMINAL</span><span class="text-emerald-400">SUIT 3D</span>';
        } else if (assetKey === 'jezero_crater') {
          att.innerHTML = '<span>CRATER Ø: 45.0 km</span><span>DELTA: -2,490m</span><span class="text-orange-400">MRO DEM 3D</span>';
        } else if (assetKey === 'martian_terrain') {
          att.innerHTML = '<span>OUTCROP MESH</span><span>SLOPE: 7.2°</span><span class="text-amber-300">TERRAIN 3D</span>';
        } else if (assetKey === 'ingenuity') {
          att.innerHTML = '<span>ALT: 12.0m AGL</span><span>ROTOR: 2,537 RPM</span><span class="text-emerald-400">HELI 3D</span>';
        } else {
          att.innerHTML = '<span>ROLL: +5.58°</span><span>PITCH: +4.69°</span><span class="text-orange-400">TILT: 7.29°</span>';
        }
      }

      ['perseverance', 'ingenuity', 'xemu_suit', 'jezero_crater', 'martian_terrain'].forEach((k) => {
        const b = document.getElementById(`btn3d_${k}`);
        if (b) {
          b.className =
            k === assetKey
              ? 'py-1 rounded bg-orange-600 text-white font-bold transition text-center'
              : 'py-1 rounded bg-[#141210] text-stone-300 border border-[#3f3a36] hover:text-white transition text-center';
        }
      });

      render3dHotspots(assetKey);
    },
    select3dHotspot,
    setVisorFilter(filterMode) {
      state.visorFilterMode = filterMode;
      ['natural', 'enhanced', 'thermal', 'anaglyph'].forEach((k) => {
        const btn = document.getElementById(`visorFlt_${k}`);
        if (btn) {
          btn.className =
            k === filterMode
              ? 'px-2 py-0.5 rounded text-[10.5px] font-mono-tech font-bold bg-orange-600 text-white transition'
              : 'px-2 py-0.5 rounded text-[10.5px] font-mono-tech font-semibold text-stone-300 hover:text-white bg-[#1c1917] border border-[#3f3a36] transition';
        }
      });
      broadcastVisorTelemetry();
      requestRedraw();
    },
    openMissionDebrief() {
      const modal = document.getElementById('missionDebriefModal');
      const body = document.getElementById('fdfModalBody');
      if (!modal || !body) return;
      const theater = window.ARES_THEATERS[state.theaterKey];
      const wp = theater.waypoints[state.selectedWaypointIdx] || theater.waypoints[0];
      const stats = state.routeResult.stats || {};
      const savings = stats.savings || {};
      const weather = theater.medaWeather || {};
      const samplesHtml = state.loggedSamples
        .map(
          (s) => `
          <tr class="border-b border-[#292524]">
            <td class="py-2 pr-3 font-bold text-emerald-400">${s.id}</td>
            <td class="py-2 pr-3 text-orange-300 font-bold">${s.stationCode}</td>
            <td class="py-2 pr-3 text-stone-100">${s.name}</td>
            <td class="py-2 pr-3 text-amber-300">${s.mineral}</td>
            <td class="py-2 text-stone-400">${s.coords}</td>
          </tr>
        `
        )
        .join('');

      body.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="bg-[#1c1917] border border-[#292524] rounded-xl p-3">
            <div class="text-[10px] text-stone-400">MISSION SECTOR</div>
            <div class="text-sm font-extrabold text-orange-400 mt-0.5">${theater.shortName}</div>
            <div class="text-[10px] text-stone-300 mt-0.5">${theater.coords}</div>
          </div>
          <div class="bg-[#1c1917] border border-[#292524] rounded-xl p-3">
            <div class="text-[10px] text-stone-400">EVA TRAVERSE BUDGET</div>
            <div class="text-sm font-extrabold text-stone-100 mt-0.5">${stats.totalDistM || 1420}m • ${stats.totalMissionMin || 184} min</div>
            <div class="text-[10px] text-amber-300 mt-0.5">0.38g Metabolic: ${stats.metabolicRateKcalHr || 310} kcal/hr (${stats.o2LitersUsed || 195}L O₂)</div>
          </div>
          <div class="bg-[#1c1917] border border-[#292524] rounded-xl p-3">
            <div class="text-[10px] text-stone-400">SUIT PLSS &amp; BUDDY RULE</div>
            <div class="text-sm font-extrabold text-emerald-400 mt-0.5">O₂ ${state.consumables.o2Pct}% • CO₂ ${state.consumables.scrubberPct}%</div>
            <div class="text-[10px] text-stone-300 mt-0.5">EV-2 Tow End O₂: ${(state.routeResult.buddyCheck && state.routeResult.buddyCheck.endBuddyTowO2Pct) || 38}% (&gt;15% Redline)</div>
          </div>
          <div class="bg-[#1c1917] border border-[#292524] rounded-xl p-3">
            <div class="text-[10px] text-stone-400">RAD DOSE &amp; DIURNAL ATMOS</div>
            <div class="text-sm font-extrabold text-amber-400 mt-0.5">${((wp.radMsvHr || 0.021) * 3.1).toFixed(3)} mSv (&lt;15 mSv ALARA)</div>
            <div class="text-[10px] text-stone-300 mt-0.5">LTST ${formatLtst(state.ltstHour)} • ${weather.pressureMbar ?? 7.4} mbar • τ=${(state.dustTau || 0.42).toFixed(2)}</div>
          </div>
        </div>

        <div class="bg-[#1c1917] border border-[#292524] rounded-xl p-3.5 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div class="text-[10px] text-stone-400">A* SUIT-PHYSICS O₂ SAVINGS</div>
            <div class="text-xs font-extrabold text-emerald-400 mt-0.5">-${savings.o2SavedPct || 24}% PLSS O₂ vs Direct Line (${savings.o2LitersSaved || 42}L / ${savings.kcalSaved || 205} kcal saved)</div>
          </div>
          <div>
            <div class="text-[10px] text-stone-400">SCARP &amp; SAND-TRAP AVOIDANCE</div>
            <div class="text-xs font-extrabold text-orange-300 mt-0.5">Max Grade ${stats.maxSlopeDeg || 11.4}° vs ${savings.directMaxSlopeDeg || 28.5}° Direct (${savings.directHazards || 9} Cliffs Bypassed)</div>
          </div>
          <div>
            <div class="text-[10px] text-stone-400">401 MHz UHF ROVER RELAY</div>
            <div class="text-xs font-extrabold text-amber-300 mt-0.5">${(stats.uhfShadowMeters || 0) === 0 ? '100% Line-of-Sight Locked' : `${stats.uhfShadowMeters}m Terrain Shadow`} • Ascent +${stats.totalAscentM || 68}m</div>
          </div>
        </div>

        <div class="bg-[#1c1917] border border-[#292524] rounded-xl p-4">
          <div class="text-xs font-extrabold text-orange-400 uppercase mb-2">
            Collected Geological Core &amp; SuperCam LIBS Assay Manifest (${state.loggedSamples.length} Samples)
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr class="border-b border-[#3f3a36] text-stone-400">
                  <th class="pb-2 pr-3">SAMPLE ID</th>
                  <th class="pb-2 pr-3">STATION</th>
                  <th class="pb-2 pr-3">DESIGNATION</th>
                  <th class="pb-2 pr-3">MINERALOGY / BIOSIG</th>
                  <th class="pb-2">COORDINATES</th>
                </tr>
              </thead>
              <tbody>${samplesHtml}</tbody>
            </table>
          </div>
        </div>
      `;
      modal.classList.remove('hidden');
    },
    closeMissionDebrief() {
      const modal = document.getElementById('missionDebriefModal');
      if (modal) modal.classList.add('hidden');
    },
    exportScienceJson() {
      const theater = window.ARES_THEATERS[state.theaterKey];
      const payload = {
        mission: 'ARES-NAV xEVA Tactical & Scientific Debrief',
        exportedAt: new Date().toISOString(),
        sector: theater.name,
        coordinates: theater.coords,
        consumables: state.consumables,
        routeSummary: state.routeResult.stats,
        customWaypoints: state.customWaypoints,
        loggedSamples: state.loggedSamples
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `ARES_NAV_FDF_DEBRIEF_${state.theaterKey.toUpperCase()}.json`;
      a.click();
    },
    toggleMap3dSandbox() {
      const ov = document.getElementById('map3dSandboxOverlay');
      const btn = document.getElementById('btnMap3dSandbox');
      if (!ov) return;
      ensureDefault3dViewersMounted();
      const isHidden = ov.classList.toggle('hidden');
      if (btn) {
        btn.classList.toggle('bg-orange-600', !isHidden);
        btn.classList.toggle('text-white', !isHidden);
        btn.classList.toggle('bg-[#1c1917]', isHidden);
        btn.classList.toggle('text-orange-300', isHidden);
      }
    },
    toggleTerrain3d() {
      state.terrain3dActive = !state.terrain3dActive;
      const ov = document.getElementById('terrain3dOverlay');
      const btn = document.getElementById('btnTerrain3d');
      if (ov) ov.classList.toggle('hidden', !state.terrain3dActive);
      if (btn) {
        btn.textContent = state.terrain3dActive ? '2D ORTHO' : '3D TERRAIN';
        btn.classList.toggle('bg-amber-500', state.terrain3dActive);
        btn.classList.toggle('text-stone-950', state.terrain3dActive);
        btn.classList.toggle('bg-[#1c1917]', !state.terrain3dActive);
        btn.classList.toggle('text-amber-300', !state.terrain3dActive);
      }
      if (state.terrain3dActive) {
        speakSuitVoice(
          'JPL OnSight 3D Holographic Terrain Table active. Drag to orbit real MRO HiRISE topography or click Fly Route.'
        );
      } else if (window.ARES_TERRAIN3D && window.ARES_TERRAIN3D.cam.flyActive) {
        window.ARES_TERRAIN3D.toggleFlyRoute();
      }
      setTimeout(requestRedraw, 20);
    },
    toggleFlyRoute() {
      if (!window.ARES_TERRAIN3D) return;
      if (!state.terrain3dActive) {
        window.ARES_APP.toggleTerrain3d();
      }
      const flying = window.ARES_TERRAIN3D.toggleFlyRoute();
      const fBtn = document.getElementById('btnFlyRoute');
      if (fBtn) {
        fBtn.innerHTML = flying ? '&#10074;&#10074; PAUSE FLY' : '&#9654; FLY ROUTE';
        fBtn.classList.toggle('bg-emerald-600', flying);
        fBtn.classList.toggle('text-white', flying);
        fBtn.classList.toggle('bg-emerald-600/25', !flying);
        fBtn.classList.toggle('text-emerald-300', !flying);
      }
      if (flying) {
        speakSuitVoice('Autonomous low-altitude canyon chase camera engaged along optimal traverse.');
      }
      requestRedraw();
    },
    cycleTerrainExag() {
      if (!window.ARES_TERRAIN3D) return;
      const ex = window.ARES_TERRAIN3D.cycleVertExag();
      const b = document.getElementById('btnVertExag');
      if (b) b.textContent = `EXAG: ${ex.toFixed(1)}x`;
      requestRedraw();
    },
    resetTerrainCam() {
      if (!window.ARES_TERRAIN3D) return;
      window.ARES_TERRAIN3D.resetCamera();
      const fBtn = document.getElementById('btnFlyRoute');
      if (fBtn) {
        fBtn.innerHTML = '&#9654; FLY ROUTE';
        fBtn.classList.remove('bg-emerald-600', 'text-white');
        fBtn.classList.add('bg-emerald-600/25', 'text-emerald-300');
      }
      requestRedraw();
    },
    toggleCapcomMarkMode() {
      if (state.terrain3dActive) {
        window.ARES_APP.toggleTerrain3d();
      }
      state.capcomMarkMode = !state.capcomMarkMode;
      if (state.capcomMarkMode && state.plotPinMode) {
        window.ARES_APP.togglePlotPinMode();
      }
      const btn = document.getElementById('btnCapcomMark');
      const mapCanvas = document.getElementById('gisMapCanvas');
      if (btn) {
        btn.innerHTML = state.capcomMarkMode ? '&#9670; CLICK OUTCROP' : '&#9670; MARK';
        btn.classList.toggle('bg-sky-500', state.capcomMarkMode);
        btn.classList.toggle('text-stone-950', state.capcomMarkMode);
        btn.classList.toggle('bg-[#1c1917]', !state.capcomMarkMode);
        btn.classList.toggle('text-sky-300', !state.capcomMarkMode);
      }
      if (mapCanvas) {
        mapCanvas.style.cursor = state.capcomMarkMode ? 'crosshair' : 'grab';
      }
    },
    openDrawerTab(mode) {
      const dr = document.getElementById('elevProfileDrawer');
      const btn = document.getElementById('btnElevDrawer');
      if (dr && dr.classList.contains('hidden')) {
        dr.classList.remove('hidden');
        if (btn) btn.classList.add('active');
      }
      window.ARES_APP.setDrawerMode(mode);
    },
    toggleBuddyFaultSim() {
      state.buddyFaultSim = !state.buddyFaultSim;
      const b = document.getElementById('btnBuddyFault');
      if (b) {
        b.innerHTML = state.buddyFaultSim
          ? '&#10003; CLEAR BUDDY FAULT'
          : '&#9888; BUDDY-TOW FAULT CHECK';
        b.classList.toggle('bg-red-600', state.buddyFaultSim);
        b.classList.toggle('text-white', state.buddyFaultSim);
      }
      recomputeRoute();
      const bc = (state.routeResult && state.routeResult.buddyCheck) || {};
      if (state.buddyFaultSim) {
        speakSuitVoice(
          bc.buddyTowSafe
            ? `EV-2 suit fault simulated. Buddy-tow metabolic load plus 48 percent. Terminal oxygen ${bc.endBuddyTowO2Pct} percent. Above 15 percent NASA reserve redline.`
            : `Warning! Buddy-tow fault breaches 15 percent oxygen reserve redline at ${bc.endBuddyTowO2Pct} percent. Engage rover mule or shorten traverse.`
        );
      }
    },
    setLtstHour(val) {
      state.ltstHour = Math.max(6.0, Math.min(19.5, Number(val)));
      broadcastMcDirective({
        type: 'env',
        ltstHour: state.ltstHour,
        dustTau: state.dustTau
      });
      recomputeRoute();
    },
    setDustTau(val) {
      state.dustTau = Math.max(0.4, Math.min(3.5, Number(val)));
      const vBtn = document.getElementById('btnVisorDust');
      const dBtn = document.getElementById('btnDustWhiteout');
      const isStorm = state.dustTau >= 2.2;
      if (vBtn) {
        vBtn.classList.toggle('bg-amber-500', isStorm);
        vBtn.classList.toggle('text-stone-950', isStorm);
      }
      if (dBtn) {
        dBtn.classList.toggle('bg-orange-600', isStorm);
        dBtn.classList.toggle('text-white', isStorm);
      }
      broadcastMcDirective({
        type: 'env',
        ltstHour: state.ltstHour,
        dustTau: state.dustTau
      });
      recomputeRoute();
    },
    toggleDustWhiteout() {
      const nextTau = state.dustTau >= 2.2 ? 0.42 : 3.2;
      window.ARES_APP.setDustTau(nextTau);
      if (nextTau >= 2.2) {
        speakSuitVoice(
          'Warning. Regional Martian dust storm whiteout. Optical depth tau 3.2. Recommend engaging Visor Synthetic Vision.'
        );
      } else {
        speakSuitVoice('Atmospheric dust optical depth restored to nominal tau 0.42.');
      }
    },
    resetAtmosNominal() {
      state.ltstHour = 13.5;
      window.ARES_APP.setDustTau(0.42);
    },
    toggleVisorSyntheticVision() {
      state.visorSyntheticVision = !state.visorSyntheticVision;
      const b1 = document.getElementById('btnVisorSynth');
      const b2 = document.getElementById('btnVrSynthOverlay');
      if (b1) {
        b1.classList.toggle('bg-sky-500', state.visorSyntheticVision);
        b1.classList.toggle('text-stone-950', state.visorSyntheticVision);
        b1.classList.toggle('bg-[#1c1917]', !state.visorSyntheticVision);
        b1.classList.toggle('text-sky-300', !state.visorSyntheticVision);
      }
      if (b2) {
        b2.classList.toggle('bg-sky-500', state.visorSyntheticVision);
        b2.classList.toggle('text-stone-950', state.visorSyntheticVision);
      }
      if (state.visorSyntheticVision) {
        speakSuitVoice('Visor Synthetic Vision engaged. Projecting 3D HiRISE topographic wireframe and route corridor.');
      }
      broadcastVisorTelemetry();
      requestRedraw();
    },
    openMicroLab() {
      const modal = document.getElementById('microLabModal');
      if (!modal) return;
      modal.classList.remove('hidden');
      if (window.ARES_MICROLAB) {
        window.ARES_MICROLAB.open(state.theaterKey);
      }
      speakSuitVoice(
        'SHERLOC 248.6 nanometer Deep-UV Raman and PIXL X-ray fluorescence astrobiology lab online.'
      );
    },
    closeMicroLab() {
      const modal = document.getElementById('microLabModal');
      if (modal) modal.classList.add('hidden');
      if (window.ARES_MICROLAB) window.ARES_MICROLAB.close();
    },
    setMicroTarget(key) {
      if (window.ARES_MICROLAB) window.ARES_MICROLAB.setTarget(key);
    },
    setMicroLensMode(mode) {
      if (window.ARES_MICROLAB) window.ARES_MICROLAB.setLensMode(mode);
    },
    logMicroLabSample() {
      if (!window.ARES_MICROLAB) return;
      const smp = window.ARES_MICROLAB.getAssaySamplePayload(state.loggedSamples.length + 1);
      state.loggedSamples.unshift(smp);
      syncAllUI();
      if (state.activeMode === 'science') renderScienceAndManifest();
      speakSuitVoice(`Biosignature micro-assay logged to Flight Data File as ${smp.id}.`);
      const btn = document.getElementById('btnLogMicroSample');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = '✓ MICRO-ASSAY LOGGED TO FDF!';
        setTimeout(() => {
          btn.textContent = orig;
        }, 1400);
      }
    },
    setRoutingMode(mode) {
      state.routingMode = mode || 'optimal';
      if (state.routingMode === 'rad_shelter') {
        state.layers.radiationWeather = true;
      }
      recomputeRoute();
    },
    toggleMuleAssist(checked) {
      state.consumables.muleAssisted = !!checked;
      recomputeRoute();
      speakSuitVoice(
        checked
          ? 'Perseverance robotic mule tether engaged. Suit tool pack offloaded. Walk-back radius extended.'
          : 'Unassisted suit carry mode. Astronaut bearing full 0.38g geological sampling load.'
      );
    },
    toggleElevDrawer() {
      const dr = document.getElementById('elevProfileDrawer');
      const btn = document.getElementById('btnElevDrawer');
      if (!dr) return;
      const isHidden = dr.classList.toggle('hidden');
      if (btn) btn.classList.toggle('active', !isHidden);
      if (!isHidden) {
        setTimeout(renderElevProfile, 30);
      }
    },
    setScrubScope(scope) {
      state.scrubScope = scope === 'full' ? 'full' : 'rim';
      const bRim = document.getElementById('btnScrubRim');
      const bFull = document.getElementById('btnScrubFull');
      if (bRim && bFull) {
        bRim.className =
          state.scrubScope === 'rim'
            ? 'px-2 py-0.5 rounded bg-amber-500/25 border border-amber-500/60 text-amber-300 font-bold text-[10px] transition'
            : 'px-2 py-0.5 rounded bg-[#1c1917] text-stone-300 border border-[#3f3a36] hover:text-white font-bold text-[10px] transition';
        bFull.className =
          state.scrubScope === 'full'
            ? 'px-2 py-0.5 rounded bg-amber-500/25 border border-amber-500/60 text-amber-300 font-bold text-[10px] transition'
            : 'px-2 py-0.5 rounded bg-[#1c1917] text-stone-300 border border-[#3f3a36] hover:text-white font-bold text-[10px] transition';
      }
      if (state.scrubScope === 'full' && !state.layers.m20Traverse) {
        state.layers.m20Traverse = true;
        syncAllUI();
      }
      const pts = getActiveScrubWaypoints();
      const rng = document.getElementById('gpsWaypointScrubber');
      if (rng && pts.length) {
        rng.max = String(pts.length - 1);
        rng.value = String(pts.length - 1);
      }
      if (pts.length) {
        const p0 = pts[0];
        const pN = pts[pts.length - 1];
        const lblS = document.getElementById('lblScrubStart');
        const lblE = document.getElementById('lblScrubEnd');
        if (lblS) lblS.textContent = `SOL ${p0.sol} (${(+p0.dist_km || 0).toFixed(2)} km)`;
        if (lblE) lblE.textContent = `SOL ${pN.sol} (${(+pN.dist_km || 45.25).toFixed(2)} km)`;
        window.ARES_APP.scrubGpsHistory(pts.length - 1);
      }
    },
    scrubGpsHistory(val) {
      const pts = getActiveScrubWaypoints();
      if (!pts.length) return;
      activeScrubIdx = Math.max(0, Math.min(pts.length - 1, Number(val)));
      const pt = pts[activeScrubIdx];
      if (!pt) return;

      const rd = document.getElementById('gpsScrubReadout');
      if (rd) {
        const distFmt = (+pt.dist_km || 0).toFixed(2);
        rd.textContent = `RMC ${pt.rmc} • SOL ${pt.sol} • ${distFmt} km • ELEV ${pt.elev}m`;
      }

      if (typeof pt.lon === 'number' && typeof pt.lat === 'number') {
        state.scrubGpsCoord = [pt.lon, pt.lat];
      }

      const att = document.getElementById('attitudeBadge');
      if (att) {
        const rSign = pt.roll >= 0 ? '+' : '';
        const pSign = pt.pitch >= 0 ? '+' : '';
        att.innerHTML = `<span>ROLL: ${rSign}${pt.roll}°</span><span>PITCH: ${pSign}${pt.pitch}°</span><span class="text-amber-300">TILT: ${pt.tilt}°</span>`;
      }

      const viewer = document.getElementById('nasa3dViewer');
      if (viewer) {
        viewer.orientation = `${pt.roll}deg ${pt.pitch}deg 0deg`;
      }

      state.traverseProgress = activeScrubIdx / Math.max(1, pts.length - 1);
      renderElevProfile();
      requestRedraw();
    },
    selectRawSequence(seqKey) {
      activeSeqKey = seqKey;
      seqFrameIdx = 0;
      const seqs = window.M20_CAMERA_SEQUENCES || {};
      const seq = seqs[activeSeqKey];
      if (seq && seq.frames && seq.frames.length) {
        const fr = seq.frames[0];
        document.getElementById('dockPhoto').src = fr.url;
        document.getElementById('dockMetaInstrument').textContent = seq.instrument;
        document.getElementById('dockMetaSite').textContent = `FRAME 1/${seq.frames.length}`;
      }
    },
    toggleRawSequencePlay() {
      const btn = document.getElementById('btnPlaySeq');
      if (seqTimer) {
        clearInterval(seqTimer);
        seqTimer = null;
        if (btn) btn.innerHTML = '&#9654; PLAY SEQ';
        return;
      }
      if (btn) btn.innerHTML = '&#10074;&#10074; PAUSE SEQ';
      seqTimer = setInterval(() => {
        const seqs = window.M20_CAMERA_SEQUENCES || {};
        const seq = seqs[activeSeqKey];
        if (!seq || !seq.frames || !seq.frames.length) return;
        seqFrameIdx = (seqFrameIdx + 1) % seq.frames.length;
        const fr = seq.frames[seqFrameIdx];
        document.getElementById('dockPhoto').src = fr.url;
        document.getElementById('dockMetaInstrument').textContent = seq.instrument;
        document.getElementById('dockMetaSite').textContent = `FRAME ${seqFrameIdx + 1}/${seq.frames.length}`;
      }, 280);
    },
    toggleGlobeMola() {
      if (!window.ARES_GLOBE) return;
      window.ARES_GLOBE.state.useMolaTexture = !window.ARES_GLOBE.state.useMolaTexture;
      const btn = document.getElementById('btnGlobeMola');
      if (btn) {
        btn.textContent = window.ARES_GLOBE.state.useMolaTexture
          ? 'MOLA DEM (PIA10132)'
          : '8K TRUE-COLOR';
        btn.classList.toggle('active', window.ARES_GLOBE.state.useMolaTexture);
      }
    },
    toggleGlobeSpin() {
      if (!window.ARES_GLOBE) return;
      window.ARES_GLOBE.state.autoRotate = !window.ARES_GLOBE.state.autoRotate;
      const btn = document.getElementById('btnGlobeSpin');
      if (btn) {
        btn.textContent = window.ARES_GLOBE.state.autoRotate ? 'PAUSE ROTATION' : 'AUTO-ROTATE 360°';
      }
    },
    setSunAngle(val) {
      if (!window.ARES_GLOBE) return;
      window.ARES_GLOBE.state.sunAngleRad = Number(val);
    },
    nextWaypoint() {
      const theater = window.ARES_THEATERS[state.theaterKey];
      selectWaypoint((state.selectedWaypointIdx + 1) % theater.waypoints.length);
    },
    prevWaypoint() {
      const theater = window.ARES_THEATERS[state.theaterKey];
      selectWaypoint(
        (state.selectedWaypointIdx - 1 + theater.waypoints.length) % theater.waypoints.length
      );
    },
    updateConsumable(key, val) {
      state.consumables[key] = Number(val);
      recomputeRoute();
    },
    toggleSepStorm() {
      state.sepStormActive = !state.sepStormActive;
      state.routingMode = state.sepStormActive ? 'rad_shelter' : 'optimal';
      if (state.sepStormActive) state.layers.radiationWeather = true;
      const btn = document.getElementById('btnSepStorm');
      if (btn) {
        btn.textContent = state.sepStormActive ? 'SEP STORM: ACTIVE' : 'TRIGGER SOLAR SEP STORM SIM';
        btn.classList.toggle('active', state.sepStormActive);
      }
      if (state.sepStormActive) {
        speakSuitVoice(
          'Warning. Solar energetic particle event detected. Rerouting crew to nearest radiation shelter.'
        );
      }
      recomputeRoute();
    },
    toggleSuitVoice() {
      state.suitVoiceEnabled = !state.suitVoiceEnabled;
      const btn = document.getElementById('btnSuitVoice');
      if (btn) {
        btn.textContent = state.suitVoiceEnabled
          ? 'VOICE: ON'
          : 'VOICE';
        btn.classList.toggle('bg-orange-600', state.suitVoiceEnabled);
        btn.classList.toggle('text-white', state.suitVoiceEnabled);
        btn.classList.toggle('bg-[#292524]', !state.suitVoiceEnabled);
        btn.classList.toggle('text-stone-200', !state.suitVoiceEnabled);
      }
      if (state.suitVoiceEnabled) {
        speakSuitVoice(
          'ARES-NAV xEVA tactical suit voice online. Orbital GPS lock nominal.'
        );
      }
    },
    toggleVoiceCommands() {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      const btn = document.getElementById('btnVoiceCmd');
      if (!SpeechRec) {
        alert(
          'Web Speech Recognition requires Chrome, Edge, or Safari with microphone access.'
        );
        return;
      }

      state.voiceCmdActive = !state.voiceCmdActive;
      if (btn) {
        btn.textContent = state.voiceCmdActive ? 'MIC: ON' : 'MIC';
        btn.classList.toggle('bg-emerald-600', state.voiceCmdActive);
        btn.classList.toggle('text-white', state.voiceCmdActive);
        btn.classList.toggle('bg-[#292524]', !state.voiceCmdActive);
        btn.classList.toggle('text-orange-300', !state.voiceCmdActive);
      }

      if (!state.voiceCmdActive) {
        if (state._speechRec) {
          try {
            state._speechRec.stop();
          } catch (_) {}
        }
        return;
      }

      if (!state.suitVoiceEnabled) {
        window.ARES_APP.toggleSuitVoice();
      } else {
        speakSuitVoice('Hands-free astronaut voice command link listening.');
      }

      if (!state._speechRec) {
        const rec = new SpeechRec();
        rec.continuous = true;
        rec.interimResults = false;
        rec.lang = 'en-US';

        rec.onresult = (ev) => {
          const last = ev.results[ev.results.length - 1];
          if (!last || !last[0]) return;
          const cmd = String(last[0].transcript || '').toLowerCase().trim();
          if (!cmd) return;

          if (cmd.includes('globe') || cmd.includes('planet') || cmd.includes('orbit')) {
            setMode('globe');
          } else if (cmd.includes('terrain') || cmd.includes('hologram') || cmd.includes('onsight')) {
            setMode('map');
            if (!state.terrain3dActive) window.ARES_APP.toggleTerrain3d();
          } else if (cmd.includes('fly')) {
            setMode('map');
            window.ARES_APP.toggleFlyRoute();
          } else if (cmd.includes('synthetic') || cmd.includes('wireframe')) {
            setMode('visor');
            if (!state.visorSyntheticVision) window.ARES_APP.toggleVisorSyntheticVision();
          } else if (cmd.includes('whiteout') || cmd.includes('dust')) {
            window.ARES_APP.toggleDustWhiteout();
          } else if (cmd.includes('micro') || cmd.includes('sherloc')) {
            window.ARES_APP.openMicroLab();
          } else if (cmd.includes('map') || cmd.includes('surface')) {
            setMode('map');
          } else if (cmd.includes('goggle') || cmd.includes('stereo')) {
            setMode('visor');
            if (!state.vrGogglesMode) window.ARES_APP.toggleVrGogglesMode();
          } else if (cmd.includes('visor') || cmd.includes('helmet')) {
            setMode('visor');
          } else if (cmd.includes('science') || cmd.includes('manifest')) {
            setMode('science');
          } else if (cmd.includes('laser') || cmd.includes('zap') || cmd.includes('fire')) {
            fireLaserAt(0.5, 0.5);
          } else if (cmd.includes('sample') || cmd.includes('assay')) {
            if (state.activeMode === 'visor') window.ARES_APP.logLaserAssaySample();
            else logCurrentStationSample();
          } else if (cmd.includes('scout') || cmd.includes('helicopter') || cmd.includes('ingenuity')) {
            window.ARES_APP.toggleIngenuityScout();
          } else if (cmd.includes('emergency') || cmd.includes('abort')) {
            if (!state.emergencyAbortActive) window.ARES_APP.toggleEmergencyAbort();
          } else if (cmd.includes('reset') || cmd.includes('nominal')) {
            if (state.emergencyAbortActive) window.ARES_APP.toggleEmergencyAbort();
          } else if (cmd.includes('next')) {
            window.ARES_APP.nextWaypoint();
          } else if (cmd.includes('previous') || cmd.includes('back')) {
            window.ARES_APP.prevWaypoint();
          } else if (cmd.includes('thermal')) {
            window.ARES_APP.setVisorFilter('thermal');
          } else if (cmd.includes('natural')) {
            window.ARES_APP.setVisorFilter('natural');
          } else if (cmd.includes('center')) {
            window.ARES_APP.recenterVisor();
          } else if (cmd.includes('debrief') || cmd.includes('report')) {
            window.ARES_APP.openMissionDebrief();
          }
        };

        rec.onend = () => {
          if (state.voiceCmdActive) {
            try {
              rec.start();
            } catch (_) {}
          }
        };
        rec.onerror = () => {};
        state._speechRec = rec;
      }

      try {
        state._speechRec.start();
      } catch (_) {}
    },
    openCapcomModal() {
      const modal = document.getElementById('capcomSyncModal');
      if (!modal) return;
      modal.classList.remove('hidden');
      if (window.ARES_CAPCOM) {
        const st = window.ARES_CAPCOM.getStatus();
        const urlEl = document.getElementById('capcomVisorUrl');
        if (urlEl) urlEl.textContent = st.visorUrl;
        const qrEl = document.getElementById('capcomQrContainer');
        if (qrEl) {
          qrEl.innerHTML = window.ARES_CAPCOM.generateQrSvg(st.visorUrl, 176);
        }
        window.ARES_APP.setCapcomRole(st.role, true);
        refreshCapcomUiIndicators();
      }
    },
    closeCapcomModal() {
      const modal = document.getElementById('capcomSyncModal');
      if (modal) modal.classList.add('hidden');
    },
    setCapcomRole(newRole, silent) {
      state.capcomRole = newRole;
      if (window.ARES_CAPCOM) {
        window.ARES_CAPCOM.setRole(newRole);
      }
      ['mc', 'visor', 'off'].forEach((r) => {
        const b = document.getElementById(`btnRole_${r}`);
        if (b) {
          b.className =
            r === newRole
              ? 'py-1.5 rounded bg-orange-600 text-white font-bold text-[10px] transition'
              : 'py-1.5 rounded bg-[#141210] border border-[#3f3a36] text-stone-300 font-bold text-[10px] transition';
        }
      });
      refreshCapcomUiIndicators();
      if (!silent && newRole === 'visor') {
        broadcastVisorTelemetry();
      }
      requestRedraw();
    },
    copyCapcomUrl() {
      if (!window.ARES_CAPCOM) return;
      const url = window.ARES_CAPCOM.getVisorUrl();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).catch(() => {});
      }
      const btn = document.getElementById('btnCopyCapcomUrl');
      if (btn) {
        btn.textContent = 'COPIED';
        setTimeout(() => {
          btn.textContent = 'COPY';
        }, 1200);
      }
    },
    togglePlotPinMode() {
      state.plotPinMode = !state.plotPinMode;
      const btn = document.getElementById('btnPlotPin');
      const mapCanvas = document.getElementById('gisMapCanvas');
      if (btn) {
        btn.textContent = state.plotPinMode ? '+ CLICK MAP' : '+ PIN';
        btn.classList.toggle('bg-orange-600', state.plotPinMode);
        btn.classList.toggle('text-white', state.plotPinMode);
        btn.classList.toggle('bg-[#1c1917]', !state.plotPinMode);
        btn.classList.toggle('text-orange-300', !state.plotPinMode);
      }
      if (mapCanvas) {
        mapCanvas.style.cursor = state.plotPinMode ? 'crosshair' : 'grab';
      }
    },
    clearCustomPins() {
      state.customWaypoints = [];
      const clrBtn = document.getElementById('btnClearPins');
      if (clrBtn) clrBtn.classList.add('hidden');
      recomputeRoute();
      speakSuitVoice('Custom EVA pins cleared. Restored nominal mission route.');
    },
    toggleIngenuityScout() {
      state.ingenuityScoutActive = !state.ingenuityScoutActive;
      const btn = document.getElementById('btnIngenuityScout');
      if (btn) {
        btn.textContent = state.ingenuityScoutActive ? 'SCOUT: ON' : 'SCOUT';
        btn.classList.toggle('bg-amber-500', state.ingenuityScoutActive);
        btn.classList.toggle('text-stone-950', state.ingenuityScoutActive);
        btn.classList.toggle('bg-[#1c1917]', !state.ingenuityScoutActive);
        btn.classList.toggle('text-amber-300', !state.ingenuityScoutActive);
      }
      if (state.ingenuityScoutActive) {
        window.ARES_APP.set3dAsset('ingenuity');
        const att = document.getElementById('attitudeBadge');
        if (att) {
          att.innerHTML =
            '<span>ALT: 12.0m AGL</span><span>ROTOR: 2,537 RPM</span><span class="text-emerald-400">RECON: CLEAR</span>';
        }
        speakSuitVoice(
          'Ingenuity aerial scout deployed to 12 meters altitude. Scanning forward EVA route for slope hazards.'
        );
      } else {
        window.ARES_APP.set3dAsset('perseverance');
      }
      requestRedraw();
    },
    setDrawerMode(mode) {
      state.drawerMode = mode;
      const tabs = {
        elev: 'btnDrawerElev',
        rimfax: 'btnDrawerRimfax',
        plss: 'btnDrawerPlss',
        atmos: 'btnDrawerAtmos'
      };
      Object.entries(tabs).forEach(([k, id]) => {
        const el = document.getElementById(id);
        if (el) {
          el.className =
            k === mode
              ? 'px-2.5 py-0.5 rounded bg-orange-600 text-white font-bold text-[10px] transition'
              : 'px-2.5 py-0.5 rounded bg-[#1c1917] text-stone-300 border border-[#3f3a36] hover:text-white font-bold text-[10px] transition';
        }
      });

      const showScrub = mode === 'elev' || mode === 'rimfax';
      const scopeBtns = document.getElementById('drawerScopeButtons');
      const scrubRow = document.getElementById('drawerScrubRow');
      const plssRow = document.getElementById('drawerPlssControls');
      const atmosRow = document.getElementById('drawerAtmosControls');
      if (scopeBtns) scopeBtns.classList.toggle('hidden', !showScrub);
      if (scrubRow) scrubRow.classList.toggle('hidden', !showScrub);
      if (plssRow) plssRow.classList.toggle('hidden', mode !== 'plss');
      if (atmosRow) atmosRow.classList.toggle('hidden', mode !== 'atmos');

      if (showScrub) {
        const pts = getActiveScrubWaypoints();
        const pt = pts[Math.max(0, Math.min(pts.length - 1, activeScrubIdx))];
        const rd = document.getElementById('gpsScrubReadout');
        if (rd && pt) {
          rd.textContent = `RMC ${pt.rmc} • SOL ${pt.sol} • ${(+pt.dist_km || 0).toFixed(2)} km • ELEV ${pt.elev}m`;
        }
      }
      renderElevProfile();
    },
    toggleLaserAimMode() {
      state.laserAimMode = !state.laserAimMode;
      const btn = document.getElementById('btnLaserAim');
      const visorCanvas = document.getElementById('visorHudCanvas');
      if (btn) {
        btn.textContent = state.laserAimMode
          ? 'AIM LASER: ARMED [L]'
          : 'AIM LASER [L]';
        btn.classList.toggle('bg-red-600', state.laserAimMode);
        btn.classList.toggle('text-white', state.laserAimMode);
      }
      if (visorCanvas) {
        visorCanvas.style.cursor = state.laserAimMode ? 'crosshair' : 'grab';
      }
      requestRedraw();
    },
    logLaserAssaySample() {
      const theater = window.ARES_THEATERS[state.theaterKey];
      const wp = theater.waypoints[state.selectedWaypointIdx] || theater.waypoints[0];
      const ox = state.lastLaserOxides || wp.oxides;
      const targetName = state.lastLaserRockName || wp.name;
      const mineralName = state.lastLaserMineral || wp.crismMineral;
      const newId = `LIBS-0${state.loggedSamples.length + 1}`;
      state.loggedSamples.unshift({
        id: newId,
        stationCode: wp.code,
        theater: theater.shortName,
        name: `${targetName} (${wp.code})`,
        mineral: `${mineralName} (Biosig ${state.lastLaserBiosig || 91}%)`,
        sol: wp.metaBadge.sol,
        coords: wp.metaBadge.coords,
        thumb: wp.thumbUrl,
        notes: `1064nm LIBS Plasma Spectrum: SiO₂ ${ox.SiO2}%, FeOT ${ox.FeOT}%, MgO ${ox.MgO}%, SO₃ ${ox.SO3}%.`
      });
      syncAllUI();
      speakSuitVoice(`SuperCam laser assay logged to sample registry as ${newId}.`);
      const btn = document.getElementById('btnLogLaserSample');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = 'ASSAY LOGGED';
        setTimeout(() => {
          btn.textContent = orig;
        }, 1300);
      }
    },
    toggleSimWalk() {
      state.simRunning = !state.simRunning;
      const btn = document.getElementById('btnSimWalk');
      if (btn) {
        btn.innerHTML = state.simRunning ? '&#10074;&#10074; PAUSE' : '&#9654; DRIVE';
        btn.classList.toggle('bg-emerald-600', state.simRunning);
        btn.classList.toggle('text-white', state.simRunning);
        btn.classList.toggle('bg-[#1c1917]', !state.simRunning);
        btn.classList.toggle('text-emerald-400', !state.simRunning);
      }
    },
    fireLaser() {
      fireLaserAt(0.5, 0.5);
    },
    resetZoom() {
      state.hudZoom = 1.0;
      state.hudPitchOffset = 0;
      const zoomBadge = document.getElementById('visorZoomBadge');
      if (zoomBadge) zoomBadge.textContent = '1.0x ZOOM';
      broadcastVisorTelemetry();
      requestRedraw();
    },
    setDockTab(tab) {
      state.dockTab = tab;
      const pStation = document.getElementById('dockPanelStation');
      const pSuit = document.getElementById('dockPanelSuit');
      const bStation = document.getElementById('btnDockTabStation');
      const bSuit = document.getElementById('btnDockTabSuit');
      const isStation = tab !== 'suit';
      if (pStation) pStation.classList.toggle('hidden', !isStation);
      if (pSuit) pSuit.classList.toggle('hidden', isStation);
      if (bStation) {
        bStation.className = isStation
          ? 'flex-1 py-1.5 rounded-md bg-orange-600 text-white font-mono-tech text-[10.5px] font-extrabold transition text-center'
          : 'flex-1 py-1.5 rounded-md text-stone-400 hover:text-stone-200 font-mono-tech text-[10.5px] font-bold transition text-center';
      }
      if (bSuit) {
        bSuit.className = !isStation
          ? 'flex-1 py-1.5 rounded-md bg-orange-600 text-white font-mono-tech text-[10.5px] font-extrabold transition text-center'
          : 'flex-1 py-1.5 rounded-md text-stone-400 hover:text-stone-200 font-mono-tech text-[10.5px] font-bold transition text-center';
      }
      if (!isStation) {
        ensureDefault3dViewersMounted();
      }
    },
    toggleArPins() {
      state.hideArPins = !state.hideArPins;
      const btn = document.getElementById('btnVisorPins');
      if (btn) {
        btn.textContent = state.hideArPins ? 'AR PINS: OFF' : 'AR PINS: ON';
        btn.classList.toggle('bg-emerald-600/25', !state.hideArPins);
        btn.classList.toggle('text-emerald-300', !state.hideArPins);
        btn.classList.toggle('border-emerald-500/50', !state.hideArPins);
        btn.classList.toggle('bg-[#1c1917]', state.hideArPins);
        btn.classList.toggle('text-stone-400', state.hideArPins);
        btn.classList.toggle('border-[#3f3a36]', state.hideArPins);
      }
      requestRedraw();
    },
    recenterVisor() {
      const theater = window.ARES_THEATERS[state.theaterKey];
      const wp = (theater && theater.waypoints[state.selectedWaypointIdx]) || { hudHeadingDeg: 110 };
      if (typeof state._rawCompassHeading === 'number') {
        state.gyroYawOffset = (wp.hudHeadingDeg - state._rawCompassHeading + 360) % 360;
      }
      if (typeof state._rawPitchVal === 'number') {
        state.gyroPitchZero = state._rawPitchVal;
      }
      state._gyroCalibrated = true;
      state.hudYawDeg = wp.hudHeadingDeg;
      state.hudPitchOffset = 0;
      broadcastVisorTelemetry();
      speakSuitVoice('Visor forward azimuth re-centered.');
      requestRedraw();
    },
    toggleVrGogglesMode() {
      const enteringVr = !state.vrGogglesMode;

      // CRITICAL iOS Safari requirement: request IMU permission synchronously inside the tap gesture!
      if (enteringVr && !state.gyroActive) {
        window.ARES_APP.toggleGyroTracking(true);
      }

      state.vrGogglesMode = enteringVr;
      const topHeader = document.getElementById('appTopHeader');
      const bottomDeck = document.getElementById('visorBottomDeck');
      const topCard = document.getElementById('visorTopLeftCard');
      const vrControls = document.getElementById('vrOverlayControls');
      const vrBtn = document.getElementById('btnVrGoggles');

      if (topHeader) topHeader.classList.toggle('hidden', state.vrGogglesMode);
      if (bottomDeck) bottomDeck.classList.toggle('hidden', state.vrGogglesMode);
      if (topCard) topCard.classList.toggle('hidden', state.vrGogglesMode);
      if (vrControls) vrControls.classList.toggle('hidden', !state.vrGogglesMode);
      if (vrBtn) {
        vrBtn.textContent = state.vrGogglesMode
          ? '3D GOGGLES: ON'
          : '3D GOGGLES [V]';
      }

      if (state.vrGogglesMode) {
        if (state.visorSourceMode !== 'pano' && state.visorSourceMode !== 'butler360') {
          window.ARES_APP.setVisorSource('butler360');
        }
        if (navigator.wakeLock && navigator.wakeLock.request) {
          navigator.wakeLock
            .request('screen')
            .then((sentinel) => {
              state._wakeLock = sentinel;
            })
            .catch(() => {});
        }
        if (document.documentElement.requestFullscreen && window.innerWidth < 1024) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
        speakSuitVoice(
          'Stereoscopic 3D Visor Goggles active with IMU head tracking. Aim crosshair at any science target for 2 seconds to fire laser.'
        );
      } else {
        if (state._wakeLock && state._wakeLock.release) {
          state._wakeLock.release().catch(() => {});
          state._wakeLock = null;
        }
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
      broadcastVisorTelemetry();
      requestRedraw();
    },
    toggleGyroTracking(forceEnable) {
      const syncGyroButtons = (deniedOrInsecureMsg) => {
        const gBtn = document.getElementById('btnGyroTrack');
        const vrGyroBtn = document.getElementById('btnVrGyroOverlay');
        if (gBtn) {
          gBtn.textContent = deniedOrInsecureMsg
            ? deniedOrInsecureMsg
            : state.gyroActive
            ? 'GYRO: ON'
            : 'GYRO TRACK';
          gBtn.classList.toggle('bg-amber-500', state.gyroActive);
          gBtn.classList.toggle('text-stone-950', state.gyroActive);
          gBtn.classList.toggle('bg-[#1c1917]', !state.gyroActive);
          gBtn.classList.toggle('text-amber-300', !state.gyroActive);
        }
        if (vrGyroBtn) {
          vrGyroBtn.textContent = deniedOrInsecureMsg
            ? deniedOrInsecureMsg
            : state.gyroActive
            ? '🎯 GYRO: ON'
            : '🎯 ENABLE GYRO';
          vrGyroBtn.classList.toggle('border-emerald-400', state.gyroActive);
          vrGyroBtn.classList.toggle('text-emerald-300', state.gyroActive);
          vrGyroBtn.classList.toggle('border-amber-400/70', !state.gyroActive);
          vrGyroBtn.classList.toggle('text-amber-300', !state.gyroActive);
        }
      };

      const enableGyroListener = () => {
        state.gyroActive = forceEnable === true ? true : !state.gyroActive;
        if (state.gyroActive) {
          state._gyroCalibrated = false;
        }
        syncGyroButtons(null);

        if (state.gyroActive && !state._gyroBound) {
          state._gyroBound = true;
          let lastMotionMs = 0;
          let lastOrientEventMs = 0;

          // Gimbal-lock-free 3D Camera Look-Vector [0, 0, -1] via W3C Z(alpha)-X'(beta)-Y''(gamma) rotation matrix!
          // Works identically across Portrait, Landscape-Left, Landscape-Right, and across vertical horizon!
          const onOrientation = (ev) => {
            if (!state.gyroActive) return;
            if (typeof ev.beta !== 'number' || typeof ev.gamma !== 'number') return;

            const alphaDeg =
              typeof ev.alpha === 'number'
                ? ev.alpha
                : typeof ev.webkitCompassHeading === 'number'
                ? (360 - ev.webkitCompassHeading) % 360
                : null;
            if (alphaDeg === null) return;

            lastOrientEventMs = performance.now();
            const deg2rad = Math.PI / 180;
            const a = alphaDeg * deg2rad;
            const b = ev.beta * deg2rad;
            const g = ev.gamma * deg2rad;

            const cosA = Math.cos(a);
            const sinA = Math.sin(a);
            const cosB = Math.cos(b);
            const sinB = Math.sin(b);
            const cosG = Math.cos(g);
            const sinG = Math.sin(g);

            // World-frame look vector R * [0, 0, -1]^T
            const fx = -cosA * sinG - sinA * sinB * cosG;
            const fy = -sinA * sinG + cosA * sinB * cosG;
            const fz = -cosB * cosG;

            const horizMag = Math.hypot(fx, fy);
            let rawHeading = state._rawCompassHeading;
            if (horizMag > 0.08) {
              rawHeading = ((Math.atan2(fx, fy) * 180) / Math.PI + 360) % 360;
              state._rawCompassHeading = rawHeading;
            }

            const rawPitch = Math.asin(Math.max(-0.98, Math.min(0.98, fz))) * 0.62;
            state._rawPitchVal = rawPitch;

            // Auto-zero initial head orientation to active station heading so view starts dead-ahead!
            if (!state._gyroCalibrated && typeof rawHeading === 'number') {
              const theater = window.ARES_THEATERS[state.theaterKey];
              const wp =
                (theater && theater.waypoints[state.selectedWaypointIdx]) || { hudHeadingDeg: 110 };
              state.gyroYawOffset = (wp.hudHeadingDeg - rawHeading + 360) % 360;
              state.gyroPitchZero = rawPitch * 0.5;
              state._gyroCalibrated = true;
            }

            if (typeof rawHeading === 'number') {
              const targetYaw = (rawHeading + (state.gyroYawOffset || 0) + 360) % 360;
              const diff = ((targetYaw - state.hudYawDeg + 540) % 360) - 180;
              state.hudYawDeg = (state.hudYawDeg + diff * 0.48 + 360) % 360;
            }

            // Positive fz = looking UP at Martian sky => positive hudPitchOffset shifts panorama down to reveal sky
            const targetPitch = Math.max(
              -0.34,
              Math.min(0.34, rawPitch - (state.gyroPitchZero || 0))
            );
            state.hudPitchOffset =
              state.hudPitchOffset * 0.55 + targetPitch * 0.45;

            broadcastVisorTelemetry();
            requestRedraw();
          };

          window.addEventListener('deviceorientation', onOrientation, true);
          let lastStandardOrientMs = 0;
          window.addEventListener(
            'deviceorientation',
            (ev) => {
              if (typeof ev.alpha === 'number') lastStandardOrientMs = performance.now();
            },
            true
          );
          window.addEventListener(
            'deviceorientationabsolute',
            (ev) => {
              if (performance.now() - lastStandardOrientMs > 400) {
                onOrientation(ev);
              }
            },
            true
          );

          // High-rate 60Hz angular-velocity gyroscope fallback when DeviceOrientation is unavailable
          window.addEventListener(
            'devicemotion',
            (ev) => {
              if (!state.gyroActive || !ev.rotationRate) return;
              const now = performance.now();
              const dt = lastMotionMs ? Math.min(0.08, (now - lastMotionMs) / 1000) : 0;
              lastMotionMs = now;
              if (dt <= 0 || now - lastOrientEventMs < 260) return;

              const scrAngle =
                (window.screen &&
                  window.screen.orientation &&
                  typeof window.screen.orientation.angle === 'number'
                  ? window.screen.orientation.angle
                  : window.orientation) || 0;

              const rBeta = ev.rotationRate.beta || 0;   // deg/s around device X (portrait left->right)
              const rGamma = ev.rotationRate.gamma || 0; // deg/s around device Y (portrait bottom->top)

              let yawRate = 0;
              let pitchRate = 0;
              if (scrAngle === 90) {
                yawRate = rBeta;
                pitchRate = rGamma;
              } else if (scrAngle === -90 || scrAngle === 270) {
                yawRate = -rBeta;
                pitchRate = -rGamma;
              } else {
                yawRate = -rGamma;
                pitchRate = rBeta;
              }

              if (Math.abs(yawRate) < 0.25 && Math.abs(pitchRate) < 0.25) return;
              state.hudYawDeg = (state.hudYawDeg + yawRate * dt + 360) % 360;
              state.hudPitchOffset = Math.max(
                -0.34,
                Math.min(0.34, state.hudPitchOffset + pitchRate * dt * 0.011)
              );
              broadcastVisorTelemetry();
              requestRedraw();
            },
            true
          );
        }

        if (state.gyroActive && forceEnable !== true) {
          speakSuitVoice('Gyroscope 3D head-tracking active.');
        }
        requestRedraw();
      };

      if (state.gyroActive && forceEnable !== true) {
        enableGyroListener();
        return;
      }

      if (
        typeof window.isSecureContext === 'boolean' &&
        !window.isSecureContext &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1'
      ) {
        syncGyroButtons('HTTPS NEEDED');
        speakSuitVoice('Mobile browsers require an HTTPS connection to unlock gyroscope sensors.');
        return;
      }

      // iOS 13+ Safari requires explicit synchronous permission request inside user tap gesture
      const reqPromises = [];
      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function'
      ) {
        reqPromises.push(DeviceOrientationEvent.requestPermission().catch(() => 'denied'));
      }
      if (
        typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function'
      ) {
        reqPromises.push(DeviceMotionEvent.requestPermission().catch(() => 'denied'));
      }

      if (reqPromises.length) {
        Promise.all(reqPromises).then((results) => {
          if (results.includes('granted')) {
            enableGyroListener();
          } else {
            state.gyroActive = false;
            syncGyroButtons('ALLOW MOTION');
          }
        });
      } else {
        enableGyroListener();
      }
    },
    toggleStep(key) {
      state.checkedSteps[key] = !state.checkedSteps[key];
      renderScienceAndManifest();
    },
    setEdrFilter(sub) {
      state.edrFilter = sub;
      ['ALL', 'CURIOSITY', 'ZCAM', 'NCAM', 'SRLC', 'FHAZ', 'SCAM', 'MEDA'].forEach((k) => {
        const btn = document.getElementById(`edrBtn_${k}`);
        if (btn) {
          btn.className =
            k === sub
              ? 'px-2.5 py-1.5 rounded bg-orange-600 text-white font-bold transition'
              : k === 'CURIOSITY'
              ? 'px-2.5 py-1.5 rounded bg-[#1c1917] hover:bg-[#292524] text-amber-300 border border-[#3f3a36] transition'
              : 'px-2.5 py-1.5 rounded bg-[#1c1917] hover:bg-[#292524] text-stone-200 border border-[#3f3a36] transition';
        }
      });
      renderScienceAndManifest();
    },
    inspectManifestImage(panoPath, title, badgeText) {
      state.customHudImage = panoPath;
      state.customHudTitle = title;
      state.customHudBadge = badgeText;
      state.hudZoom = 1.0;
      state.hudPitchOffset = 0;
      setMode('visor');
      syncAllUI();
      requestRedraw();
    },
    toggleEmergencyAbort() {
      state.emergencyAbortActive = !state.emergencyAbortActive;
      const banner = document.getElementById('masterCautionBanner');
      const btn = document.getElementById('btnEmergencyAbort');
      if (banner) banner.classList.toggle('hidden', !state.emergencyAbortActive);
      if (btn) {
        btn.textContent = state.emergencyAbortActive
          ? 'RESET ABORT'
          : 'ABORT SIM';
        btn.classList.toggle('bg-red-600', state.emergencyAbortActive);
        btn.classList.toggle('text-white', state.emergencyAbortActive);
      }

      if (state._abortInterval) {
        clearInterval(state._abortInterval);
        state._abortInterval = null;
      }

      if (state.emergencyAbortActive) {
        // Capture exact crew origin on the active traverse for 2-Stage Shelter Diversion
        state.emergencyOrigin = getCurrentCrewNormPos();
        state.emergencyProgress = 0;
        state._shelterReachedAnnounced = false;

        // Play dual-tone aerospace Master Caution chime
        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (Ctx) {
            if (!audioCtx) audioCtx = new Ctx();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            [880, 660].forEach((freq, i) => {
              const osc = audioCtx.createOscillator();
              const g = audioCtx.createGain();
              osc.type = 'triangle';
              osc.frequency.value = freq;
              g.gain.value = 0.22;
              osc.connect(g);
              g.connect(audioCtx.destination);
              osc.start(audioCtx.currentTime + i * 0.14);
              osc.stop(audioCtx.currentTime + i * 0.14 + 0.12);
            });
          }
        } catch (e) {}

        state.sepStormActive = true;
        state.routingMode = 'rad_shelter';
        state.layers.radiationWeather = true;
        state.layers.topoSlope = true;
        state.consumables.o2Pct = 46;
        state.simRunning = true;
        const simBtn = document.getElementById('btnSimWalk');
        if (simBtn) {
          simBtn.innerHTML = '&#10074;&#10074; PAUSE';
          simBtn.classList.add('bg-emerald-600', 'text-white');
        }
        recomputeRoute();
        broadcastMcDirective({
          type: 'abort',
          emergencyAbort: true,
          dustTau: state.dustTau,
          ltstHour: state.ltstHour
        });
        speakSuitVoice(
          'Master Caution. Suit primary oxygen regulator leak and Solar Particle Event detected. Walk-back envelope shrinking. Sprinting to Waypoint 3 Basalt Overhang Shelter.'
        );

        state._abortInterval = setInterval(() => {
          if (!state.emergencyAbortActive) return;
          if (state.consumables.o2Pct > 28 && (state.emergencyProgress || 0) < 0.98) {
            state.consumables.o2Pct -= 2;
            const cBadge = document.getElementById('cautionTimerBadge');
            if (cBadge) {
              cBadge.textContent = `O₂: ${state.consumables.o2Pct}% (SPRINTING)`;
            }
            recomputeRoute();
          } else if ((state.emergencyProgress || 0) >= 0.98) {
            const cBadge = document.getElementById('cautionTimerBadge');
            if (cBadge) {
              cBadge.textContent = `✓ SHELTERED • O₂ ${state.consumables.o2Pct}% STABILIZED`;
            }
          }
        }, 1500);
      } else {
        state.sepStormActive = false;
        state.emergencyOrigin = null;
        state.emergencyProgress = 0;
        state._shelterReachedAnnounced = false;
        state.routingMode = 'optimal';
        state.consumables.o2Pct = 86;
        recomputeRoute();
        broadcastMcDirective({
          type: 'abort',
          emergencyAbort: false,
          dustTau: state.dustTau,
          ltstHour: state.ltstHour
        });
        speakSuitVoice('Emergency simulation cleared. Suit life support and oxygen reserves restored to nominal.');
      }
    },
    startJudgeTour() {
      state.tourActive = true;
      state.tourStepIdx = 0;
      state.tourAutoPlay = true;
      const banner = document.getElementById('judgeTourBanner');
      if (banner) banner.classList.remove('hidden');
      window.ARES_APP.applyTourStep(0);
      window.ARES_APP.scheduleTourAutoAdvance();
    },
    scheduleTourAutoAdvance() {
      if (state._tourTimer) clearTimeout(state._tourTimer);
      if (!state.tourActive || !state.tourAutoPlay) return;
      state._tourTimer = setTimeout(() => {
        if (!state.tourActive || !state.tourAutoPlay) return;
        if (state.tourStepIdx < 4) {
          window.ARES_APP.nextTourStep();
        } else {
          state.tourAutoPlay = false;
          const bAuto = document.getElementById('btnTourAuto');
          if (bAuto) bAuto.innerHTML = '&#9654; DONE';
        }
      }, 7500);
    },
    toggleTourAutoPlay() {
      state.tourAutoPlay = !state.tourAutoPlay;
      const bAuto = document.getElementById('btnTourAuto');
      if (bAuto) {
        bAuto.innerHTML = state.tourAutoPlay ? '&#9654; AUTO' : '&#10074;&#10074; PAUSED';
      }
      if (state.tourAutoPlay) window.ARES_APP.scheduleTourAutoAdvance();
      else if (state._tourTimer) clearTimeout(state._tourTimer);
    },
    nextTourStep() {
      state.tourStepIdx = ((state.tourStepIdx || 0) + 1) % 5;
      window.ARES_APP.applyTourStep(state.tourStepIdx);
      window.ARES_APP.scheduleTourAutoAdvance();
    },
    prevTourStep() {
      state.tourStepIdx = ((state.tourStepIdx || 0) + 4) % 5;
      window.ARES_APP.applyTourStep(state.tourStepIdx);
      window.ARES_APP.scheduleTourAutoAdvance();
    },
    stopJudgeTour() {
      state.tourActive = false;
      state.tourAutoPlay = false;
      if (state._tourTimer) clearTimeout(state._tourTimer);
      const banner = document.getElementById('judgeTourBanner');
      if (banner) banner.classList.add('hidden');
      if (state.emergencyAbortActive) window.ARES_APP.toggleEmergencyAbort();
      window.ARES_APP.closeMissionDebrief();
    },
    applyTourStep(idx) {
      const stages = [
        {
          badge: 'STAGE 1 / 5',
          title: 'Orbital GPS Constellation Lock & Descent to Jezero Crater',
          desc: '3D Mars Globe locked onto MRO, Odyssey & MAVEN relays above Neretva Vallis (18.44°N, 77.23°E). Descending to surface...',
          voice: 'Stage 1. Orbital GPS constellation lock established. Descending into Jezero Crater Western Rim.'
        },
        {
          badge: 'STAGE 2 / 5',
          title: 'WebGL 3D Holographic Terrain Table, Canyon Chase Fly-Through & Ingenuity Scout',
          desc: 'Extruding real 100×68 MRO HiRISE DEM in 3D (-24% O₂ A* ribbon vs Red cliff line) with autonomous Chase Camera & LiDAR Scout.',
          voice: 'Stage 2. JPL OnSight 3D Holographic Terrain Table active with autonomous canyon fly-through and Ingenuity aerial scout.'
        },
        {
          badge: 'STAGE 3 / 5',
          title: 'Master Caution: 2-Stage Emergency Shelter Diversion (WP-03)',
          desc: 'Simulating Suit O₂ leak & SEP storm — watch the crew divert into WP-03 Basalt Overhang (-74% proton flux) with Stage-2 HAB walk-back.',
          voice: 'Stage 3. Simulating Solar Particle Storm and suit oxygen leak. Diverting astronauts into Waypoint 3 Basalt Overhang Shelter.'
        },
        {
          badge: 'STAGE 4 / 5',
          title: '29,517px Mastcam-Z 360° Visor HUD & 240–850nm LIBS Spectrum',
          desc: 'Exploring the 242-MP Butler Landing 360° panorama, firing the 1064nm SuperCam laser, and inspecting atomic emission peaks.',
          voice: 'Stage 4. 360 Helmet Visor optics online. Firing SuperCam 1064 nanometer laser and analyzing atomic emission spectrum.'
        },
        {
          badge: 'STAGE 5 / 5',
          title: 'NASA Flight Data File (FDF) Debrief & 219 Real Local Mission Files',
          desc: 'Complete EVA traverse verification report, A* oxygen savings proof, collected core samples, and 219 real Mars 2020 & Curiosity files.',
          voice: 'Stage 5. Mission Debrief and Flight Data File generated with full sample registry.'
        }
      ];

      const st = stages[idx] || stages[0];
      const bEl = document.getElementById('tourStepBadge');
      const tEl = document.getElementById('tourStepTitle');
      const dEl = document.getElementById('tourStepDesc');
      if (bEl) bEl.textContent = st.badge;
      if (tEl) tEl.textContent = st.title;
      if (dEl) dEl.textContent = st.desc;
      speakSuitVoice(st.voice);

      if (idx === 0) {
        window.ARES_APP.closeMissionDebrief();
        if (state.emergencyAbortActive) window.ARES_APP.toggleEmergencyAbort();
        setMode('globe');
        setTimeout(() => {
          if (state.tourActive && state.tourStepIdx === 0) {
            window.ARES_APP.descendToSector('jezero');
          }
        }, 2800);
      } else if (idx === 1) {
        window.ARES_APP.closeMissionDebrief();
        window.ARES_APP.closeMicroLab();
        if (state.emergencyAbortActive) window.ARES_APP.toggleEmergencyAbort();
        setMode('map');
        state.layers.topoSlope = true;
        state.layers.m20Traverse = true;
        if (!state.terrain3dActive) window.ARES_APP.toggleTerrain3d();
        if (window.ARES_TERRAIN3D && !window.ARES_TERRAIN3D.cam.flyActive) {
          window.ARES_APP.toggleFlyRoute();
        }
        if (!state.ingenuityScoutActive) window.ARES_APP.toggleIngenuityScout();
        if (!state.simRunning) window.ARES_APP.toggleSimWalk();
        syncAllUI();
        requestRedraw();
      } else if (idx === 2) {
        window.ARES_APP.closeMissionDebrief();
        window.ARES_APP.closeMicroLab();
        if (state.terrain3dActive) window.ARES_APP.toggleTerrain3d();
        setMode('map');
        if (!state.emergencyAbortActive) window.ARES_APP.toggleEmergencyAbort();
        requestRedraw();
      } else if (idx === 3) {
        window.ARES_APP.closeMissionDebrief();
        if (state.emergencyAbortActive) window.ARES_APP.toggleEmergencyAbort();
        setMode('visor');
        window.ARES_APP.setVisorSource('butler360');
        setTimeout(() => {
          fireLaserAt(0.52, 0.56);
        }, 900);
      } else if (idx === 4) {
        if (state.emergencyAbortActive) window.ARES_APP.toggleEmergencyAbort();
        setMode('science');
        setTimeout(() => {
          window.ARES_APP.openMissionDebrief();
        }, 600);
      }
    }
  };

  window.addEventListener('DOMContentLoaded', () => {
    setupEvents();
    init3dModels();
    recomputeRoute();

    // Initialize CapCom Live Wi-Fi Telemetry Link (Laptop Mission Control <-> iPhone 3D Visor)
    if (window.ARES_CAPCOM) {
      const initInfo = window.ARES_CAPCOM.init({
        onRemoteState(pkt) {
          state.capcomLinked = true;
          if (pkt.theaterKey && pkt.theaterKey !== state.theaterKey && window.ARES_THEATERS[pkt.theaterKey]) {
            setTheater(pkt.theaterKey);
          }
          if (
            typeof pkt.selectedWaypointIdx === 'number' &&
            pkt.selectedWaypointIdx !== state.selectedWaypointIdx
          ) {
            state.selectedWaypointIdx = pkt.selectedWaypointIdx;
            syncAllUI();
          }
          if (typeof pkt.hudYawDeg === 'number') state.hudYawDeg = pkt.hudYawDeg;
          if (typeof pkt.hudPitchOffset === 'number') state.hudPitchOffset = pkt.hudPitchOffset;
          if (typeof pkt.hudZoom === 'number') {
            state.hudZoom = pkt.hudZoom;
            const zb = document.getElementById('visorZoomBadge');
            if (zb) zb.textContent = `${state.hudZoom.toFixed(1)}x ZOOM`;
          }
          if (pkt.visorFilterMode && pkt.visorFilterMode !== state.visorFilterMode) {
            state.visorFilterMode = pkt.visorFilterMode;
          }
          if (typeof pkt.visorSyntheticVision === 'boolean') {
            state.visorSyntheticVision = pkt.visorSyntheticVision;
          }
          if (typeof pkt.gazeDwellProgress === 'number') {
            state.gazeDwellProgress = pkt.gazeDwellProgress;
          }
          if (pkt.isNewLaser && pkt.laserEvent) {
            fireLaserAt(pkt.laserEvent.normX ?? 0.5, pkt.laserEvent.normY ?? 0.5, true);
          }
          refreshCapcomUiIndicators();
          requestRedraw();
        },
        onMcDirective(dir) {
          if (!dir) return;
          state.capcomLinked = true;
          playQuindarTone(dir.type !== 'clear_mark');

          if (dir.type === 'mark' && dir.target) {
            state.capcomTarget = dir.target;
            speakSuitVoice(
              `CapCom target received. Turn to bearing ${dir.target.bearingDeg || 110} degrees, range ${dir.target.distM || 45} meters.`
            );
          } else if (dir.type === 'clear_mark') {
            state.capcomTarget = null;
          }

          if (typeof dir.dustTau === 'number' && Math.abs(dir.dustTau - state.dustTau) > 0.03) {
            state.dustTau = dir.dustTau;
            if (state.dustTau >= 2.2 && !state.visorSyntheticVision) {
              speakSuitVoice('Dust storm whiteout warning from Mission Control. Tap Synth Vision for DEM terrain lock.');
            }
          }
          if (typeof dir.ltstHour === 'number') {
            state.ltstHour = dir.ltstHour;
          }
          if (typeof dir.emergencyAbort === 'boolean' && dir.emergencyAbort !== state.emergencyAbortActive) {
            window.ARES_APP.toggleEmergencyAbort();
          }

          syncAllUI();
          requestRedraw();
        }
      });

      state.capcomRole = initInfo.role;
      if (initInfo.isVisorAutoLaunch) {
        setMode('visor');
        window.ARES_APP.setVisorSource('butler360');
        setTimeout(() => {
          broadcastVisorTelemetry();
          refreshCapcomUiIndicators();
        }, 250);
      }
    }

    window.addEventListener('resize', requestRedraw);
    requestAnimationFrame(masterLoop);
  });
})();
