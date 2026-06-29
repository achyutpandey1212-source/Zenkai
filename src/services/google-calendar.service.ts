import { User } from "@/models/User";
import { encrypt, decrypt } from "@/lib/encryption";
import { telemetryStorage } from "@/lib/telemetry-context";

export interface GoogleEventInput {
  summary: string;
  description: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  colorId?: string;
}

export class GoogleCalendarService {
  // In-memory store to simulate Google Calendar state in Mock Mode (useful for testing conflict resolution!)
  public static mockEventsStore = new Map<string, GoogleEventInput>();

  /**
   * Helper to fetch with timeout, rate limit retries, and transient failure recovery.
   */
  private static async fetchWithRetry(url: string, init?: RequestInit, retries = 3, initialDelayMs = 1000): Promise<Response> {
    let attempt = 0;
    while (true) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

        const response = await fetch(url, {
          ...init,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if ((response.status === 429 || response.status >= 500) && attempt < retries) {
          attempt++;
          const delay = initialDelayMs * Math.pow(2, attempt - 1);
          console.warn(`[Google Calendar API] Transient status ${response.status} (Attempt ${attempt}/${retries}). Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        return response;
      } catch (error: any) {
        attempt++;
        const isTimeout = error.name === "AbortError" || error.message?.includes("timeout");
        const isNetwork = error.message?.includes("fetch failed") || error.code === "ENOTFOUND" || error.code === "ECONNRESET";

        if ((isTimeout || isNetwork) && attempt < retries) {
          const delay = initialDelayMs * Math.pow(2, attempt - 1);
          console.warn(`[Google Calendar API] Network error/timeout (Attempt ${attempt}/${retries}): ${error.message}. Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        throw error;
      }
    }
  }

  /**
   * Helper to log errors to GraphState telemetry
   */
  private static logTelemetryError(action: string, errorMessage: string) {
    const store = telemetryStorage.getStore();
    const state = store?.stateRef as any;
    if (state) {
      if (!state.calendarFailures) {
        state.calendarFailures = [];
      }
      state.calendarFailures.push({ action, error: errorMessage });
    }
  }

  /**
   * Helper to verify if Google Calendar is connected and get a valid access token.
   * Refreshes the token if it is expired.
   */
  static async getValidToken(uid: string): Promise<{ accessToken: string; isMock: boolean } | null> {
    const user = await User.findOne({ firebaseUid: uid });
    if (!user || !user.googleCalendarSettings?.connected) {
      return null;
    }

    const { accessToken, refreshToken, expiry } = user.googleCalendarSettings;
    if (!accessToken || !refreshToken || !expiry) {
      return null;
    }

    // Check if we are running in Mock Mode
    const isMock = refreshToken.startsWith("mock-refresh-token") || !process.env.GOOGLE_CLIENT_ID;
    if (isMock) {
      return { accessToken: "mock-access-token", isMock: true };
    }

    // Decrypt tokens
    let decryptedAccessToken = "";
    let decryptedRefreshToken = "";
    try {
      decryptedAccessToken = decrypt(accessToken);
      decryptedRefreshToken = decrypt(refreshToken);
    } catch (err: any) {
      console.error("Failed to decrypt Google Calendar tokens:", err);
      await User.updateOne(
        { firebaseUid: uid },
        { $set: { "googleCalendarSettings.syncHealth": "reconnect_required" } }
      );
      this.logTelemetryError("decryptTokens", err.message || String(err));
      return null;
    }

    // Token is valid if expiry has at least 5 minutes remaining
    if (expiry > Date.now() + 300000) {
      return { accessToken: decryptedAccessToken, isMock: false };
    }

    // Token is expired, perform OAuth refresh
    try {
      console.log(`Refreshing Google OAuth token for user ${uid}`);
      const clientId = process.env.GOOGLE_CLIENT_ID || "";
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

      const response = await this.fetchWithRetry("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: decryptedRefreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Google Token Refresh Error (User ${uid}):`, errorText);
        this.logTelemetryError("refreshToken", errorText);

        // Update health status to reconnect_required on auth failure
        if (response.status === 400 || response.status === 401) {
          await User.updateOne(
            { firebaseUid: uid },
            { $set: { "googleCalendarSettings.syncHealth": "reconnect_required" } }
          );
        }
        return null;
      }

      const data = await response.json();
      const newAccessToken = data.access_token;
      const newExpiry = Date.now() + (data.expires_in * 1000);

      // Save refreshed credentials and ensure health is marked healthy
      await User.updateOne(
        { firebaseUid: uid },
        {
          $set: {
            "googleCalendarSettings.accessToken": encrypt(newAccessToken),
            "googleCalendarSettings.expiry": newExpiry,
            "googleCalendarSettings.syncHealth": "healthy"
          },
        }
      );

      return { accessToken: newAccessToken, isMock: false };
    } catch (err: any) {
      console.error(`Google Token Refresh Network Error (User ${uid}):`, err);
      this.logTelemetryError("refreshTokenNetwork", err.message || String(err));
      return null;
    }
  }

  /**
   * Get an event from Google Calendar
   */
  static async getEvent(uid: string, eventId: string): Promise<{ event: GoogleEventInput | null; googleRequests: number }> {
    const tokenInfo = await this.getValidToken(uid);
    if (!tokenInfo) {
      throw new Error("Google Calendar not connected or healthy");
    }

    if (tokenInfo.isMock) {
      const mockEvent = this.mockEventsStore.get(eventId);
      return { event: mockEvent || null, googleRequests: 1 };
    }

    try {
      const response = await this.fetchWithRetry(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenInfo.accessToken}`,
        },
      });

      if (response.status === 404) {
        return { event: null, googleRequests: 1 };
      }

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          await User.updateOne(
            { firebaseUid: uid },
            { $set: { "googleCalendarSettings.syncHealth": "reconnect_required" } }
          );
        }
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const data = await response.json();

      const event: GoogleEventInput = {
        summary: data.summary || "",
        description: data.description || "",
        start: {
          dateTime: data.start?.dateTime || data.start?.date || "",
          timeZone: data.start?.timeZone || "UTC",
        },
        end: {
          dateTime: data.end?.dateTime || data.end?.date || "",
          timeZone: data.end?.timeZone || "UTC",
        },
        colorId: data.colorId || undefined
      };

      return { event, googleRequests: 1 };
    } catch (err: any) {
      this.logTelemetryError("getEvent", err.message || String(err));
      throw new Error(`Google Calendar API Error (GetEvent): ${err.message}`);
    }
  }

  /**
   * Create a new event on Google Calendar
   */
  static async createEvent(uid: string, eventData: GoogleEventInput): Promise<{ id: string; googleRequests: number }> {
    const tokenInfo = await this.getValidToken(uid);
    if (!tokenInfo) {
      throw new Error("Google Calendar not connected or healthy");
    }

    if (tokenInfo.isMock) {
      const mockId = `mock-event-${Math.random().toString(36).substring(2, 11)}`;
      this.mockEventsStore.set(mockId, eventData);
      console.log(`[MOCK] Created Google Event [${mockId}] for ${uid}: "${eventData.summary}"`);
      return { id: mockId, googleRequests: 1 };
    }

    try {
      const response = await this.fetchWithRetry("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenInfo.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          await User.updateOne(
            { firebaseUid: uid },
            { $set: { "googleCalendarSettings.syncHealth": "reconnect_required" } }
          );
        }
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const data = await response.json();
      return { id: data.id, googleRequests: 1 };
    } catch (err: any) {
      this.logTelemetryError("createEvent", err.message || String(err));
      throw new Error(`Google Calendar API Error (CreateEvent): ${err.message}`);
    }
  }

  /**
   * Update an existing event on Google Calendar
   */
  static async updateEvent(uid: string, eventId: string, eventData: GoogleEventInput): Promise<{ googleRequests: number }> {
    const tokenInfo = await this.getValidToken(uid);
    if (!tokenInfo) {
      throw new Error("Google Calendar not connected or healthy");
    }

    if (tokenInfo.isMock) {
      this.mockEventsStore.set(eventId, eventData);
      console.log(`[MOCK] Updated Google Event [${eventId}] for ${uid}: "${eventData.summary}"`);
      return { googleRequests: 1 };
    }

    try {
      const response = await this.fetchWithRetry(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${tokenInfo.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventData),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          await User.updateOne(
            { firebaseUid: uid },
            { $set: { "googleCalendarSettings.syncHealth": "reconnect_required" } }
          );
        }
        const errorText = await response.text();
        throw new Error(errorText);
      }

      return { googleRequests: 1 };
    } catch (err: any) {
      this.logTelemetryError("updateEvent", err.message || String(err));
      throw new Error(`Google Calendar API Error (UpdateEvent): ${err.message}`);
    }
  }

  /**
   * Delete an event from Google Calendar
   */
  static async deleteEvent(uid: string, eventId: string): Promise<{ googleRequests: number }> {
    const tokenInfo = await this.getValidToken(uid);
    if (!tokenInfo) {
      throw new Error("Google Calendar not connected or healthy");
    }

    if (tokenInfo.isMock) {
      this.mockEventsStore.delete(eventId);
      console.log(`[MOCK] Deleted Google Event [${eventId}] for ${uid}`);
      return { googleRequests: 1 };
    }

    try {
      const response = await this.fetchWithRetry(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${tokenInfo.accessToken}`,
        },
      });

      if (!response.ok && response.status !== 404) {
        if (response.status === 401 || response.status === 403) {
          await User.updateOne(
            { firebaseUid: uid },
            { $set: { "googleCalendarSettings.syncHealth": "reconnect_required" } }
          );
        }
        const errorText = await response.text();
        throw new Error(errorText);
      }

      return { googleRequests: 1 };
    } catch (err: any) {
      this.logTelemetryError("deleteEvent", err.message || String(err));
      throw new Error(`Google Calendar API Error (DeleteEvent): ${err.message}`);
    }
  }
}
