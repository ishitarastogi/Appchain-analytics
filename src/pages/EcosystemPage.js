/* src/pages/EcosystemPage.js */

import React, { useState, useEffect } from "react";
import Sidebar from "../Sidebar/Sidebar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChartPie } from "@fortawesome/free-solid-svg-icons";
import "./EcosystemPage.css";
import { Pie, Bar } from "react-chartjs-2";
import {
  fetchGoogleSheetData,
  fetchAllTransactions,
  fetchAllTvlData,
  fetchAllActiveAccounts,
} from "../services/googleSheetService";
import { abbreviateNumber } from "../utils/numberFormatter";
import { saveData, getData } from "../services/indexedDBService";

// Register required components for Chart.js
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from "chart.js";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement
);

const ECOSYSTEM_DATA_ID = "ecosystemData"; // Unique ID for IndexedDB
const SIX_HOURS_IN_MS = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

const EcosystemPage = () => {
  // State variables
  const [raasOptions, setRaasOptions] = useState(["All Raas"]);
  const [selectedRaas, setSelectedRaas] = useState("All Raas");
  const [allChains, setAllChains] = useState([]);
  const [transactionsByChainDate, setTransactionsByChainDate] = useState({});
  const [tvlDataByChainDate, setTvlDataByChainDate] = useState({});
  const [activeAccountsByChainDate, setActiveAccountsByChainDate] = useState(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data for charts
  const [chainsByVerticalData, setChainsByVerticalData] = useState({});
  const [transactionCountByVerticalData, setTransactionCountByVerticalData] =
    useState({});
  const [tvlByVerticalData, setTvlByVerticalData] = useState({});
  const [frameworkCounts, setFrameworkCounts] = useState({});
  const [daCounts, setDaCounts] = useState({});
  const [l2L3Counts, setL2L3Counts] = useState({});
  const [frameworkByVerticalData, setFrameworkByVerticalData] = useState({});
  const [daByVerticalData, setDaByVerticalData] = useState({});
  const [l2L3ByVerticalData, setL2L3ByVerticalData] = useState({});

  // Table Data
  const [tableData, setTableData] = useState([]);

  // State variables for filters and toggles
  const [tableFilter, setTableFilter] = useState("Transaction Count");
  const [showPercentageTransactionCount, setShowPercentageTransactionCount] =
    useState(false);
  const [showPercentageTvl, setShowPercentageTvl] = useState(false);

  // Define RaasDropdown inside component
  const RaasDropdown = ({ options, selected, onChange }) => {
    return (
      <select
        className="raas-dropdown-select"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        aria-label="RaaS Dropdown"
      >
        {options.map((raas) => (
          <option key={raas} value={raas}>
            {raas}
          </option>
        ))}
      </select>
    );
  };

  // Fetch and cache data on component mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Retrieve data from IndexedDB
        const storedRecord = await getData(ECOSYSTEM_DATA_ID);
        const sixHoursAgo = Date.now() - SIX_HOURS_IN_MS;

        if (storedRecord && storedRecord.timestamp > sixHoursAgo) {
          // Use stored data if it's less than 6 hours old
          console.log("📦 Using cached data from IndexedDB.");
          populateStateWithData(storedRecord.data);
          setLoading(false);
          return;
        }

        console.log("🚀 Fetching new data from Google Sheets and APIs...");
        // Fetch new data
        const sheetData = await fetchGoogleSheetData();
        const transactionsData = await fetchAllTransactions(sheetData);
        const tvlData = await fetchAllTvlData(sheetData);
        const activeAccountsData = await fetchAllActiveAccounts(sheetData);

        const newData = {
          sheetData,
          transactionsData,
          tvlData,
          activeAccountsData,
        };

        // Save new data with timestamp to IndexedDB
        await saveData(ECOSYSTEM_DATA_ID, newData);

        populateStateWithData(newData);
      } catch (err) {
        console.error("❌ Error fetching data:", err);
        setError(`Failed to load ecosystem data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Function to populate state with fetched data
  const populateStateWithData = (data) => {
    const { sheetData, transactionsData, tvlData, activeAccountsData } = data;

    // Filter chains with status "Mainnet"
    const mainnetChains = sheetData.filter(
      (chain) => chain.status && chain.status.trim().toLowerCase() === "mainnet"
    );

    setAllChains(mainnetChains);

    // Corrected data assignments
    setTransactionsByChainDate(transactionsData.transactionsByChain);
    setTvlDataByChainDate(tvlData.tvlDataByChainDate);
    setActiveAccountsByChainDate(activeAccountsData.activeAccountsByChainDate);

    // Set RaaS Options
    const uniqueRaas = [
      "All Raas",
      ...new Set(
        mainnetChains
          .map((chain) => chain.raas)
          .filter((raas) => raas && raas.trim() !== "")
          .map((raas) => raas.trim())
      ),
    ];
    setRaasOptions(uniqueRaas);
  };

  // Process data whenever relevant state changes
  useEffect(() => {
    if (!loading && allChains.length) {
      processChartsData();
      processTableData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loading,
    allChains,
    transactionsByChainDate,
    tvlDataByChainDate,
    activeAccountsByChainDate,
    selectedRaas,
    tableFilter,
  ]);

  // Function to process data for charts
  const processChartsData = () => {
    // Filter chains based on selected RaaS
    const filteredChains =
      selectedRaas === "All Raas"
        ? allChains
        : allChains.filter(
            (chain) =>
              chain.raas &&
              chain.raas.toLowerCase() === selectedRaas.toLowerCase()
          );

    // 1. Chains by Vertical
    const chainsByVertical = {};
    filteredChains.forEach((chain) => {
      const vertical = chain.vertical || "Unknown";
      if (!chainsByVertical[vertical]) {
        chainsByVertical[vertical] = 0;
      }
      chainsByVertical[vertical] += 1;
    });
    setChainsByVerticalData(chainsByVertical);

    // 2. Transaction Count by Vertical
    const transactionCountByVertical = {};
    filteredChains.forEach((chain) => {
      const vertical = chain.vertical || "Unknown";
      const transactions = transactionsByChainDate[chain.name] || {};
      const totalTransactions = Object.values(transactions).reduce(
        (acc, curr) => acc + curr,
        0
      );
      if (!transactionCountByVertical[vertical]) {
        transactionCountByVertical[vertical] = 0;
      }
      transactionCountByVertical[vertical] += totalTransactions;
    });
    setTransactionCountByVerticalData(transactionCountByVertical);

    // 3. TVL by Vertical
    const tvlByVertical = {};
    filteredChains.forEach((chain) => {
      const vertical = chain.vertical || "Unknown";
      const tvlData = tvlDataByChainDate[chain.name] || {};
      const latestDate = Object.keys(tvlData).sort().pop(); // Get the latest date
      const latestTvl = latestDate ? tvlData[latestDate].totalTvl : 0;
      if (!tvlByVertical[vertical]) {
        tvlByVertical[vertical] = 0;
      }
      tvlByVertical[vertical] += latestTvl;
    });
    setTvlByVerticalData(tvlByVertical);

    // Framework Counts and By Vertical
    const frameworkCountsLocal = {};
    const frameworkByVerticalLocal = {};
    filteredChains.forEach((chain) => {
      const framework = chain.framework || "Unknown";
      const vertical = chain.vertical || "Unknown";

      // Framework Counts
      if (!frameworkCountsLocal[framework]) {
        frameworkCountsLocal[framework] = 0;
      }
      frameworkCountsLocal[framework] += 1;

      // Framework by Vertical
      if (!frameworkByVerticalLocal[vertical]) {
        frameworkByVerticalLocal[vertical] = {};
      }
      if (!frameworkByVerticalLocal[vertical][framework]) {
        frameworkByVerticalLocal[vertical][framework] = {
          count: 0,
          chains: [],
        };
      }
      frameworkByVerticalLocal[vertical][framework].count += 1;
      frameworkByVerticalLocal[vertical][framework].chains.push(chain.name);
    });
    setFrameworkCounts(frameworkCountsLocal);
    setFrameworkByVerticalData(frameworkByVerticalLocal);

    // DA Counts and By Vertical
    const daCountsLocal = {};
    const daByVerticalLocal = {};
    filteredChains.forEach((chain) => {
      const da = chain.da || "Unknown";
      const vertical = chain.vertical || "Unknown";

      // DA Counts
      if (!daCountsLocal[da]) {
        daCountsLocal[da] = 0;
      }
      daCountsLocal[da] += 1;

      // DA by Vertical
      if (!daByVerticalLocal[vertical]) {
        daByVerticalLocal[vertical] = {};
      }
      if (!daByVerticalLocal[vertical][da]) {
        daByVerticalLocal[vertical][da] = {
          count: 0,
          chains: [],
        };
      }
      daByVerticalLocal[vertical][da].count += 1;
      daByVerticalLocal[vertical][da].chains.push(chain.name);
    });
    setDaCounts(daCountsLocal);
    setDaByVerticalData(daByVerticalLocal);

    // L2/L3 Counts and By Vertical
    const l2L3CountsLocal = {};
    const l2L3ByVerticalLocal = {};
    filteredChains.forEach((chain) => {
      const l2L3 = chain.l2OrL3 || "Unknown";
      const vertical = chain.vertical || "Unknown";

      // L2/L3 Counts
      if (!l2L3CountsLocal[l2L3]) {
        l2L3CountsLocal[l2L3] = 0;
      }
      l2L3CountsLocal[l2L3] += 1;

      // L2/L3 by Vertical
      if (!l2L3ByVerticalLocal[vertical]) {
        l2L3ByVerticalLocal[vertical] = {};
      }
      if (!l2L3ByVerticalLocal[vertical][l2L3]) {
        l2L3ByVerticalLocal[vertical][l2L3] = {
          count: 0,
          chains: [],
        };
      }
      l2L3ByVerticalLocal[vertical][l2L3].count += 1;
      l2L3ByVerticalLocal[vertical][l2L3].chains.push(chain.name);
    });
    setL2L3Counts(l2L3CountsLocal);
    setL2L3ByVerticalData(l2L3ByVerticalLocal);
  };

  // Function to process data for the table
  const processTableData = () => {
    // Aggregate data per vertical
    const verticalData = {};

    allChains.forEach((chain) => {
      if (
        selectedRaas !== "All Raas" &&
        (!chain.raas || chain.raas.toLowerCase() !== selectedRaas.toLowerCase())
      ) {
        return;
      }

      const vertical = chain.vertical || "Unknown";
      if (!verticalData[vertical]) {
        verticalData[vertical] = {
          count: 0,
          topChains: [],
        };
      }

      verticalData[vertical].count += 1;

      // Calculate metric based on selected filter
      let metricValue = 0;
      if (tableFilter === "Transaction Count") {
        const transactions = transactionsByChainDate[chain.name] || {};
        const totalTransactions = Object.values(transactions).reduce(
          (acc, curr) => acc + curr,
          0
        );
        metricValue = totalTransactions;
      } else if (tableFilter === "TVL") {
        const tvlData = tvlDataByChainDate[chain.name] || {};
        const latestDate = Object.keys(tvlData).sort().pop();
        metricValue = latestDate ? tvlData[latestDate].totalTvl : 0;
      }

      verticalData[vertical].topChains.push({
        name: chain.name,
        logoUrl: chain.logoUrl,
        metricValue,
      });
    });

    // Determine top 10 chains by metric per vertical
    Object.keys(verticalData).forEach((vertical) => {
      verticalData[vertical].topChains.sort(
        (a, b) => b.metricValue - a.metricValue
      );
      verticalData[vertical].topChains = verticalData[vertical].topChains.slice(
        0,
        10
      );
    });

    // Prepare table data
    const tableDataLocal = Object.keys(verticalData).map((vertical) => {
      const data = verticalData[vertical];
      return {
        vertical,
        count: data.count,
        topChains: data.topChains,
      };
    });

    // Sort table data by count descending
    tableDataLocal.sort((a, b) => b.count - a.count);

    setTableData(tableDataLocal);
  };

  // Generate chart options
  const generateChartOptions = (
    title,
    isPieChart = false,
    showPercentage = false,
    legendPosition = "top"
  ) => ({
    responsive: true,
    maintainAspectRatio: true, // Maintain aspect ratio for all charts
    plugins: {
      legend: {
        display: true, // Ensure legends are displayed
        position: legendPosition,
        labels: {
          color: "#FFFFFF",
          // Adjust font size or other properties if needed
        },
      },
      title: {
        display: true,
        text: title,
        color: "#FFFFFF",
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            let label = "";
            if (context.chart.data.labels) {
              label = context.chart.data.labels[context.dataIndex] || "";
            }

            let value;
            if (isPieChart) {
              value = context.parsed;
            } else {
              value =
                context.parsed && context.parsed.y !== undefined
                  ? context.parsed.y
                  : context.parsed;
            }

            let percentage;

            if (isPieChart) {
              const totalPie = context.dataset.data.reduce(
                (acc, val) => acc + val,
                0
              );
              percentage = ((value / totalPie) * 100).toFixed(2);
              return `${label}: ${percentage}% (${abbreviateNumber(value, 2)})`;
            } else {
              const total = context.dataset.data.reduce(
                (acc, val) => acc + val,
                0
              );
              percentage = ((value / total) * 100).toFixed(2);
              const meta = context.dataset.meta
                ? context.dataset.meta[context.dataIndex]
                : [];
              let tooltipLines = [`${label}: ${abbreviateNumber(value, 2)}`];
              if (meta && meta.length) {
                tooltipLines.push("Chains:");
                tooltipLines = tooltipLines.concat(meta);
              }
              return tooltipLines;
            }
          },
        },
        backgroundColor: "rgba(0,0,0,0.7)",
        titleColor: "#FFFFFF",
        bodyColor: "#FFFFFF",
      },
    },
    scales: isPieChart
      ? {} // No scales for pie charts
      : {
          x: {
            stacked: true,
            ticks: { color: "#FFFFFF" },
            grid: { display: true },
          },
          y: {
            stacked: true,
            ticks: {
              color: "#FFFFFF",
              callback: function (value) {
                if (showPercentage) {
                  return value + "%";
                } else {
                  return abbreviateNumber(value, 2);
                }
              },
            },
            grid: { display: true },
          },
        },
  });

  // Utility function to get color by index
  const getColorByIndex = (index) => {
    const COLORS = [
      "#FF6384",
      "#36A2EB",
      "#FFCE56",
      "#4BC0C0",
      "#9966FF",
      "#FF9F40",
      "#C9CBCF",
      "#E7E9ED",
      "#7CB342",
      "#D32F2F",
      "#F06292",
      "#BA68C8",
      "#4DD0E1",
      "#9575CD",
      "#7986CB",
      "#81C784",
      "#AED581",
      "#FF8A65",
      "#A1887F",
      "#90A4AE",
      // Add more colors if needed
    ];
    return COLORS[index % COLORS.length];
  };

  // Generate data for each chart
  const getChainsByVerticalChartData = () => {
    const labels = Object.keys(chainsByVerticalData);
    const data = Object.values(chainsByVerticalData);
    return {
      labels,
      datasets: [
        {
          label: "Number of Chains",
          data,
          backgroundColor: labels.map((_, idx) => getColorByIndex(idx)),
        },
      ],
    };
  };

  const getTransactionCountByVerticalChartData = (showPercentage = false) => {
    const labels = Object.keys(transactionCountByVerticalData);
    const dataValues = Object.values(transactionCountByVerticalData);

    let data = dataValues;

    if (showPercentage) {
      const total = dataValues.reduce((acc, val) => acc + val, 0);
      data = dataValues.map((val) => (val / total) * 100);
    }

    return {
      labels,
      datasets: [
        {
          label: showPercentage ? "Transaction Count (%)" : "Transaction Count",
          data,
          backgroundColor: labels.map((_, idx) => getColorByIndex(idx)),
        },
      ],
    };
  };

  const getTvlByVerticalChartData = (showPercentage = false) => {
    const labels = Object.keys(tvlByVerticalData);
    const dataValues = Object.values(tvlByVerticalData);

    let data = dataValues;

    if (showPercentage) {
      const total = dataValues.reduce((acc, val) => acc + val, 0);
      data = dataValues.map((val) => (val / total) * 100);
    }

    return {
      labels,
      datasets: [
        {
          label: showPercentage ? "TVL (%)" : "Total Value Locked (TVL)",
          data,
          backgroundColor: labels.map((_, idx) => getColorByIndex(idx)),
        },
      ],
    };
  };

  // Framework Charts Data
  const getFrameworkByVerticalChartData = () => {
    const labels = Object.keys(frameworkByVerticalData);
    const frameworksSet = new Set();
    labels.forEach((vertical) => {
      Object.keys(frameworkByVerticalData[vertical]).forEach((framework) =>
        frameworksSet.add(framework)
      );
    });
    const frameworks = Array.from(frameworksSet);

    const datasets = frameworks.map((framework, idx) => {
      const data = labels.map((vertical) => {
        const entry = frameworkByVerticalData[vertical][framework];
        return entry ? entry.count : 0;
      });
      const meta = labels.map((vertical) => {
        const entry = frameworkByVerticalData[vertical][framework];
        return entry ? entry.chains : [];
      });
      return {
        label: framework,
        data,
        meta, // Store chains separately
        backgroundColor: getColorByIndex(idx),
      };
    });

    return {
      labels,
      datasets,
    };
  };

  const getFrameworkShareChartData = () => {
    const labels = Object.keys(frameworkCounts);
    const data = Object.values(frameworkCounts);

    return {
      labels,
      datasets: [
        {
          label: "Frameworks Share",
          data,
          backgroundColor: labels.map((_, idx) => getColorByIndex(idx)),
        },
      ],
    };
  };

  // DA Charts Data
  const getDaByVerticalChartData = () => {
    const labels = Object.keys(daByVerticalData);
    const daSet = new Set();
    labels.forEach((vertical) => {
      Object.keys(daByVerticalData[vertical]).forEach((da) => daSet.add(da));
    });
    const daProviders = Array.from(daSet);

    const datasets = daProviders.map((daProvider, idx) => {
      const data = labels.map((vertical) => {
        const entry = daByVerticalData[vertical][daProvider];
        return entry ? entry.count : 0;
      });
      const meta = labels.map((vertical) => {
        const entry = daByVerticalData[vertical][daProvider];
        return entry ? entry.chains : [];
      });
      return {
        label: daProvider,
        data,
        meta, // Store chains separately
        backgroundColor: getColorByIndex(idx),
      };
    });

    return {
      labels,
      datasets,
    };
  };

  const getDaShareChartData = () => {
    const labels = Object.keys(daCounts);
    const data = Object.values(daCounts);

    return {
      labels,
      datasets: [
        {
          label: "DA Share",
          data,
          backgroundColor: labels.map((_, idx) => getColorByIndex(idx)),
        },
      ],
    };
  };

  // L2/L3 Charts Data
  const getL2L3ByVerticalChartData = () => {
    const labels = Object.keys(l2L3ByVerticalData);
    const l2L3Set = new Set();
    labels.forEach((vertical) => {
      Object.keys(l2L3ByVerticalData[vertical]).forEach((l2L3) =>
        l2L3Set.add(l2L3)
      );
    });
    const l2L3Types = Array.from(l2L3Set);

    const datasets = l2L3Types.map((l2L3, idx) => {
      const data = labels.map((vertical) => {
        const entry = l2L3ByVerticalData[vertical][l2L3];
        return entry ? entry.count : 0;
      });
      const meta = labels.map((vertical) => {
        const entry = l2L3ByVerticalData[vertical][l2L3];
        return entry ? entry.chains : [];
      });
      return {
        label: l2L3,
        data,
        meta, // Store chains separately
        backgroundColor: getColorByIndex(idx),
      };
    });

    return {
      labels,
      datasets,
    };
  };

  const getL2L3ShareChartData = () => {
    const labels = Object.keys(l2L3Counts);
    const data = Object.values(l2L3Counts);

    return {
      labels,
      datasets: [
        {
          label: "L2/L3 Share",
          data,
          backgroundColor: labels.map((_, idx) => getColorByIndex(idx)),
        },
      ],
    };
  };

  // Function to handle RaaS selection
  const handleRaasChange = (value) => {
    setSelectedRaas(value);
  };

  return (
    <div className="ecosystem-page">
      <Sidebar />
      <div className="main-content">
        {/* Header */}
        <div className="ecosystem-header">
          <div className="heading-container">
            <FontAwesomeIcon icon={faChartPie} className="icon" />
            <div>
              <h2>Ecosystem Overview</h2>
              <p className="description">
                Explore the distribution and performance of various chains
                across different verticals within the ecosystem.
              </p>
            </div>
          </div>

          {/* RaaS Dropdown */}
          <div className="raas-dropdown">
            <RaasDropdown
              options={raasOptions}
              selected={selectedRaas}
              onChange={handleRaasChange}
            />
          </div>
        </div>

        {/* Error Message */}
        {error && <div className="error-message">{error}</div>}

        {/* Loading Indicator */}
        {loading && <div className="loading">Loading ecosystem data...</div>}

        {/* Main Content */}
        {!loading && !error && (
          <>
            <div className="ecosystem-content">
              {/* Left Side: Table */}
              <div className="left-section">
                <div className="table-card">
                  <div className="table-header">
                    <h3>Verticals Overview</h3>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Vertical</th>
                        <th>
                          <div className="table-header-with-filter">
                            <span>Top Chains (by {tableFilter})</span>
                            <div className="table-filter-section">
                              <span>Filter by:</span>
                              <select
                                value={tableFilter}
                                onChange={(e) => setTableFilter(e.target.value)}
                                className="table-filter-select"
                              >
                                <option value="Transaction Count">
                                  Transaction Count
                                </option>
                                <option value="TVL">TVL</option>
                              </select>
                            </div>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.map((row) => (
                        <tr key={row.vertical}>
                          <td>
                            <div className="vertical-name">
                              <span className="name">{row.vertical}</span>
                              <span className="count">({row.count})</span>
                            </div>
                          </td>
                          <td>
                            <div className="top-chains">
                              {row.topChains.map((chain) => (
                                <div
                                  key={chain.name}
                                  className="chain-logo-container"
                                  data-chain-name={chain.name}
                                  data-metric-value={abbreviateNumber(
                                    chain.metricValue,
                                    2
                                  )}
                                  data-metric-type={tableFilter}
                                >
                                  <img
                                    src={chain.logoUrl}
                                    alt={chain.name}
                                    className="chain-logo"
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.src =
                                        "https://www.helika.io/wp-content/uploads/2023/09/proofofplay_logo.png";
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Side: Chains by Vertical Pie Chart */}
              <div className="right-section">
                <div className="chart-card chains-by-vertical-chart">
                  <h3>Chains by Vertical</h3>
                  <Pie
                    data={getChainsByVerticalChartData()}
                    options={generateChartOptions(
                      "Chains by Vertical",
                      true,
                      false,
                      "bottom" // Position legend at the bottom
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="charts-section">
              {/* Transaction Count and TVL Charts */}
              <div className="charts-row">
                {/* Transaction Count by Vertical */}
                <div className="chart-card bar-chart-card half-width">
                  <div className="chart-header">
                    <h3>Transaction Count by Vertical</h3>
                    <div className="toggle-percentage">
                      <label>
                        <input
                          type="checkbox"
                          checked={showPercentageTransactionCount}
                          onChange={(e) =>
                            setShowPercentageTransactionCount(e.target.checked)
                          }
                        />
                        Show Percentage
                      </label>
                    </div>
                  </div>
                  <Bar
                    data={getTransactionCountByVerticalChartData(
                      showPercentageTransactionCount
                    )}
                    options={generateChartOptions(
                      "Transaction Count by Vertical",
                      false,
                      showPercentageTransactionCount
                    )}
                    height={300} // Added height prop
                  />
                </div>

                {/* TVL by Vertical */}
                <div className="chart-card bar-chart-card half-width">
                  <div className="chart-header">
                    <h3>TVL by Vertical</h3>
                    <div className="toggle-percentage">
                      <label>
                        <input
                          type="checkbox"
                          checked={showPercentageTvl}
                          onChange={(e) =>
                            setShowPercentageTvl(e.target.checked)
                          }
                        />
                        Show Percentage
                      </label>
                    </div>
                  </div>
                  <Bar
                    data={getTvlByVerticalChartData(showPercentageTvl)}
                    options={generateChartOptions(
                      "TVL by Vertical",
                      false,
                      showPercentageTvl
                    )}
                    height={300} // Added height prop
                  />
                </div>
              </div>

              {/* Framework Charts */}
              <div className="charts-row">
                <div className="chart-card half-width">
                  <h3>Framework by Vertical</h3>
                  <Bar
                    data={getFrameworkByVerticalChartData()}
                    options={generateChartOptions(
                      "Framework by Vertical",
                      false
                    )}
                    height={300} // Added height prop
                  />
                </div>
                <div className="chart-card half-width">
                  <h3>Frameworks Share</h3>
                  <Pie
                    data={getFrameworkShareChartData()}
                    options={generateChartOptions("Frameworks Share", true)}
                  />
                </div>
              </div>

              {/* DA Charts */}
              <div className="charts-row">
                <div className="chart-card half-width">
                  <h3>DA by Vertical</h3>
                  <Bar
                    data={getDaByVerticalChartData()}
                    options={generateChartOptions("DA by Vertical", false)}
                    height={300} // Added height prop
                  />
                </div>
                <div className="chart-card half-width">
                  <h3>DA Share</h3>
                  <Pie
                    data={getDaShareChartData()}
                    options={generateChartOptions("DA Share", true)}
                  />
                </div>
              </div>

              {/* L2/L3 Charts */}
              <div className="charts-row">
                <div className="chart-card half-width">
                  <h3>L2/L3 by Vertical</h3>
                  <Bar
                    data={getL2L3ByVerticalChartData()}
                    options={generateChartOptions("L2/L3 by Vertical", false)}
                    height={300} // Added height prop
                  />
                </div>
                <div className="chart-card half-width">
                  <h3>L2/L3 Share</h3>
                  <Pie
                    data={getL2L3ShareChartData()}
                    options={generateChartOptions("L2/L3 Share", true)}
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

export default EcosystemPage;
