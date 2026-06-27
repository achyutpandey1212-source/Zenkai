import React from "react";

interface FooterProps {
  theme: "morning" | "evening";
  timezone: string;
  appUrl: string;
}

export const Footer: React.FC<FooterProps> = ({ theme, timezone, appUrl }) => {
  const isMorning = theme === "morning";

  const footerStyle: React.CSSProperties = {
    padding: "32px 24px",
    textAlign: "center",
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "11px",
    color: isMorning ? "#64748b" : "#94a3b8",
    lineHeight: "1.6",
  };

  const linkStyle: React.CSSProperties = {
    color: isMorning ? "#312e81" : "#f59e0b",
    textDecoration: "underline",
  };

  return (
    <div style={footerStyle}>
      <p style={{ margin: "0 0 8px 0" }}>
        This briefing was quietly prepared by Zenkai. Timezone: {timezone || "UTC"}.
      </p>
      <p style={{ margin: 0 }}>
        Configure briefings or manage notifications on your{" "}
        <a href={`${appUrl}/app`} style={linkStyle}>
          Zenkai Settings
        </a>{" "}
        •{" "}
        <a href={`${appUrl}/app`} style={linkStyle}>
          Unsubscribe
        </a>
      </p>
    </div>
  );
};
