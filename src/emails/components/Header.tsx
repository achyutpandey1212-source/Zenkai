import React from "react";

interface HeaderProps {
  theme: "morning" | "evening";
  dateStr: string;
  appUrl: string;
}

export const Header: React.FC<HeaderProps> = ({ theme, dateStr, appUrl }) => {
  const isMorning = theme === "morning";

  const headerStyle: React.CSSProperties = {
    padding: "32px 0 16px 0",
    textAlign: "center",
    fontFamily: "system-ui, -apple-system, sans-serif",
  };

  const titleStyle: React.CSSProperties = {
    margin: "8px 0 4px 0",
    fontSize: "20px",
    fontWeight: 800,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: isMorning ? "#1e1b4b" : "#ffffff",
  };

  const dateStyle: React.CSSProperties = {
    margin: 0,
    fontSize: "13px",
    color: isMorning ? "#475569" : "#cbd5e1",
    fontWeight: 500,
    letterSpacing: "0.02em",
  };

  return (
    <div style={headerStyle}>
      <a href={`${appUrl}/app`} style={{ textDecoration: "none" }}>
        {/* We use a clean text logo with a nice glyph representation for compatibility, but also display an img if hosted */}
        <span style={{ 
          display: "inline-block", 
          fontSize: "24px", 
          verticalAlign: "middle",
          marginRight: "6px",
          color: isMorning ? "#1e1b4b" : "#f59e0b"
        }}>
          ⛩️
        </span>
        <span style={titleStyle}>Zenkai</span>
      </a>
      <p style={dateStyle}>{dateStr}</p>
    </div>
  );
};
