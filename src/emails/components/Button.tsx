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
    padding: "12px 24px",
    borderRadius: "6px",
    fontWeight: 600,
    fontSize: "14px",
    textDecoration: "none",
    textAlign: "center",
    backgroundColor: isMorning ? "#1e1b4b" : "#f59e0b",
    color: isMorning ? "#ffffff" : "#1e1b4b",
    border: isMorning ? "1px solid #312e81" : "1px solid #d97706",
  };

  return (
    <a href={href} style={style} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
};
