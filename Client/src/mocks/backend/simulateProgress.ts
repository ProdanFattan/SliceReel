export interface ProgressSimulation {
  durationMs: number
  tickMs: number
  /** Called with a fraction in (0, 1) on every tick before the last. */
  onTick: (fraction: number) => void
  onDone: () => void
}

/** Drives a fake job from 0 to 1 over `durationMs`. Returns a function that cancels it. */
export function simulateProgress({
  durationMs,
  tickMs,
  onTick,
  onDone,
}: ProgressSimulation): () => void {
  const totalTicks = Math.max(1, Math.ceil(durationMs / tickMs))
  let tick = 0

  const timer = setInterval(() => {
    tick += 1
    if (tick < totalTicks) {
      onTick(tick / totalTicks)
      return
    }
    clearInterval(timer)
    onDone()
  }, tickMs)

  return () => clearInterval(timer)
}
