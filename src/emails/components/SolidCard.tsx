import React from "react";

interface SolidCardProps {
  children: React.ReactNode;
  theme: "morning" | "evening";
  title?: string;
  style?: React.CSSProperties;
}

export const SolidCard: React.FC<SolidCardProps> = ({ children, theme, title, style }) => {
  const isMorning = theme === "morning";

  const cardStyle: React.CSSProperties = {
    padding: "24px",
    borderRadius: "16px",
    marginBottom: "20px",
    backgroundColor: isMorning ? "#ffffff" : "#1f1f1f",
    border: isMorning ? "1px solid #eee8dd" : "1px solid #2a2a2a",
    color: isMorning ? "#1f1f1f" : "#f8f4ec",
    fontFamily: "system-ui, -apple-system, sans-serif",
    boxShadow: isMorning ? "0 1px 3px rgba(0, 0, 0, 0.02)" : "0 4px 12px rgba(0, 0, 0, 0.15)",
    ...style,
  };

  const titleStyle: React.CSSProperties = {
    margin: "0 0 16px 0",
    fontSize: "9px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.15em",
    color: "#c9a86a", // Zenkai signature gold accent
  };

  return (
    <div style={cardStyle}>
      {title && <h3 style={titleStyle}>{title}</h3>}
      {children}
    </div>
  );
};
