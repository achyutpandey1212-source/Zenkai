/**
 * Plugin Registry — Extensibility Layer
 *
 * Future agents (Calendar, Gmail, Search, Notifications, File Analysis, OCR)
 * register here as AgentPlugins. The main graph automatically discovers and
 * wires registered plugins without any existing code being modified.
 *
 * Usage for a new Calendar agent:
 *   import { PluginRegistry } from "@/orchestration/plugins/plugin-registry";
 *   import { calendarPlugin } from "@/orchestration/plugins/calendar.plugin";
 *   PluginRegistry.register(calendarPlugin);
 *
 * The main graph calls PluginRegistry.getRegisteredPlugins() to discover
 * and add plugin nodes before compilation.
 */

import type { AgentPlugin } from "../graph/types";
import type { GraphState } from "../graph/state";
import { EventBus } from "../events/event-bus";

type ZenkaiPlugin = AgentPlugin<GraphState>;

class PluginRegistryClass {
  private plugins: Map<string, ZenkaiPlugin> = new Map();

  /**
   * Register a new agent plugin.
   * Automatically subscribes the plugin's event handler to the event bus.
   * Throws if a plugin with the same name already exists.
   */
  register(plugin: ZenkaiPlugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(
        `[PluginRegistry] Plugin "${plugin.name}" is already registered. Use registerOrReplace() to overwrite.`
      );
    }

    this.plugins.set(plugin.name, plugin);

    // Auto-subscribe to events
    if (plugin.subscribesToEvents && plugin.onEvent) {
      for (const eventName of plugin.subscribesToEvents) {
        EventBus.on(eventName, (payload) => plugin.onEvent!(eventName, payload));
      }
    }

    console.log(`[PluginRegistry] Registered plugin: ${plugin.name} v${plugin.version}`);
  }

  /**
   * Register or replace a plugin (useful for hot-reload in development).
   */
  registerOrReplace(plugin: ZenkaiPlugin): void {
    if (this.plugins.has(plugin.name)) {
      console.warn(`[PluginRegistry] Replacing plugin: ${plugin.name}`);
    }
    this.plugins.set(plugin.name, plugin);

    if (plugin.subscribesToEvents && plugin.onEvent) {
      for (const eventName of plugin.subscribesToEvents) {
        EventBus.on(eventName, (payload) => plugin.onEvent!(eventName, payload));
      }
    }
  }

  /**
   * Returns all registered plugins in registration order.
   * The main graph uses this to dynamically add plugin nodes before compilation.
   */
  getRegisteredPlugins(): ZenkaiPlugin[] {
    return Array.from(this.plugins.values());
  }

  /** Returns a specific plugin by name */
  getPlugin(name: string): ZenkaiPlugin | undefined {
    return this.plugins.get(name);
  }

  /** Check if a plugin is registered */
  has(name: string): boolean {
    return this.plugins.has(name);
  }

  /** List all registered plugin names (useful for logs and debugging) */
  listNames(): string[] {
    return Array.from(this.plugins.keys());
  }

  /** Clear all plugins (useful for test teardown) */
  clear(): void {
    this.plugins.clear();
  }
}

// Singleton — one registry for the entire application
export const PluginRegistry = new PluginRegistryClass();
