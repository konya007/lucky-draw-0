import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, CanvasTexture, Color, FrontSide, Group, MeshStandardMaterial, PlaneGeometry, Quaternion, SRGBColorSpace, Vector3 } from 'three'
import { fixZeroNormals } from '../../lib/safeNormals'
import { useGameStore, shown, type Win } from '../../store/useGameStore'
import { director } from '../../director/Director'
import { stage } from '../../director/channels'

export const TICKET_W = 0.42
export const TICKET_H = 0.21

/** Ticket transform, tweened by the Director (hands → camera → box). */
export const ticket = {
  visible: false,
  pos: new Vector3(),
  quat: new Quaternion(),
  scale: 1,
  /** extra flip around the ticket's own Y (radians) for the reveal spin */
  flip: 0,
  /** 0 = folded in four (as it comes out of the ball) → 1 = flat */
  unfold: 1,
}

/** Draws the winning ticket: ivory paper, embossed brass frame, perforated stub, serial, event, data, date. */
export async function drawTicket(win: Win): Promise<CanvasTexture> {
  await document.fonts?.ready
  const W = 2048
  const H = 1024
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  // paper with subtle fibre noise
  const grad = g.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, '#f6eedc')
  grad.addColorStop(1, '#eadfc6')
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(120,90,50,${Math.random() * 0.05})`
    g.fillRect(Math.random() * W, Math.random() * H, 2, 2)
  }
  const stub = 430
  // brass frame (double line, "embossed" with a light and a dark offset)
  const frame = (inset: number, w: number) => {
    g.lineWidth = w
    g.strokeStyle = 'rgba(255,240,200,0.9)'
    g.strokeRect(inset - 2, inset - 2, W - inset * 2, H - inset * 2)
    g.strokeStyle = '#a77a2e'
    g.strokeRect(inset, inset, W - inset * 2, H - inset * 2)
  }
  frame(36, 10)
  frame(60, 3)
  // perforation between stub and body
  g.fillStyle = 'rgba(0,0,0,0)'
  g.globalCompositeOperation = 'destination-out'
  for (let y = 24; y < H; y += 46) {
    g.beginPath()
    g.arc(stub, y, 9, 0, Math.PI * 2)
    g.fill()
  }
  // notches at the ends of the perforation
  g.beginPath()
  g.arc(stub, 0, 34, 0, Math.PI * 2)
  g.arc(stub, H, 34, 0, Math.PI * 2)
  g.fill()
  g.globalCompositeOperation = 'source-over'
  g.setLineDash([2, 0])

  // stub: serial vertical
  g.save()
  g.translate(stub / 2, H / 2)
  g.rotate(-Math.PI / 2)
  g.fillStyle = '#7a5520'
  g.font = '600 64px "Playfair Display", serif'
  g.textAlign = 'center'
  g.fillText('Nº ' + win.serial, 0, 20)
  g.font = '400 30px Inter, sans-serif'
  g.fillStyle = '#9a7a46'
  g.fillText('ADMIT ONE · GRAND DRAW', 0, 90)
  g.restore()

  // body
  const cx = stub + (W - stub) / 2
  g.textAlign = 'center'
  g.fillStyle = '#6e4a17'
  g.font = '600 44px Inter, sans-serif'
  spaced(g, (win.title || 'GRAND DRAW').toUpperCase(), cx, 170, 12)
  // ornament
  g.strokeStyle = '#b8893b'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(cx - 260, 210)
  g.lineTo(cx - 40, 210)
  g.moveTo(cx + 40, 210)
  g.lineTo(cx + 260, 210)
  g.stroke()
  g.fillStyle = '#b8893b'
  g.beginPath()
  g.moveTo(cx, 196)
  g.lineTo(cx + 14, 210)
  g.lineTo(cx, 224)
  g.lineTo(cx - 14, 210)
  g.fill()

  // on-screen text respects the ID-mask display mode
  const [name, ...rest] = (win.entry.cols.length ? win.entry.cols : [win.entry.raw]).map(shown)
  // big, high-contrast lines: readable on a projector from the back of the room
  g.fillStyle = '#0d0703'
  fitText(g, name, cx, 480, W - stub - 200, 270, '800', '"Playfair Display", serif')
  if (rest[0]) {
    g.fillStyle = '#7a1f12'
    fitText(g, rest[0], cx, 660, W - stub - 240, 150, '700', 'Inter, sans-serif', false, 6)
  }
  if (rest.length > 1) {
    g.fillStyle = '#3d2a12'
    fitText(g, rest.slice(1).join('  ·  '), cx, 780, W - stub - 260, 76, '600', 'Inter, sans-serif')
  }
  g.fillStyle = '#6e5232'
  g.font = '500 38px Inter, sans-serif'
  const d = new Date(win.at)
  spaced(g, d.toLocaleString('vi-VN', { dateStyle: 'long', timeStyle: 'short' }).toUpperCase(), cx, 900, 4)

  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  return t
}

function spaced(g: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  g.save()
  ;(g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${spacing}px`
  g.fillText(text, x, y)
  g.restore()
}

function fitText(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number, weight: string, family: string, italic = false, spacing = 0) {
  ;(g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${spacing}px`
  let s = size
  do {
    g.font = `${italic ? 'italic ' : ''}${weight} ${s}px ${family}`
    if (g.measureText(text).width <= maxW) break
    s -= 4
  } while (s > 28)
  let t = text
  while (g.measureText(t).width > maxW && t.length > 3) t = t.slice(0, -2) + '…'
  g.fillText(t, x, y)
  ;(g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px'
}

/** The ticket mesh (one per draw; texture rebuilt and the old one disposed). */
export function Ticket() {
  const current = useGameStore((s) => s.current)
  const maskOn = useGameStore((s) => s.maskIds)
  const group = useRef<Group>(null)
  const mat = useMemo(
    () => new MeshStandardMaterial({ side: FrontSide, color: '#ffffff', roughness: 0.7, metalness: 0, transparent: true, alphaTest: 0.5, emissive: new Color(1, 1, 1), emissiveIntensity: 0.32 }),
    [],
  )
  const geo = useMemo(() => {
    const g = new PlaneGeometry(TICKET_W, TICKET_H, 16, 8)
    return g
  }, [])
  const flatNormals = useRef(true)
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array as Float32Array), [geo])

  useEffect(() => {
    if (!current) return
    let alive = true
    void drawTicket(current).then((t) => {
      if (!alive) return t.dispose()
      mat.map?.dispose()
      mat.map = t
      mat.emissiveMap = t
      mat.needsUpdate = true
    })
    return () => {
      alive = false
    }
  }, [current, mat, maskOn])

  useFrame((s) => {
    const g = group.current
    if (!g) return
    g.visible = ticket.visible
    if (!ticket.visible) return
    g.position.copy(ticket.pos)
    g.quaternion.copy(ticket.quat)
    g.rotateY(ticket.flip)
    g.scale.setScalar(ticket.scale)
    // folded in four: unfolding opens the vertical fold first, then the horizontal one
    const pos = geo.attributes.position
    const u = ticket.unfold
    const ease = (x: number) => x * x * (3 - 2 * x)
    const av = Math.PI * (1 - ease(Math.min(1, Math.max(0, u * 2)))) // right half folded over the left
    const ah = Math.PI * (1 - ease(Math.min(1, Math.max(0, u * 2 - 1)))) // top half folded down
    const wob = s.clock.elapsedTime * 1.3
    // Real folds: each half rotates rigidly about its crease, which sits a hair in front of the
    // sheet. A 180° fold maps z → 2e − z, so layer order reverses exactly like stacked paper
    // (folded flaps show their plain back, the printed face ends up inside).
    const e = 0.0012
    const ch = Math.cos(ah), sh = Math.sin(ah)
    const cv = Math.cos(av), sv = Math.sin(av)
    for (let i = 0; i < pos.count; i++) {
      let x = base[i * 3]
      let y = base[i * 3 + 1]
      let z = u >= 1 ? Math.sin(wob + x * 6) * 0.002 : 0
      if (y > 0) {
        // first fold: top half over the bottom (about the horizontal centre line)
        const zr = z - e
        const ny = y * ch - zr * sh
        z = y * sh + zr * ch + e
        y = ny
      }
      if (x > 0) {
        // second fold: right half over the left (about the vertical centre line)
        const E = 3 * e
        const zr = z - E
        const nx = x * cv - zr * sv
        z = x * sv + zr * cv + E
        x = nx
      }
      pos.setXYZ(i, x, y, z)
    }
    pos.needsUpdate = true
    // keep shading right while the paper bends (tiny mesh, only while folded/unfolding)
    if (u < 1 || !flatNormals.current) {
      geo.computeVertexNormals()
      // a 180° crease cancels its normals → NaN → black squares through the bloom
      fixZeroNormals(geo)
      flatNormals.current = u >= 1
    }
    mat.emissiveIntensity = 0.28 + (stage.invited === 'ticket' ? stage.invite * 0.12 : 0)
  })

  return (
    <group ref={group} visible={false}>
      <mesh
        geometry={geo}
        material={mat}
        castShadow
        onPointerDown={(e) => {
          e.stopPropagation()
          director.ticketTap(e.nativeEvent.clientY)
        }}
        onPointerUp={(e) => director.ticketRelease(e.nativeEvent.clientY)}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      />
      {/* back of the paper: same folding sheet, drawn from behind only, so flaps show their plain side */}
      <mesh geometry={geo} raycast={() => null}>
        <meshStandardMaterial color="#e9dcc0" roughness={0.8} emissive="#e9dcc0" emissiveIntensity={0.45} side={BackSide} />
      </mesh>
    </group>
  )
}
