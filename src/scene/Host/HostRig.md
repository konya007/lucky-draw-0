# Host rig — inspection results

Source: `public/3d_anime_character_girl_for_blender.glb` (Sketchfab export, full body, 5.3 MB)
Runtime file: `public/host.glb` (made with `npm run compress-host`: Meshopt + WebP, textures ≤ 2048, **631 KB**)

## Summary

| Item | Value |
|---|---|
| Animation clips | **none** → the procedural animator + IK in `useHostAnimator.ts` is the primary path |
| Skinned meshes | 5, all sharing the same 185 joints |
| Triangles | 44,256 |
| Morph targets / blendshapes | none. `Eye_L/R` bones only move the irises (the whites are in the face texture), so expressions are done with head/body motion, never by scaling the eyes |
| Materials | `hair`, `material`, `glasses`, `material_3`, `hair_shadow`, all `KHR_materials_unlit` with a baseColor texture (converted to `MeshToonMaterial` + 3-step ramp + rim) |
| Textures | 5 × PNG 2048² (≈ 9.7 MB) → WebP (≈ 0.54 MB) |
| Bind-pose height | ≈ 1.5 m (Y-up, faces +Z), feet at y = 0. Normalized at runtime to **1.6 m** from skinned bounds |
| Bone axis convention | Unity-humanoid style: each bone points along its local **+Y** toward its child |
| Naming | Unity/VRoid-like with an export index suffix. three.js turns spaces into `_`, so `Left arm_20` becomes `Left_arm_20`. Lookup strips the suffix (`baseName()`) |

## `HOST_BONES` (base name → used for)

| Key | Base name | Use |
|---|---|---|
| hips | `Hips` | root height, crouch, gait twist |
| spine / chest | `Spine`, `Chest` | lean, bow, breathing, counter-twist |
| neck / head | `Neck`, `Head` | look-at (40% / 60%) |
| lArm, lElbow, lWrist | `Left_arm`, `Left_elbow`, `Left_wrist` | left arm two-bone IK |
| rArm, rElbow, rWrist | `Right_arm`, `Right_elbow`, `Right_wrist` | right arm two-bone IK (crank knob, ball) |
| lLeg, lKnee, lAnkle, lToe | `Left_leg`, `Left_knee`, `Left_ankle`, `Left_toe` | left leg IK (planted feet), facing check |
| rLeg, rKnee, rAnkle, rToe | `Right_leg`, … | right leg IK |
| lMid / rMid | `MiddleFinger1_L/R` | palm attach point for held objects |

Measured bone lengths (model units): upper arm 0.175, forearm 0.192, thigh 0.376, shin 0.380, hips at y = 0.839.

## Secondary-motion bones (springs)

`Hair_Side01_L/R`, `Hair_Side_Ribon01_L/R`, `Hair_Front_001/002`, `Tail_02`, `Front_Ribon_01_L/R` get a damped spring driven by root acceleration and the walk bounce (follow-through). `Wing02_L/R` flap. The 12 skirt strands (`Skirt_0_0…Skirt_0_11`, each a 5-joint chain) are pushed by the thighs so the legs never poke through the skirt.

Other notable chains: full finger chains (3 joints each), `zArmTwist_*` / `zHandTwist_*` (left at rest), `Eye_L/R`, 60 skirt joints (`Skirt_{0-4}_{0-11}`), tail and wings.

## Adding real clips

See README → "Host animations". Put retargeted clips in `public/host-animations.glb` and set `"animations": "/host-animations.glb"` in `public/host-manifest.json`. The `Idle` and `Walking` clips then drive the body, and IK/look-at stay layered on top for the arms and head.

---

# Multiple characters (rigs)

Each host character is a subclass of `HostRig` (`rigs/HostRig.ts`). The animator (`useHostAnimator.ts`) only talks to the skeleton through the rig, so the same procedural animation, IK, gaze and springs drive every model.

| File | Character | Skeleton |
|---|---|---|
| `rigs/AnimeGirlRig.ts` | Cô gái anime (`/host.glb`) | VRoid/Unity humanoid, 185 joints, unlit → toon |
| `rigs/MrBeastRig.ts` | MrBeast (`/host-mrbeast.glb`) | Unreal mannequin, 3 skins (141 + 76 + 179 joints), PBR |
| `rigs/FoxRig.ts` (default) | Cáo Kính (`/host-fox.glb`) | Blender-style v2 (source `fox_rigged_v2.glb`), 36 joints incl. index/pinky knuckles + thumb + toes, PBR, **own clips** Idle/Walk/Wave/Jump/TailWag (`useClips`); hops while cranking (`crankHop`), shows things lower/out to the side (`headClear`) |

What a rig defines: `bones` (logical bone → base name), `height`, `materials` ('toon' | 'lit'), `hop`, `armRest`, and the hooks `springGain()`, `wingSide()`, `isSkirtRoot()`, `handSide()`, `baseName()`.

**Adding a character:** compress the GLB (`gltf-transform optimize in.glb public/host-xxx.glb --compress meshopt --texture-compress webp --texture-size 2048`), write `rigs/XxxRig.ts` extending `HostRig`, add it to `RIGS` in `rigs/index.ts`. It then appears in the editor's "Nhân vật" picker. Voice lines: `public/audio/voiceStart_<id>.mp3`, `voiceCongrats_<id>.mp3`.

## MrBeast (Unreal/Fortnite) notes

- Bone names: `upperarm_l_017` → base `upperarm_l`. Logical mapping: hips `pelvis`, spine `spine_02`, chest `spine_04`, neck `neck_01`, head `head`, arms `upperarm/lowerarm/hand_*`, legs `thigh/calf/foot/ball_*`, palm `middle_01_*`.
- **Duplicate skeletons:** body, head and accessories each have their own copy of the skeleton. The copy containing `pelvis` is primary; every same-named bone in the other copies mirrors it each frame (`mirrors` in the animator).
- Springs: `dyn_hood*`, `cape`, `dyn_megaphone`, `dyn_shoe_back_*`. Twist/deform bones are children of the arm/leg bones and follow automatically.
- Height on stage 1.75 m, hop 0.055 m, arms hang by the sides.
- Real hands (not mittens): grip at the palm (`handReach 0.5`), ball shown at 1.25× resting in an upturned palm (`palmBones`: the palm direction is measured from the knuckles each frame and holding wrists roll palm-up; held objects sit on the palm side), ticket at 1.05×, wider clap gap, deeper lean/crouch to reach the tray.

## Fox notes

- three.js strips dots from node names: `hand.L` → `handL`, `tail.01` → `tail01`.
- `useClips = true`: the GLB's Idle/Walk clips drive body and legs (crossfade 0.35 s when walking starts/stops); arms (IK), gaze, lean/bow/crouch are layered on top.
- No finger or toe bones: the hand bone is also the palm point, the foot bone also the toe.
- All rigs share the box poses: `carryBox` (both hands in front of the belly, palms in; `carryHalfWidth` per rig, used to open the box) and `carrySide` / `carryWave` (box on one palm beside the hip, `host.carryHand`; `carryWave` waves with the other hand on the way in). While the cards are packed the host waits on the apron holding the open box (`MARKS.pack`), then walks off (`PATHS.packExit`); after loading the cage the host turns upstage, pretends to set the box down and it vanishes.
