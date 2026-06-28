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
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    color: isMorning ? "#1f1f1f" : "#f8f4ec",
  };

  const dateStyle: React.CSSProperties = {
    margin: 0,
    fontSize: "12px",
    color: isMorning ? "#555555" : "#a0a0a0",
    fontWeight: 500,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  };

  return (
    <div style={headerStyle}>
      <a href={`${appUrl}/app`} style={{ textDecoration: "none" }}>
        <img 
          src="cid:logo_1" 
          alt="Zenkai Logo" 
          width="24"
          height="24"
          style={{
            display: "inline-block",
            verticalAlign: "middle",
            marginRight: "8px",
            border: "0",
          }}
        />
        <span style={titleStyle}>ZENKAI</span>
      </a>
      <p style={dateStyle}>{dateStr}</p>
    </div>
  );
};
