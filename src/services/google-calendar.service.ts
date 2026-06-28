import { User } from "@/models/User";
import { encrypt, decrypt } from "@/lib/encryption";

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
      // If health was reconnect_required, let's keep it but check if mock token is healthy
      return { accessToken: "mock-access-token", isMock: true };
    }

    // Decrypt tokens
    let decryptedAccessToken = "";
    let decryptedRefreshToken = "";
    try {
      decryptedAccessToken = decrypt(accessToken);
      decryptedRefreshToken = decrypt(refreshToken);
    } catch (err) {
      console.error("Failed to decrypt Google Calendar tokens:", err);
      await User.updateOne(
        { firebaseUid: uid },
        { $set: { "googleCalendarSettings.syncHealth": "reconnect_required" } }
      );
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

      const response = await fetch("https://oauth2.googleapis.com/token", {
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
    } catch (err) {
      console.error(`Google Token Refresh Network Error (User ${uid}):`, err);
      return null;
    }
  }

  /**
   * Get an event from Google Calendar (used to inspect manual edits and detect conflicts)
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

    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
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
      throw new Error(`Google Calendar API Error (GetEvent): ${errorText}`);
    }

    const data = await response.json();
    
    // Map response structure back to our standard input structure
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

    const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
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
      throw new Error(`Google Calendar API Error (CreateEvent): ${errorText}`);
    }

    const data = await response.json();
    return { id: data.id, googleRequests: 1 };
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

    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
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
      throw new Error(`Google Calendar API Error (UpdateEvent): ${errorText}`);
    }

    return { googleRequests: 1 };
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

    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${tokenInfo.accessToken}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      // 404 means already deleted, which is acceptable!
      if (response.status === 401 || response.status === 403) {
        await User.updateOne(
          { firebaseUid: uid },
          { $set: { "googleCalendarSettings.syncHealth": "reconnect_required" } }
        );
      }
      const errorText = await response.text();
      throw new Error(`Google Calendar API Error (DeleteEvent): ${errorText}`);
    }

    return { googleRequests: 1 };
  }
}
