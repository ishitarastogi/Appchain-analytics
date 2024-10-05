// src/components/TopChains/TopChains.js

import React, { useEffect, useState } from "react";
import moment from "moment";
import "./TopChains.css";
import { fetchGoogleSheetData } from "../../services/googleSheetService";
import { getData } from "../../services/indexedDBService"; // Import getData

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
  const [topChains, setTopChains] = useState([]);
  const [chainDetails, setChainDetails] = useState([]);
  const [loading, setLoading] = useState(true); // Loading state
  const [error, setError] = useState(null); // Error state

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch chain details from Google Sheets
        const sheetData = await fetchGoogleSheetData();
        setChainDetails(sheetData);

        // Retrieve cached transaction data from IndexedDB
        const cachedRecord = await getData("transactionMetricsData"); // Use the same key as TransactionMetrics

        if (cachedRecord && cachedRecord.data) {
          const { transactionsByChain, totalTransactionsCombined } =
            cachedRecord.data;
          console.log("Cached Transactions By Chain:", transactionsByChain); // Debugging
          calculateTopChains(
            transactionsByChain,
            totalTransactionsCombined,
            sheetData
          );
        } else {
          console.error("No cached transaction data available.");
          setError("No cached transaction data available.");
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load top chains data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const calculateTopChains = (
    transactionsByChain,
    totalTxCombined,
    chainDetails
  ) => {
    const chainTotals = Object.entries(transactionsByChain).map(
      ([chainName, weeks]) => {
        const total = Object.values(weeks).reduce(
          (sum, val) => sum + parseInt(val, 10),
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

    const lastWeekKey = getLastWeekKey(transactionsByChain);
    const previousWeekKey = getPreviousWeekKey(lastWeekKey);

    // Debugging logs
    console.log("Last Week Key:", lastWeekKey);
    console.log("Previous Week Key:", previousWeekKey);

    if (!previousWeekKey) {
      console.error("Cannot determine previous week key.");
      setTopChains([]); // Or handle accordingly
      return;
    }

    const updatedTopChains = topSix.map((chain) => {
      const currentWeekTx =
        transactionsByChain[chain.chainName]?.[lastWeekKey] || 0;
      const previousWeekTx =
        transactionsByChain[chain.chainName]?.[previousWeekKey] || 0;

      // Debugging logs
      console.log(`Chain: ${chain.chainName}`);
      console.log(
        `Current Week (${lastWeekKey}) Transactions: ${currentWeekTx}`
      );
      console.log(
        `Previous Week (${previousWeekKey}) Transactions: ${previousWeekTx}`
      );

      let percentageIncrease = "N/A";
      if (previousWeekTx > 0) {
        percentageIncrease =
          (((currentWeekTx - previousWeekTx) / previousWeekTx) * 100).toFixed(
            2
          ) + "%";
      } else if (previousWeekTx === 0 && currentWeekTx > 0) {
        percentageIncrease = "No Previous Data"; // More informative than "∞%"
      } else {
        percentageIncrease = "No Data";
      }

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
        percentageIncrease,
        raas: normalizedRaas || "Unknown",
        da: normalizedDA || "Unknown",
        framework: normalizedFramework || "Unknown",
      };
    });

    setTopChains(updatedTopChains);
  };

  const getLastWeekKey = (transactionsByChain) => {
    const firstChain = Object.keys(transactionsByChain)[0];
    const allWeeks = Object.keys(transactionsByChain[firstChain]).sort(
      (a, b) => {
        return (
          moment(a, "GGGG-[W]WW").toDate() - moment(b, "GGGG-[W]WW").toDate()
        );
      }
    );
    const lastWeek = allWeeks[allWeeks.length - 1];
    return lastWeek;
  };

  const getPreviousWeekKey = (lastWeekKey) => {
    // Update the format to match "GGGG-[W]WW"
    const lastWeekMoment = moment(lastWeekKey, "GGGG-[W]WW");
    if (!lastWeekMoment.isValid()) {
      console.error("Invalid lastWeekKey format:", lastWeekKey);
      return null;
    }
    const previousWeekMoment = lastWeekMoment.clone().subtract(1, "week");
    const previousWeekKey = previousWeekMoment.format("GGGG-[W]WW");
    return previousWeekKey;
  };

  if (loading) {
    return (
      <div className="top-chains-container">
        <h2 className="top-chains-heading">Top 6 Blockchain Chains</h2>
        <p>Loading data...</p>
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
                Total Transactions: {chain.total.toLocaleString()}
              </p>
              <p className="chain-market-share">
                Market Share: {chain.marketShare}
              </p>
              <p className="chain-percentage-increase">
                % Increase Since Last Week: {chain.percentageIncrease}
              </p>
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
        <p>No top chains data available.</p>
      )}
    </div>
  );
};

export default TopChains;
