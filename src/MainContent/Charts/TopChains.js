// src/components/MainContent/Charts/TopChains.js

import React, { useEffect, useState } from "react";
import moment from "moment";
import "./TopChains.css";
import { fetchGoogleSheetData } from "../../services/googleSheetService";

// Importing RaaS Logos
import GelatoLogo from "../../assets/logos/raas/Gelato.png";
import ConduitLogo from "../../assets/logos/raas/conduit.jpg";
import CalderaLogo from "../../assets/logos/raas/Caldera.png";
import AltlayerLogo from "../../assets/logos/raas/altlayer.png";

// Importing DA Logos
import EthereumDALogo from "../../assets/logos/da/ethereum.png";
import DACLogo from "../../assets/logos/da/dac.png";
import CelestiaLogo from "../../assets/logos/da/celestia.png";

// Importing Framework Logos
import OPStackLogo from "../../assets/logos/framework/op.png";
import OrbitLogo from "../../assets/logos/framework/arbitrums.png";

// Mapping for RaaS Logos
const raasLogos = {
  gelato: GelatoLogo,
  conduit: ConduitLogo,
  caldera: CalderaLogo,
  altlayer: AltlayerLogo,
};

// Mapping for DA Logos
const daLogos = {
  ethereumda: EthereumDALogo,
  dac: DACLogo,
  celestia: CelestiaLogo,
};

// Mapping for Framework Logos
const frameworkLogos = {
  opstack: OPStackLogo,
  orbit: OrbitLogo,
};

const TopChains = () => {
  const [topChains, setTopChains] = useState([]);
  const [chainDetails, setChainDetails] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sheetData = await fetchGoogleSheetData();
        setChainDetails(sheetData);

        const cachedData = JSON.parse(
          localStorage.getItem("transactionDataCache")
        );
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

    chainTotals.sort((a, b) => b.total - a.total);
    const topSix = chainTotals.slice(0, 6); // Top 6 Chains

    let calculatedTotalTxCombined = totalTxCombined;
    if (!calculatedTotalTxCombined || isNaN(calculatedTotalTxCombined)) {
      calculatedTotalTxCombined = chainTotals.reduce(
        (sum, chain) => sum + chain.total,
        0
      );
    }

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

      const normalizedRaas = chainData?.raas?.trim().toLowerCase();
      const normalizedDA = chainData?.da?.trim().toLowerCase();
      const normalizedFramework = chainData?.framework?.trim().toLowerCase();
      const chainLogo = chainData?.logo;

      return {
        ...chain,
        marketShare,
        percentageIncrease,
        raas: normalizedRaas || "Unknown",
        da: normalizedDA || "Unknown",
        framework: normalizedFramework || "Unknown",
        logo: chainLogo,
      };
    });

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
      <h2 className="top-chains-heading">Top 6 Blockchddfdain Chains</h2>
      <div className="top-chains-cards">
        {topChains.map((chain, index) => (
          <div key={index} className="chain-card" tabIndex="0">
            {chain.logo && (
              <img
                src={chain.logo}
                alt={`${chain.chainName} Logo`}
                className="chain-logo"
                loading="lazy"
              />
            )}
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
              {/* RaaS Logo */}
              <div
                className="logo-container raas-logo"
                aria-label="RaaS"
                title="RaaS"
              >
                {chain.raas && raasLogos[chain.raas] ? (
                  <img
                    src={raasLogos[chain.raas]}
                    alt={`${chain.raas} Logo`}
                    className="logo"
                    loading="lazy"
                  />
                ) : (
                  <div className="logo-placeholder">RaaS</div>
                )}
                {/* Tooltip is handled purely via CSS using the title attribute */}
              </div>

              {/* Data Availability Logo */}
              <div
                className="logo-container da-logo"
                aria-label="Data Availability"
                title="Data Availability"
              >
                {chain.da && daLogos[chain.da] ? (
                  <img
                    src={daLogos[chain.da]}
                    alt={`${chain.da} Logo`}
                    className="logo"
                    loading="lazy"
                  />
                ) : (
                  <div className="logo-placeholder">DA</div>
                )}
                {/* Tooltip is handled purely via CSS using the title attribute */}
              </div>

              {/* Framework Logo */}
              <div
                className="logo-container framework-logo"
                aria-label="Framework"
                title="Framework"
              >
                {chain.framework && frameworkLogos[chain.framework] ? (
                  <img
                    src={frameworkLogos[chain.framework]}
                    alt={`${chain.framework} Logo`}
                    className="logo"
                    loading="lazy"
                  />
                ) : (
                  <div className="logo-placeholder">FW</div>
                )}
                {/* Tooltip is handled purely via CSS using the title attribute */}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopChains;
