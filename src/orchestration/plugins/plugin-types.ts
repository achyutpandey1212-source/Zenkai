/**
 * Plugin Types — AgentPlugin interface for extensible agent registration
 *
 * This file documents the contract that all future agent plugins must implement.
 * Examples: CalendarPlugin, GmailPlugin, SearchPlugin, NotificationPlugin
 */

import type { GraphState } from "../graph/state";
import type { NodeResult, AgentPlugin } from "../graph/types";

export type { AgentPlugin };

/**
 * Template for building a new plugin.
 *
 * @example
 * ```ts
 * // src/orchestration/plugins/calendar.plugin.ts
 * import { ZenkaiPlugin } from "@/orchestration/plugins/plugin-types";
 * import { ZenkaiEvent } from "@/orchestration/events/event-types";
 *
 * export const calendarPlugin: ZenkaiPlugin = {
 *   name: "calendar",
 *   version: "1.0.0",
 *   description: "Syncs Zenkai agenda with Google Calendar",
 *   subscribesToEvents: [ZenkaiEvent.AgendaUpdated, ZenkaiEvent.MilestoneCreated],
 *   onEvent: async (eventName, payload) => {
 *     if (eventName === ZenkaiEvent.AgendaUpdated) {
 *       // sync to Google Calendar
 *     }
 *   },
 *   nodeFn: async (state) => {
 *     // Optional: if this plugin should run as a foreground/background node in the graph
 *     return {
 *       patch: { pluginData: { ...state.pluginData, calendar: { synced: true } } },
 *       metadata: { success: true, duration: 0, skipped: true, reason: "Event-driven only" },
 *     };
 *   },
 * };
 * ```
 */
export type ZenkaiPlugin = AgentPlugin<GraphState>;

/**
 * Minimal no-op plugin factory for testing.
 */
export function createNoopPlugin(name: string): ZenkaiPlugin {
  return {
    name,
    version: "0.0.1",
    description: `No-op plugin: ${name}`,
    nodeFn: async (state): Promise<NodeResult<GraphState>> => ({
      patch: {},
      metadata: {
        success: true,
        duration: 0,
        skipped: true,
        reason: "No-op plugin — not yet implemented",
      },
    }),
  };
}
