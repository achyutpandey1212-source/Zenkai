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
    color: "#f8f4ec",
    fontFamily: "system-ui, -apple-system, sans-serif",
  };

  const completedTextStyle: React.CSSProperties = {
    ...textStyle,
    color: "#a0a0a0",
    textDecoration: "line-through",
  };

  const listStyle: React.CSSProperties = {
    margin: "0",
    paddingLeft: "0",
    listStyleType: "none", // Using custom gold markers instead of standard bullets
    fontFamily: "system-ui, -apple-system, sans-serif",
  };

  return (
    <EmailLayout theme="evening">
      <Header theme="evening" dateStr={data.dateStr} appUrl={appUrl} />

      <p style={{ 
        fontFamily: "Georgia, serif", 
        fontSize: "18px", 
        fontStyle: "italic", 
        fontWeight: "normal", 
        color: "#a0a0a0",
        margin: "0 0 24px 0",
        textAlign: "center"
      }}>
        Good evening, <span style={{ color: "#c9a86a", fontFamily: "system-ui, sans-serif", fontStyle: "normal", fontWeight: 600 }}>{data.userName}</span>.
      </p>

      {data.reflection && (
        <SolidCard theme="evening" title="Evening Reflection" style={{ borderLeft: "4px solid #c9a86a" }}>
          <p style={{ 
            fontFamily: "Georgia, serif", 
            fontSize: "15px", 
            fontStyle: "italic", 
            lineHeight: "1.6",
            margin: 0, 
            color: "#f8f4ec" 
          }}>
            "{data.reflection}"
          </p>
        </SolidCard>
      )}

      {data.completedTasks && data.completedTasks.length > 0 && (
        <SolidCard theme="evening" title="Accomplished Today">
          <ul style={listStyle}>
            {data.completedTasks.map((item, idx) => (
              <li key={idx} style={{ ...completedTextStyle, marginBottom: "8px" }}>
                <span style={{ color: "#c9a86a", marginRight: "8px", fontWeight: "bold" }}>✓</span> {item}
              </li>
            ))}
          </ul>
        </SolidCard>
      )}

      {data.pendingTasks && data.pendingTasks.length > 0 && (
        <SolidCard theme="evening" title="Pending Horizon">
          <ul style={listStyle}>
            {data.pendingTasks.map((item, idx) => (
              <li key={idx} style={{ ...textStyle, marginBottom: "8px" }}>
                <span style={{ color: "#c9a86a", marginRight: "8px", fontWeight: "bold" }}>•</span> {item}
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
            backgroundColor: "#141414", 
            border: "1px solid #2a2a2a", 
            borderRadius: "4px", 
            overflow: "hidden" 
          }}>
            <div style={{ width: `${data.timelineProgress.progressPercentage}%`, height: "100%", backgroundColor: "#c9a86a" }} />
          </div>
          <p style={{ 
            ...textStyle, 
            fontSize: "12px", 
            fontWeight: 700, 
            color: "#c9a86a", 
            margin: "6px 0 0 0", 
            textAlign: "right" 
          }}>
            {data.timelineProgress.progressPercentage}% Complete
          </p>
        </SolidCard>
      )}

      {data.tomorrowSuggestedFocus && (
        <SolidCard theme="evening" title="Tomorrow's suggested focus">
          <p style={{ ...textStyle, margin: 0, color: "#f8f4ec" }}>
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
