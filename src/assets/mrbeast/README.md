# MrBeast

- Source: `source/source.glb` (Fortnite outfit, 3.3 MB). Compressed: `host.glb` (≈ 453 KB).
- Unreal mannequin skeleton (`pelvis`, `spine_01…05`, `upperarm_l` …). Names look like `upperarm_l_017`, which becomes `upperarm_l`.
- Three skins, each with its own copy of the skeleton. The copy containing `pelvis` is the primary one; the others are synced to it every frame.
- Real hands:
  - `palmBones` (index and pinky knuckles) let the game turn the palms.
  - `handReach 0.5` puts the grip point in the palm.
- Spring bones: `dyn_hood*`, `cape`, `dyn_megaphone`, `dyn_shoe_back_*`.
