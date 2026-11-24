export interface EventSink<TEvent> {
  send(event: TEvent): void
  close(): void
}

/** Fans out events to every sink subscribed under a key (one key per video). */
export class EventHub<TEvent> {
  readonly #sinks = new Map<string, Set<EventSink<TEvent>>>()

  subscribe(key: string, sink: EventSink<TEvent>): () => void {
    const sinks = this.#sinks.get(key) ?? new Set()
    sinks.add(sink)
    this.#sinks.set(key, sinks)
    return () => this.#remove(key, sink)
  }

  publish(key: string, event: TEvent): void {
    for (const sink of this.#sinks.get(key) ?? []) sink.send(event)
  }

  closeAll(key: string): void {
    const sinks = this.#sinks.get(key)
    this.#sinks.delete(key)
    for (const sink of sinks ?? []) sink.close()
  }

  subscriberCount(key: string): number {
    return this.#sinks.get(key)?.size ?? 0
  }

  #remove(key: string, sink: EventSink<TEvent>): void {
    const sinks = this.#sinks.get(key)
    sinks?.delete(sink)
    if (sinks?.size === 0) this.#sinks.delete(key)
  }
}
