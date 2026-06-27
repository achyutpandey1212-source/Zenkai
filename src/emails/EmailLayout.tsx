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
    backgroundColor: isMorning ? "#fef9f3" : "#090714",
    // Premium email-safe gradients
    background: isMorning 
      ? "linear-gradient(135deg, #fef9f3 0%, #fff1f2 50%, #f0fdf4 100%)" 
      : "linear-gradient(135deg, #090714 0%, #110e29 55%, #25123e 100%)",
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
