import React from "react";
import { EmailLayout } from "./EmailLayout";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { SolidCard } from "./components/SolidCard";
import { Button } from "./components/Button";

export interface EveningBriefData {
  userName: string;
  dateStr: string;
  reflection: string;
  completedTasks: string[];
  pendingTasks: string[];
  timelineProgress: {
    totalTasks: number;
    completedTasks: number;
    progressPercentage: number;
  };
  tomorrowSuggestedFocus: string;
  timezone: string;
}

interface EveningEmailProps {
  data: EveningBriefData;
  appUrl: string;
}

export const EveningEmail: React.FC<EveningEmailProps> = ({ data, appUrl }) => {
  const textStyle: React.CSSProperties = {
    fontSize: "14px",
    lineHeight: "1.6",
    margin: "0 0 12px 0",
    color: "#cbd5e1",
    fontFamily: "system-ui, -apple-system, sans-serif",
  };

  const completedTextStyle: React.CSSProperties = {
    ...textStyle,
    color: "#94a3b8",
    textDecoration: "line-through",
  };

  const listStyle: React.CSSProperties = {
    margin: "0",
    paddingLeft: "20px",
    fontFamily: "system-ui, -apple-system, sans-serif",
  };

  return (
    <EmailLayout theme="evening">
      <Header theme="evening" dateStr={data.dateStr} appUrl={appUrl} />

      <p style={{ ...textStyle, fontSize: "16px", fontWeight: 600, color: "#ffffff" }}>
        Good evening, {data.userName}.
      </p>

      {data.reflection && (
        <SolidCard theme="evening" title="Evening Reflection" style={{ borderLeft: "4px solid #f59e0b" }}>
          <p style={{ ...textStyle, fontStyle: "italic", margin: 0, color: "#e2e8f0" }}>
            "{data.reflection}"
          </p>
        </SolidCard>
      )}

      {data.completedTasks && data.completedTasks.length > 0 && (
        <SolidCard theme="evening" title="Accomplished Today">
          <ul style={{ ...listStyle, color: "#a7f3d0" }}>
            {data.completedTasks.map((item, idx) => (
              <li key={idx} style={{ ...completedTextStyle, color: "#34d399", marginBottom: "8px" }}>
                ✓ {item}
              </li>
            ))}
          </ul>
        </SolidCard>
      )}

      {data.pendingTasks && data.pendingTasks.length > 0 && (
        <SolidCard theme="evening" title="Pending Horizon">
          <ul style={{ ...listStyle, color: "#94a3b8" }}>
            {data.pendingTasks.map((item, idx) => (
              <li key={idx} style={{ ...textStyle, marginBottom: "8px" }}>
                • {item}
              </li>
            ))}
          </ul>
        </SolidCard>
      )}

      {data.timelineProgress && (
        <SolidCard theme="evening" title="Roadmap Progress">
          <p style={{ ...textStyle, fontSize: "13px", margin: "0 0 8px 0" }}>
            You have completed {data.timelineProgress.completedTasks} of {data.timelineProgress.totalTasks} roadmap tasks.
          </p>
          <div style={{ 
            width: "100%", 
            height: "8px", 
            backgroundColor: "#0f0d22", 
            border: "1px solid #2e2a75", 
            borderRadius: "4px", 
            overflow: "hidden" 
          }}>
            <div style={{ width: `${data.timelineProgress.progressPercentage}%`, height: "100%", backgroundColor: "#f59e0b" }} />
          </div>
          <p style={{ 
            ...textStyle, 
            fontSize: "12px", 
            fontWeight: 700, 
            color: "#f59e0b", 
            margin: "6px 0 0 0", 
            textAlign: "right" 
          }}>
            {data.timelineProgress.progressPercentage}% Complete
          </p>
        </SolidCard>
      )}

      {data.tomorrowSuggestedFocus && (
        <SolidCard theme="evening" title="Tomorrow's suggested focus">
          <p style={{ ...textStyle, margin: 0, color: "#cbd5e1" }}>
            {data.tomorrowSuggestedFocus}
          </p>
        </SolidCard>
      )}

      <div style={{ textAlign: "center", margin: "36px 0 16px 0" }}>
        <Button theme="evening" href={`${appUrl}/app`}>
          Continue Tomorrow →
        </Button>
      </div>

      <Footer theme="evening" timezone={data.timezone} appUrl={appUrl} />
    </EmailLayout>
  );
};
