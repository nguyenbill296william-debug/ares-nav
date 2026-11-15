# ARES-NAV // 7-Slide Presentation Script, Live Demo Choreography & Judge Q&A Guide

Synchronized slide-for-slide with [ARES_NAV_NASA_SpaceApps_7Slide_Deck.pdf](ARES_NAV_NASA_SpaceApps_7Slide_Deck.pdf), [ARES_NAV_NASA_SpaceApps_7Slide_Deck.pptx](ARES_NAV_NASA_SpaceApps_7Slide_Deck.pptx), and [slides.html](slides.html).

---

## Part 1: Slide-by-Slide Spoken Script (~3m 30s Total)

### Slide 01 / 07 — Cover: ARES-NAV (`0:00 – 0:25`)
**[Stage Cue: Start on Slide 01. Hold up your DIY Smartphone 3D Visor Goggles briefly when mentioning 3D Visor Optics.]**

> "Good morning, judges. We are **Project Interplanetary Explorers**, and this is **ARES-NAV**: an autonomous orbital-to-surface navigation system, suit-physics pathplanner, and stereoscopic 3D visor built for human Mars exploration.
>
> Powered by **219 real NASA Mars 2020 Perseverance and Curiosity mission files**, ARES-NAV unifies orbital satellite tracking, 3D HiRISE terrain routing that cuts suit oxygen burn by **24 percent**, and a **242-megapixel** head-tracked helmet HUD across Jezero Crater and Gale Crater."

---

### Slide 02 / 07 — Why Earth Navigation Fails Human Explorers on Mars (`0:25 – 0:55`)
**[Advance to Slide 02]**

> "Why can’t future Mars astronauts navigate the way we do on Earth, or even the way Apollo crews did on the Moon? Four physical realities stand in the way:
>
> First, Mars has **no global GPS constellation and no planetary dipole magnetic field**—meaning a magnetic compass is useless, and steep canyon walls hide the habitat within tens of meters.
> Second, inside a **4.3-PSI pressurized spacesuit** at **0.38g**, the shortest straight line is rarely the safest route—climbing scarps steeper than **20 degrees** or sinking into low-thermal-inertia sand drifts spikes metabolic oxygen burn and CO2 scrubber load.
> Third, unshielded **Solar Energetic Particle storms** and **tau-3.2 dust whiteouts** can blind optical cameras in minutes.
> And fourth, with up to a **44-minute round-trip communication delay** to Earth, astronauts cannot wait for Houston. Survival requires zero-latency, onboard autonomy."

---

### Slide 03 / 07 — One Integrated Stack from 400 km Orbit to 120 µm Rock Grains (`0:55 – 1:25`)
**[Advance to Slide 03]**

> "To solve this, we engineered a single offline-ready software stack spanning four synchronized modes—from **400-kilometer orbit down to 120-micrometer rock grains**:
>
> **Mode 1** renders an 8K WebGL Mars globe with MGS MOLA altimetry, tracking real-time relay geometry across MRO, Mars Odyssey, and MAVEN.
> **Mode 2** descends into a tactical GIS console and **JPL OnSight-style WebGL 3D terrain table**, fusing HiRISE elevation, CRISM mineralogy, THEMIS sand-footing data, RIMFAX ground-penetrating radar, and a 3D flying Ingenuity aerial scout.
> **Mode 3** puts the astronaut inside **242-megapixel Mastcam-Z panoramas** with spatial AR beacons, dust-whiteout wireframes, and SuperCam laser spectroscopy.
> And **Mode 4** delivers a **SHERLOC Deep-UV Raman and PIXL X-ray micro-lab** that compiles every rock core directly into a printable **NASA Flight Data File**—all in vanilla ES6 JavaScript and custom WebGL shaders, with zero proprietary API keys or cloud lock-in."

---

### Slide 04 / 07 — Physics-Driven Routing That Cuts Suit Oxygen Burn by 24% (`1:25 – 2:05`)
**[Advance to Slide 04]**

> "Slide 4 shows the core safety engine behind Mode 2. Instead of drawing geometric straight lines across lethal cliffs, ARES-NAV solves an 8-connected graph weighted by **0.38g Pandolf-Santee spacesuit energetics**, slope grade, THEMIS sand-slip risk, radiation exposure, and 401-megahertz UHF line-of-sight—while enforcing NASA’s **Dual-Crew Buddy-Tow Flight Rule**, guaranteeing a **15 percent oxygen reserve** even if one astronaut must tow an injured partner back to base.
>
> Across Jezero Crater Site 093, while a direct line crosses loose sand traps, hits a hazardous **28.4-degree scarp**, and burns **256 liters** of oxygen, our A-star pathfinder caps slope at **14.2 degrees** and cuts suit oxygen consumption to **195 liters—a 24 percent reduction**.
>
> And if an oxygen regulator leak or solar proton storm strikes mid-EVA, our walk-back safety ring contracts in real time, triggering a **two-stage contingency sprint** into **Waypoint 3’s Basalt Overhang**—cutting radiation dose by **74 percent** under 2.8 meters of rock before staging recovery to the habitat."

---

### Slide 05 / 07 — Turning Any Smartphone into an IMU Head-Tracked 3D Mars Visor (`2:05 – 2:45`)
**[Advance to Slide 05. Invite a judge to look through the 3D Goggles if demonstrating live.]**

> "Because pressurized spacesuit gloves make touchscreens impractical on foot, Slide 5 shows how we turned an ordinary smartphone and low-cost magnifying lenses into a **hands-free, head-tracked 3D Mars Visor**.
>
> First, standard smartphone Euler angles suffer 90-degree gimbal flips when tilted into landscape goggles—so we compute the full 3D rotation matrix forward vector (`R * [0, 0, -1]^T`) directly from the phone’s IMU for smooth, zero-drift head tracking at 60 frames per second.
> Second, astronauts operate the visor **without touching the screen**: holding the center gaze reticle on an outcrop for **2.0 seconds** fires a simulated **1064-nanometer SuperCam LIBS laser**, and during a **tau-3.2 dust whiteout**, **Synthetic Vision** projects 3D HiRISE DEM ridge wireframes straight through the obscured sky.
> Third, our **20-hertz bi-directional CapCom link** pairs the goggles with the laptop Mission Control console—tracking the astronaut’s live viewing cone on the map while letting the habitat operator click **MARK** on any outcrop to project a 3D AR target diamond and voice advisory straight into the astronaut’s eyes."

---

### Slide 06 / 07 — Grounded in 219 Authentic NASA Surface & Orbital Datasets (`2:45 – 3:15`)
**[Advance to Slide 06]**

> "Nothing in ARES-NAV is generic placeholder art. Every terrain elevation, rover roll-and-pitch telemetry point across Perseverance’s **45.25-kilometer traverse**, and mineral signature is grounded in **219 indexed NASA datasets**—from the **29,517-pixel Butler Landing Mastcam-Z mosaic** to Curiosity’s **Sol 4462 Mount Sharp boxwork ridges** and Perseverance’s real **SuperCam microphone wind recordings**.
>
> In our **SHERLOC 248.6-nanometer Deep-UV Raman and PIXL XRF lab**, crews inspect real Cheyava Falls micro-imagery—resolving iron-phosphate vivianite and greigite redox rims co-located with the **1600-inverse-centimeter organic carbon G-band** to score **Level 4 out of 7 on NASA’s Confidence of Life Detection scale**, then export a complete **NASA Flight Data File** and RFC 7946 GeoJSON manifest."

---

### Slide 07 / 07 — From Analogue EVA Field Trials to Every Classroom on Earth (`3:15 – 3:45`)
**[Advance to Slide 07]**

> "Finally, ARES-NAV is built for immediate impact both in human spaceflight analogs and global STEM classrooms.
>
> By swapping the elevation raster and gravity constant from **0.38g Mars to 0.16g Moon**, our exact same metabolic A-star planner and visor HUD adapt directly to **Artemis Lunar South Pole traverses**, **NASA CHAPEA** Mars habitat simulations, and desert EVA field trials.
> At the same time, replacing `$3,500` headsets with a **`$5` smartphone lens viewer** and **100 percent offline browser execution** means any student or researcher on Earth can step onto Jezero Crater today with zero paid APIs and zero setup.
>
> We invite you to test our live deployment—or look inside our 3D Visor Goggles right now while we mark a live target from Mission Control. Thank you, and we welcome your questions."

---

## Part 2: Complete Judge Q&A Bank (Questions Judges Ask & How to Answer)

### Q1: "Would astronauts actually use this when they're exploring Mars?"
- **Answer:** Yes—not by holding a laptop or tapping a touchscreen in bulky `4.3 psi` pressurized gloves, but across the exact **three operational layers** NASA’s EVA & Human Surface Mobility program uses:
  1. **Why Earth Mission Control Fails on Mars:** With an **8–22 minute one-way light-time delay** (up to 44 minutes round-trip), Houston cannot micromanage turns, slope hazards, or consumables in real time like on Apollo or ISS. Autonomous onboard metabolic routing and walk-back safety rings are mandatory flight-safety software.
  2. **Three Context-Matched Interfaces:**
     - **Pressurized Rover / Habitat Console (Modes 1 & 2):** Directly mirrors **NASA JPL *OnSight***, **NASA *MMGIS***, and **MIT/NASA *SEXTANT***—used by the Intra-Vehicular (`IVA`) support astronaut inside the rover/habitat to plan oxygen-optimal traverses on HiRISE DEMs, deploy aerial scouts, and drop `MARK` targets for the surface crew.
     - **Hands-Free Surface EVA Visor (Mode 3):** Mirrors **NASA *SUITS*** waveguide HUD standards—operated via **voice commands, 2-second gaze-dwell targeting, and one-key Declutter** so gloved astronauts keep both hands free on rocky terrain.
     - **Automated Post-EVA Debrief (Mode 4 & FDF):** Auto-compiles JSC Flight Data Files and GeoJSON manifests, saving scarce crew time.
  3. **Honest TRL Framing:** Today ARES-NAV is a **TRL-4 human-in-the-loop prototype** running in WebGL on real PDS datasets; for flight (`TRL 8–9`), the same A\* metabolic engine and HUD symbology compile onto radiation-hardened suit/rover avionics fed by live visual-inertial LiDAR SLAM, UWB rover ranging, and PLSS sensors.

### Q2: "Mars has no GPS satellites and no magnetic field. How does ARES-NAV actually localize the astronaut and their heading?"
- **Answer:** Real Mars human architectures combine two tiers modeled directly in ARES-NAV:
  1. **Coarse Radiometric Orbital Fix (`~5–15 m`):** Two-way UHF Doppler and slant-range trilateration (`Electra` transceivers) during passes of **MRO, Mars Odyssey, and MAVEN**, weighted by satellite geometry (`PDOP / HDOP` in Mode 1).
  2. **Fine Tactical Surface Lock (`<0.4 m` & `<0.5°` heading):** Ultra-Wideband (`UWB`) / `401 MHz` time-of-flight ranging anchored to the **pressurized rover or habitat mast**, fused with **Visual-Inertial Odometry (`VIO`) and skyline ridge matching** against georeferenced **25 cm/pixel MRO HiRISE DEMs**—requiring zero magnetic compasses.

### Q3: "How did you calculate the 24% oxygen savings on Slide 4, and how does the cost function work?"
- **Answer:** Our 8-connected A\* solver evaluates every DEM grid transition using `J(e) = Δd * [1 + w_slope(θ) + w_slip(TIU) + w_rad(SEP) + w_uhf]`, coupled to **Pandolf-Santee walking metabolic equations scaled to Martian gravity (`3.71 m/s²`, `0.38g`)** for a suited astronaut:
  - Slopes above `15°` incur nonlinear metabolic penalties, and `>25°` scarps are hard `NO-GO` walls.
  - Low thermal inertia (`<130 TIU` from Mars Odyssey THEMIS) flags unconsolidated aeolian sand drifts where boot sinkage increases energy burn.
  - Across Jezero Site 093, the naive straight line climbs a `28.4°` scarp and crosses sand traps (`256 L O₂`), whereas ARES-NAV routes through a `14.2°` bedrock pass (`195 L O₂`, saving `61 L` or `24%`) and also verifies a **50-trial Monte Carlo P50/P95 O₂ envelope** plus NASA’s **15% Buddy-Tow reserve redline**.

### Q4: "What happens if an emergency hits mid-EVA—like a Solar Particle Event or a suit O₂ leak?"
- **Answer:** Clicking **`ABORT SIM`** demonstrates our **2-Stage Contingency Protocol**:
  1. Unlike Galatic Cosmic Rays, acute **Solar Energetic Particle (`SEP`) proton storms** can deliver dangerous doses within tens of minutes on Mars’s thin `0.6 kPa` atmosphere.
  2. If the habitat is farther than immediate exposure limits allow, ARES-NAV dynamically shrinks the PLSS walk-back envelope and sprints the crew into the nearest **pre-surveyed natural rock overhang (`WP-03 Megabreccia Alcove`, 2.8–3.8 m basalt shielding)**—attenuating proton flux by **74%**—before staging a controlled **Leg-2 recovery** back to `HAB-01` (or dispatching the pressurized rover).

### Q5: "On Slide 5, what does `R · [0, 0, -1]^T` mean, and why did standard phone orientation break?"
- **Answer:** Browser `DeviceOrientationEvent` reports Euler angles (`alpha, beta, gamma`) calibrated for holding a phone flat in portrait mode. When you rotate a smartphone `90°` sideways into landscape VR goggles and look up or across the horizon, `beta` approaches `±90°`, causing **Euler gimbal lock**—where azimuth suddenly flips `180°`. We solved this by constructing the full orthogonal 3D rotation matrix `R = Rz(alpha) * Rx(beta) * Ry(gamma) * R_screen` and projecting the camera’s optical `-Z` axis (`R · [0, 0, -1]^T`), extracting true spherical azimuth and elevation with zero gimbal flips.

### Q6: "During a `τ = 3.2` dust storm whiteout, if optical cameras are blinded, how does Synthetic Vision still show the terrain?"
- **Answer:** Just like commercial aviation **Synthetic Vision Systems (`SVS`)** used by pilots in zero-visibility fog, Synthetic Vision does **not** rely on live optical camera contrast during the storm. Because the georeferenced **MRO HiRISE DEM heightfield** is stored locally in onboard memory and suit pose is tracked via **IMU + UWB rover ranging + radar altimetry**, ARES-NAV projects the stored 3D elevation mesh and hazard-colored ridge wireframes directly onto the visor waveguide—letting the crew navigate safely back to shelter when optical visibility drops near zero.

### Q7: "On Slide 6, why does Cheyava Falls score Level 4 out of 7 on NASA's CoLD scale—why not Level 7?"
- **Answer:** NASA’s **Confidence of Life Detection (`CoLD`)** framework has 7 strict tiers:
  - **Levels 1–4** can be achieved *in situ* on Mars: detecting a biosignature-relevant signal (`L1`, `1600 cm⁻¹` organic G-band), ruling out spacecraft contamination (`L2`), confirming habitable aqueous context (`L3`, `CaSO₄` veins), and evaluating abiotic vs. biological plausibility (`L4`, millimeter-scale `vivianite/greigite` redox "leopard spots" formed at low temperatures).
  - **Levels 5–7** require independent confirmation, isotopic fractionation (`δ¹³C`), and ruling out all non-biological syntheses using synchrotron/mass-spectrometry labs on Earth (**Mars Sample Return**) or a full human base lab. Scoring it `CoLD 4/7` reflects Perseverance’s actual July 2024 science team assessment.

### Q8: "Which parts of your 219 datasets are real NASA data versus simulated models?"
- **Answer:** *(Be 100% transparent—judges reward scientific honesty)*
  - **100% Real NASA Archival Data:** All 219 indexed local files—the `29,517×8,199` Mastcam-Z 360° mosaic, Perseverance Sol 0–2023 GPS/RMC traverse (`45.25 km`) and roll/pitch telemetry, Curiosity Sol 4462 Gale Boxwork panoramas (`PIA26696`), MRO HiRISE ortho-imagery (`PIA26374`) & MOLA DEM relief, SHERLOC/WATSON Cheyava Falls micro-scans, Perseverance SuperCam Mars wind audio, and all 5 NASA 3D CAD meshes (including the 9,124-triangle Ingenuity flight mesh).
  - **Physics-Informed Simulation Layers:** Real-time `0.38g` Pandolf-Santee suit metabolic burn, live orbital pass propagation (`PDOP`), interactive LIBS/Raman spectral synthesis calibrated to endmember rock oxides, RIMFAX radargram visualization along arbitrary user pins, and two-player CapCom co-op telemetry.

### Q9: "How does the entire system run 100% offline in a browser with zero cloud servers or API keys?"
- **Answer:** Remote field stations—whether desert EVA analogs like Utah MDRS, NASA CHAPEA, or classrooms with restricted internet—cannot depend on paid cloud map tiles or external servers. We pre-compiled the DEM elevation matrices, Perseverance odometry, 9 HiRISE/Mastcam-Z WebP basemap textures, Mars wind audio, and Draco-decoded 3D Ingenuity CAD buffers into self-contained JavaScript modules rendered via custom **WebGL 1.0 GLSL shaders** and **HTML5 Canvas**—so even double-clicking `index.html` offline via `file://` runs at 60 FPS with zero network calls.

### Q10: "How easily can ARES-NAV scale to NASA's Artemis Lunar South Pole missions?"
- **Answer:** Because the physics engine is parameterized rather than hardcoded to Mars, adapting ARES-NAV to **Artemis III / IV at Shackleton Rim** requires only three configuration swaps:
  1. Replace the MRO HiRISE DEM raster with **LRO LOLA `5 m/px` lunar south pole topography**.
  2. Change gravitational acceleration in the Pandolf-Santee metabolic solver from **`3.71 m/s²` (`0.38g` Mars)** to **`1.62 m/s²` (`0.16g` Moon)**.
  3. Swap the dust-tau atmospheric scattering shader for **low-angle `1.5°` solar illumination & Permanently Shadowed Region (`PSR`) thermal/lighting constraints**—making the exact same visor HUD and CapCom co-op architecture immediately usable for lunar EVA analog testing.
