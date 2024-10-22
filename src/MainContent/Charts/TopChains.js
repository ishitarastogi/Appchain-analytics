// src/components/TopChains/TopChains.js

import React, { useContext, useEffect, useState } from "react";
import moment from "moment";
import "./TopChains.css"; // Assuming you have a separate CSS for TopChains
import { DataContext } from "../Charts/context/DataContext"; // Import DataContext

// Importing logos
import GelatoLogo from "../../assets/logos/raas/Gelato.png";
import ConduitLogo from "../../assets/logos/raas/conduit.jpg";
import CalderaLogo from "../../assets/logos/raas/Caldera.png";
import AltlayerLogo from "../../assets/logos/raas/altlayer.png";
import EthereumDALogo from "../../assets/logos/da/ethereum.png";
import DACLogo from "../../assets/logos/da/dac.png";
import CelestiaLogo from "../../assets/logos/da/celestia.png";
import OPStackLogo from "../../assets/logos/framework/op.png";
import OrbitLogo from "../../assets/logos/framework/arbitrums.png";

// Badge Component
const Badge = ({ logo, category, name }) => (
  <div className="badge-container">
    <div className="badge-logo">
      {logo ? (
        <img src={logo} alt={`${name} Logo`} loading="lazy" />
      ) : (
        <div className="badge-placeholder">{category}</div>
      )}
    </div>
    <div className="badge-details">
      <span className="badge-category">{category}</span>
      <span className="badge-name">{name}</span>
    </div>
  </div>
);

// Mapping for Logos
const raasLogos = {
  gelato: GelatoLogo,
  conduit: ConduitLogo,
  caldera: CalderaLogo,
  altlayer: AltlayerLogo,
};
const daLogos = {
  ethereumda: EthereumDALogo,
  dac: DACLogo,
  celestia: CelestiaLogo,
};
const frameworkLogos = {
  opstack: OPStackLogo,
  orbit: OrbitLogo,
};

const TopChains = () => {
  const { transactionData, loading, error, chainDetails } =
    useContext(DataContext);
  const [topChains, setTopChains] = useState([]);

  useEffect(() => {
    if (
      transactionData &&
      transactionData.transactionsByChain &&
      chainDetails.length > 0
    ) {
      calculateTopChains(
        transactionData.transactionsByChain,
        transactionData.totalTransactionsCombined,
        chainDetails
      );
    }
  }, [transactionData, chainDetails]);

  // Function to aggregate weekly data into monthly data
  const aggregateWeeklyToMonthly = (transactionsByChain) => {
    const transactionsByChainMonth = {};
    for (const chainName in transactionsByChain) {
      transactionsByChainMonth[chainName] = {};
      const chainData = transactionsByChain[chainName];
      for (const weekKey in chainData) {
        const weekMoment = moment(weekKey, "GGGG-[W]WW");
        const weekStartDate = weekMoment.startOf("isoWeek");
        const weekEndDate = weekMoment.endOf("isoWeek");

        // Initialize a map to keep track of days per month
        const daysPerMonth = {};

        // For each day in the week
        for (let i = 0; i < 7; i++) {
          const currentDate = weekStartDate.clone().add(i, "days");
          const monthKey = currentDate.format("YYYY-MM");
          if (!daysPerMonth[monthKey]) {
            daysPerMonth[monthKey] = 0;
          }
          daysPerMonth[monthKey] += 1;
        }

        // Total days in the week (should be 7)
        const totalDays = 7;
        const weekTransactions = chainData[weekKey];

        // Assign transactions to months proportionally
        for (const monthKey in daysPerMonth) {
          const daysInMonth = daysPerMonth[monthKey];
          const fraction = daysInMonth / totalDays;
          const monthlyTransaction = weekTransactions * fraction;

          if (!transactionsByChainMonth[chainName][monthKey]) {
            transactionsByChainMonth[chainName][monthKey] = 0;
          }
          transactionsByChainMonth[chainName][monthKey] += monthlyTransaction;
        }
      }
    }
    return transactionsByChainMonth;
  };

  const calculateTopChains = (
    transactionsByChain,
    totalTxCombined,
    chainDetails
  ) => {
    // Aggregate weekly data into monthly data
    const transactionsByChainMonth =
      aggregateWeeklyToMonthly(transactionsByChain);

    const chainTotals = Object.entries(transactionsByChainMonth).map(
      ([chainName, periods]) => {
        const total = Object.values(periods).reduce(
          (sum, val) => sum + parseFloat(val),
          0
        );
        return { chainName, total };
      }
    );

    // Sort chains by total transactions in descending order
    chainTotals.sort((a, b) => b.total - a.total);

    // Select top 6 chains
    const topSix = chainTotals.slice(0, 6);

    let calculatedTotalTxCombined = totalTxCombined;
    if (!calculatedTotalTxCombined || isNaN(calculatedTotalTxCombined)) {
      calculatedTotalTxCombined = chainTotals.reduce(
        (sum, chain) => sum + chain.total,
        0
      );
    }

    const lastMonthKey = getLastMonthKey(transactionsByChainMonth);
    const previousMonthKey = getPreviousMonthKey(lastMonthKey);

    if (!previousMonthKey) {
      console.error("Cannot determine previous month key.");
      setTopChains([]); // Or handle accordingly
      return;
    }

    const updatedTopChains = topSix.map((chain) => {
      const chainMonthlyData = transactionsByChainMonth[chain.chainName] || {};

      const currentMonthTx = chainMonthlyData[lastMonthKey] || 0;
      const previousMonthTx = chainMonthlyData[previousMonthKey] || 0;

      // Debugging statements
      console.log(`Chain: ${chain.chainName}`);
      console.log(`Transactions by Month:`, chainMonthlyData);
      console.log(`Previous Month (${previousMonthKey}): ${previousMonthTx}`);
      console.log(`Current Month (${lastMonthKey}): ${currentMonthTx}`);

      // Removed percentageIncrease calculation
      // Calculate market share
      let marketShare = "0%";
      if (calculatedTotalTxCombined > 0) {
        marketShare =
          ((chain.total / calculatedTotalTxCombined) * 100).toFixed(2) + "%";
      }

      const chainData = Array.isArray(chainDetails)
        ? chainDetails.find(
            (item) => item.name.toLowerCase() === chain.chainName.toLowerCase()
          )
        : null;

      const normalizedRaas = chainData?.raas?.trim().toLowerCase();
      const normalizedDA = chainData?.da?.trim().toLowerCase();
      const normalizedFramework = chainData?.framework?.trim().toLowerCase();

      return {
        ...chain,
        marketShare,
        // Removed percentageIncrease
        raas: normalizedRaas || "Unknown",
        da: normalizedDA || "Unknown",
        framework: normalizedFramework || "Unknown",
      };
    });

    setTopChains(updatedTopChains);
  };

  const getLastMonthKey = (transactionsByChainMonth) => {
    const firstChain = Object.keys(transactionsByChainMonth)[0];
    const allMonths = Object.keys(transactionsByChainMonth[firstChain]).filter(
      (key) => moment(key, "YYYY-MM", true).isValid()
    );

    allMonths.sort((a, b) => {
      return moment(a).diff(moment(b));
    });

    const lastMonth = allMonths[allMonths.length - 1];
    return lastMonth;
  };

  const getPreviousMonthKey = (lastMonthKey) => {
    const lastMonthMoment = moment(lastMonthKey, "YYYY-MM");
    if (!lastMonthMoment.isValid()) {
      console.error("Invalid lastMonthKey format:", lastMonthKey);
      return null;
    }
    const previousMonthMoment = lastMonthMoment.clone().subtract(1, "month");
    const previousMonthKey = previousMonthMoment.format("YYYY-MM");
    return previousMonthKey;
  };

  if (loading) {
    return (
      <div className="top-chains-container">
        <h2 className="top-chains-heading">Top 6 Blockchain Chains</h2>
        <div className="spinner"></div> {/* Optional: Add spinner */}
      </div>
    );
  }

  if (error) {
    return (
      <div className="top-chains-container">
        <h2 className="top-chains-heading">Top 6 Blockchain Chains</h2>
        <p className="error-text">{error}</p>
      </div>
    );
  }

  return (
    <div className="top-chains-container">
      <h2 className="top-chains-heading">Top 6 Blockchain Chains</h2>
      {topChains.length > 0 ? (
        <div className="top-chains-cards">
          {topChains.map((chain, index) => (
            <div key={index} className="chain-card" tabIndex="0">
              <h3 className="chain-name">{chain.chainName}</h3>
              <p className="chain-transactions">
                Total Transactions: {Math.round(chain.total).toLocaleString()}
              </p>
              <p className="chain-market-share">
                Market Share: {chain.marketShare}
              </p>
              {/* Removed percentageIncrease display */}
              <div className="chain-badges">
                <Badge
                  logo={raasLogos[chain.raas]}
                  category="RaaS"
                  name={chain.raas}
                />
                <Badge
                  logo={daLogos[chain.da]}
                  category="Data Availability"
                  name={chain.da}
                />
                <Badge
                  logo={frameworkLogos[chain.framework]}
                  category="Framework"
                  name={chain.framework}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="no-data-text">No top chains data available.</p>
      )}
    </div>
  );
};

export default TopChains;
