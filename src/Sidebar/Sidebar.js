import React from "react";
import { Link } from "react-router-dom"; // Assuming you're using React Router for navigation
import GelatoLogo from "../assets/logo.png";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHome,
  faLink,
  faWallet,
  faCube,
} from "@fortawesome/free-solid-svg-icons";
import "./Sidebar.css";

const Sidebar = () => {
  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <img src={GelatoLogo} alt="Gelato Logo" className="sidebar-logo-img" />
      </div>
      <ul>
        {/* Home Button */}
        <li className="sidebar-home">
          <Link to="/" className="home-link">
            <FontAwesomeIcon icon={faHome} /> Home
          </Link>
        </li>

        {/* Chain Performance Category */}
        <li className="sidebar-category">
          <FontAwesomeIcon icon={faLink} /> Chain Performance
        </li>
        <ul className="sidebar-subcategories">
          <li>Daily Transactions</li>
          <li>Active Accounts</li>
          <li>TPS</li>
        </ul>

        {/* Value Locked Category */}
        <li className="sidebar-category">
          <FontAwesomeIcon icon={faWallet} /> Value Locked
        </li>
        <ul className="sidebar-subcategories">
          <li>Total Value Locked (TVL)</li>
          <li>Stablecoin</li>
        </ul>

        {/* Ecosystem Category */}
        <li className="sidebar-category">
          <FontAwesomeIcon icon={faCube} /> Ecosystem
        </li>
      </ul>
    </nav>
  );
};

export default Sidebar;
