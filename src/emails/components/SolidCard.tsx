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
    padding: "20px",
    borderRadius: "8px",
    marginBottom: "16px",
    backgroundColor: isMorning ? "#ffffff" : "#1e1b4b",
    border: isMorning ? "1px solid #e2e8f0" : "1px solid #2e2a75",
    color: isMorning ? "#1e293b" : "#f1f5f9",
    fontFamily: "system-ui, -apple-system, sans-serif",
    boxShadow: isMorning ? "0 1px 3px rgba(0, 0, 0, 0.05)" : "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
    ...style,
  };

  const titleStyle: React.CSSProperties = {
    margin: "0 0 12px 0",
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: isMorning ? "#64748b" : "#94a3b8",
  };

  return (
    <div style={cardStyle}>
      {title && <h3 style={titleStyle}>{title}</h3>}
      {children}
    </div>
  );
};
