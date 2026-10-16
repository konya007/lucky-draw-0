import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, InstancedBufferAttribute, InstancedMesh, Matrix4, SphereGeometry, Vector3 } from 'three'
import { BALL_RADIUS } from '../layout'
import { ballSystem } from './ballSystem'
import { makeBallMaterial } from './ballMaterial'
import { MAX_BALLS } from '../../lib/parseEntries'

const _m = new Matrix4()
const _s = new Vector3()
const WHITE = new Color(1, 1, 1)
const _p = new Vector3()

/** All 100 balls in a single InstancedMesh (colour via instanceColor), transforms pulled from ballSystem each frame. */
export function BallPool() {
  const mesh = useRef<InstancedMesh>(null)
  const geo = useMemo(() => {
    const g = new SphereGeometry(BALL_RADIUS, 24, 16)
    g.setAttribute('aFlash', new InstancedBufferAttribute(new Float32Array(MAX_BALLS), 1))
    return g
  }, [])
  const mat = useMemo(() => makeBallMaterial({ instanced: true }), [])

  useEffect(() => {
    const m = mesh.current!
    for (let i = 0; i < MAX_BALLS; i++) {
      m.setMatrixAt(i, _m.makeScale(0, 0, 0))
      m.setColorAt(i, ballSystem.balls[i]?.color ?? WHITE)
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    return () => {
      geo.dispose()
      mat.dispose()
    }
  }, [geo, mat])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const m = mesh.current
    if (!m || !ballSystem.balls.length) return
    const flash = geo.getAttribute('aFlash') as InstancedBufferAttribute
    for (const b of ballSystem.balls) {
      const visible = b.mode !== 'hidden' && b.mode !== 'hero'
      const s = visible ? b.scale : 0
      _s.setScalar(s)
      if (b.mode === 'float') {
        // packed balls bob gently while they hover
        _p.copy(b.pos).setY(b.pos.y + Math.sin(t * 1.3 + b.i * 1.7) * 0.025)
        _m.compose(_p, b.quat, _s)
      } else _m.compose(b.pos, b.quat, _s)
      m.setMatrixAt(b.i, _m)
      m.setColorAt(b.i, b.color)
      flash.setX(b.i, b.flash)
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    flash.needsUpdate = true
  })

  return <instancedMesh ref={mesh} args={[geo, mat, MAX_BALLS]} castShadow receiveShadow frustumCulled={false} />
}
