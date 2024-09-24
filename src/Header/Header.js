import React from "react";
import "./Header.css";

const Header = () => {
  return (
    <header className="header">
      <img src="/assets/logo.png" alt="Gelato Logo" className="logo" />
      <div className="title-section">
        <h1>Appchain Growth Insights</h1>
        <p>
          Platform for live appchain transaction data and trends. Analyze daily
          transactions, active accounts, and market trends for appchains across
          the ecosystem.
        </p>
      </div>
    </header>
  );
};

export default Header;
