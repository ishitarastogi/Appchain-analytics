import React from "react";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/Sidebar";
import ScatterPlot from "../MainContent/Charts/ScatterPlot";
import TransactionChart from "../MainContent/Charts/TransactionChart";
import TopChains from "../TopChains/TopChains";

const Home = () => {
  return (
    <div className="home">
      <Sidebar />
      <div className="main-content">
        <Header />
        <ScatterPlot />
        <TransactionChart />
        <TopChains />
      </div>
    </div>
  );
};

export default Home;
