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
  const [activeAccountsByChainDate, setActiveAccountsByChainDate] = useState(
    {}
  );
  const [tpsDataByChainDate, setTpsDataByChainDate] = useState({});
  const [tvlDataByChainDate, setTvlDataByChainDate] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("90 days");
  const [xAxisOption, setXAxisOption] = useState("Chain"); // Options: Chain, Vertical, Framework, L2/L3

  const raasOptions = ["Gelato", "Caldera", "Conduit", "Altlayer", "Alchemy"];

  const timeRangeOptions = ["90 days", "180 days", "1 Year", "All"];

  const xAxisOptions = ["Chain", "Vertical", "Framework", "L2/L3"];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Retrieve data from IndexedDB
        // Uncomment the next line to clear IndexedDB for testing
        await clearAllData();
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
  };

  useEffect(() => {
    // Filter chains based on selected RaaS
    const filtered = allChains.filter(
      (chain) =>
        chain.raas && chain.raas.toLowerCase() === selectedRaas.toLowerCase()
    );
    setFilteredChains(filtered);
  }, [allChains, selectedRaas]);

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

  const averageTPS = useMemo(() => {
    let total = 0;
    let count = 0;
    filteredChains.forEach((chain) => {
      const chainName = chain.name;
      const chainTps = tpsDataByChainDate[chainName] || {};
      const tpsValues = Object.values(chainTps).map(
        (entry) => entry.value || 0
      );
      total += tpsValues.reduce((sum, val) => sum + val, 0);
      count += tpsValues.length;
    });
    return count > 0 ? total / count : 0;
  }, [filteredChains, tpsDataByChainDate]);

  // Time Range Filtering
  const getFilteredDates = () => {
    const today = moment().format("YYYY-MM-DD");
    let startDate;
    let dateDifference;

    switch (timeRange) {
      case "90 days":
        dateDifference = 90;
        break;
      case "180 days":
        dateDifference = 180;
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
      const chainTps = tpsDataByChainDate[chainName] || {};
      const tpsValues = Object.values(chainTps).map(
        (entry) => entry.value || 0
      );
      const averageChainTps =
        tpsValues.length > 0
          ? tpsValues.reduce((sum, val) => sum + val, 0) / tpsValues.length
          : 0;

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
        averageChainTps,
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

    const tpsValues = dates.map((date) => {
      let total = 0;
      let count = 0;
      filteredChains.forEach((chain) => {
        const chainName = chain.name;
        const chainTps = tpsDataByChainDate[chainName] || {};
        const value = chainTps[date]?.value || 0;
        total += value;
        if (value > 0) count += 1;
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
  ]);

  // Ecosystem Charts Data
  const ecosystemChartData = useMemo(() => {
    // Chain by Vertical
    const verticalCounts = {};
    filteredChains.forEach((chain) => {
      const vertical = chain.vertical || "N/A";
      verticalCounts[vertical] = (verticalCounts[vertical] || 0) + 1;
    });

    // Chain by DA
    const daCounts = {};
    filteredChains.forEach((chain) => {
      const da = chain.da || "N/A";
      daCounts[da] = (daCounts[da] || 0) + 1;
    });

    // Chain by Framework
    const frameworkCounts = {};
    filteredChains.forEach((chain) => {
      const framework = chain.framework || "N/A";
      frameworkCounts[framework] = (frameworkCounts[framework] || 0) + 1;
    });

    // Chain by L2/L3
    const layerCounts = {};
    filteredChains.forEach((chain) => {
      const layer = chain.l2OrL3 || "N/A";
      layerCounts[layer] = (layerCounts[layer] || 0) + 1;
    });

    return {
      verticalCounts,
      daCounts,
      frameworkCounts,
      layerCounts,
    };
  }, [filteredChains]);

  // Handle X-Axis Option Change
  const handleXAxisOptionChange = (event) => {
    setXAxisOption(event.target.value);
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
            <div className="time-range-selector">
              {timeRangeOptions.map((range) => (
                <button
                  key={range}
                  className={timeRange === range ? "active" : ""}
                  onClick={() => handleTimeRangeChange(range)}
                >
                  {range}
                </button>
              ))}
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
                      <th>TPS</th>
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
                        <td>{chain.averageChainTps.toFixed(2)}</td>
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
                {/* Transaction Count Chart */}
                <div className="chart-card">
                  <h4>Transaction Count</h4>
                  <Bar
                    data={{
                      labels: activityChartData.dates,
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
                      labels: activityChartData.dates,
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
                      labels: activityChartData.dates,
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
                {/* Average TPS Chart */}
                <div className="chart-card">
                  <h4>Average TPS</h4>
                  <Line
                    data={{
                      labels: activityChartData.dates,
                      datasets: [
                        {
                          label: "TPS",
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
              </div>
            </div>

            {/* Ecosystem Charts */}
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
