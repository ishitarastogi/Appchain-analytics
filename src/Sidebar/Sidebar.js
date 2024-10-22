// src/components/Sidebar.js
import React from "react";
import { Link } from "react-router-dom";
import GelatoLogo from "../assets/logo.png";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHome,
  faLink,
  faWallet,
  faCube,
  faUserCheck,
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
          <li>
            <Link to="/daily-transactions" className="subcategory-link">
              Daily Transactions
            </Link>
          </li>
          <li>
            <Link to="/active-accounts" className="subcategory-link">
              Active Accounts
            </Link>
          </li>
          <li>
            <Link to="/tps" className="subcategory-link">
              TPS
            </Link>
          </li>
        </ul>

        {/* Value Locked Category */}
        <li className="sidebar-category">
          <FontAwesomeIcon icon={faWallet} /> Value Locked
        </li>
        <ul className="sidebar-subcategories">
          <li>
            <Link to="/tvl" className="subcategory-link">
              Total Value Locked (TVL)
            </Link>
          </li>
          <li>
            <Link to="/stablecoin" className="subcategory-link">
              Stablecoin
            </Link>
          </li>
        </ul>

        {/* Ecosystem Category */}
        <li className="sidebar-category">
          <FontAwesomeIcon icon={faCube} /> Ecosystem
        </li>
        <ul className="sidebar-subcategories">
          <li>
            <Link to="/vertical" className="subcategory-link">
              Vertical
            </Link>
          </li>
          <li>
            <Link to="/framework" className="subcategory-link">
              Framework
            </Link>
          </li>
          <li>
            <Link to="/da" className="subcategory-link">
              Data Availability
            </Link>
          </li>
          <li>
            <Link to="/layer" className="subcategory-link">
              Layer2/Layer3
            </Link>
          </li>
        </ul>
      </ul>
    </nav>
  );
};

export default Sidebar;
