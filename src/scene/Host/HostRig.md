# Host animation system

Every character shares one procedural animator (`useHostAnimator.ts`):

- two-bone IK for arms and legs;
- a skipping gait with planted feet;
- springs for hands, head, hair and ears;
- idle gaze, and palm orientation measured from the knuckles;
- optionally the model's own Idle/Walk clips, with all of the above layered on top.

What differs per model is **data**: `src/assets/<pack>/info.json`. It holds the bone mapping, regexes for hair, hands, wings and skirts, and motion tuning. See `src/assets/README.md`.

| File | Role |
|---|---|
| `rigs/HostRig.ts` | Logical bone keys (`BoneKey`) and the default value of every motion parameter |
| `rigs/PackRig.ts` | `ModelInfo` (the info.json type), validation, `PackRig` built from the data |
| `rigs/index.ts` | Registry: loads every `src/assets/*/` pack (`import.meta.glob`) plus uploaded packs (`useRigs`, `rigById`, `useRig`) |
| `src/lib/modelPacks.ts` | Uploaded `.zip` packs: unzip (fflate), IndexedDB storage, template download |
| `Host.tsx` | Loads the GLB; normalizes height, facing, centre and materials; binds the animator |
| `useHostAnimator.ts` | All the motion |

## Arm poses (`ArmPose`)

- `rest`, `clasp`, `wave`, `clap`
- `present`, `presentTwo`, `openBall`, `hairTouch`
- `carryBox`: ballot box held with both hands.
- `carrySide` / `carryWave`: box on one palm (`host.carryHand`); the other hand hangs or waves.

`reach(side, getter, palm?)` sends one hand to a point: the crank knob, the ball, a ticket edge.

## Technical notes

- **Bone names:** three.js sanitizes node names. It removes `. : / [ ]` and turns spaces into `_`. `HostRig.baseName()` also drops a trailing `_<number>`.
- **Several skins:** multi-skin exports carry duplicate skeletons (MrBeast). The copy containing the hips bone is primary; the others are synced to it every frame.
- **Palms:** with `palmBones`, the palm direction is measured from the knuckles every frame. Holding wrists roll palm-up, and held objects sit on the palm side.
