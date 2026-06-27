import { Resend } from "resend";
import React from "react";
import { BriefingLog } from "@/models/BriefingLog";
import { MorningEmail, MorningBriefData } from "@/emails/MorningEmail";
import { EveningEmail, EveningBriefData } from "@/emails/EveningEmail";

const apiKey = process.env.RESEND_API_KEY || "re_mock_key_for_testing";
const resend = new Resend(apiKey);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

export class EmailService {
  /**
   * Render and send Morning Briefing email
   */
  static async sendMorningBrief(
    uid: string,
    email: string,
    data: MorningBriefData,
    telemetry: any,
    skipped: boolean
  ): Promise<void> {
    const startTime = Date.now();
    let status: "success" | "failed" = "failed";
    let lastError = "";
    let retryAttempts = 0;
    const maxRetries = 3;

    const { renderToStaticMarkup } = await import("react-dom/server");
    const element = React.createElement(MorningEmail, { data, appUrl: APP_URL });
    const html = renderToStaticMarkup(element);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // If Resend API key is mock, skip sending but log success for developer experience
        if (apiKey.startsWith("re_mock")) {
          console.log(`[EmailService] Mock sending morning brief to ${email}. (Set RESEND_API_KEY to send actual emails)`);
          status = "success";
          break;
        }

        const res = await resend.emails.send({
          from: `Zenkai <${FROM_EMAIL}>`,
          to: email,
          subject: `Your Morning Briefing — Zenkai`,
          html,
        });

        if (res.error) {
          throw new Error(res.error.message || JSON.stringify(res.error));
        }

        status = "success";
        break;
      } catch (err: any) {
        retryAttempts = attempt;
        lastError = err.message || JSON.stringify(err);
        console.warn(`[EmailService] Morning Brief attempt ${attempt} failed: ${lastError}`);
        
        if (attempt < maxRetries) {
          // Linear backoff
          await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        }
      }
    }

    const durationMs = Date.now() - startTime;
    const tokensUsed = telemetry?.totalTokens || 0;
    const cost = telemetry?.cost || 0;

    await BriefingLog.create({
      uid,
      email,
      type: "morning",
      status,
      sentAt: status === "success" ? new Date() : undefined,
      scheduledTime: "08:00",
      durationMs,
      tokensUsed,
      cost,
      failuresCount: status === "failed" ? 1 : 0,
      lastError: lastError || undefined,
      retryAttempts,
      skipped,
    });
  }

  /**
   * Render and send Evening Reflection email
   */
  static async sendEveningBrief(
    uid: string,
    email: string,
    data: EveningBriefData,
    telemetry: any,
    skipped: boolean
  ): Promise<void> {
    const startTime = Date.now();
    let status: "success" | "failed" = "failed";
    let lastError = "";
    let retryAttempts = 0;
    const maxRetries = 3;

    const { renderToStaticMarkup } = await import("react-dom/server");
    const element = React.createElement(EveningEmail, { data, appUrl: APP_URL });
    const html = renderToStaticMarkup(element);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (apiKey.startsWith("re_mock")) {
          console.log(`[EmailService] Mock sending evening brief to ${email}. (Set RESEND_API_KEY to send actual emails)`);
          status = "success";
          break;
        }

        const res = await resend.emails.send({
          from: `Zenkai <${FROM_EMAIL}>`,
          to: email,
          subject: `Your Evening Reflection — Zenkai`,
          html,
        });

        if (res.error) {
          throw new Error(res.error.message || JSON.stringify(res.error));
        }

        status = "success";
        break;
      } catch (err: any) {
        retryAttempts = attempt;
        lastError = err.message || JSON.stringify(err);
        console.warn(`[EmailService] Evening Brief attempt ${attempt} failed: ${lastError}`);

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        }
      }
    }

    const durationMs = Date.now() - startTime;
    const tokensUsed = telemetry?.totalTokens || 0;
    const cost = telemetry?.cost || 0;

    await BriefingLog.create({
      uid,
      email,
      type: "evening",
      status,
      sentAt: status === "success" ? new Date() : undefined,
      scheduledTime: "20:30",
      durationMs,
      tokensUsed,
      cost,
      failuresCount: status === "failed" ? 1 : 0,
      lastError: lastError || undefined,
      retryAttempts,
      skipped,
    });
  }
}
