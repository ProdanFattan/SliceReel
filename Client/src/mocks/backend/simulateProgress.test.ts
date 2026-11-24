import { simulateProgress } from './simulateProgress'

describe('simulateProgress', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('ticks with rising fractions, then finishes', () => {
    const onTick = vi.fn()
    const onDone = vi.fn()
    simulateProgress({ durationMs: 400, tickMs: 100, onTick, onDone })

    vi.advanceTimersByTime(400)

    expect(onTick.mock.calls).toEqual([[0.25], [0.5], [0.75]])
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('stops when cancelled', () => {
    const onDone = vi.fn()
    const cancel = simulateProgress({ durationMs: 400, tickMs: 100, onTick: vi.fn(), onDone })

    cancel()
    vi.advanceTimersByTime(1000)

    expect(onDone).not.toHaveBeenCalled()
  })
})
