# ARES-NAV // First-Place Championship Pitch, Live Bi-Directional CapCom Demo & Judge Q&A Guide

---

## 1. Pre-Demo 60-Second Wi-Fi Setup Checklist (Laptop Mission Control ↔ iPhone 3D Goggles)

1. **Connect to Wi-Fi:** Connect your **Laptop** and your **iPhone** to the **same venue Wi-Fi** (or turn on your iPhone’s **Personal Hotspot** and connect your laptop to it — zero internet required!).
2. **Launch CapCom Server (1 Click):** Double-click **`START_ARES_CAPCOM.bat`** in `D:\Nasa`.
   - Starts the multi-threaded HTTP `206` Range + Bi-Directional SSE Telemetry Relay Server on port `8080` and opens `http://localhost:8080` on your laptop.
3. **Pair Your iPhone in 3 Seconds:**
   - Click **`CAPCOM`** in the top-right header bar of the laptop screen.
   - Point your iPhone camera at the **ISO-18004 QR Code** (`http://<LAN_IP>:8080/?visor=1`) and tap the link in Safari.
   - Rotate your iPhone horizontally (**Landscape**), tap **`GYRO TRACK`**, and tap **`3D GOGGLES [V]`** (Screen Wake Lock automatically keeps the iPhone awake!).
   - Slide your iPhone into your **DIY Stereoscopic 3D Magnifying Visor**.
   - Look at your laptop header: the **`CAPCOM`** status dot pulses **emerald green**!
   - **Two-Way Co-Op Magic:**
     - **Mars → Houston (20 Hz):** As the judge turns the 3D Goggles, their live cyan FOV frustum cone rotates on **`EV-1`** across the 2D & 3D Surface Map, and Gaze-Dwell laser shots stream live!
     - **Houston → Mars (<20 ms):** Click **`◆ MARK`** in Mode 2's top toolbar and click any rock outcrop on the laptop map — a NASA Quindar PTT beep sounds and a pulsing **Cyan `◆ CAPCOM PRIORITY TARGET` 3D AR Diamond + Directional Lens Chevrons** materialize right inside the judge's 3D Goggles!

*(Offline Fallback: Opening `index.html` directly via `file://` with zero server still runs 100% of ARES-NAV — WebGL Mars Globe, WebGL 3D Holographic Terrain Table, DEM A\* Router, SHERLOC Micro-Lab, 3D GLB meshes, Mars Audio, and 219 NASA files — completely offline!)*

---

## 2. Word-for-Word 3-Minute Championship Pitch & Choreography

> **[0:00 – 0:25] The Hook: Why Mars Navigation Is Life-or-Death**
> *"Imagine stepping onto Mars in a 4.3-PSI pressurized spacesuit. Mars has **zero GPS satellites**, **no global dipole magnetic field**, lethal $>25^\circ$ crater scarps that burn double your oxygen, sudden **$\tau = 3.2$ dust storm whiteouts**, and unshielded solar proton storms. That is why we built **ARES-NAV** — an Orbital-to-Surface Mars Navigation System, JPL OnSight-style 3D Terrain Table, Bi-Directional CapCom Co-Op Suite, and Stereoscopic 3D Spacesuit Visor powered by **219 real local NASA Perseverance and Curiosity mission files**."*

> **[0:25 – 1:15] Mode 1 & Mode 2: Orbital PNT → Real DEM A\* Routing → WebGL 3D Terrain Fly-Through**
> *(Start in **`[1] 360° Planet Mars`**, point out `HDOP 0.4m`, then click **`JEZERO CRATER [DESCEND →]`**)*
> *"In **Mode 1**, our WebGL globe locks onto NASA’s real relay orbiters — MRO, Odyssey, and MAVEN — computing live `HDOP` dilution of precision before descending into Jezero Crater.*
>
> *In **Mode 2: Surface GPS Map**, our 8-connected A\* router evaluates real `100×68` **MRO HiRISE and MOLA Digital Elevation Models** coupled with **0.38g Pandolf-Santee suit metabolic physics**, **Dual-Crew (`EV-1 + EV-2`) 26m Buddy-Rule constraints**, and **401 MHz UHF ray-casting** — saving **24% of primary PLSS oxygen** versus a direct climb!*
> *(Click **`3D TERRAIN`** → **`▶ FLY ROUTE`** and **`SCOUT`**!)*
> *And just like NASA JPL’s *OnSight* holographic table, clicking **`3D TERRAIN`** extrudes all 13,266 triangles of real Jezero topography in WebGL — letting Mission Control fly a low-altitude canyon chase camera right along the elevated green A\* ribbon while watching the red straight-line path slam into vertical cliffs!"*

> **[1:15 – 1:50] Stress Tests: 2-Stage Emergency Shelter + PLSS Buddy-Tow + Dust Storm Synthetic Vision**
> *(Click **`✕ 2D ORTHO`** → **`TELEMETRY DECK`** → **`PLSS & BUDDY`** → **`⚠ BUDDY-TOW FAULT CHECK`**, then click **`ABORT SIM`**)*
> *"Inside our **4-Tab Flight Telemetry Deck**, we verify NASA’s **15% PLSS Reserve Redline** even if `EV-1` has to tow an injured `EV-2` crewmate (+48% metabolic load), alongside diurnal **Solar `LTST` & Orbital Relay Pass windows**. And when a **Suit O₂ Leak + Solar Particle Event** hits, Master Caution triggers an automatic **2-stage sprint into Waypoint 3’s Basalt Overhang (-74% radiation dose)**."*
> *(Click **`✓ RESET NOMINAL`**)*

> **[1:50 – 2:35] The Showstopper: Two-Way CapCom AR Goggles + Dust Whiteout Synthetic Vision**
> *(Hand your **DIY iPhone 3D Visor Goggles** to a judge! On the laptop, click **`◆ MARK`** and click an outcrop near `WP-02`)*
> *"Please look inside our **Stereoscopic 3D Spacesuit Visor**! You are standing inside NASA’s **242-megapixel Mastcam-Z 360° panorama**. Watch this two-way Houston-to-Mars link: as you turn your head, our map tracks your 20 Hz gaze — and when I click **`◆ MARK`** on an outcrop here at Mission Control, a NASA Quindar tone fires and a **3D Cyan Priority Target Diamond** appears right in front of your eyes!*
> *(Switch laptop to **`[3] 360° Visor HUD`**, click **`DUST WHITEOUT (τ=3.2)`**, then click **`SYNTHETIC VISION [S]`**)*
> *Even if a $\tau = 3.2$ Martian dust storm blinds optical cameras to zero visibility, engaging **`SYNTHETIC VISION`** projects real **3D HiRISE DEM ridge wireframes and holographic ground route chevrons** straight through the storm — while Gaze-Dwell fires the **1064nm SuperCam LIBS laser**!"*

> **[2:35 – 3:00] SHERLOC Deep-UV Micro-Lab (CoLD 1–7) & Printable NASA FDF Debrief**
> *(Click **`SHERLOC LAB`**, drag the UV lens over `ROI-01` Cheyava Falls Leopard Spot, click **`+ LOG BIOSIGNATURE MICRO-ASSAY TO FDF`**, then open **`DEBRIEF (FDF)`**)*
> *"Finally, our **SHERLOC 248.6nm Deep-UV Raman & PIXL X-Ray Micro-Lab** lets astronauts scan real `1280px` Cheyava Falls micro-imagery to resolve millimeter-scale **vivianite/greigite 'leopard spots'** and the **1595 cm⁻¹ organic carbon G-band** — scoring **Level 4 on NASA’s CoLD Biosignature Scale** and exporting a complete **NASA Flight Data File Debrief**. Thank you!"*

---

## 3. Judge Technical Q&A Cheat Sheet (How to Crush Deep Engineering Questions)

### Q1: *"Mars doesn't have GPS satellites. How does ARES-NAV actually localize the astronaut?"*
- **Answer:** Real human Mars surface architectures (NASA Moon-to-Mars Architecture) combine **two tiers** modeled directly in ARES-NAV:
  1. **Orbital Radiometric Doppler / Two-Way Ranging (`Electra UHF`):** Triangulating slant-range and Doppler shift from **MRO, Odyssey, and MAVEN** provides a coarse fix (`~5–15m`), weighted by satellite elevation angle (`HDOP` shown live in Mode 1).
  2. **Map-Relative Terrain/Visual Localization (`HiRISE Ortho + Rover UWB/UHF Anchor`):** The astronaut’s visor matches horizon ridges against MRO **HiRISE 25 cm/pixel DEMs** (visible in **`SYNTHETIC VISION`**) while ranging off the **Perseverance Rover Mast (`2.1m AGL`)**, achieving `<0.4m` tactical surface accuracy without magnetic compasses.

### Q2: *"How does your A\* pathfinding & PLSS Buddy-Rule model work?"*
- **Answer:** Our 8-connected A\* evaluates a multi-layer physical cost tensor over real `100×68` **MRO HiRISE (`DTEEC_048900_1745`) & MOLA DEM heightfields**:
  - **0.38g Pandolf-Santee Metabolic Cost:** Models astronaut + pressurized xEMU mass (or **Rover Mule Tether** offload) in $g = 3.711\text{ m/s}^2$, slope penalties ($>15^\circ$ soft, $>25^\circ$ `NO-GO`), **THEMIS Thermal Inertia (`TIU`)** sand-sinkage penalties, **401 MHz UHF ray-casting**, and cold dawn/dusk (`LTST`) + dust (`τ`) heater draw.
  - **NASA Dual-Crew Buddy Rule:** Enforces `EV-1` + `EV-2` co-traverse (`26m` safety tether) and verifies that a `+48%` metabolic **Buddy-Tow Fault** on the return leg never breaches NASA’s **15% PLSS O₂ Reserve Redline**.

### Q3: *"What is the science behind the SHERLOC Micro-Lab and NASA CoLD Scale?"*
- **Answer:** At Bright Angel (*Cheyava Falls*, Sol 2023), Perseverance’s **SHERLOC** (`248.6 nm` Deep-UV Raman & fluorescence spectrometer) and **PIXL** (`120 µm` X-ray fluorescence) discovered millimeter-scale reaction fronts ("leopard spots") with **iron-phosphate (`vivianite`) rims**, **iron-sulfide (`greigite`) cores**, Ca-sulfate (`bassanite`, `1014 cm⁻¹`) veins, and the **`1595 cm⁻¹` aromatic organic carbon G-band**. On NASA’s 7-level **Confidence of Life Detection (CoLD)** framework, this achieves **CoLD Level 4** (highest achievable in-situ on Mars; Levels 5–7 require Earth laboratory isotopic analysis via Mars Sample Return).

### Q4: *"How does Synthetic Vision work during a Martian Dust Whiteout?"*
- **Answer:** During regional dust storms, atmospheric optical depth rises from $\tau \approx 0.4$ to $\tau > 3.0$, causing Mie scattering that reduces visual contrast of crater rims to near zero. Because ARES-NAV stores the georeferenced `100×68` MRO HiRISE DEM locally and tracks suit IMU orientation + UWB range, toggling **`SYNTHETIC VISION [S]`** projects real-time 3D elevation-sampled ridge wireframes (color-coded by $>15^\circ$ scarp hazard) and ground-locked route chevrons directly onto the astronaut's binocular waveguide visor.

---

## 4. Quick Voice Commands & Keyboard Shortcuts
Click **`MIC`** in the top bar and speak naturally (or use hotkeys):
- **Modes:** `"Planet Mars"` (`[1]`), `"Surface Map"` (`[2]`), `"Helmet Visor"` (`[3]`), `"Science Log"` (`[4]`)
- **3D Terrain & Optics:** `"3D Terrain"` (`[T]`), `"Fly Route"`, `"Synthetic Vision"` (`[S]`), `"Dust Whiteout"`, `"3D Goggles"` (`[V]`)
- **Science & Safety:** `"Sherloc Lab"`, `"Fire Laser"` (`[L]`), `"Log Sample"`, `"Aerial Scout"`, `"Emergency Abort"`, `"Reset Nominal"`, `"Mission Debrief"`
