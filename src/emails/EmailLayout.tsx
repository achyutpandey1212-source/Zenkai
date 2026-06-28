import React from "react";

interface EmailLayoutProps {
  theme: "morning" | "evening";
  children: React.ReactNode;
}

export const EmailLayout: React.FC<EmailLayoutProps> = ({ theme, children }) => {
  const isMorning = theme === "morning";

  const outerStyle: React.CSSProperties = {
    width: "100%",
    minHeight: "100%",
    backgroundColor: isMorning ? "#F8F4EC" : "#141414",
    // Premium email-safe gradients matching the app
    background: isMorning 
      ? "linear-gradient(135deg, #FAF8F5 0%, #F8F4EC 100%)" 
      : "linear-gradient(135deg, #1C1C1C 0%, #141414 100%)",
    padding: "32px 0",
    margin: 0,
    fontFamily: "system-ui, -apple-system, sans-serif",
  };

  const innerStyle: React.CSSProperties = {
    maxWidth: "560px",
    margin: "0 auto",
    padding: "0 16px",
  };

  return (
    <div style={outerStyle}>
      <div style={innerStyle}>
        {children}
      </div>
    </div>
  );
};
