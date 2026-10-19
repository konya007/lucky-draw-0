# Template pack

1. Get the template:
   - from source: copy this folder to `src/assets/<character-name>/`;
   - or download it from Settings in the game and unzip it.
2. Put your compressed model next to `info.json` and name it `host.glb`.
3. Edit `info.json`:
   - a unique `id` and a display `name`;
   - the `bones` map, using normalized bone names (see `../README.md`);
   - `height` and `materials`.
4. Optional: add `voice/start.mp3`, `voice/congrats.mp3` and `thumbnail.webp`. Delete the matching lines from `info.json` for any you don't use.
5. Load the pack:
   - a source pack shows up when you run `npm run dev`;
   - otherwise zip the folder and upload it in **Settings → Character**.

Open `info.json` in VS Code to get autocompletion and checks against `model.schema.json`.
