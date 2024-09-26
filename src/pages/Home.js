import React from "react";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/Sidebar";
import LaunchTimelineChart from "../MainContent/Charts/LaunchTimelineChart";
import TransactionMetrics from "../MainContent/Charts/TransactionMetrics"; // Existing import
import TopChains from "../MainContent/Charts/TopChains"; // New import for TopChains
import "./Home.css";

const Home = () => {
  return (
    <div className="home">
      <Sidebar />
      <div className="main-content">
        <Header />
        <div className="content-area">
          <LaunchTimelineChart />
          <TransactionMetrics /> {/* Existing metrics and chart */}
          <TopChains /> {/* New TopChains section */}
        </div>
      </div>
    </div>
  );
};

export default Home;
