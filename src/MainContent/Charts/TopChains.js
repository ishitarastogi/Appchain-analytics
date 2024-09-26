import React, { useEffect, useState } from "react";
import moment from "moment";
import "./TopChains.css";
import { fetchGoogleSheetData } from "../../services/googleSheetService"; // Import the Google Sheets service

// Importing RaaS Logos
import GelatoLogo from "../../assets/logos/raas/Gelato.png";
import ConduitLogo from "../../assets/logos/raas/conduit.jpg";
import CalderaLogo from "../../assets/logos/raas/Caldera.png";
import AltlayerLogo from "../../assets/logos/raas/altlayer.png";
// Add other RaaS logos as needed

// Importing DA Logos
import EthereumDALogo from "../../assets/logos/da/ethereum.png";
import DACLogo from "../../assets/logos/da/dac.png";
import CelestiaLogo from "../../assets/logos/da/celestia.png";
// Add other DA logos as needed

// Importing Framework Logos
import OPStackLogo from "../../assets/logos/framework/op.png";
import OrbitLogo from "../../assets/logos/framework/arbitrums.png";
// Add other Framework logos as needed

// Mapping for RaaS Logos
const raasLogos = {
  gelato: GelatoLogo,
  conduit: ConduitLogo,
  Caldera: CalderaLogo,
  altlayer: AltlayerLogo,
};

// Mapping for DA Logos
const daLogos = {
  EthereumDA: EthereumDALogo,
  dac: DACLogo,
  Celestia: CelestiaLogo,
};

// Mapping for Framework Logos
const frameworkLogos = {
  opstack: OPStackLogo,
  orbit: OrbitLogo,
};

const TopChains = () => {
  const [topChains, setTopChains] = useState([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [chainDetails, setChainDetails] = useState([]); // State to store chain details from Google Sheets

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sheetData = await fetchGoogleSheetData(); // Fetch data from Google Sheets
        console.log("Fetched Google Sheets Data:", sheetData);
        setChainDetails(sheetData); // Set chain details from sheet data

        const cachedData = JSON.parse(
          localStorage.getItem("transactionDataCache")
        );
        console.log("Cached Data:", cachedData);
        if (cachedData) {
          const { transactionsByChain, totalTransactionsCombined } = cachedData;
          calculateTopChains(
            transactionsByChain,
            totalTransactionsCombined,
            sheetData
          );
        } else {
          console.error("No cached transaction data available.");
        }
      } catch (error) {
        console.error("Error fetching Google Sheets data:", error);
      }
    };

    fetchData(); // Fetch Google Sheets data on component mount
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

    console.log("Chain Totals:", chainTotals); // Log chain totals to check values

    chainTotals.sort((a, b) => b.total - a.total);
    const topSix = chainTotals.slice(0, 6);

    let calculatedTotalTxCombined = totalTxCombined;
    if (!calculatedTotalTxCombined || isNaN(calculatedTotalTxCombined)) {
      calculatedTotalTxCombined = chainTotals.reduce(
        (sum, chain) => sum + chain.total,
        0
      );
    }

    console.log("Calculated Total Tx Combined:", calculatedTotalTxCombined); // Log total transactions combined

    setTotalTransactions(calculatedTotalTxCombined);

    const lastWeekKey = getLastWeekKey(transactionsByChain);
    const previousWeekKey = getPreviousWeekKey(lastWeekKey);

    const updatedTopChains = topSix.map((chain) => {
      const currentWeekTx =
        transactionsByChain[chain.chainName]?.[lastWeekKey] || 0;
      const previousWeekTx =
        transactionsByChain[chain.chainName]?.[previousWeekKey] || 0;
      let percentageIncrease = "N/A";
      if (previousWeekTx > 0) {
        percentageIncrease =
          (((currentWeekTx - previousWeekTx) / previousWeekTx) * 100).toFixed(
            2
          ) + "%";
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

      console.log(`Chain Data for ${chain.chainName}:`, chainData); // Log individual chain data

      const normalizedRaas = chainData?.raas?.trim().toLowerCase();
      const normalizedDA = chainData?.da?.trim().toLowerCase();
      const normalizedFramework = chainData?.framework?.trim().toLowerCase();

      console.log("Normalized RaaS:", normalizedRaas); // Log normalized RaaS
      console.log("Normalized DA:", normalizedDA); // Log normalized DA
      console.log("Normalized Framework:", normalizedFramework); // Log normalized Framework

      return {
        ...chain,
        marketShare,
        percentageIncrease,
        raas: normalizedRaas || "Unknown",
        da: normalizedDA || "Unknown",
        framework: normalizedFramework || "Unknown",
      };
    });

    console.log("Updated Top Chains:", updatedTopChains); // Log updated top chains
    setTopChains(updatedTopChains);
  };

  const getLastWeekKey = (transactionsByChain) => {
    const firstChain = Object.keys(transactionsByChain)[0];
    const allWeeks = Object.keys(transactionsByChain[firstChain]).sort();
    return allWeeks[allWeeks.length - 1];
  };

  const getPreviousWeekKey = (lastWeekKey) => {
    const lastWeekMoment = moment(lastWeekKey, "YYYY-WW");
    const previousWeekMoment = lastWeekMoment.clone().subtract(1, "week");
    return previousWeekMoment.format("YYYY-WW");
  };

  return (
    <div className="top-chains-container">
      <h2 className="top-chains-heading">Top 6 Blockchain Chains</h2>
      <div className="top-chains-cards">
        {topChains.map((chain, index) => (
          <div key={index} className="chain-card">
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
            <div className="chain-logos">
              {chain.raas && raasLogos[chain.raas] ? (
                <img
                  src={raasLogos[chain.raas]}
                  alt={`${chain.raas} Logo`}
                  className="logo"
                />
              ) : (
                console.log(`RaaS Logo missing for: ${chain.raas}`)
              )}
              {chain.da && daLogos[chain.da] ? (
                <img
                  src={daLogos[chain.da]}
                  alt={`${chain.da} Logo`}
                  className="logo"
                />
              ) : (
                console.log(`DA Logo missing for: ${chain.da}`)
              )}
              {chain.framework && frameworkLogos[chain.framework] ? (
                <img
                  src={frameworkLogos[chain.framework]}
                  alt={`${chain.framework} Logo`}
                  className="logo"
                />
              ) : (
                console.log(`Framework Logo missing for: ${chain.framework}`)
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopChains;
