import { useEffect, useRef, useState } from 'react'
import styles from './SpinWheel.module.css'

// Segments ordered on the wheel. Slot 0 = prize (unreachable).
// Slots 1-9 cover scores 1-10 explicitly.
const SEGMENTS = [
  { label: '📱', score: null },
  { label: '1 — Ouch',     score: 1 },
  { label: '2 — Painful',  score: 2 },
  { label: '3 — Bad',      score: 3 },
  { label: '4 — Mediocre', score: 4 },
  { label: '5 — Meh',      score: 5 },
  { label: '6 — Amusing',  score: 6 },
  { label: '7 — Funny',    score: 7 },
  { label: '8 — Good',     score: 8 },
  { label: '9+ — Genius',  score: 9 },
]

const COLORS = [
  '#00ff88','#ff4466','#ffcc00','#44aaff',
  '#ff8844','#aa44ff','#44ffcc','#ff4488',
  '#88ff44','#4488ff',
]

const N = SEGMENTS.length
const DEG_PER = 360 / N

// Map Jev score (1-10) directly to wheel slot (1-9). Score 9 and 10 share slot 9.
function scoreToSlot(score) {
  if (score >= 9) return 9
  return Math.max(1, Math.round(score))
}

function drawWheel(canvas) {
  const ctx = canvas.getContext('2d')
  const cx = canvas.width / 2
  const cy = canvas.height / 2
  const r = cx - 4

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  for (let i = 0; i < N; i++) {
    const startRad = ((i * DEG_PER - 90) * Math.PI) / 180
    const endRad   = (((i + 1) * DEG_PER - 90) * Math.PI) / 180
    const midAngle = ((i * DEG_PER + DEG_PER / 2 - 90) * Math.PI) / 180

    // Prize slot: gold fill with glow border
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, r, startRad, endRad)
    ctx.closePath()
    ctx.fillStyle = i === 0 ? '#FFD700' : COLORS[i]
    ctx.fill()
    ctx.strokeStyle = i === 0 ? '#ff8c00' : '#0a0a0f'
    ctx.lineWidth = i === 0 ? 3 : 2
    ctx.stroke()

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(midAngle)

    if (i === 0) {
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      // Draw all content right-aligned from the rim inward
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      // 🎊 near rim
      ctx.font = '18px system-ui'
      ctx.fillText('🎊', r - 6, 0)
      // 📱
      ctx.font = '28px system-ui'
      ctx.fillText('📱', r - 36, 0)
      // 🎉
      ctx.font = '18px system-ui'
      ctx.fillText('🎉', r - 76, 0)
      // "10"
      ctx.font = 'bold 16px system-ui'
      ctx.fillStyle = '#7a3f00'
      ctx.fillText('10', r - 106, 0)
    } else {
      ctx.textAlign = 'right'
      ctx.fillStyle = '#0a0a0f'
      ctx.font = 'bold 13px system-ui'
      ctx.textBaseline = 'middle'
      ctx.fillText(SEGMENTS[i].label, r - 6, 0)
    }

    ctx.restore()
  }

  ctx.beginPath()
  ctx.arc(cx, cy, 18, 0, Math.PI * 2)
  ctx.fillStyle = '#0a0a0f'
  ctx.fill()
  ctx.strokeStyle = '#00ff88'
  ctx.lineWidth = 2
  ctx.stroke()
}

export default function SpinWheel({ score, onDone }) {
  const canvasRef = useRef(null)
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [done, setDone] = useState(false)
  const cancelledRef = useRef(false)

  useEffect(() => {
    if (canvasRef.current) drawWheel(canvasRef.current)
  }, [])

  // Auto-spin once on mount
  useEffect(() => {
    cancelledRef.current = false
    setSpinning(true)

    const targetSlot = scoreToSlot(score)
    const landAngle = -(targetSlot * DEG_PER + DEG_PER / 2)
    const normalised = ((landAngle % 360) + 360) % 360
    const totalDeg = 5 * 360 + normalised
    const duration = 4500
    const start = performance.now()

    let raf
    function frame(now) {
      if (cancelledRef.current) return
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 5)
      setRotation(totalDeg * eased)

      if (t < 1) {
        raf = requestAnimationFrame(frame)
      } else {
        setRotation(totalDeg)
        setSpinning(false)
        setDone(true)
        onDone()
      }
    }

    raf = requestAnimationFrame(frame)

    return () => {
      cancelledRef.current = true
      cancelAnimationFrame(raf)
    }
  // Run once only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={styles.wheel}>
      <div className={styles.pointer}>▼</div>
      <canvas
        ref={canvasRef}
        width={360}
        height={360}
        className={styles.canvas}
        style={{ transform: `rotate(${rotation}deg)` }}
      />
      {spinning && <p className={styles.spinHint}>⚡ spinning...</p>}
    </div>
  )
}
