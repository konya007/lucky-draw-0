/** Every one-shot sound the game can emit. A file in public/audio/manifest.json with the same key overrides the synth. */
export const SFX = [
  'curtain', 'lightOn', 'ballClose', 'whoosh', 'hitBrass', 'hitBall', 'lid', 'lidOpen', 'ratchet', 'gate',
  'roll', 'shellOpen', 'cymbal', 'confetti', 'paper', 'tick', 'footstep', 'rustle', 'clap', 'lock', 'crowd',
  'chime', 'applause', 'voiceStart', 'voiceCongrats',
] as const
export type SfxName = (typeof SFX)[number]

export const LOOPS = ['music', 'room', 'drumroll'] as const
export type LoopName = (typeof LOOPS)[number]
