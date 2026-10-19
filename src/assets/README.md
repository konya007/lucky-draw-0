# Model packs

Each host character is **one folder** in `src/assets/`. The game picks up every folder that has an `info.json`, except folders whose names start with `_` (such as `_template`). Adding a character needs no code changes.

```
src/assets/
├── model.schema.json      # every info.json field (VS Code autocompletes it through "$schema")
├── _template/             # starter pack: copy this folder to begin
├── foxy/                  # Specs the Fox (default, ships its own Idle/Walk clips)
├── girl-anime/            # anime girl (VRoid, toon shading)
└── mrbeast/               # MrBeast (Unreal mannequin)
```

## What a pack contains

| File | Required | Content |
|---|---|---|
| `info.json` | ✔ | Name, author, license, bone mapping, motion tuning (see `model.schema.json`) |
| `host.glb` | ✔ | The compressed model (meshopt + webp textures). Use `files.model` for another name |
| `voice/start.mp3`, `voice/congrats.mp3` | | The character's own greeting and congratulation lines (`voices` in info.json) |
| `thumbnail.webp` | | Small image for the character picker (`files.thumbnail`) |
| `animations.glb` | | Idle / Walk clips for the same skeleton, for models that ship without them (`files.animations`) |
| `rig.ts` | | Source-code packs only: overrides hooks that the regexes in info.json can't express (see below) |
| `source/` | | The uncompressed original, kept for re-compressing. Not bundled into the build |
| `README.md` | | Notes about the model |

## Adding a character

**From source.** Copy `_template/` to `src/assets/<name>/`, put your `host.glb` in it and edit `info.json`. Then run `npm run dev`; the character shows up in the Character picker.

**Without code.** Zip the folder and upload it in **Settings → Character → Upload .zip pack**. The pack is stored in the browser (IndexedDB). Uploaded packs are data only: a `rig.ts` inside a zip is ignored.

### Compressing the model

Put the original at `src/assets/<name>/source/source.glb` and run:

```bash
npm run compress-model -- <name>
```

This writes `host.glb` (meshopt, webp textures ≤ 2048 px). For a zip-only pack, compress it by hand:

```bash
npx gltf-transform optimize in.glb host.glb --compress meshopt --texture-compress webp
```

### Finding bone names

Open the model in <https://gltf-viewer.donmccurdy.com/> or in Blender to see the bone tree. `info.json` uses the names after three.js normalizes them:

- spaces become `_`
- `.` `:` `/` `[` `]` are removed
- a trailing export index `_<number>` is dropped

For example, `hand.L` becomes `handL`, `mixamorig:Hips` becomes `mixamorigHips`, and `Left arm_20` becomes `Left_arm`. With `npm run dev`, the console prints the bone count of the active model.

### Model requirements

- One armature at the origin, feet on y = 0, facing +Z or -Z. The game turns the model to match its feet.
- Bones for:
  - hips, two spine bones, neck and head
  - three per arm: upper arm, forearm, wrist
  - three or four per leg
- Knees and elbows slightly bent in the rest pose, so the IK knows which way they fold.
- Clean skin weights:
  - glasses, hats and similar props are weighted 100% to the head bone
  - no arm weights on the torso
- Under about 40k triangles, textures ≤ 2048 px.

### `rig.ts` (optional, source packs only)

```ts
import type { RigHooks } from '../../scene/Host/rigs/PackRig'

export default {
  // e.g. strip a custom prefix from the bone names
  baseName: (name) => name.replace(/^Armature_/, '').replace(/_\d+$/, ''),
} satisfies RigHooks
```

## Prompt for an AI assistant

Give this prompt to another AI together with the `.glb` file, or with its bone list, to get an `info.json` written:

```
You are writing info.json for a host character in the GRAND DRAW game (three.js).
Full schema: <paste src/assets/model.schema.json>.
Example: <paste src/assets/_template/info.json>.

My model: <name, wanted height in metres, skeleton style (Mixamo / VRoid / Unreal / Blender Rigify …)>.
Bone list (original names in the file): <paste the bone tree>.

Rules:
1. Normalize bone names the way three.js does: spaces → "_", remove . : / [ ], drop a trailing "_<number>".
2. Map all 21 keys in "bones". Without toe bones use the ankle for lToe/rToe; for mitten hands use the wrist for lMid/rMid.
3. If there are index and pinky knuckle bones, fill "palmBones"; otherwise set it to null.
4. "hands": one regex selecting every hand bone (wrist + fingers), and regexes telling left from right.
5. "springs" for hair, ears, ribbons, capes; "wings" and "skirtRoots" when present.
6. materials = "toon" for unlit (KHR_materials_unlit, anime-style) models, otherwise "lit".
7. Answer with valid JSON only.
```
