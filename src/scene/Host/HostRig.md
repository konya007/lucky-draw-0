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
