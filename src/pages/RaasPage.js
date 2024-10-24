// src/pages/RaaSPage.js

import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "../Sidebar/Sidebar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLayerGroup } from "@fortawesome/free-solid-svg-icons";
import "./RaaSPage.css";
import {
  Chart as ChartJS,
  LineElement,
  BarElement,
  PointElement,
  CategoryScale,
  LinearScale,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
} from "chart.js";
import { Line, Pie } from "react-chartjs-2";
import {
  fetchGoogleSheetData,
  fetchAllTransaction,
  fetchAllActiveAccounts,
  fetchAllTpsData,
  fetchAllTvlData,
} from "../services/googleSheetService";
import moment from "moment";
import { saveData, getData, clearAllData } from "../services/indexedDBService";

// DA Logos
import EthereumDALogo from "../assets/logos/da/ethereum.png";
import DACLogo from "../assets/logos/da/dac.png";
import CelestiaLogo from "../assets/logos/da/celestia.png";
import EigenDALogo from "../assets/logos/da/EigenDA.jpg"; // Renamed for clarity

// Framework Logos
import OPStackLogo from "../assets/logos/framework/op.png";
import OrbitLogo from "../assets/logos/framework/arbitrums.png";
import PolygonLogo from "../assets/logos/framework/Polygon.jpeg";
import Nova from "../assets/logos/framework/Nova.png";

ChartJS.register(
  LineElement,
  BarElement,
  PointElement,
  CategoryScale,
  LinearScale,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement
);

// Custom Number Formatter
const abbreviateNumber = (number, decimals = 2) => {
  if (number === null || number === undefined || isNaN(number)) return "0";

  const absNumber = Math.abs(number);

  if (absNumber >= 1.0e8) {
    // For numbers >= 100,000,000 → Million (scaled by 100,000,000)
    return (number / 1.0e8).toFixed(decimals) + "M";
  }

  if (absNumber >= 1.0e5) {
    // For numbers >= 100,000 → Thousand (scaled by 100,000)
    return (number / 1.0e5).toFixed(decimals) + "K";
  }

  return number.toLocaleString(); // Formats number with commas
};

// DA Logos Mapping
const daLogoMap = {
  EthereumDA: EthereumDALogo,
  DAC: DACLogo,
  Celestia: CelestiaLogo,
  "Eigen DA": EigenDALogo,

  // Add other DA mappings as needed
};

// Framework Logos Mapping
const frameworkLogoMap = {
  "OP Stack": OPStackLogo,
  Orbit: OrbitLogo,
  Polygon: PolygonLogo,
  "Arbitrum Nova": Nova,
  // Add other Framework mappings as needed
};

// Settlement Logos Mapping
const settlementLogoMap = {
  // Example mappings; replace with actual logos and keys
  Ethereum: EthereumDALogo,
  "Arbitrum Nova": Nova,
};

// Utility functions to get logos
const getDALogo = (daName) => daLogoMap[daName] || "/logos/default_da.png";
const getFrameworkLogo = (frameworkName) =>
  frameworkLogoMap[frameworkName] || "/logos/default_framework.png";
const getSettlementLogo = (settlementName) =>
  settlementLogoMap[settlementName] || "/logos/default_settlement.png";

const RAAS_DATA_ID = "raasPageData"; // Unique ID for IndexedDB

const RaaSPage = () => {
  // State variables
  const [selectedRaas, setSelectedRaas] = useState("Gelato"); // Default RaaS
  const [allChains, setAllChains] = useState([]);
  const [filteredChains, setFilteredChains] = useState([]);
  const [transactionsByChainDate, setTransactionsByChainDate] = useState({});
  const [activeAccountsByChainDate, setActiveAccountsByChainDate] = useState(
    {}
  );
  const [tpsDataByChainDate, setTpsDataByChainDate] = useState({});
  const [tvlDataByChainDate, setTvlDataByChainDate] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // New State Variables for Time Range Selector
  const [timeUnit, setTimeUnit] = useState("Daily"); // "Daily" or "Monthly"
  const [timeRange, setTimeRange] = useState("90 days");

  const [xAxisOption, setXAxisOption] = useState("Chain"); // Options: Chain, Vertical, Framework, L2/L3

  // New State Variables for Filters
  const [selectedVertical, setSelectedVertical] = useState("All Verticals");
  const [selectedFramework, setSelectedFramework] = useState("All Frameworks");
  const [selectedLayer, setSelectedLayer] = useState("All Layers");

  // Chart View Options
  const [chartView, setChartView] = useState("Total"); // Options: Total, Per Chain
  const [chartType, setChartType] = useState("Absolute"); // Options: Absolute, Stacked, Percentage

  const raasOptions = ["Gelato", "Caldera", "Conduit", "Altlayer", "Alchemy"];

  const timeRangeOptions = {
    Daily: ["90 days", "180 days", "1 Year", "All"],
    Monthly: ["3 Months", "6 Months", "1 Year", "All"],
  };

  const xAxisOptions = ["Chain", "Vertical", "Framework", "L2/L3"];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // await clearAllData(); // Remove this line if you want to utilize caching
      try {
        // Retrieve data from IndexedDB
        console.log("🔍 Attempting to retrieve data from IndexedDB...");
        const storedRecord = await getData(RAAS_DATA_ID);

        const oneHourAgo = Date.now() - 1 * 60 * 60 * 1000; // 1 hour

        if (storedRecord && storedRecord.timestamp > oneHourAgo) {
          // Use stored data if it's less than 1 hour old
          console.log("📦 Using cached data from IndexedDB.");
          populateStateWithData(storedRecord.data);
          setLoading(false);
          return;
        }

        console.log("🚀 Fetching new data from Google Sheets and APIs...");
        // Fetch new data if no valid stored data is available
        const sheetData = await fetchGoogleSheetData();
        const transactionsData = await fetchAllTransaction(sheetData);
        const activeAccountsData = await fetchAllActiveAccounts(sheetData);
        const tpsData = await fetchAllTpsData(sheetData);
        const tvlData = await fetchAllTvlData(sheetData);

        const newData = {
          sheetData,
          transactionsData,
          activeAccountsData,
          tpsData,
          tvlData,
        };

        // Save new data to IndexedDB
        console.log("💾 Saving new data to IndexedDB...");
        await saveData(RAAS_DATA_ID, newData);

        populateStateWithData(newData);
      } catch (error) {
        console.error("❌ Error during data fetching:", error);
        setError("Failed to load data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const populateStateWithData = (data) => {
    const {
      sheetData,
      transactionsData,
      activeAccountsData,
      tpsData,
      tvlData,
    } = data;

    // Filter chains with status "Mainnet" and have a projectId
    const mainnetChains = sheetData.filter(
      (chain) =>
        chain.status &&
        chain.status.trim().toLowerCase() === "mainnet" &&
        chain.projectId // Ensure projectId is present
    );

    setAllChains(mainnetChains);
    setTransactionsByChainDate(transactionsData.transactionsByChainDate);
    setActiveAccountsByChainDate(activeAccountsData.activeAccountsByChainDate);
    setTpsDataByChainDate(tpsData.tpsDataByChainDate);
    setTvlDataByChainDate(tvlData.tvlDataByChainDate);
  };

  // Compute options for filters
  const verticalOptions = useMemo(() => {
    const options = new Set();
    allChains.forEach((chain) => {
      if (chain.vertical) options.add(chain.vertical);
    });
    return ["All Verticals", ...Array.from(options)];
  }, [allChains]);

  const frameworkOptions = useMemo(() => {
    const options = new Set();
    allChains.forEach((chain) => {
      if (chain.framework) options.add(chain.framework);
    });
    return ["All Frameworks", ...Array.from(options)];
  }, [allChains]);

  const layerOptions = useMemo(() => {
    const options = new Set();
    allChains.forEach((chain) => {
      if (chain.l2OrL3) options.add(chain.l2OrL3);
    });
    return ["All Layers", ...Array.from(options)];
  }, [allChains]);

  useEffect(() => {
    // Filter chains based on selected RaaS and other filters
    const filtered = allChains.filter((chain) => {
      const matchesRaas =
        chain.raas && chain.raas.toLowerCase() === selectedRaas.toLowerCase();

      const matchesVertical =
        selectedVertical === "All Verticals" ||
        chain.vertical === selectedVertical;

      const matchesFramework =
        selectedFramework === "All Frameworks" ||
        chain.framework === selectedFramework;

      const matchesLayer =
        selectedLayer === "All Layers" || chain.l2OrL3 === selectedLayer;

      return matchesRaas && matchesVertical && matchesFramework && matchesLayer;
    });

    setFilteredChains(filtered);
  }, [
    allChains,
    selectedRaas,
    selectedVertical,
    selectedFramework,
    selectedLayer,
  ]);

  // Compute statistics
  const totalProjects = filteredChains.length;

  const totalTransactions = useMemo(() => {
    let total = 0;
    filteredChains.forEach((chain) => {
      const chainName = chain.name;
      const chainTransactions = transactionsByChainDate[chainName] || {};
      total += Object.values(chainTransactions).reduce(
        (sum, val) => sum + (val.value || 0),
        0
      );
    });
    return total;
  }, [filteredChains, transactionsByChainDate]);

  const totalActiveAccounts = useMemo(() => {
    let total = 0;
    filteredChains.forEach((chain) => {
      const chainName = chain.name;
      const chainAccounts = activeAccountsByChainDate[chainName] || {};
      total += Object.values(chainAccounts).reduce(
        (sum, val) => sum + (val || 0),
        0
      );
    });
    return total;
  }, [filteredChains, activeAccountsByChainDate]);

  const totalTVL = useMemo(() => {
    let total = 0;
    filteredChains.forEach((chain) => {
      const chainName = chain.name;
      const chainTvlData = tvlDataByChainDate[chainName] || {};
      const dateKeys = Object.keys(chainTvlData);
      if (dateKeys.length > 0) {
        const latestDate = dateKeys.reduce((a, b) =>
          moment(a).isAfter(b) ? a : b
        );
        const currentTvl = chainTvlData[latestDate]?.totalTvl || 0;
        total += currentTvl;
      }
    });
    return total;
  }, [filteredChains, tvlDataByChainDate]);

  // Adjusted Average TPS Calculation
  const averageTPS = useMemo(() => {
    let total = 0;
    let count = 0;
    filteredChains.forEach((chain) => {
      const chainName = chain.name;
      const chainTpsData = tpsDataByChainDate[chainName] || {};
      const dateKeys = Object.keys(chainTpsData);
      if (dateKeys.length > 0) {
        const latestDate = dateKeys.reduce((a, b) =>
          moment(a).isAfter(b) ? a : b
        );
        const currentTps = chainTpsData[latestDate] || 0;
        total += currentTps;
        count += 1;
      }
    });
    // Avoid division by zero
    return count > 0 ? total / count : 0;
  }, [filteredChains, tpsDataByChainDate]);

  // Time Range Filtering based on timeUnit and timeRange
  const getFilteredDates = () => {
    const today = moment().format("YYYY-MM-DD");
    let startDate;
    let dateDifference;

    switch (timeRange) {
      case "90 days":
      case "3 Months":
        dateDifference = timeUnit === "Daily" ? 90 : 3 * 30; // Approximate months
        break;
      case "180 days":
      case "6 Months":
        dateDifference = timeUnit === "Daily" ? 180 : 6 * 30;
        break;
      case "1 Year":
        dateDifference = 365;
        break;
      case "All":
        // Find the earliest launch date among the filtered chains
        const launchDates = filteredChains
          .filter((chain) => chain.launchDate)
          .map((chain) =>
            moment(new Date(chain.launchDate)).format("YYYY-MM-DD")
          );
        if (launchDates.length > 0) {
          startDate = launchDates.reduce((minDate, date) =>
            date < minDate ? date : minDate
          );
        } else {
          startDate = moment().subtract(1, "year").format("YYYY-MM-DD"); // default to 1 year ago
        }
        break;
      default:
        dateDifference = 90;
    }

    if (dateDifference) {
      startDate = moment()
        .subtract(dateDifference, "days")
        .format("YYYY-MM-DD");
    }

    const dates = [];
    let currentDate = moment(startDate);
    while (currentDate.isSameOrBefore(today, "day")) {
      dates.push(currentDate.format("YYYY-MM-DD"));
      currentDate.add(1, "day");
    }
    return dates;
  };

  // Launch Timeline Chart Data
  const launchTimelineData = useMemo(() => {
    const data = filteredChains
      .filter((chain) => chain.launchDate)
      .map((chain) => ({
        chainName: chain.name,
        launchDate: moment(new Date(chain.launchDate)).format("YYYY-MM-DD"),
      }))
      .sort((a, b) =>
        moment(a.launchDate).isBefore(moment(b.launchDate)) ? -1 : 1
      );
    return data;
  }, [filteredChains]);

  // Table Data
  const tableData = useMemo(() => {
    return (
      filteredChains
        .map((chain) => {
          const chainName = chain.name;
          const chainLogo = chain.logoUrl || "";
          const chainVertical = chain.vertical || "N/A";
          const chainFramework = chain.framework || "N/A";
          const chainDA = chain.da || "N/A";
          const chainSettlement = chain.settlementWhenL3 || "N/A"; // Ensure this property exists

          // TVL
          const chainTvl = tvlDataByChainDate[chainName] || {};
          const dateKeys = Object.keys(chainTvl);
          let currentTvl = 0;
          if (dateKeys.length > 0) {
            const latestDate = dateKeys.reduce((a, b) =>
              moment(a).isAfter(b) ? a : b
            );
            currentTvl = chainTvl[latestDate]?.totalTvl || 0;
          }

          // Total Transactions
          const chainTransactions = transactionsByChainDate[chainName] || {};
          const totalTransactions = Object.values(chainTransactions).reduce(
            (sum, val) => sum + (val.value || 0),
            0
          );

          // Total Active Accounts
          const chainAccounts = activeAccountsByChainDate[chainName] || {};
          const totalActiveAccounts = Object.values(chainAccounts).reduce(
            (sum, val) => sum + (val || 0),
            0
          );

          // Current TPS
          const chainTpsData = tpsDataByChainDate[chainName] || {};
          const tpsDateKeys = Object.keys(chainTpsData);
          let currentTps = 0;
          if (tpsDateKeys.length > 0) {
            const latestTpsDate = tpsDateKeys.reduce((a, b) =>
              moment(a).isAfter(b) ? a : b
            );
            currentTps = chainTpsData[latestTpsDate] || 0;
          }

          return {
            chainName,
            chainLogo,
            chainVertical,
            chainFramework,
            chainDA,
            chainSettlement,
            currentTvl,
            totalTransactions,
            totalActiveAccounts,
            currentTps, // Added Current TPS
          };
        })
        //.filter((chain) => chain !== null) // Remove null entries (now unnecessary)
        .sort((a, b) => b.currentTvl - a.currentTvl) // Sort by TVL descending
      //.slice(0, 10) // Remove this line to include all chains
    );
  }, [
    filteredChains,
    tvlDataByChainDate,
    transactionsByChainDate,
    activeAccountsByChainDate,
    tpsDataByChainDate, // Added dependency
  ]);

  // Activity Charts Data
  const activityChartData = useMemo(() => {
    const dates = getFilteredDates();

    // Initialize datasets
    const transactionDatasets = [];
    const activeAccountsDatasets = [];
    const tvlDatasets = [];

    if (chartView === "Total") {
      // Total data
      const transactionCounts = dates.map((date) => {
        let total = 0;
        filteredChains.forEach((chain) => {
          const chainName = chain.name;
          const chainTransactions = transactionsByChainDate[chainName] || {};
          total += chainTransactions[date]?.value || 0;
        });
        return total;
      });

      const activeAccountsCounts = dates.map((date) => {
        let total = 0;
        filteredChains.forEach((chain) => {
          const chainName = chain.name;
          const chainAccounts = activeAccountsByChainDate[chainName] || {};
          total += chainAccounts[date] || 0;
        });
        return total;
      });

      const tvlValues = dates.map((date) => {
        let total = 0;
        filteredChains.forEach((chain) => {
          const chainName = chain.name;
          const chainTvl = tvlDataByChainDate[chainName] || {};
          total += chainTvl[date]?.totalTvl || 0;
        });
        return total;
      });

      transactionDatasets.push({
        label: "Total Transactions",
        data: transactionCounts,
        borderColor: "#FF6384",
        backgroundColor: "rgba(255,99,132,0.2)",
        fill: true,
        tension: 0.1,
      });

      activeAccountsDatasets.push({
        label: "Total Active Accounts",
        data: activeAccountsCounts,
        borderColor: "#36A2EB",
        backgroundColor: "rgba(54,162,235,0.2)",
        fill: true,
        tension: 0.1,
      });

      tvlDatasets.push({
        label: "Total TVL",
        data: tvlValues,
        borderColor: "#FFCE56",
        backgroundColor: "rgba(255,206,86,0.2)",
        fill: true,
        tension: 0.1,
      });
    } else {
      // Per-chain data
      filteredChains.forEach((chain, index) => {
        const chainName = chain.name;
        const color = `hsl(${(index * 50) % 360}, 70%, 50%)`;

        // Transactions
        const transactionData = dates.map((date) => {
          const chainTransactions = transactionsByChainDate[chainName] || {};
          return chainTransactions[date]?.value || 0;
        });
        transactionDatasets.push({
          label: chainName,
          data: transactionData,
          borderColor: color,
          backgroundColor: color,
          fill: false,
          tension: 0.1,
        });

        // Active Accounts
        const activeAccountsData = dates.map((date) => {
          const chainAccounts = activeAccountsByChainDate[chainName] || {};
          return chainAccounts[date] || 0;
        });
        activeAccountsDatasets.push({
          label: chainName,
          data: activeAccountsData,
          borderColor: color,
          backgroundColor: color,
          fill: false,
          tension: 0.1,
        });

        // TVL
        const tvlData = dates.map((date) => {
          const chainTvl = tvlDataByChainDate[chainName] || {};
          return chainTvl[date]?.totalTvl || 0;
        });
        tvlDatasets.push({
          label: chainName,
          data: tvlData,
          borderColor: color,
          backgroundColor: color,
          fill: false,
          tension: 0.1,
        });
      });
    }

    return {
      dates,
      transactionDatasets,
      activeAccountsDatasets,
      tvlDatasets,
    };
  }, [
    filteredChains,
    transactionsByChainDate,
    activeAccountsByChainDate,
    tvlDataByChainDate,
    chartView,
    chartType,
    timeRange,
    timeUnit,
  ]);

  // Ecosystem Charts Data (remains the same)
  const ecosystemChartData = useMemo(() => {
    // Chain by Vertical
    const verticalCounts = {};
    const verticalChains = {};
    filteredChains.forEach((chain) => {
      const vertical = chain.vertical || "N/A";
      verticalCounts[vertical] = (verticalCounts[vertical] || 0) + 1;
      if (!verticalChains[vertical]) verticalChains[vertical] = [];
      verticalChains[vertical].push(chain.name);
    });

    // Chain by DA
    const daCounts = {};
    const daChains = {};
    filteredChains.forEach((chain) => {
      const da = chain.da || "N/A";
      daCounts[da] = (daCounts[da] || 0) + 1;
      if (!daChains[da]) daChains[da] = [];
      daChains[da].push(chain.name);
    });

    // Chain by Framework
    const frameworkCounts = {};
    const frameworkChains = {};
    filteredChains.forEach((chain) => {
      const framework = chain.framework || "N/A";
      frameworkCounts[framework] = (frameworkCounts[framework] || 0) + 1;
      if (!frameworkChains[framework]) frameworkChains[framework] = [];
      frameworkChains[framework].push(chain.name);
    });

    // Chain by L2/L3
    const layerCounts = {};
    const layerChains = {};
    filteredChains.forEach((chain) => {
      const layer = chain.l2OrL3 || "N/A";
      layerCounts[layer] = (layerCounts[layer] || 0) + 1;
      if (!layerChains[layer]) layerChains[layer] = [];
      layerChains[layer].push(chain.name);
    });

    return {
      verticalCounts,
      verticalChains,
      daCounts,
      daChains,
      frameworkCounts,
      frameworkChains,
      layerCounts,
      layerChains,
    };
  }, [filteredChains]);

  // Handle X-Axis Option Change
  const handleXAxisOptionChange = (event) => {
    setXAxisOption(event.target.value);
  };

  // Handle Time Unit Change
  const handleTimeUnitChange = (unit) => {
    setTimeUnit(unit);
    // Reset timeRange to default when timeUnit changes
    setTimeRange(timeRangeOptions[unit][0]);
  };

  // Handle Time Range Change
  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
  };

  // Handle Chart View Change
  const handleChartViewChange = (event) => {
    setChartView(event.target.value);
  };

  // Handle Chart Type Change
  const handleChartTypeChange = (event) => {
    setChartType(event.target.value);
  };

  // Utility functions
  const getColorForChain = (chainName) => {
    const colorMap = {
      Playnance: "#FF6384",
      Anomaly: "#36A2EB",
      "Aleph Zero": "#FFCE56",
      Everclear: "#4BC0C0",
      Fox: "#9966FF",
      Ethernity: "#FF9F40",
      Camp: "#C9CBCF",
      Gameswift: "#E7E9ED",
      "SX Network": "#36A2EB",
      "Event Horizon": "#FF6384",
      Arenaz: "#FFCE56",
      "Edu Chain": "#4BC0C0",
      Caldera: "#EC6731",
      Other: "#999999",
    };
    return colorMap[chainName] || getRandomColor();
  };

  const getRandomColor = () => {
    const letters = "0123456789ABCDEF";
    let color = "#";
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  };

  return (
    <div className="raas-page">
      <Sidebar />
      <div className="main-content">
        {/* Header */}
        <div className="raas-header">
          <div className="heading-container">
            <FontAwesomeIcon icon={faLayerGroup} className="icon" />
            <div>
              <h2>{selectedRaas} RaaS</h2>
              <p className="description">
                Overview and analytics for {selectedRaas} Rollup as a Service.
              </p>
            </div>
          </div>

          {/* RaaS Selection Dropdown */}
          <div className="raas-dropdown">
            <select
              value={selectedRaas}
              onChange={(e) => setSelectedRaas(e.target.value)}
            >
              {raasOptions.map((raas) => (
                <option key={raas} value={raas}>
                  {raas}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error Message */}
        {error && <div className="error-message">{error}</div>}

        {/* Loading Indicator */}
        {loading && <div className="loading">Loading data...</div>}

        {!loading && (
          <>
            <div className="time-range-selector">
              <div className="time-range-left">
                {["Daily", "Monthly"].map((unit) => (
                  <button
                    key={unit}
                    className={timeUnit === unit ? "active" : ""}
                    onClick={() => handleTimeUnitChange(unit)}
                  >
                    {unit}
                  </button>
                ))}
              </div>
              <div className="time-range-right">
                {timeRangeOptions[timeUnit].map((range) => (
                  <button
                    key={range}
                    className={timeRange === range ? "active" : ""}
                    onClick={() => handleTimeRangeChange(range)}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            {/* Statistics Cards */}
            <div className="stats-cards">
              <div className="stats-card">
                <h3>Total Projects</h3>
                <p>{totalProjects}</p>
              </div>
              <div className="stats-card">
                <h3>Total Transactions</h3>
                <p>${abbreviateNumber(totalTransactions, 2)}</p>
              </div>
              <div className="stats-card">
                <h3>Total Active Accounts</h3>
                <p>${abbreviateNumber(totalActiveAccounts, 2)}</p>
              </div>
              <div className="stats-card">
                <h3>Total TVL</h3>
                <p>${abbreviateNumber(totalTVL, 2)}</p>
              </div>
              <div className="stats-card">
                <h3>Average TPS</h3>
                <p>{averageTPS.toFixed(2)}</p>
              </div>
            </div>

            {/* Launch Timeline Chart */}
            <div className="launch-timeline-section">
              <h3>Launch Timeline</h3>
              <div className="timeline-chart">
                {launchTimelineData.map((item, index) => (
                  <div key={index} className="timeline-item">
                    <div className="timeline-date">
                      {moment(item.launchDate).format("MMM YYYY")}
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-dot"></div>
                      <div
                        className="timeline-line"
                        style={{
                          display:
                            index === launchTimelineData.length - 1
                              ? "none"
                              : "block",
                        }}
                      ></div>
                      <div className="timeline-label">{item.chainName}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Time Range Selector */}

            {/* Filters */}
            <div className="filters-container">
              <div className="filter-dropdown">
                <label>Vertical:</label>
                <select
                  value={selectedVertical}
                  onChange={(e) => setSelectedVertical(e.target.value)}
                >
                  {verticalOptions.map((vertical) => (
                    <option key={vertical} value={vertical}>
                      {vertical}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-dropdown">
                <label>Framework:</label>
                <select
                  value={selectedFramework}
                  onChange={(e) => setSelectedFramework(e.target.value)}
                >
                  {frameworkOptions.map((framework) => (
                    <option key={framework} value={framework}>
                      {framework}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filter-dropdown">
                <label>L2/L3:</label>
                <select
                  value={selectedLayer}
                  onChange={(e) => setSelectedLayer(e.target.value)}
                >
                  {layerOptions.map((layer) => (
                    <option key={layer} value={layer}>
                      {layer}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Data Table */}
            <div className="table-section">
              <h3 className="section-title">Projects</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Vertical</th>
                      <th>TVL</th>
                      <th>Tx Count</th>
                      <th>Active Accounts</th>
                      <th>Current TPS</th>
                    </tr>
                  </thead>

                  <tbody>
                    {tableData.map((chain, index) => (
                      <tr key={index}>
                        <td className="chain-name-cell">
                          <div className="chain-name">
                            {chain.chainName}
                            <div className="logo-container">
                              {/* Framework Logo */}
                              {chain.chainFramework && (
                                <img
                                  src={getFrameworkLogo(chain.chainFramework)}
                                  alt={chain.chainFramework}
                                  className="small-logo"
                                  title={chain.chainFramework}
                                />
                              )}
                              {/* DA Logo */}
                              {chain.chainDA && (
                                <img
                                  src={getDALogo(chain.chainDA)}
                                  alt={chain.chainDA}
                                  className="small-logo"
                                  title={chain.chainDA}
                                />
                              )}
                              {/* Settlement Logo */}
                              {chain.chainSettlement && (
                                <img
                                  src={getSettlementLogo(chain.chainSettlement)}
                                  alt={chain.chainSettlement}
                                  className="small-logo"
                                  title={chain.chainSettlement}
                                />
                              )}
                            </div>
                          </div>
                        </td>
                        <td>{chain.chainVertical}</td>
                        <td>${abbreviateNumber(chain.currentTvl, 2)}</td>
                        <td>${abbreviateNumber(chain.totalTransactions, 2)}</td>
                        <td>
                          ${abbreviateNumber(chain.totalActiveAccounts, 2)}
                        </td>
                        <td>{chain.currentTps.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Chart View Options */}
            <div className="chart-options">
              <div className="chart-view-dropdown">
                <label>Chart View:</label>
                <select value={chartView} onChange={handleChartViewChange}>
                  <option value="Total">Total</option>
                  <option value="Per Chain">Per Chain</option>
                </select>
              </div>
              <div className="chart-type-dropdown">
                <label>Chart Type:</label>
                <select value={chartType} onChange={handleChartTypeChange}>
                  <option value="Absolute">Absolute</option>
                  <option value="Stacked">Stacked</option>
                  <option value="Percentage">Percentage</option>
                </select>
              </div>
            </div>

            {/* Activity Charts */}
            <div className="activity-charts-section">
              <h2>Activity charts</h2>

              <div className="charts-grid">
                {/* Transaction Count Chart */}
                <div className="chart-card">
                  <h4>Transaction Count</h4>
                  <Line
                    data={{
                      labels: activityChartData.dates.map((date) =>
                        timeUnit === "Daily"
                          ? moment(date).format("D MMM")
                          : moment(date).format("MMM YYYY")
                      ),
                      datasets: activityChartData.transactionDatasets,
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          display: chartView === "Per Chain",
                          position: "bottom",
                          labels: {
                            color: "#FFFFFF",
                          },
                        },
                      },
                      scales: {
                        x: {
                          ticks: {
                            color: "#FFFFFF",
                            maxRotation: 45,
                            minRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 10,
                          },
                        },
                        y: {
                          ticks: {
                            color: "#FFFFFF",
                            beginAtZero: true,
                          },
                        },
                      },
                    }}
                  />
                </div>
                {/* Active Accounts Chart */}
                <div className="chart-card">
                  <h4>Active Accounts</h4>
                  <Line
                    data={{
                      labels: activityChartData.dates.map((date) =>
                        timeUnit === "Daily"
                          ? moment(date).format("D MMM")
                          : moment(date).format("MMM YYYY")
                      ),
                      datasets: activityChartData.activeAccountsDatasets,
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          display: chartView === "Per Chain",
                          position: "bottom",
                          labels: {
                            color: "#FFFFFF",
                          },
                        },
                      },
                      scales: {
                        x: {
                          ticks: {
                            color: "#FFFFFF",
                            maxRotation: 45,
                            minRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 10,
                          },
                        },
                        y: {
                          ticks: {
                            color: "#FFFFFF",
                            beginAtZero: true,
                          },
                        },
                      },
                    }}
                  />
                </div>
                {/* TVL Chart */}
                <div className="chart-card">
                  <h4>Total Value Locked (TVL)</h4>
                  <Line
                    data={{
                      labels: activityChartData.dates.map((date) =>
                        timeUnit === "Daily"
                          ? moment(date).format("D MMM")
                          : moment(date).format("MMM YYYY")
                      ),
                      datasets: activityChartData.tvlDatasets,
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          display: chartView === "Per Chain",
                          position: "bottom",
                          labels: {
                            color: "#FFFFFF",
                          },
                        },
                      },
                      scales: {
                        x: {
                          ticks: {
                            color: "#FFFFFF",
                            maxRotation: 45,
                            minRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 10,
                          },
                        },
                        y: {
                          ticks: {
                            color: "#FFFFFF",
                            beginAtZero: true,
                          },
                        },
                      },
                    }}
                  />
                </div>
                {/* Average TPS Chart */}
                <div className="chart-card">
                  <h4>Average TPS</h4>
                  <Line
                    data={{
                      labels: activityChartData.dates.map((date) =>
                        timeUnit === "Daily"
                          ? moment(date).format("D MMM")
                          : moment(date).format("MMM YYYY")
                      ),
                      datasets: [
                        {
                          label: "Average TPS",
                          data: activityChartData.dates.map((date) => {
                            let total = 0;
                            let count = 0;
                            filteredChains.forEach((chain) => {
                              const chainName = chain.name;
                              const chainTps =
                                tpsDataByChainDate[chainName] || {};
                              if (chainTps[date] !== undefined) {
                                total += chainTps[date];
                                count += 1;
                              }
                            });
                            return count > 0 ? total / count : 0;
                          }),
                          borderColor: "#4BC0C0",
                          backgroundColor: "rgba(75, 192, 192, 0.2)",
                          tension: 0.1,
                          fill: true,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          display: false,
                        },
                        title: {
                          display: true,
                          text: `Average TPS Over Time - ${timeRange}`,
                          color: "#FFFFFF",
                        },
                        tooltip: {
                          mode: "index",
                          intersect: false,
                          callbacks: {
                            title: function (context) {
                              let dateLabel = context[0].label;
                              return dateLabel;
                            },
                            label: function (context) {
                              let label = context.dataset.label || "";
                              let value = context.parsed.y;
                              return `${label}: ${
                                value !== undefined ? value.toFixed(2) : "N/A"
                              }`;
                            },
                          },
                          backgroundColor: "rgba(0,0,0,0.7)",
                          titleColor: "#FFFFFF",
                          bodyColor: "#FFFFFF",
                        },
                      },
                      scales: {
                        x: {
                          title: {
                            display: true,
                            text: timeUnit === "Daily" ? "Date" : "Month",
                            color: "#FFFFFF",
                          },
                          ticks: {
                            color: "#FFFFFF",
                            maxRotation: 45,
                            minRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 10,
                          },
                        },
                        y: {
                          title: {
                            display: true,
                            text: "Average TPS",
                            color: "#FFFFFF",
                          },
                          ticks: {
                            color: "#FFFFFF",
                            beginAtZero: true,
                          },
                        },
                      },
                      elements: {
                        point: {
                          radius: 0, // Remove dots from the chart
                        },
                      },
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Ecosystem Charts */}
            <div className="ecosystem-charts-section">
              <h2>Ecosystem charts</h2>
              <div className="charts-grid">
                {/* Chain by Vertical */}
                <div className="chart-card">
                  <h4>Chains by Vertical</h4>
                  <Pie
                    data={{
                      labels: Object.keys(ecosystemChartData.verticalCounts),
                      datasets: [
                        {
                          data: Object.values(
                            ecosystemChartData.verticalCounts
                          ),
                          backgroundColor: [
                            "#FF6384",
                            "#36A2EB",
                            "#FFCE56",
                            "#4BC0C0",
                            "#9966FF",
                          ],
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          position: "right",
                          labels: {
                            color: "#FFFFFF",
                          },
                        },
                        tooltip: {
                          callbacks: {
                            label: function (tooltipItem) {
                              const index = tooltipItem.dataIndex;
                              const label = tooltipItem.label;
                              const count = tooltipItem.dataset.data[index];
                              const chainNames =
                                ecosystemChartData.verticalChains[label];
                              return [`${label}: ${count}`, ...chainNames];
                            },
                          },
                        },
                      },
                    }}
                  />
                </div>
                {/* Chain by DA */}
                <div className="chart-card">
                  <h4>Chains by Data Availability</h4>
                  <Pie
                    data={{
                      labels: Object.keys(ecosystemChartData.daCounts),
                      datasets: [
                        {
                          data: Object.values(ecosystemChartData.daCounts),
                          backgroundColor: [
                            "#FF6384",
                            "#36A2EB",
                            "#FFCE56",
                            "#4BC0C0",
                            "#9966FF",
                          ],
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          position: "right",
                          labels: {
                            color: "#FFFFFF",
                          },
                        },
                        tooltip: {
                          callbacks: {
                            label: function (tooltipItem) {
                              const index = tooltipItem.dataIndex;
                              const label = tooltipItem.label;
                              const count = tooltipItem.dataset.data[index];
                              const chainNames =
                                ecosystemChartData.daChains[label];
                              return [`${label}: ${count}`, ...chainNames];
                            },
                          },
                        },
                      },
                    }}
                  />
                </div>
                {/* Chain by Framework */}
                <div className="chart-card">
                  <h4>Chains by Framework</h4>
                  <Pie
                    data={{
                      labels: Object.keys(ecosystemChartData.frameworkCounts),
                      datasets: [
                        {
                          data: Object.values(
                            ecosystemChartData.frameworkCounts
                          ),
                          backgroundColor: [
                            "#FF6384",
                            "#36A2EB",
                            "#FFCE56",
                            "#4BC0C0",
                            "#9966FF",
                          ],
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          position: "right",
                          labels: {
                            color: "#FFFFFF",
                          },
                        },
                        tooltip: {
                          callbacks: {
                            label: function (tooltipItem) {
                              const index = tooltipItem.dataIndex;
                              const label = tooltipItem.label;
                              const count = tooltipItem.dataset.data[index];
                              const chainNames =
                                ecosystemChartData.frameworkChains[label];
                              return [`${label}: ${count}`, ...chainNames];
                            },
                          },
                        },
                      },
                    }}
                  />
                </div>
                {/* Chain by L2/L3 */}
                <div className="chart-card">
                  <h4>Chains by Layer (L2/L3)</h4>
                  <Pie
                    data={{
                      labels: Object.keys(ecosystemChartData.layerCounts),
                      datasets: [
                        {
                          data: Object.values(ecosystemChartData.layerCounts),
                          backgroundColor: [
                            "#FF6384",
                            "#36A2EB",
                            "#FFCE56",
                            "#4BC0C0",
                            "#9966FF",
                          ],
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          position: "right",
                          labels: {
                            color: "#FFFFFF",
                          },
                        },
                        tooltip: {
                          callbacks: {
                            label: function (tooltipItem) {
                              const index = tooltipItem.dataIndex;
                              const label = tooltipItem.label;
                              const count = tooltipItem.dataset.data[index];
                              const chainNames =
                                ecosystemChartData.layerChains[label];
                              return [`${label}: ${count}`, ...chainNames];
                            },
                          },
                        },
                      },
                    }}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RaaSPage;
