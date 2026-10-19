# Specs the Fox (default host)

- Source: `source/source.glb` (fox_rigged_v2, 36 Blender-style joints: `upper_arm.L`, `hand.L`, `f_index.01.L`, `toe.L` …). Compressed: `host.glb` (≈ 416 KB).
- Ships its own clips: Idle / Walk / Wave / Jump / TailWag (`useClips: true`).
  - Idle and Walk drive the body and legs.
  - Arms, gaze and leaning are procedural.
- Chibi with a big head and short arms, so it has its own tuning:
  - `crankHop`: jumps while cranking.
  - `reachStep`: steps up to the knob.
  - `trayStandoff`: stands clear of the table.
  - `headClear`: holds things lower and to the side.
  - `ticketShot`: shifts the ticket close-up.
- `centreOn: "hips"`, because the big tail shifts the bounding-box centre.
