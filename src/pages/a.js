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
import { Line, Bar, Pie } from "react-chartjs-2";
import {
  fetchGoogleSheetData,
  fetchAllTransaction,
  fetchAllActiveAccounts,
  fetchAllTpsData,
  fetchAllTvlData,
} from "../services/googleSheetService";
import { abbreviateNumber, formatNumber } from "../utils/numberFormatter";
import moment from "moment";
import { saveData, getData, clearAllData } from "../services/indexedDBService";

// Register required components for Chart.js
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

const RAAS_DATA_ID = "raasPageData"; // Unique ID for IndexedDB

const RaaSPage = () => {
  // State variables
  const [selectedRaas, setSelectedRaas] = useState("Gelato"); // Default RaaS
  const [allChains, setAllChains] = useState([]);
  const [filteredChains, setFilteredChains] = useState([]);
  const [transactionsByChainDate, setTransactionsByChainDate] = useState({});
  const [activeAccountsByChainDate, setActiveAccountsByChainDate] = useState({});
  const [tpsDataByChainDate, setTpsDataByChainDate] = useState({});
  const [tvlDataByChainDate, setTvlDataByChainDate] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // New State Variables for Time Range Selector
  const [timeUnit, setTimeUnit] = useState("Daily"); // "Daily" or "Monthly"
  const [timeRange, setTimeRange] = useState("90 days");

  const [xAxisOption, setXAxisOption] = useState("Chain"); // Options: Chain, Vertical, Framework, L2/L3

  const raasOptions = ["Gelato", "Caldera", "Conduit", "Altlayer", "Alchemy"];

  const timeRangeOptions = {
    Daily: ["Daily", "90 days", "180 days", "1 Year", "All"],
    Monthly: ["3 Months", "6 Months", "1 Year", "All"],
  };

  const xAxisOptions = ["Chain", "Vertical", "Framework", "L2/L3"];

  // New State Variables for Dropdowns
  const [verticalOptions, setVerticalOptions] = useState([]);
  const [frameworkOptions, setFrameworkOptions] = useState([]);
  const [layerOptions, setLayerOptions] = useState([]);

  const [selectedVertical, setSelectedVertical] = useState("All");
  const [selectedFramework, setSelectedFramework] = useState("All");
  const [selectedLayer, setSelectedLayer] = useState("All");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Retrieve data from IndexedDB
        // Uncomment the next line to clear IndexedDB for testing
        // await clearAllData();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const populateStateWithData = (data) => {
    const {
      sheetData,
      transactionsData,
      activeAccountsData,
      tpsData,
      tvlData,
    } = data;

    // Filter chains with status "Mainnet"
    const mainnetChains = sheetData.filter(
      (chain) => chain.status && chain.status.trim().toLowerCase() === "mainnet"
    );

    setAllChains(mainnetChains);
    setTransactionsByChainDate(transactionsData.transactionsByChainDate);
    setActiveAccountsByChainDate(activeAccountsData.activeAccountsByChainDate);
    setTpsDataByChainDate(tpsData.tpsDataByChainDate);
    setTvlDataByChainDate(tvlData.tvlDataByChainDate);

    // Extract unique options for dropdowns
    const verticalsSet = new Set();
    const frameworksSet = new Set();
    const layersSet = new Set();

    mainnetChains.forEach((chain) => {
      if (chain.vertical) {
        verticalsSet.add(chain.vertical);
      }
      if (chain.framework) {
        frameworksSet.add(chain.framework);
      }
      if (chain.l2OrL3) {
        layersSet.add(chain.l2OrL3);
      }
    });

    setVerticalOptions(["All", ...Array.from(verticalsSet)]);
    setFrameworkOptions(["All", ...Array.from(frameworksSet)]);
    setLayerOptions(["All", ...Array.from(layersSet)]);
  };

  useEffect(() => {
    // Filter chains based on selected RaaS and other selections
    const filtered = allChains.filter((chain) => {
      const raasMatch =
        chain.raas && chain.raas.toLowerCase() === selectedRaas.toLowerCase();
      const verticalMatch =
        selectedVertical === "All" ||
        (chain.vertical && chain.vertical === selectedVertical);
      const frameworkMatch =
        selectedFramework === "All" ||
        (chain.framework && chain.framework === selectedFramework);
      const layerMatch =
        selectedLayer === "All" ||
        (chain.l2OrL3 && chain.l2OrL3 === selectedLayer);

      return raasMatch && verticalMatch && frameworkMatch && layerMatch;
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
      const chainTvl = tvlDataByChainDate[chainName] || {};
      total += Object.values(chainTvl).reduce(
        (sum, val) => sum + (val.totalTvl || 0),
        0
      );
    });
    return total;
  }, [filteredChains, tvlDataByChainDate]);

  // Adjusted Average TPS Calculation
  const averageTPS = useMemo(() => {
    let total = 0;
    let count = 0;
    const today = moment().format("YYYY-MM-DD");
    const yesterday = moment().subtract(1, "day").format("YYYY-MM-DD");
    filteredChains.forEach((chain) => {
      const chainName = chain.name;
      const chainTpsData = tpsDataByChainDate[chainName] || {};
      // Get current TPS
      const currentTps = chainTpsData[yesterday] || chainTpsData[today] || 0;
      total += currentTps;
      count += 1;
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
      case "Daily":
        // For Daily, use the most recent date
        startDate = moment().subtract(1, "day").format("YYYY-MM-DD");
        break;
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
    const today = moment().format("YYYY-MM-DD");
    const yesterday = moment().subtract(1, "day").format("YYYY-MM-DD");
    return filteredChains.map((chain) => {
      const chainName = chain.name;
      const chainVertical = chain.vertical || "N/A";
      const chainFramework = chain.framework || "N/A";
      const chainDA = chain.da || "N/A";
      const chainSettlement = chain.settlementWhenL3 || "N/A";
      const chainLogo = chain.logoUrl || "";

      // TVL
      const chainTvl = tvlDataByChainDate[chainName] || {};
      const totalTvl = Object.values(chainTvl).reduce(
        (sum, val) => sum + (val.totalTvl || 0),
        0
      );

      // TPS
      const chainTpsData = tpsDataByChainDate[chainName] || {};
      const tpsValues = Object.values(chainTpsData);
      // Get current TPS and max TPS
      const currentTps = chainTpsData[yesterday] || chainTpsData[today] || 0;
      const maxTps = tpsValues.length > 0 ? Math.max(...tpsValues) : 0;

      // Transaction Count
      const chainTransactions = transactionsByChainDate[chainName] || {};
      const totalTransactions = Object.values(chainTransactions).reduce(
        (sum, val) => sum + (val.value || 0),
        0
      );

      // Active Accounts
      const chainAccounts = activeAccountsByChainDate[chainName] || {};
      const totalActiveAccounts = Object.values(chainAccounts).reduce(
        (sum, val) => sum + (val || 0),
        0
      );

      return {
        chainName,
        chainLogo,
        chainVertical,
        chainFramework,
        chainDA,
        chainSettlement,
        totalTvl,
        currentTps, // Updated field
        maxTps, // Updated field
        totalTransactions,
        totalActiveAccounts,
      };
    });
  }, [
    filteredChains,
    transactionsByChainDate,
    activeAccountsByChainDate,
    tpsDataByChainDate,
    tvlDataByChainDate,
  ]);

  // Activity Charts Data
  const activityChartData = useMemo(() => {
    const dates = getFilteredDates();

    const transactionCounts = dates.map((date) => {
      let total = 0;
      filteredChains.forEach((chain) => {
        const chainName = chain.name;
        const chainTransactions = transactionsByChainDate[chainName] || {};
        const value = chainTransactions[date]?.value || 0;
        total += value;
      });
      return total;
    });

    const activeAccountsCounts = dates.map((date) => {
      let total = 0;
      filteredChains.forEach((chain) => {
        const chainName = chain.name;
        const chainAccounts = activeAccountsByChainDate[chainName] || {};
        const value = chainAccounts[date] || 0;
        total += value;
      });
      return total;
    });

    const tvlValues = dates.map((date) => {
      let total = 0;
      filteredChains.forEach((chain) => {
        const chainName = chain.name;
        const chainTvl = tvlDataByChainDate[chainName] || {};
        const value = chainTvl[date]?.totalTvl || 0;
        total += value;
      });
      return total;
    });

    // Average TPS values
    const tpsValues = dates.map((date) => {
      let total = 0;
      let count = 0;
      filteredChains.forEach((chain) => {
        const chainName = chain.name;
        const chainTps = tpsDataByChainDate[chainName] || {};
        if (chainTps[date] !== undefined) {
          const value = chainTps[date];
          total += value;
          count += 1;
        }
      });
      return count > 0 ? total / count : 0;
    });

    return {
      dates,
      transactionCounts,
      activeAccountsCounts,
      tvlValues,
      tpsValues,
    };
  }, [
    filteredChains,
    transactionsByChainDate,
    activeAccountsByChainDate,
    tpsDataByChainDate,
    tvlDataByChainDate,
    timeRange,
    timeUnit,
  ]);

  // Ecosystem Charts Data
  const ecosystemChartData = useMemo(() => {
    // Chain by Vertical
    const verticalCounts = {};
    const verticalChains = {};
    filteredChains.forEach((chain) => {
      const vertical = chain.vertical || "N/A";
      verticalCounts[vertical] = (verticalCounts[vertical] || 0) + 1;

      if (!verticalChains[vertical]) {
        verticalChains[vertical] = [];
      }
      verticalChains[vertical].push(chain.name);
    });

    // Chain by DA
    const daCounts = {};
    const daChains = {};
    filteredChains.forEach((chain) => {
      const da = chain.da || "N/A";
      daCounts[da] = (daCounts[da] || 0) + 1;

      if (!daChains[da]) {
        daChains[da] = [];
      }
      daChains[da].push(chain.name);
    });

    // Chain by Framework
    const frameworkCounts = {};
    const frameworkChains = {};
    filteredChains.forEach((chain) => {
      const framework = chain.framework || "N/A";
      frameworkCounts[framework] = (frameworkCounts[framework] || 0) + 1;

      if (!frameworkChains[framework]) {
        frameworkChains[framework] = [];
      }
      frameworkChains[framework].push(chain.name);
    });

    // Chain by L2/L3
    const layerCounts = {};
    const layerChains = {};
    filteredChains.forEach((chain) => {
      const layer = chain.l2OrL3 || "N/A";
      layerCounts[layer] = (layerCounts[layer] || 0) + 1;

      if (!layerChains[layer]) {
        layerChains[layer] = [];
      }
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

  // Placeholder for chain logos
  const chainLogoMap = {
    // Replace with actual logo URLs
    "Optimism SDK": "/logos/optimism_sdk.png",
    "OP Stack": "/logos/op_stack.png",
    "ZK Rollup": "/logos/zk_rollup.png",
    "Data Availability A": "/logos/da_a.png",
    "Data Availability B": "/logos/da_b.png",
    // Add other mappings as needed
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
            {/* Description */}
            <div className="raas-description">
              <p>
                {selectedRaas} is a leading Rollup as a Service provider,
                offering scalable solutions for blockchain projects.
              </p>
            </div>

            {/* Statistics Cards */}
            <div className="stats-cards">
              <div className="stats-card">
                <h3>Total Projects</h3>
                <p>{totalProjects}</p>
              </div>
              <div className="stats-card">
                <h3>Total Transactions</h3>
                <p>{abbreviateNumber(totalTransactions, 2)}</p>
              </div>
              <div className="stats-card">
                <h3>Total Active Accounts</h3>
                <p>{abbreviateNumber(totalActiveAccounts, 2)}</p>
              </div>
              <div className="stats-card">
                <h3>Total TVL</h3>
                <p>${abbreviateNumber(totalTVL, 2)}M</p>
              </div>
              <div className="stats-card">
                <h3>Average TPS</h3>
                <p>{averageTPS.toFixed(2)}</p>
              </div>
            </div>

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
            <div className="time-range-selector">
              {/* Left Side: Time Unit Buttons */}
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
              {/* Right Side: Time Range Buttons */}
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

            {/* Dropdowns for Vertical, Framework, L2/L3 */}
            <div className="filter-dropdowns">
              <div className="dropdown">
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
              <div className="dropdown">
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
              <div className="dropdown">
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
                      <th>Current TPS</th>
                      <th>Max TPS</th>
                      <th>Tx Count</th>
                      <th>Active Accounts</th>
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
                                  src={
                                    chainLogoMap[chain.chainFramework] ||
                                    "/logos/default_framework.png"
                                  }
                                  alt={chain.chainFramework}
                                  className="small-logo"
                                  title={chain.chainFramework}
                                />
                              )}
                              {/* DA Logo */}
                              {chain.chainDA && (
                                <img
                                  src={
                                    chainLogoMap[chain.chainDA] ||
                                    "/logos/default_da.png"
                                  }
                                  alt={chain.chainDA}
                                  className="small-logo"
                                  title={chain.chainDA}
                                />
                              )}
                              {/* Settlement Logo */}
                              {chain.chainSettlement && (
                                <img
                                  src={
                                    chainLogoMap[chain.chainSettlement] ||
                                    "/logos/default_settlement.png"
                                  }
                                  alt={chain.chainSettlement}
                                  className="small-logo"
                                  title={chain.chainSettlement}
                                />
                              )}
                            </div>
                          </div>
                        </td>
                        <td>{chain.chainVertical}</td>
                        <td>${abbreviateNumber(chain.totalTvl, 2)}M</td>
                        <td>
                          {chain.currentTps !== undefined
                            ? chain.currentTps.toFixed(2)
                            : "N/A"}
                        </td>
                        <td>
                          {chain.maxTps !== undefined
                            ? chain.maxTps.toFixed(2)
                            : "N/A"}
                        </td>
                        <td>{abbreviateNumber(chain.totalTransactions, 2)}</td>
                        <td>
                          {abbreviateNumber(chain.totalActiveAccounts, 2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Activity Charts */}
            <div className="activity-charts-section">
              <div className="x-axis-selector">
                <label>X-Axis:</label>
                <select value={xAxisOption} onChange={handleXAxisOptionChange}>
                  {xAxisOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="charts-grid">
                <div className="chart-card">
                  <h4>Transaction Count</h4>
                  <Bar
                    data={{
                      labels: activityChartData.dates.map((date) =>
                        timeUnit === "Daily"
                          ? moment(date).format("D MMM")
                          : moment(date).format("MMM YYYY")
                      ),
                      datasets: [
                        {
                          label: "Transactions",
                          data: activityChartData.transactionCounts,
                          backgroundColor: "#FF6384",
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          display: false,
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
                  <Bar
                    data={{
                      labels: activityChartData.dates.map((date) =>
                        timeUnit === "Daily"
                          ? moment(date).format("D MMM")
                          : moment(date).format("MMM YYYY")
                      ),
                      datasets: [
                        {
                          label: "Active Accounts",
                          data: activityChartData.activeAccountsCounts,
                          backgroundColor: "#36A2EB",
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          display: false,
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
                      datasets: [
                        {
                          label: "TVL",
                          data: activityChartData.tvlValues,
                          borderColor: "#FFCE56",
                          backgroundColor: "rgba(255, 206, 86, 0.2)",
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
                          data: activityChartData.tpsValues,
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
            <div className="ecosystem-charts-section">
              <div className="charts-grid">
                {/* Chain by Vertical */}
                <div className="chart-card">
                  <h4>Chains by Vertical</h4>
                  <Pie
                    data={{
                      labels: Object.keys(ecosystemChartData.verticalCounts),
                      datasets: [
                        {
                          data: Object.values(ecosystemChartData.verticalCounts),
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
                            label: function (context) {
                              const label = context.label || "";
                              const value = context.formattedValue || "";
                              const chains =
                                ecosystemChartData.verticalChains[label] || [];
                              return [
                                `${label}: ${value}`,
                                ...chains.map((chainName) => `- ${chainName}`),
                              ];
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
                            label: function (context) {
                              const label = context.label || "";
                              const value = context.formattedValue || "";
                              const chains =
                                ecosystemChartData.daChains[label] || [];
                              return [
                                `${label}: ${value}`,
                                ...chains.map((chainName) => `- ${chainName}`),
                              ];
                            },
                          },
                        },
                      },
                    }}
                  />
                </div>
                {/* Chain by Framework */}
                <div className="chart-card">
                  <h4>Chains by Framework
