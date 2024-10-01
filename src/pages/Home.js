import React from "react";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/Sidebar";
import LaunchTimelineChart from "../MainContent/Charts/LaunchTimelineChart";
import TransactionMetrics from "../MainContent/Charts/TransactionMetrics";
import TopChains from "../MainContent/Charts/TopChains";
import "./Home.css";

const Home = () => {
  return (
    <div className="home">
      <Sidebar />
      <div className="main-content">
        <Header />
        <div className="content-area">
          <LaunchTimelineChart />
          <TransactionMetrics />
          <TopChains />
        </div>
      </div>
    </div>
  );
};

export default Home;
