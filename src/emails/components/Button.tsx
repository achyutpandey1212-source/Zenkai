import React from "react";

interface ButtonProps {
  href: string;
  children: React.ReactNode;
  theme: "morning" | "evening";
}

export const Button: React.FC<ButtonProps> = ({ href, children, theme }) => {
  const isMorning = theme === "morning";
  
  const style: React.CSSProperties = {
    display: "inline-block",
    padding: "12px 28px",
    borderRadius: "8px",
    fontWeight: 600,
    fontSize: "13px",
    textDecoration: "none",
    textAlign: "center",
    backgroundColor: isMorning ? "#1f1f1f" : "#f8f4ec",
    color: isMorning ? "#f8f4ec" : "#1f1f1f",
    border: isMorning ? "1px solid #1f1f1f" : "1px solid #f8f4ec",
    letterSpacing: "0.05em",
  };

  return (
    <a href={href} style={style} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
};
