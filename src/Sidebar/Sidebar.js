import React from "react";
import "./Sidebar.css";

const Sidebar = () => {
  return (
    <nav className="sidebar">
      <ul>
        <li>Chain Performance</li>
        <li>Daily Transactions</li>
        <li>Active Accounts</li>
        <li>TPS</li>
        <li>Value Locked</li>
        <ul>
          <li>Total Value Locked (TVL)</li>
          <li>Stablecoin</li>
        </ul>
        <li>Ecosystem</li>
      </ul>
    </nav>
  );
};

export default Sidebar;
