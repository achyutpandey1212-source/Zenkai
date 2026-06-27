import React from "react";
import { EmailLayout } from "./EmailLayout";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { SolidCard } from "./components/SolidCard";
import { Button } from "./components/Button";

export interface MorningBriefData {
  userName: string;
  dateStr: string;
  insight: string;
  priorities: string[];
  agenda: Array<{ time: string; title: string }>;
  deadlines: Array<{ title: string; due: string }>;
  milestones: Array<{ title: string; progress: number }>;
  timezone: string;
}

interface MorningEmailProps {
  data: MorningBriefData;
  appUrl: string;
}

export const MorningEmail: React.FC<MorningEmailProps> = ({ data, appUrl }) => {
  const textStyle: React.CSSProperties = {
    fontSize: "14px",
    lineHeight: "1.6",
    margin: "0 0 12px 0",
    color: "#334155",
    fontFamily: "system-ui, -apple-system, sans-serif",
  };

  const listStyle: React.CSSProperties = {
    margin: "0",
    paddingLeft: "20px",
    color: "#334155",
    fontFamily: "system-ui, -apple-system, sans-serif",
  };

  return (
    <EmailLayout theme="morning">
      <Header theme="morning" dateStr={data.dateStr} appUrl={appUrl} />
      
      <p style={{ ...textStyle, fontSize: "16px", fontWeight: 600, color: "#1e1b4b" }}>
        Good morning, {data.userName}.
      </p>

      {data.insight && (
        <SolidCard theme="morning" title="Today's Insight" style={{ borderLeft: "4px solid #f59e0b" }}>
          <p style={{ ...textStyle, fontStyle: "italic", margin: 0, color: "#475569" }}>
            "{data.insight}"
          </p>
        </SolidCard>
      )}

      {data.priorities && data.priorities.length > 0 && (
        <SolidCard theme="morning" title="Today's Top Priorities">
          <ul style={listStyle}>
            {data.priorities.map((item, idx) => (
              <li key={idx} style={{ ...textStyle, marginBottom: "8px" }}>
                {item}
              </li>
            ))}
          </ul>
        </SolidCard>
      )}

      {data.agenda && data.agenda.length > 0 && (
        <SolidCard theme="morning" title="Daily Agenda">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {data.agenda.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: idx < data.agenda.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                  <td style={{ 
                    ...textStyle, 
                    padding: "10px 0", 
                    fontWeight: 700, 
                    color: "#1e1b4b", 
                    width: "120px",
                    verticalAlign: "top"
                  }}>
                    {item.time}
                  </td>
                  <td style={{ 
                    ...textStyle, 
                    padding: "10px 0", 
                    color: "#334155",
                    verticalAlign: "top"
                  }}>
                    {item.title}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SolidCard>
      )}

      {(data.deadlines?.length > 0 || data.milestones?.length > 0) && (
        <SolidCard theme="morning" title="Roadmap & Commitments">
          {data.deadlines && data.deadlines.length > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#b91c1c", marginBottom: "8px" }}>Upcoming Deadlines</div>
              {data.deadlines.map((d, idx) => (
                <p key={idx} style={{ ...textStyle, margin: "0 0 6px 0", fontSize: "13px" }}>
                  ⏰ <strong>{d.title}</strong> • due {d.due}
                </p>
              ))}
            </div>
          )}
          {data.milestones && data.milestones.length > 0 && (
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#475569", marginBottom: "8px" }}>Pending Milestones</div>
              {data.milestones.map((m, idx) => (
                <div key={idx} style={{ margin: "0 0 12px 0" }}>
                  <div style={{ ...textStyle, margin: "0 0 4px 0", fontSize: "13px", display: "flex", justifyContent: "space-between" }}>
                    <span>🎯 {m.title}</span>
                    <span style={{ fontWeight: 600, float: "right" }}>{m.progress}%</span>
                  </div>
                  <div style={{ width: "100%", height: "6px", backgroundColor: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ width: `${m.progress}%`, height: "6px", backgroundColor: "#1e1b4b", borderRadius: "3px" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SolidCard>
      )}

      <div style={{ textAlign: "center", margin: "36px 0 16px 0" }}>
        <Button theme="morning" href={`${appUrl}/app`}>
          Open Today's Workspace →
        </Button>
      </div>

      <Footer theme="morning" timezone={data.timezone} appUrl={appUrl} />
    </EmailLayout>
  );
};
