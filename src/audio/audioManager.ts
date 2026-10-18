import { useSettingsStore } from '../store/useSettingsStore'
import { assetUrl } from '../lib/assetUrl'
import { LOOPS, SFX, type LoopName, type SfxName } from './sfx'
import folderFiles from 'virtual:audio-files'

type V3 = { x: number; y: number; z: number }
interface PlayOpts {
  vol?: number
  /** playback-rate multiplier; ±8% random jitter is always added */
  pitch?: number
  /** world position → routed through an HRTF panner (spatial) */
  pos?: V3
}

/**
 * Web Audio engine. Everything is synthesized so the project runs with zero assets;
 * files listed in public/audio/manifest.json replace individual sounds or loops.
 * The context is only created after the first user gesture (autoplay policy).
 */
class AudioManager {
  ctx: AudioContext | null = null
  private master!: GainNode
  private music!: GainNode
  private sfx!: GainNode
  private noise!: AudioBuffer
  private files = new Map<string, AudioBuffer>()
  private loops = new Map<LoopName, { gain: GainNode; target: number; src: AudioBufferSourceNode }>()
  private voices = new Map<string, number>()
  private unsub: (() => void) | null = null
  private defaultMusic: AudioBuffer | null = null
  private customMusic: AudioBuffer | null = null
  private customMusicBlob: Blob | null = null

  async unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume()
      return
    }
    const ctx = new AudioContext()
    this.ctx = ctx
    this.master = ctx.createGain()
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 3
    this.master.connect(comp).connect(ctx.destination)
    this.music = ctx.createGain()
    this.sfx = ctx.createGain()
    this.music.connect(this.master)
    this.sfx.connect(this.master)
    this.noise = this.makeNoise(2)
    this.applyVolumes()
    this.unsub = useSettingsStore.subscribe(() => this.applyVolumes())
    this.startLoops()
    void this.loadManifest()
    void this.applyCustomMusic()
  }

  private applyVolumes() {
    if (!this.ctx) return
    const s = useSettingsStore.getState()
    const t = this.ctx.currentTime
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.master, t, 0.08)
    this.music.gain.setTargetAtTime(s.music, t, 0.08)
    this.sfx.gain.setTargetAtTime(s.sfx, t, 0.08)
  }

  private async loadManifest() {
    try {
      // 1) files dropped in public/audio named after a sound (hitBall.mp3, music.ogg …)
      const known = new Set<string>([...SFX, ...LOOPS])
      const map: Record<string, string> = {}
      for (const f of folderFiles) {
        const name = f.replace(/\.[^.]+$/, '')
        // per-character voice lines: voiceStart_<rigId>, voiceCongrats_<rigId> …
        if (known.has(name) || /^voice[A-Z]\w*_[\w-]+$/.test(name)) map[name] = f
      }
      // 2) manifest.json entries win (for files with other names)
      try {
        const m = (await (await fetch(assetUrl('audio/manifest.json'))).json()) as { files?: Record<string, string> }
        Object.assign(map, m.files ?? {})
      } catch {
        /* no manifest */
      }
      await Promise.all(
        Object.entries(map).map(async ([k, f]) => {
          let decoded: AudioBuffer
          try {
            const res = await fetch(assetUrl(`audio/${f}`))
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            decoded = await this.ctx!.decodeAudioData(await res.arrayBuffer())
          } catch (e) {
            console.warn(`[audio] could not load public/audio/${f} for "${k}":`, e)
            return
          }
          this.files.set(k, decoded)
          if (k === 'music') {
            this.defaultMusic = decoded
            if (!this.customMusic) this.swapLoop('music', decoded)
          } else if (this.loops.has(k as LoopName)) this.swapLoop(k as LoopName, decoded)
        }),
      )
    } catch {
      /* no overrides: synth only */
    }
  }

  /** Replace a running loop's buffer (seamless restart on the same gain node). */
  private swapLoop(name: LoopName, buf: AudioBuffer) {
    const loop = this.loops.get(name)
    if (!loop || !this.ctx) return
    loop.src.stop()
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    src.connect(loop.gain)
    src.start()
    loop.src = src
  }

  /** Background music uploaded by the user (null = back to the default). Applied now or at unlock. */
  setCustomMusic(blob: Blob | null) {
    this.customMusicBlob = blob
    void this.applyCustomMusic()
  }

  private async applyCustomMusic() {
    const ctx = this.ctx
    if (!ctx) return // applied in unlock()
    const blob = this.customMusicBlob
    if (!blob) {
      this.customMusic = null
      if (this.defaultMusic) this.swapLoop('music', this.defaultMusic)
      return
    }
    try {
      const buf = await ctx.decodeAudioData(await blob.arrayBuffer())
      if (this.customMusicBlob !== blob) return // replaced meanwhile
      this.customMusic = buf
      this.swapLoop('music', buf)
    } catch (e) {
      console.warn('[audio] could not decode uploaded music', e)
    }
  }

  pause(p: boolean) {
    if (!this.ctx) return
    if (p) void this.ctx.suspend()
    else void this.ctx.resume()
  }

  dispose() {
    this.unsub?.()
    void this.ctx?.close()
    this.ctx = null
  }

  /** Keep the WebAudio listener on the camera so cage/outlet sounds are spatial. */
  setListener(pos: V3, fwd: V3, up: V3) {
    const ctx = this.ctx
    const l = ctx?.listener
    if (!ctx || !l || !l.positionX) return
    const t = ctx.currentTime
    l.positionX.setTargetAtTime(pos.x, t, 0.05)
    l.positionY.setTargetAtTime(pos.y, t, 0.05)
    l.positionZ.setTargetAtTime(pos.z, t, 0.05)
    l.forwardX.setTargetAtTime(fwd.x, t, 0.05)
    l.forwardY.setTargetAtTime(fwd.y, t, 0.05)
    l.forwardZ.setTargetAtTime(fwd.z, t, 0.05)
    l.upX.setTargetAtTime(up.x, t, 0.05)
    l.upY.setTargetAtTime(up.y, t, 0.05)
    l.upZ.setTargetAtTime(up.z, t, 0.05)
  }

  /** Continuous loops: 0..1 level, smoothed (time constant in seconds). */
  setLoop(name: LoopName, level: number, smooth = 0.15) {
    const l = this.loops.get(name)
    if (!l || !this.ctx) return
    if (Math.abs(l.target - level) < 0.004) return
    l.target = level
    l.gain.gain.setTargetAtTime(level, this.ctx.currentTime, smooth)
  }

  vibrate(ms = 15) {
    navigator.vibrate?.(ms)
  }

  /**
   * A host voice line: the character's own file (`voiceStart_<rigId>.mp3`) if present, else the shared
   * `voiceStart.mp3`, else the synthesized cue. Voices play at their natural pitch (no random detune).
   */
  playVoice(line: 'voiceStart' | 'voiceCongrats', rigId: string, o: PlayOpts = {}) {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running') return
    const file = this.files.get(`${line}_${rigId}`) ?? this.files.get(line)
    if (!file) return this.play(line, o)
    const out = ctx.createGain()
    out.gain.value = o.vol ?? 1
    if (o.pos) {
      const p = ctx.createPanner()
      p.panningModel = 'HRTF'
      p.distanceModel = 'inverse'
      p.refDistance = 2.5
      p.positionX.value = o.pos.x
      p.positionY.value = o.pos.y
      p.positionZ.value = o.pos.z
      out.connect(p).connect(this.sfx)
    } else out.connect(this.sfx)
    const src = ctx.createBufferSource()
    src.buffer = file
    src.connect(out)
    src.start()
  }

  play(name: SfxName, o: PlayOpts = {}) {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running') return
    // Voice limit per sound so physics bursts never saturate.
    const limit = name === 'hitBall' || name === 'hitBrass' ? 10 : 4
    const n = this.voices.get(name) ?? 0
    if (n >= limit) return
    this.voices.set(name, n + 1)
    setTimeout(() => this.voices.set(name, Math.max(0, (this.voices.get(name) ?? 1) - 1)), 60)

    const out = ctx.createGain()
    out.gain.value = o.vol ?? 1
    if (o.pos) {
      const p = ctx.createPanner()
      p.panningModel = 'HRTF'
      p.distanceModel = 'inverse'
      p.refDistance = 1.5
      p.positionX.value = o.pos.x
      p.positionY.value = o.pos.y
      p.positionZ.value = o.pos.z
      out.connect(p).connect(this.sfx)
    } else out.connect(this.sfx)

    const rate = (o.pitch ?? 1) * (1 + (Math.random() - 0.5) * 0.16)
    const file = this.files.get(name)
    if (file) {
      const src = ctx.createBufferSource()
      src.buffer = file
      src.playbackRate.value = rate
      src.connect(out)
      src.start()
      return
    }
    this.synth(name, out, rate)
  }

  // ------------------------------------------------------------------ synthesis
  private makeNoise(sec: number) {
    const ctx = this.ctx!
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate)
    const d = b.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    return b
  }

  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a)
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d)
  }

  private noiseHit(out: AudioNode, t: number, freq: number, q: number, dur: number, peak = 1, type: BiquadFilterType = 'bandpass') {
    const ctx = this.ctx!
    const s = ctx.createBufferSource()
    s.buffer = this.noise
    s.loop = true
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const g = ctx.createGain()
    this.env(g, t, 0.003, peak, dur)
    s.connect(f).connect(g).connect(out)
    s.start(t, Math.random())
    s.stop(t + dur + 0.05)
    return { f, g }
  }

  private tone(out: AudioNode, t: number, freq: number, dur: number, peak = 0.3, type: OscillatorType = 'sine', a = 0.004) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.value = freq
    const g = ctx.createGain()
    this.env(g, t, a, peak, dur)
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + a + dur + 0.05)
    return o
  }

  /** Metallic "ting": a few inharmonic partials. */
  private metal(out: AudioNode, t: number, base: number, dur: number, peak: number) {
    ;[1, 2.76, 5.4, 8.93].forEach((m, i) => this.tone(out, t, base * m, dur / (i + 1), peak / (i + 1.5), 'sine', 0.001))
  }

  private synth(name: SfxName, out: GainNode, r: number) {
    const t = this.ctx!.currentTime + 0.005
    switch (name) {
      case 'hitBall':
        this.noiseHit(out, t, 3200 * r, 6, 0.04, 0.5)
        this.tone(out, t, 1900 * r, 0.03, 0.08)
        break
      case 'hitBrass':
        this.noiseHit(out, t, 2400 * r, 10, 0.03, 0.35)
        this.metal(out, t, 1250 * r, 0.25, 0.08)
        break
      case 'ballClose':
        this.noiseHit(out, t, 4200 * r, 4, 0.025, 0.4)
        this.tone(out, t, 2600 * r, 0.06, 0.06)
        break
      case 'tick':
        this.tone(out, t, 3100 * r, 0.025, 0.1, 'triangle', 0.001)
        break
      case 'lock':
        this.noiseHit(out, t, 1600, 8, 0.03, 0.4)
        this.noiseHit(out, t + 0.05, 1200, 8, 0.04, 0.3)
        break
      case 'ratchet':
        for (let i = 0; i < 3; i++) this.noiseHit(out, t + i * 0.035, 2600 * r, 12, 0.018, 0.35)
        break
      case 'footstep':
        // heel on wood: low thump + click
        this.noiseHit(out, t, 260 * r, 1.5, 0.08, 0.7, 'lowpass')
        this.noiseHit(out, t + 0.012, 3800 * r, 3, 0.02, 0.25)
        break
      case 'lid':
        this.noiseHit(out, t, 180, 1, 0.15, 0.9, 'lowpass')
        this.metal(out, t, 310 * r, 1.2, 0.25)
        break
      case 'lidOpen':
        this.metal(out, t, 520 * r, 0.6, 0.08)
        this.noiseHit(out, t, 900, 2, 0.2, 0.15)
        break
      case 'gate':
        this.noiseHit(out, t, 1400, 5, 0.05, 0.6)
        this.metal(out, t + 0.02, 760 * r, 0.4, 0.12)
        break
      case 'roll': {
        const { f } = this.noiseHit(out, t, 700, 2, 0.9, 0.25)
        f.frequency.linearRampToValueAtTime(400, t + 0.9)
        break
      }
      case 'whoosh': {
        const { f } = this.noiseHit(out, t, 600, 1.2, 0.35, 0.25)
        f.frequency.exponentialRampToValueAtTime(3000 * r, t + 0.3)
        break
      }
      case 'curtain': {
        const { f, g } = this.noiseHit(out, t, 500, 0.7, 2.6, 0.5)
        g.gain.cancelScheduledValues(t)
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(0.5, t + 0.6)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8)
        f.frequency.linearRampToValueAtTime(900, t + 1.5)
        break
      }
      case 'crowd': {
        // audience murmur settling down
        const { g } = this.noiseHit(out, t, 420, 0.5, 3, 0.3)
        g.gain.cancelScheduledValues(t)
        g.gain.setValueAtTime(0.25, t)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3)
        break
      }
      case 'lightOn':
        this.noiseHit(out, t, 120, 1, 0.12, 1, 'lowpass')
        this.noiseHit(out, t, 2000, 1, 0.05, 0.3)
        break
      case 'shellOpen':
        this.noiseHit(out, t, 5000, 3, 0.05, 0.4)
        this.tone(out, t, 880, 0.6, 0.1)
        this.tone(out, t + 0.05, 1320, 0.8, 0.08)
        break
      case 'cymbal': {
        this.noiseHit(out, t, 5000, 0.4, 2.8, 0.8, 'highpass')
        this.metal(out, t, 420, 2.2, 0.06)
        break
      }
      case 'confetti':
        for (let i = 0; i < 6; i++) this.noiseHit(out, t + Math.random() * 0.4, 6000, 2, 0.04, 0.12)
        break
      case 'paper':
        for (let i = 0; i < 4; i++) this.noiseHit(out, t + i * 0.05, 3500 + Math.random() * 2000, 1.5, 0.06, 0.2)
        break
      case 'rustle':
        this.noiseHit(out, t, 1800, 0.8, 0.45, 0.12)
        break
      case 'clap':
        for (let i = 0; i < 3; i++) this.noiseHit(out, t + i * 0.42, 1300, 1.2, 0.07, 0.6)
        break
      case 'applause': {
        // audience applause: ~220 hand claps scattered over 3.5 s with a swell and decay,
        // each a short band-passed noise burst at a random pitch, plus a few cheering "woo" tones
        const dur = 3.5
        for (let i = 0; i < 220; i++) {
          // density rises fast, holds, then thins out
          const u = Math.random()
          const at = dur * (u < 0.15 ? u * 2 : 0.3 + (u - 0.15) * 0.82)
          const env = Math.min(1, at / 0.4) * Math.max(0.15, 1 - Math.max(0, at - 1.8) / (dur - 1.8))
          this.noiseHit(out, t + at, 900 + Math.random() * 1800, 1.4, 0.035 + Math.random() * 0.02, 0.22 * env)
        }
        for (let k = 0; k < 4; k++) {
          const o = this.tone(out, t + 0.2 + k * 0.35, 520 + Math.random() * 180, 0.5, 0.025, 'triangle', 0.05)
          o.frequency.exponentialRampToValueAtTime(820 + Math.random() * 200, t + 0.55 + k * 0.35)
        }
        break
      }
      case 'chime':
        ;[1, 1.25, 1.5, 2].forEach((m, i) => this.tone(out, t + i * 0.08, 660 * m, 1.4, 0.07))
        break
      case 'voiceStart':
      case 'voiceCongrats':
        // voice lines are file-only (see README); the synth just sparkles
        ;[1, 1.5].forEach((m, i) => this.tone(out, t + i * 0.1, 988 * m, 0.5, 0.05))
        break
    }
  }

  // ------------------------------------------------------------------ loops
  private startLoops() {
    const ctx = this.ctx!
    const mk = (name: LoopName, buf: AudioBuffer, bus: GainNode) => {
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      const gain = ctx.createGain()
      gain.gain.value = 0
      src.connect(gain).connect(bus)
      src.start()
      this.loops.set(name, { gain, target: 0, src })
    }
    mk('room', this.renderRoom(), this.music)
    mk('drumroll', this.renderDrumroll(), this.sfx)
    this.defaultMusic = this.renderMusic()
    mk('music', this.defaultMusic, this.music)
    this.setLoop('room', 0.16, 1)
  }

  private buffer(sec: number, fill: (d: Float32Array, sr: number) => void) {
    const ctx = this.ctx!
    const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * sec), ctx.sampleRate)
    fill(b.getChannelData(0), ctx.sampleRate)
    return b
  }

  private renderRoom() {
    // brown noise = large hall air
    return this.buffer(4, (d) => {
      let last = 0
      for (let i = 0; i < d.length; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
        d[i] = last * 2.5
      }
    })
  }

  private renderDrumroll() {
    return this.buffer(1, (d, sr) => {
      const hits = 26
      for (let h = 0; h < hits; h++) {
        const start = Math.floor((h / hits) * d.length)
        const amp = h % 2 ? 0.55 : 0.75
        for (let i = 0; i < sr * 0.06 && start + i < d.length; i++) {
          const e = Math.exp(-i / (sr * 0.012))
          d[start + i] += (Math.random() * 2 - 1) * e * amp * 0.6 + Math.sin(i * 0.09) * e * 0.25
        }
      }
    })
  }

  /** 32-second generative cello/piano bed (Am – F – C – G), rendered once into a loop buffer. */
  private renderMusic() {
    const sec = 32
    const chords = [
      [45, 57, 60, 64],
      [41, 53, 57, 60],
      [48, 55, 60, 64],
      [43, 55, 59, 62],
    ]
    const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12)
    return this.buffer(sec, (d, sr) => {
      const bar = sec / 4
      for (let c = 0; c < 4; c++) {
        const notes = chords[c]
        const t0 = c * bar
        // bowed pad: slow attack/release, slight vibrato, a few harmonics
        notes.forEach((m, ni) => {
          const f = mtof(m)
          const n = Math.floor(bar * sr)
          for (let i = 0; i < n; i++) {
            const t = i / sr
            const env = Math.min(1, t / 2.2) * Math.min(1, (bar - t) / 2.2)
            const ph = 2 * Math.PI * f * t + 0.6 * Math.sin(2 * Math.PI * 5 * t + ni) * 0.02
            const s = Math.sin(ph) + 0.35 * Math.sin(2 * ph) + 0.18 * Math.sin(3 * ph)
            d[Math.floor(t0 * sr) + i] += s * env * (ni === 0 ? 0.1 : 0.045)
          }
        })
        // sparse piano notes
        for (let k = 0; k < 3; k++) {
          const f = mtof(notes[1 + ((k + c) % 3)] + 12)
          const start = Math.floor((t0 + 1 + k * 2.3) * sr)
          for (let i = 0; i < sr * 3; i++) {
            const t = i / sr
            const env = Math.exp(-t * 1.6)
            const s = Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t) * Math.exp(-t * 4)
            if (start + i < d.length) d[start + i] += s * env * 0.055
          }
        }
      }
    })
  }
}

export const audio = new AudioManager()
