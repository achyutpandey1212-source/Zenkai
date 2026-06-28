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
  logId?: string;
}

export const MorningEmail: React.FC<MorningEmailProps> = ({ data, appUrl, logId }) => {
  const textStyle: React.CSSProperties = {
    fontSize: "14px",
    lineHeight: "1.6",
    margin: "0 0 12px 0",
    color: "#1f1f1f",
    fontFamily: "system-ui, -apple-system, sans-serif",
  };

  const listStyle: React.CSSProperties = {
    margin: "0",
    paddingLeft: "20px",
    color: "#1f1f1f",
    fontFamily: "system-ui, -apple-system, sans-serif",
  };

  return (
    <EmailLayout theme="morning" appUrl={appUrl}>
      <Header theme="morning" dateStr={data.dateStr} appUrl={appUrl} />
      
      <p style={{ 
        fontFamily: "Georgia, serif", 
        fontSize: "18px", 
        fontStyle: "italic", 
        fontWeight: "normal", 
        color: "#555555",
        margin: "0 0 24px 0",
        textAlign: "center"
      }}>
        Good morning, <span style={{ color: "#c9a86a", fontFamily: "system-ui, sans-serif", fontStyle: "normal", fontWeight: 600 }}>{data.userName}</span>.
      </p>

      {data.insight && (
        <SolidCard theme="morning" title="Today's Insight" style={{ borderLeft: "4px solid #c9a86a" }}>
          <p style={{ 
            fontFamily: "Georgia, serif", 
            fontSize: "15px", 
            fontStyle: "italic", 
            lineHeight: "1.6",
            margin: 0, 
            color: "#555555" 
          }}>
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
                <tr key={idx} style={{ borderBottom: idx < data.agenda.length - 1 ? "1px solid #eee8dd" : "none" }}>
                  <td style={{ 
                    ...textStyle, 
                    padding: "10px 0", 
                    fontWeight: 700, 
                    color: "#c9a86a", 
                    width: "120px",
                    verticalAlign: "top"
                  }}>
                    {item.time}
                  </td>
                  <td style={{ 
                    ...textStyle, 
                    padding: "10px 0", 
                    color: "#1f1f1f",
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
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#b91c1c", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Upcoming Deadlines</div>
              {data.deadlines.map((d, idx) => (
                <p key={idx} style={{ ...textStyle, margin: "0 0 6px 0", fontSize: "13px" }}>
                  ⏰ <strong>{d.title}</strong> • due {d.due}
                </p>
              ))}
            </div>
          )}
          {data.milestones && data.milestones.length > 0 && (
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#555555", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Pending Milestones</div>
              {data.milestones.map((m, idx) => (
                <div key={idx} style={{ margin: "0 0 12px 0" }}>
                  <div style={{ ...textStyle, margin: "0 0 4px 0", fontSize: "13px", display: "flex", justifyContent: "space-between" }}>
                    <span>🎯 {m.title}</span>
                    <span style={{ fontWeight: 600, color: "#c9a86a", float: "right" }}>{m.progress}%</span>
                  </div>
                  <div style={{ width: "100%", height: "6px", backgroundColor: "#eee8dd", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ width: `${m.progress}%`, height: "6px", backgroundColor: "#c9a86a", borderRadius: "3px" }} />
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
      {logId && (
        <img
          src={`${appUrl}/api/briefings/track-open?id=${logId}`}
          width="1"
          height="1"
          style={{ display: "none" }}
          alt=""
        />
      )}
    </EmailLayout>
  );
};
