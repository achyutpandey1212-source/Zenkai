/**
 * Zenkai Internal Event Bus
 *
 * In-memory pub/sub system for decoupled node communication.
 *
 * Future agents (Calendar, Gmail, Notifications, Search) register
 * handlers here without touching any existing graph code.
 *
 * Usage:
 *   EventBus.on(ZenkaiEvent.AgendaUpdated, async (payload) => { ... })
 *   EventBus.emit(ZenkaiEvent.AgendaUpdated, { uid, date })
 */

type EventHandler = (payload: unknown) => Promise<void> | void;

class InternalEventBus {
  private handlers: Map<string, EventHandler[]> = new Map();

  /**
   * Subscribe to an event.
   * Returns an unsubscribe function for cleanup.
   */
  on(eventName: string, handler: EventHandler): () => void {
    const existing = this.handlers.get(eventName) ?? [];
    this.handlers.set(eventName, [...existing, handler]);

    return () => {
      const current = this.handlers.get(eventName) ?? [];
      this.handlers.set(eventName, current.filter((h) => h !== handler));
    };
  }

  /**
   * Emit an event to all registered handlers.
   * Handlers run asynchronously (fire-and-forget) to never block the graph.
   * Failures in handlers are isolated — they do not crash the workflow.
   */
  emit(eventName: string, payload: unknown): void {
    const handlers = this.handlers.get(eventName) ?? [];
    for (const handler of handlers) {
      Promise.resolve(handler(payload)).catch((err) => {
        console.error(`[EventBus] Handler for "${eventName}" threw:`, err);
      });
    }
  }

  /**
   * Emit and await — use when you need to confirm handlers completed
   * (useful for test assertions and debugging).
   */
  async emitSync(eventName: string, payload: unknown): Promise<void> {
    const handlers = this.handlers.get(eventName) ?? [];
    for (const handler of handlers) {
      try {
        await handler(payload);
      } catch (err) {
        console.error(`[EventBus] Handler for "${eventName}" threw (sync):`, err);
      }
    }
  }

  /** Returns the number of registered handlers for a given event (useful for testing) */
  listenerCount(eventName: string): number {
    return this.handlers.get(eventName)?.length ?? 0;
  }

  /** Clear all handlers (useful for test teardown) */
  clear(): void {
    this.handlers.clear();
  }
}

// Singleton — one event bus for the entire application lifecycle
export const EventBus = new InternalEventBus();
