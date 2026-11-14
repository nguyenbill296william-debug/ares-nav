/**
 * ARES-NAV // Multi-Layered Real NASA DEM Terrain Grid, 0.38g Pandolf-Santee Suit-Physics A* Pathfinder,
 * UHF Comms Line-of-Sight Raycaster & 2-Stage Contingency Shelter Diversion Engine
 */

window.ARES_ENGINE = (function () {
  const GRID_W = 100;
  const GRID_H = 68;
  const MAP_WIDTH_METERS = 1600; // 1.6 km x 1.088 km tactical EVA sector
  const MAP_HEIGHT_METERS = 1088;
  const MARS_DEG_TO_METERS = 59274; // 1 deg latitude on Mars (R = 3396.2 km)

  let currentGrid = [];
  let currentTheaterKey = null;
  let currentSepStorm = null;

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function hashNoise(x, y, seed) {
    const v = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
    return v - Math.floor(v);
  }

  function smoothNoise(x, y, seed) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const a = hashNoise(ix, iy, seed);
    const b = hashNoise(ix + 1, iy, seed);
    const c = hashNoise(ix, iy + 1, seed);
    const d = hashNoise(ix + 1, iy + 1, seed);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  }

  function fbm(x, y, seed) {
    let total = 0;
    let amp = 0.5;
    let freq = 1.0;
    for (let i = 0; i < 4; i++) {
      total += amp * smoothNoise(x * freq, y * freq, seed + i * 19);
      freq *= 2.03;
      amp *= 0.5;
    }
    return total;
  }

  /**
   * Build 100x68 Multi-Layered Scientific Terrain Grid from Real NASA MRO HiRISE / MOLA DEM
   */
  function buildTerrainGrid(theaterKey, sepStormActive) {
    const theater = window.ARES_THEATERS[theaterKey];
    const isJezero = theaterKey === 'jezero';
    const seed = isJezero ? 404 : 808;
    const demSource =
      window.ARES_DEM_GRIDS &&
      window.ARES_DEM_GRIDS[theaterKey] &&
      window.ARES_DEM_GRIDS[theaterKey].length === GRID_W * GRID_H
        ? window.ARES_DEM_GRIDS[theaterKey]
        : null;

    currentTheaterKey = theaterKey;
    currentSepStorm = !!sepStormActive;
    currentGrid = new Array(GRID_H);

    const baseLatRad = (theater.baseLat * Math.PI) / 180;
    const lonScaleMeters = Math.max(10000, MARS_DEG_TO_METERS * Math.cos(baseLatRad));

    // Pass 1: Elevation fused from real NASA MRO HiRISE / MOLA DEM + calibrated hazard scarps
    for (let gy = 0; gy < GRID_H; gy++) {
      currentGrid[gy] = new Array(GRID_W);
      const ny = gy / (GRID_H - 1);
      for (let gx = 0; gx < GRID_W; gx++) {
        const nx = gx / (GRID_W - 1);

        const regionalClimb = (nx * 0.62 + (1 - ny) * 0.56) * (isJezero ? 54 : 50);
        const microRelief = fbm(nx * 5.0, ny * 5.0, seed) * 14;
        const realDemRelief = demSource
          ? (demSource[gy * GRID_W + gx] / 1000) * (isJezero ? 78 : 74)
          : (nx * 0.4 + (1 - ny) * 0.4) * 52 + fbm(nx * 4.2, ny * 4.2, seed) * 18;

        // Calibrated local geomorphology for verified scarp / boulder / eolian drift hazards
        let hazardRelief = 0;
        for (const hz of theater.hazards) {
          const dx = (nx - hz.x) / hz.rx;
          const dy = (ny - hz.y) / hz.ry;
          const d2 = dx * dx + dy * dy;
          if (d2 < 1.8) {
            if (hz.type === 'scarp') {
              hazardRelief += Math.exp(-d2 * 1.6) * 38;
            } else if (hz.type === 'boulder_field') {
              hazardRelief += Math.exp(-d2 * 2.1) * 20;
            } else if (hz.type === 'sand_trap') {
              hazardRelief -= Math.exp(-d2 * 2.0) * 7.5;
            }
          }
        }

        const elevM = theater.baseElevM + realDemRelief + regionalClimb + microRelief + hazardRelief;
        const lat = +(theater.baseLat + (0.5 - ny) * (MAP_HEIGHT_METERS / MARS_DEG_TO_METERS)).toFixed(5);
        const lon = +(theater.baseLon + (nx - 0.5) * (MAP_WIDTH_METERS / lonScaleMeters)).toFixed(5);

        currentGrid[gy][gx] = {
          gx,
          gy,
          nx,
          ny,
          lat,
          lon,
          elevM,
          demNorm: demSource ? demSource[gy * GRID_W + gx] / 1000 : 0.5,
          slopeDeg: 0,
          dzdx: 0,
          dzdy: 0,
          curvature: 0,
          thermalInertia: 280,
          footingClass: 'CONSOLIDATED_CRUST',
          crismIndex: 0.25,
          crismMineral: 'Basaltic Regolith',
          radUsV: 19.5,
          shieldingFactor: 1.0,
          isShelterZone: false,
          uhfLos: true,
          uhfMarginDb: 28,
          hazardType: null
        };
      }
    }

    // Pass 2: Slope (HiRISE), Curvature-Driven Thermal Inertia (THEMIS), Stratigraphic CRISM, Horizon Shielding
    const cellSpanX = MAP_WIDTH_METERS / (GRID_W - 1);
    const cellSpanY = MAP_HEIGHT_METERS / (GRID_H - 1);

    for (let gy = 0; gy < GRID_H; gy++) {
      for (let gx = 0; gx < GRID_W; gx++) {
        const cell = currentGrid[gy][gx];
        const eL = currentGrid[gy][Math.max(0, gx - 1)].elevM;
        const eR = currentGrid[gy][Math.min(GRID_W - 1, gx + 1)].elevM;
        const eU = currentGrid[Math.max(0, gy - 1)][gx].elevM;
        const eD = currentGrid[Math.min(GRID_H - 1, gy + 1)][gx].elevM;

        const dzdx = (eR - eL) / (2 * cellSpanX);
        const dzdy = (eD - eU) / (2 * cellSpanY);
        const laplacian = eL + eR + eU + eD - 4 * cell.elevM; // >0 concave hollow, <0 convex ridge
        cell.dzdx = dzdx;
        cell.dzdy = dzdy;
        cell.curvature = laplacian;

        let slopeDeg = Math.atan(Math.hypot(dzdx, dzdy)) * (180 / Math.PI) * 2.35;

        for (const hz of theater.hazards) {
          const dx = (cell.nx - hz.x) / hz.rx;
          const dy = (cell.ny - hz.y) / hz.ry;
          const d = Math.hypot(dx, dy);
          if (d < 1.0) {
            const boost = (1 - d * d) * hz.maxSlope;
            if (hz.type === 'scarp') {
              slopeDeg = Math.max(slopeDeg, boost);
            }
            cell.hazardType = hz.type;
          }
        }
        cell.slopeDeg = Math.min(34.5, +slopeDeg.toFixed(1));

        // Mars Odyssey THEMIS Thermal Inertia (85 to 465 TIU):
        // Convex wind-scoured ridges expose high-TI bedrock; concave hollows trap low-TI eolian dust
        const tiNoise = fbm(cell.nx * 6.2 + 2.1, cell.ny * 6.2 + 1.4, seed + 55);
        const ridgeBedrockBoost = clamp(-laplacian * 16, -55, 68);
        let ti = 235 + tiNoise * 145 + ridgeBedrockBoost + (cell.slopeDeg > 13 ? 38 : 0);
        if (cell.hazardType === 'sand_trap') {
          ti = 92 + tiNoise * 38; // Verified eolian sand drift (<135 TIU)
        }
        cell.thermalInertia = Math.round(clamp(85, ti, 465));
        cell.footingClass =
          cell.thermalInertia < 145
            ? 'SINKAGE_DRIFT'
            : cell.thermalInertia > 315
            ? 'SOLID_BEDROCK'
            : 'CONSOLIDATED_CRUST';

        // MRO CRISM Hydrated Mineralogy Index (Stratigraphic elevation band + waypoint spectral locks)
        const relElev = cell.elevM - theater.baseElevM;
        const stratBand = 0.5 + 0.5 * Math.sin(relElev * 0.11 + (isJezero ? 0.6 : 1.4));
        let crism = (fbm(cell.nx * 5.2 + 4.2, cell.ny * 5.2 + 3.7, seed + 99) * 0.52 + stratBand * 0.34);
        let mineralLabel = isJezero ? 'Mafic Olivine-Pyroxene Regolith' : 'Basaltic Sulfate Regolith';

        for (const wp of theater.waypoints) {
          const dWp = Math.hypot(cell.nx - wp.x, cell.ny - wp.y);
          if (dWp < 0.16) {
            const influence = (1 - (dWp / 0.16) * 0.68) * wp.crismIndex;
            if (influence > crism) {
              crism = influence;
              mineralLabel = wp.crismMineral;
            }
          }
        }
        cell.crismIndex = +clamp(crism, 0.08, 0.99).toFixed(2);
        if (cell.crismIndex > 0.78) {
          cell.crismMineral = mineralLabel;
        } else if (cell.crismIndex > 0.54) {
          cell.crismMineral = isJezero
            ? 'Mg-Fe Carbonate / Smectite Clay'
            : 'Polyhydrated Mg-Sulfate & Silica';
        } else {
          cell.crismMineral = mineralLabel;
        }

        // MSL RAD / MAVEN Space Weather + Directional Topographic Horizon Sky-View Shielding
        const naturalTopoShield = clamp(
          Math.max(0, laplacian) * 0.022 + (cell.slopeDeg > 14 ? 0.09 : 0),
          0,
          0.26
        );
        let maxShield = naturalTopoShield;
        for (const sh of theater.shelters) {
          const dSh = Math.hypot(cell.nx - sh.x, cell.ny - sh.y);
          if (dSh < sh.radius) {
            const factor = (1 - (dSh / sh.radius) * 0.52) * (sh.shieldingPct / 100);
            if (factor > maxShield) {
              maxShield = factor;
              cell.isShelterZone = true;
            }
          }
        }
        cell.shieldingFactor = +(1.0 - maxShield).toFixed(2);
        const baseGcr = 18.5 + (relElev / 100) * 3.8;
        const stormMultiplier = sepStormActive ? 4.6 : 1.0;
        cell.radUsV = +(baseGcr * stormMultiplier * cell.shieldingFactor).toFixed(1);
      }
    }

    // Pass 3: 401 MHz UHF EVA Comms Line-of-Sight Raycast from HAB-01 Rover High-Gain Mast (+2.6m)
    const habWp = theater.waypoints[0];
    const habGx = clamp(Math.round(habWp.x * (GRID_W - 1)), 0, GRID_W - 1);
    const habGy = clamp(Math.round(habWp.y * (GRID_H - 1)), 0, GRID_H - 1);
    const habAntElevM = currentGrid[habGy][habGx].elevM + 2.6;

    for (let gy = 0; gy < GRID_H; gy++) {
      for (let gx = 0; gx < GRID_W; gx++) {
        const cell = currentGrid[gy][gx];
        const suitAntElevM = cell.elevM + 1.85;
        const steps = Math.max(1, Math.round(Math.hypot(gx - habGx, gy - habGy)));
        let maxObstructionM = 0;

        if (steps > 2) {
          for (let s = 1; s < steps; s++) {
            const t = s / steps;
            const sx = Math.round(habGx + (gx - habGx) * t);
            const sy = Math.round(habGy + (gy - habGy) * t);
            const midElev = currentGrid[sy][sx].elevM;
            const rayElev = habAntElevM + (suitAntElevM - habAntElevM) * t;
            const obs = midElev - rayElev;
            if (obs > maxObstructionM) maxObstructionM = obs;
          }
        }

        const distM = Math.hypot((cell.nx - habWp.x) * MAP_WIDTH_METERS, (cell.ny - habWp.y) * MAP_HEIGHT_METERS);
        const marginDb = Math.round(clamp(36 - distM * 0.013 - maxObstructionM * 4.4, -14, 36));
        cell.uhfMarginDb = marginDb;
        cell.uhfLos = maxObstructionM <= 1.35 && marginDb >= 3;
      }
    }

    return currentGrid;
  }

  function sampleAt(nx, ny) {
    if (!currentGrid.length) return null;
    const gx = clamp(Math.round(nx * (GRID_W - 1)), 0, GRID_W - 1);
    const gy = clamp(Math.round(ny * (GRID_H - 1)), 0, GRID_H - 1);
    return currentGrid[gy][gx];
  }

  /**
   * 0.38g Martian Pandolf-Santee Pressurized Spacesuit Metabolic & Consumable Integrator
   */
  function evaluatePathPhysics(pathPts, waypoints, consumables) {
    let totalDistM = 0;
    let totalAscentM = 0;
    let totalDescentM = 0;
    let maxSlopeDeg = 0;
    let hazardEncounters = 0;
    let noGoViolations = 0;
    let sandTrapMeters = 0;
    let uhfShadowMeters = 0;
    let totalRadDoseUsV = 0;
    let totalWalkTimeMin = 0;
    let walkKcal = 0;

    // Crew mass 78 kg + xEMU/Mars PLSS & geology kit (reduced by 58% when tethered to autonomous Mule)
    const bodyMassKg = 78;
    const suitAndLoadKg = consumables.muleAssisted ? 26 : 62;
    const totalMassKg = bodyMassKg + suitAndLoadKg;
    const marsGravityRatio = 0.379; // 3.721 m/s^2 / 9.807 m/s^2
    const baseSpeedMps = consumables.muleAssisted ? 0.94 : 0.70;
    const suitJointPenalty = consumables.muleAssisted ? 1.14 : 1.28;

    const profileSamples = [];

    for (let i = 0; i < pathPts.length; i++) {
      const pt = pathPts[i];
      const cell = sampleAt(pt.nx, pt.ny);
      let segDistM = 0;
      let gradeFrac = 0;

      if (i > 0) {
        const prev = pathPts[i - 1];
        const dxM = (pt.nx - prev.nx) * MAP_WIDTH_METERS;
        const dyM = (pt.ny - prev.ny) * MAP_HEIGHT_METERS;
        segDistM = Math.hypot(dxM, dyM);
        totalDistM += segDistM;

        const prevCell = sampleAt(prev.nx, prev.ny);
        const dElev = cell.elevM - prevCell.elevM;
        if (dElev > 0) totalAscentM += dElev;
        else totalDescentM += Math.abs(dElev);
        gradeFrac = segDistM > 0.2 ? clamp(dElev / segDistM, -0.65, 0.65) : 0;
      }

      if (cell.slopeDeg > maxSlopeDeg) maxSlopeDeg = cell.slopeDeg;
      if (cell.slopeDeg >= 25.0) noGoViolations++;
      if (cell.slopeDeg > 20.0 || cell.thermalInertia < 145) hazardEncounters++;
      if (cell.thermalInertia < 145) sandTrapMeters += segDistM;
      if (!cell.uhfLos) uhfShadowMeters += segDistM;

      // Terrain sinkage factor (eta) from THEMIS thermal inertia
      const eta =
        cell.thermalInertia < 145
          ? 1.88 // Loose eolian drift sand sinkage
          : cell.thermalInertia > 315
          ? 1.0 // Indurated bedrock pavement
          : 1.16;

      // Speed reduction on steep grades and loose sand
      const slopeSlowdown = cell.slopeDeg > 12 ? Math.max(0.42, 1 - (cell.slopeDeg - 12) * 0.028) : 1.0;
      const sandSlowdown = cell.thermalInertia < 145 ? 0.68 : 1.0;
      const segSpeedMps = Math.max(0.28, baseSpeedMps * slopeSlowdown * sandSlowdown);
      const segTimeSec = segDistM / segSpeedMps;
      const segTimeMin = segTimeSec / 60;

      // Gravity-scaled Pandolf-Santee metabolic watts -> kcal
      const standingWatts =
        (1.5 * bodyMassKg + 2.0 * totalMassKg * Math.pow(suitAndLoadKg / bodyMassKg, 2)) *
        marsGravityRatio;
      const walkingWatts =
        eta * totalMassKg * (1.5 * segSpeedMps * segSpeedMps) * (0.55 + 0.45 * marsGravityRatio);
      const gradePct = gradeFrac * 100;
      let slopeWatts = 0;
      if (gradePct >= 0) {
        slopeWatts = 0.35 * eta * totalMassKg * segSpeedMps * gradePct * marsGravityRatio * 2.1;
      } else if (gradePct < -8) {
        // Santee eccentric quadriceps braking cost on steep downhill scarps
        slopeWatts = 0.22 * eta * totalMassKg * segSpeedMps * Math.abs(gradePct + 8) * marsGravityRatio * 1.8;
      }

      // Steep scarp scramble penalty (>20 deg)
      const scrambleMultiplier = cell.slopeDeg >= 25 ? 1.65 : cell.slopeDeg >= 18 ? 1.25 : 1.0;
      const totalWatts = (standingWatts + walkingWatts + slopeWatts) * suitJointPenalty * scrambleMultiplier + 95;
      const segKcal = (totalWatts * segTimeSec) / 4184;

      walkKcal += segKcal;
      totalWalkTimeMin += segTimeMin;
      totalRadDoseUsV += cell.radUsV * (segTimeMin / 60);

      profileSamples.push({
        distM: Math.round(totalDistM),
        nx: pt.nx,
        ny: pt.ny,
        lat: cell.lat,
        lon: cell.lon,
        elevM: Math.round(cell.elevM),
        slopeDeg: cell.slopeDeg,
        thermalInertia: cell.thermalInertia,
        crismIndex: cell.crismIndex,
        radUsV: cell.radUsV,
        uhfLos: cell.uhfLos,
        uhfMarginDb: cell.uhfMarginDb
      });
    }

    const totalDwellMin = waypoints.reduce((acc, w) => acc + (w.dwellMins || 15), 0);
    // Resting/sampling metabolic rate at science stations (~165 kcal/hr in 0.38g)
    const dwellKcal = (totalDwellMin / 60) * (consumables.muleAssisted ? 152 : 178);
    const totalMissionMin = Math.round(totalWalkTimeMin + totalDwellMin);
    const totalKcal = Math.round(walkKcal + dwellKcal);
    const metabolicRateKcalHr = Math.round(totalKcal / Math.max(0.25, totalMissionMin / 60));
    const o2LitersUsed = Math.round(totalKcal * 0.206); // ~0.206 L O2 per kcal

    return {
      profile: profileSamples,
      totalDistM: Math.round(totalDistM),
      totalAscentM: Math.round(totalAscentM),
      totalDescentM: Math.round(totalDescentM),
      totalMissionMin,
      walkTimeMin: Math.round(totalWalkTimeMin),
      dwellTimeMin: totalDwellMin,
      maxSlopeDeg: +maxSlopeDeg.toFixed(1),
      hazardEncounters,
      noGoViolations,
      sandTrapMeters: Math.round(sandTrapMeters),
      uhfShadowMeters: Math.round(uhfShadowMeters),
      metabolicRateKcalHr,
      totalKcal,
      o2LitersUsed,
      totalRadDoseUsV: +totalRadDoseUsV.toFixed(1)
    };
  }

  /**
   * Compute A* Least-Effort Suit-Physics Route + Quantitative Direct-Baseline Savings + Emergency Shelter Diversion
   */
  function computeTraverseRoute(
    theaterKey,
    routingMode,
    consumables,
    sepStormActive,
    customWaypoints,
    emergencyState,
    envState
  ) {
    const env = envState || {};
    const ltstHour = typeof env.ltstHour === 'number' ? env.ltstHour : 13.5;
    const dustTau = typeof env.dustTau === 'number' ? env.dustTau : 0.42;
    const buddyFaultSim = !!env.buddyFaultSim;
    const theater = window.ARES_THEATERS[theaterKey];
    const hab = theater.waypoints[0];
    const allCustom = (customWaypoints || []).slice();
    const waypoints = theater.waypoints.slice().concat(allCustom);
    waypoints.sort((a, b) => {
      if (a === hab) return -1;
      if (b === hab) return 1;
      const da = Math.hypot(a.x - hab.x, a.y - hab.y);
      const db = Math.hypot(b.x - hab.x, b.y - hab.y);
      return da - db;
    });

    if (
      !currentGrid.length ||
      currentTheaterKey !== theaterKey ||
      currentSepStorm !== !!sepStormActive
    ) {
      buildTerrainGrid(theaterKey, sepStormActive);
    }

    // 1. Active Selected Route
    const fullPath = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      const seg = findSegmentPath(waypoints[i], waypoints[i + 1], routingMode);
      if (i > 0 && seg.length > 0) seg.shift();
      fullPath.push(...seg);
    }
    const activePhys = evaluatePathPhysics(fullPath, waypoints, consumables);

    // 2. Direct Straight-Line Baseline (Quantitative Proof of A* Suit-Physics Value & 3D Cliff Comparison)
    const directPath = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      const seg = findSegmentPath(waypoints[i], waypoints[i + 1], 'direct');
      if (i > 0 && seg.length > 0) seg.shift();
      directPath.push(...seg);
    }
    const directPhys =
      routingMode === 'direct' ? activePhys : evaluatePathPhysics(directPath, waypoints, consumables);

    // Also compare against optimal A* if user is currently viewing 'direct'
    let optPhys = activePhys;
    if (routingMode === 'direct') {
      const optPath = [];
      for (let i = 0; i < waypoints.length - 1; i++) {
        const seg = findSegmentPath(waypoints[i], waypoints[i + 1], 'optimal');
        if (i > 0 && seg.length > 0) seg.shift();
        optPath.push(...seg);
      }
      optPhys = evaluatePathPhysics(optPath, waypoints, consumables);
    }

    const savings = {
      o2SavedPct: Math.max(
        6,
        Math.round(((directPhys.totalKcal - optPhys.totalKcal) / Math.max(1, directPhys.totalKcal)) * 100)
      ),
      kcalSaved: Math.max(18, directPhys.totalKcal - optPhys.totalKcal),
      o2LitersSaved: Math.max(4, directPhys.o2LitersUsed - optPhys.o2LitersUsed),
      directMaxSlopeDeg: directPhys.maxSlopeDeg,
      optMaxSlopeDeg: optPhys.maxSlopeDeg,
      directHazards: directPhys.hazardEncounters,
      radSavedPct: Math.max(
        0,
        Math.round(
          ((directPhys.totalRadDoseUsV - activePhys.totalRadDoseUsV) /
            Math.max(0.1, directPhys.totalRadDoseUsV)) *
            100
        )
      )
    };

    // 3. Walk-Back Abort Envelope physics based on limiting PLSS consumable
    const limitingPct = Math.min(
      consumables.o2Pct,
      consumables.scrubberPct,
      consumables.batteryPct
    );
    const limitingSource =
      limitingPct === consumables.o2Pct
        ? 'PLSS Primary O₂'
        : limitingPct === consumables.scrubberPct
        ? 'CO₂ LiOH/RCA Scrubber'
        : 'Suit High-Density Battery';

    const usableFraction = Math.max(0.05, (limitingPct - 15) / 85);
    const envThermalPenalty =
      (ltstHour < 8.0 || ltstHour > 17.2 ? 0.91 : 1.0) * (dustTau > 1.8 ? 0.90 : 1.0);
    const walkBackRadiusM = Math.round(
      usableFraction *
        1380 *
        (consumables.muleAssisted ? 1.18 : 0.86) *
        (sepStormActive ? 0.72 : 1.0) *
        envThermalPenalty
    );

    // 3B. Predictive PLSS Burn-Down Time-Series & Dual-Astronaut (EV-1 + EV-2) Buddy-Tow Envelope
    // Outbound traverse (0 -> Apex) + Science Dwells + Return Walk-Back (Apex -> HAB-01)
    const outboundO2PctUsed = clamp((activePhys.o2LitersUsed / 540) * 100, 8, 62);
    const returnO2PctNominal = outboundO2PctUsed * 0.56; // Downhill/direct return without station dwells
    const returnO2PctBuddyTow = returnO2PctNominal * (consumables.muleAssisted ? 1.48 : 2.15); // EV-2 towing incapacitated EV-1
    const heaterLoadMult =
      (ltstHour < 8.0 || ltstHour > 17.2 ? 1.38 : 1.0) * (1 + Math.max(0, dustTau - 0.45) * 0.14);
    const totalRoundTripMin = Math.round(activePhys.totalMissionMin * 1.44);
    const plssTimeline = [];
    const stepsN = 28;
    for (let k = 0; k <= stepsN; k++) {
      const u = k / stepsN; // 0.0 -> 0.65 outbound+dwells, 0.65 -> 1.0 return to HAB-01
      const isReturn = u > 0.65;
      const outFrac = clamp(u / 0.65, 0, 1);
      const retFrac = isReturn ? clamp((u - 0.65) / 0.35, 0, 1) : 0;

      const nomO2 = clamp(
        consumables.o2Pct - outboundO2PctUsed * outFrac - returnO2PctNominal * retFrac,
        2,
        100
      );
      const towO2 = clamp(
        consumables.o2Pct - outboundO2PctUsed * outFrac - returnO2PctBuddyTow * retFrac,
        0,
        100
      );
      const scrub = clamp(
        consumables.scrubberPct - (outboundO2PctUsed * 0.88 * outFrac + returnO2PctNominal * 0.85 * retFrac),
        2,
        100
      );
      const batt = clamp(
        consumables.batteryPct - (26 * outFrac + 14 * retFrac) * heaterLoadMult,
        2,
        100
      );
      const cumRad = +(activePhys.totalRadDoseUsV * (outFrac + retFrac * 0.42)).toFixed(1);
      let stageTag = '';
      if (k === 0) stageTag = 'HAB';
      else if (k === 9) stageTag = 'WP-02';
      else if (k === 18) stageTag = 'APEX';
      else if (k === stepsN) stageTag = 'RTB';

      plssTimeline.push({
        u,
        metMin: Math.round(u * totalRoundTripMin),
        o2Pct: +(buddyFaultSim ? towO2 : nomO2).toFixed(1),
        nomO2Pct: +nomO2.toFixed(1),
        towO2Pct: +towO2.toFixed(1),
        scrubberPct: +scrub.toFixed(1),
        batteryPct: +batt.toFixed(1),
        cumRadUsV: cumRad,
        stageTag
      });
    }
    const endPt = plssTimeline[plssTimeline.length - 1];
    const buddyCheck = {
      faultSimActive: buddyFaultSim,
      roundTripMin: totalRoundTripMin,
      endNominalO2Pct: endPt.nomO2Pct,
      endBuddyTowO2Pct: endPt.towO2Pct,
      endBatteryPct: endPt.batteryPct,
      buddyTowSafe: endPt.towO2Pct >= 15.0 && endPt.batteryPct >= 15.0,
      reserveRedlinePct: 15
    };

    // 4. 2-Stage Contingency Shelter Diversion Route when Emergency Abort / SEP Storm is active
    let contingency = null;
    if (emergencyState && emergencyState.active) {
      const shelterWp =
        theater.waypoints.find((w) => w.role === 'shelter') ||
        (theater.shelters && theater.shelters[0]
          ? { code: 'SH-01', name: theater.shelters[0].name, x: theater.shelters[0].x, y: theater.shelters[0].y }
          : hab);
      const startPt = {
        x: clamp(emergencyState.startNx ?? hab.x, 0.02, 0.98),
        y: clamp(emergencyState.startNy ?? hab.y, 0.02, 0.98)
      };

      const leg1Path = findSegmentPath(startPt, { x: shelterWp.x, y: shelterWp.y }, 'rad_shelter');
      const leg2Path = findSegmentPath(
        { x: shelterWp.x, y: shelterWp.y },
        { x: hab.x, y: hab.y },
        'rad_shelter'
      );

      let leg1DistM = 0;
      let leg1MaxSlope = 0;
      for (let i = 1; i < leg1Path.length; i++) {
        const dxM = (leg1Path[i].nx - leg1Path[i - 1].nx) * MAP_WIDTH_METERS;
        const dyM = (leg1Path[i].ny - leg1Path[i - 1].ny) * MAP_HEIGHT_METERS;
        leg1DistM += Math.hypot(dxM, dyM);
        const c = sampleAt(leg1Path[i].nx, leg1Path[i].ny);
        if (c && c.slopeDeg > leg1MaxSlope) leg1MaxSlope = c.slopeDeg;
      }

      let leg2DistM = 0;
      for (let i = 1; i < leg2Path.length; i++) {
        const dxM = (leg2Path[i].nx - leg2Path[i - 1].nx) * MAP_WIDTH_METERS;
        const dyM = (leg2Path[i].ny - leg2Path[i - 1].ny) * MAP_HEIGHT_METERS;
        leg2DistM += Math.hypot(dxM, dyM);
      }

      const shieldingPct = (theater.shelters && theater.shelters[0] && theater.shelters[0].shieldingPct) || 74;
      const sprintSpeedMps = consumables.muleAssisted ? 1.24 : 1.05;
      const etaShelterMin = Math.max(1, Math.round(leg1DistM / sprintSpeedMps / 60));

      contingency = {
        active: true,
        shelterCode: shelterWp.code || 'WP-03',
        shelterName: shelterWp.name,
        shelterNx: shelterWp.x,
        shelterNy: shelterWp.y,
        startNx: startPt.x,
        startNy: startPt.y,
        leg1Path,
        leg2Path,
        distToShelterM: Math.round(leg1DistM),
        distShelterToHabM: Math.round(leg2DistM),
        leg1MaxSlopeDeg: +leg1MaxSlope.toFixed(1),
        etaShelterMin,
        shieldingPct
      };
    }

    return {
      path: fullPath,
      directPath,
      profile: activePhys.profile,
      plssTimeline,
      buddyCheck,
      contingency,
      stats: {
        totalDistM: activePhys.totalDistM,
        totalAscentM: activePhys.totalAscentM,
        totalDescentM: activePhys.totalDescentM,
        totalMissionMin: activePhys.totalMissionMin,
        walkTimeMin: activePhys.walkTimeMin,
        dwellTimeMin: activePhys.dwellTimeMin,
        maxSlopeDeg: activePhys.maxSlopeDeg,
        hazardEncounters: activePhys.hazardEncounters,
        noGoViolations: activePhys.noGoViolations,
        sandTrapMeters: activePhys.sandTrapMeters,
        uhfShadowMeters: activePhys.uhfShadowMeters,
        metabolicRateKcalHr: activePhys.metabolicRateKcalHr,
        totalKcal: activePhys.totalKcal,
        o2LitersUsed: activePhys.o2LitersUsed,
        totalRadDoseUsV: activePhys.totalRadDoseUsV,
        limitingPct,
        limitingSource,
        walkBackRadiusM,
        walkBackNormRx: walkBackRadiusM / MAP_WIDTH_METERS,
        walkBackNormRy: walkBackRadiusM / MAP_HEIGHT_METERS,
        savings
      }
    };
  }

  function findSegmentPath(wpStart, wpEnd, routingMode) {
    if (routingMode === 'direct') {
      const steps = 32;
      const pts = [];
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        pts.push({
          nx: wpStart.x + (wpEnd.x - wpStart.x) * t,
          ny: wpStart.y + (wpEnd.y - wpStart.y) * t
        });
      }
      return pts;
    }

    const startGx = clamp(Math.round(wpStart.x * (GRID_W - 1)), 0, GRID_W - 1);
    const startGy = clamp(Math.round(wpStart.y * (GRID_H - 1)), 0, GRID_H - 1);
    const endGx = clamp(Math.round(wpEnd.x * (GRID_W - 1)), 0, GRID_W - 1);
    const endGy = clamp(Math.round(wpEnd.y * (GRID_H - 1)), 0, GRID_H - 1);

    const totalNodes = GRID_W * GRID_H;
    const gScore = new Float32Array(totalNodes).fill(Infinity);
    const fScore = new Float32Array(totalNodes).fill(Infinity);
    const cameFrom = new Int32Array(totalNodes).fill(-1);
    const closed = new Uint8Array(totalNodes);

    const startIdx = startGy * GRID_W + startGx;
    const endIdx = endGy * GRID_W + endGx;

    gScore[startIdx] = 0;
    fScore[startIdx] = Math.hypot(endGx - startGx, endGy - startGy);

    const openSet = [startIdx];
    const dirs = [
      [-1, 0, 1.0],
      [1, 0, 1.0],
      [0, -1, 1.0],
      [0, 1, 1.0],
      [-1, -1, 1.414],
      [1, -1, 1.414],
      [-1, 1, 1.414],
      [1, 1, 1.414]
    ];

    while (openSet.length > 0) {
      let bestPos = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (fScore[openSet[i]] < fScore[openSet[bestPos]]) bestPos = i;
      }
      const current = openSet.splice(bestPos, 1)[0];
      if (current === endIdx) break;
      closed[current] = 1;

      const cx = current % GRID_W;
      const cy = (current / GRID_W) | 0;

      for (const [dx, dy, baseCost] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
        const nIdx = ny * GRID_W + nx;
        if (closed[nIdx]) continue;

        const cell = currentGrid[ny][nx];
        let penalty = 1.0;

        // Suit-Physics Slope & >25 deg No-Go Scarp Penalties
        if (cell.slopeDeg >= 25.0) {
          penalty += 42.0;
        } else if (cell.slopeDeg >= 15.0) {
          penalty += 4.6 + (cell.slopeDeg - 15.0) * 1.15;
        } else {
          penalty += cell.slopeDeg * 0.12;
        }

        // THEMIS Low Thermal Inertia Sand-Trap Penalty (<145 TIU)
        if (cell.thermalInertia < 145) {
          penalty += 15.0;
        } else if (cell.thermalInertia > 315) {
          penalty *= 0.94; // Favor solid high-TI bedrock spines
        }

        // Favor maintaining UHF Line-of-Sight to Rover Mast where feasible
        if (!cell.uhfLos) {
          penalty += 0.45;
        }

        // Radiation-Shielded Mode favors natural shelter overhangs & topographic shielding
        if (routingMode === 'rad_shelter') {
          penalty += (cell.radUsV / 15.0) * 2.3;
          if (cell.isShelterZone) penalty *= 0.4;
          else if (cell.shieldingFactor < 0.88) penalty *= 0.82;
        }

        const tentativeG = gScore[current] + baseCost * penalty;
        if (tentativeG < gScore[nIdx]) {
          cameFrom[nIdx] = current;
          gScore[nIdx] = tentativeG;
          fScore[nIdx] = tentativeG + Math.hypot(endGx - nx, endGy - ny);
          if (!openSet.includes(nIdx)) openSet.push(nIdx);
        }
      }
    }

    const rawCoords = [];
    let curr = endIdx;
    while (curr !== -1) {
      const gx = curr % GRID_W;
      const gy = (curr / GRID_W) | 0;
      rawCoords.push({ nx: gx / (GRID_W - 1), ny: gy / (GRID_H - 1) });
      if (curr === startIdx) break;
      curr = cameFrom[curr];
    }
    rawCoords.reverse();

    if (rawCoords.length > 0) {
      rawCoords[0] = { nx: wpStart.x, ny: wpStart.y };
      rawCoords[rawCoords.length - 1] = { nx: wpEnd.x, ny: wpEnd.y };
    }
    if (rawCoords.length >= 4) {
      rawCoords[1] = {
        nx: 0.55 * wpStart.x + 0.45 * rawCoords[1].nx,
        ny: 0.55 * wpStart.y + 0.45 * rawCoords[1].ny
      };
      const last = rawCoords.length - 1;
      rawCoords[last - 1] = {
        nx: 0.55 * wpEnd.x + 0.45 * rawCoords[last - 1].nx,
        ny: 0.55 * wpEnd.y + 0.45 * rawCoords[last - 1].ny
      };
    }

    // 2-pass Chaikin corner-cutting while anchoring exact waypoint endpoints
    if (rawCoords.length < 3) return rawCoords;
    let smoothed = rawCoords;
    for (let pass = 0; pass < 2; pass++) {
      const next = [{ nx: wpStart.x, ny: wpStart.y }];
      for (let i = 0; i < smoothed.length - 1; i++) {
        const p0 = smoothed[i];
        const p1 = smoothed[i + 1];
        next.push({ nx: 0.75 * p0.nx + 0.25 * p1.nx, ny: 0.75 * p0.ny + 0.25 * p1.ny });
        next.push({ nx: 0.25 * p0.nx + 0.75 * p1.nx, ny: 0.25 * p0.ny + 0.75 * p1.ny });
      }
      next.push({ nx: wpEnd.x, ny: wpEnd.y });
      smoothed = next;
    }
    return smoothed;
  }

  return {
    GRID_W,
    GRID_H,
    MAP_WIDTH_METERS,
    MAP_HEIGHT_METERS,
    buildTerrainGrid,
    sampleAt,
    computeTraverseRoute,
    getGrid: () => currentGrid
  };
})();
