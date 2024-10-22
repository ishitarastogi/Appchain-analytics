/* src/pages/FrameworkPage.js */

import React, { useState, useEffect } from "react";
import Sidebar from "../Sidebar/Sidebar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChartPie } from "@fortawesome/free-solid-svg-icons";
import "./FrameworkPage.css";
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

const FRAMEWORK_DATA_ID = "frameworkData"; // Unique ID for IndexedDB
const SIX_HOURS_IN_MS = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

const FrameworkPage = () => {
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
  const [chainsByFrameworkData, setChainsByFrameworkData] = useState({});
  const [transactionCountByFrameworkData, setTransactionCountByFrameworkData] =
    useState({});
  const [tvlByFrameworkData, setTvlByFrameworkData] = useState({});
  const [frameworkCounts, setFrameworkCounts] = useState({});
  const [daCounts, setDaCounts] = useState({});
  const [l2L3Counts, setL2L3Counts] = useState({});
  const [daByFrameworkData, setDaByFrameworkData] = useState({});
  const [l2L3ByFrameworkData, setL2L3ByFrameworkData] = useState({});

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
        const storedRecord = await getData(FRAMEWORK_DATA_ID);
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
        await saveData(FRAMEWORK_DATA_ID, newData);

        populateStateWithData(newData);
      } catch (err) {
        console.error("❌ Error fetching data:", err);
        setError(`Failed to load framework data: ${err.message}`);
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

    // 1. Chains by Framework
    const chainsByFramework = {};
    filteredChains.forEach((chain) => {
      const framework = chain.framework || "Unknown";
      if (!chainsByFramework[framework]) {
        chainsByFramework[framework] = 0;
      }
      chainsByFramework[framework] += 1;
    });
    setChainsByFrameworkData(chainsByFramework);

    // 2. Transaction Count by Framework
    const transactionCountByFramework = {};
    filteredChains.forEach((chain) => {
      const framework = chain.framework || "Unknown";
      const transactions = transactionsByChainDate[chain.name] || {};
      const totalTransactions = Object.values(transactions).reduce(
        (acc, curr) => acc + curr,
        0
      );
      if (!transactionCountByFramework[framework]) {
        transactionCountByFramework[framework] = 0;
      }
      transactionCountByFramework[framework] += totalTransactions;
    });
    setTransactionCountByFrameworkData(transactionCountByFramework);

    // 3. TVL by Framework
    const tvlByFramework = {};
    filteredChains.forEach((chain) => {
      const framework = chain.framework || "Unknown";
      const tvlData = tvlDataByChainDate[chain.name] || {};
      const latestDate = Object.keys(tvlData).sort().pop(); // Get the latest date
      const latestTvl = latestDate ? tvlData[latestDate].totalTvl : 0;
      if (!tvlByFramework[framework]) {
        tvlByFramework[framework] = 0;
      }
      tvlByFramework[framework] += latestTvl;
    });
    setTvlByFrameworkData(tvlByFramework);

    // DA Counts and By Framework
    const daCountsLocal = {};
    const daByFrameworkLocal = {};
    filteredChains.forEach((chain) => {
      const da = chain.da || "Unknown";
      const framework = chain.framework || "Unknown";

      // DA Counts
      if (!daCountsLocal[da]) {
        daCountsLocal[da] = 0;
      }
      daCountsLocal[da] += 1;

      // DA by Framework
      if (!daByFrameworkLocal[framework]) {
        daByFrameworkLocal[framework] = {};
      }
      if (!daByFrameworkLocal[framework][da]) {
        daByFrameworkLocal[framework][da] = {
          count: 0,
          chains: [],
        };
      }
      daByFrameworkLocal[framework][da].count += 1;
      daByFrameworkLocal[framework][da].chains.push(chain.name);
    });
    setDaCounts(daCountsLocal);
    setDaByFrameworkData(daByFrameworkLocal);

    // L2/L3 Counts and By Framework
    const l2L3CountsLocal = {};
    const l2L3ByFrameworkLocal = {};
    filteredChains.forEach((chain) => {
      const l2L3 = chain.l2OrL3 || "Unknown";
      const framework = chain.framework || "Unknown";

      // L2/L3 Counts
      if (!l2L3CountsLocal[l2L3]) {
        l2L3CountsLocal[l2L3] = 0;
      }
      l2L3CountsLocal[l2L3] += 1;

      // L2/L3 by Framework
      if (!l2L3ByFrameworkLocal[framework]) {
        l2L3ByFrameworkLocal[framework] = {};
      }
      if (!l2L3ByFrameworkLocal[framework][l2L3]) {
        l2L3ByFrameworkLocal[framework][l2L3] = {
          count: 0,
          chains: [],
        };
      }
      l2L3ByFrameworkLocal[framework][l2L3].count += 1;
      l2L3ByFrameworkLocal[framework][l2L3].chains.push(chain.name);
    });
    setL2L3Counts(l2L3CountsLocal);
    setL2L3ByFrameworkData(l2L3ByFrameworkLocal);
  };

  // Function to process data for the table
  const processTableData = () => {
    // Aggregate data per framework
    const frameworkData = {};

    allChains.forEach((chain) => {
      if (
        selectedRaas !== "All Raas" &&
        (!chain.raas || chain.raas.toLowerCase() !== selectedRaas.toLowerCase())
      ) {
        return;
      }

      const framework = chain.framework || "Unknown";
      if (!frameworkData[framework]) {
        frameworkData[framework] = {
          count: 0,
          topChains: [],
        };
      }

      frameworkData[framework].count += 1;

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

      frameworkData[framework].topChains.push({
        name: chain.name,
        logoUrl: chain.logoUrl,
        metricValue,
      });
    });

    // Determine top 10 chains by metric per framework
    Object.keys(frameworkData).forEach((framework) => {
      frameworkData[framework].topChains.sort(
        (a, b) => b.metricValue - a.metricValue
      );
      frameworkData[framework].topChains = frameworkData[
        framework
      ].topChains.slice(0, 10);
    });

    // Prepare table data
    const tableDataLocal = Object.keys(frameworkData).map((framework) => {
      const data = frameworkData[framework];
      return {
        framework,
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
  const getChainsByFrameworkChartData = () => {
    const labels = Object.keys(chainsByFrameworkData);
    const data = Object.values(chainsByFrameworkData);
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

  const getTransactionCountByFrameworkChartData = (showPercentage = false) => {
    const labels = Object.keys(transactionCountByFrameworkData);
    const dataValues = Object.values(transactionCountByFrameworkData);

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

  const getTvlByFrameworkChartData = (showPercentage = false) => {
    const labels = Object.keys(tvlByFrameworkData);
    const dataValues = Object.values(tvlByFrameworkData);

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

  // DA Charts Data
  const getDaByFrameworkChartData = () => {
    const labels = Object.keys(daByFrameworkData);
    const daSet = new Set();
    labels.forEach((framework) => {
      Object.keys(daByFrameworkData[framework]).forEach((da) => daSet.add(da));
    });
    const daProviders = Array.from(daSet);

    const datasets = daProviders.map((daProvider, idx) => {
      const data = labels.map((framework) => {
        const entry = daByFrameworkData[framework][daProvider];
        return entry ? entry.count : 0;
      });
      const meta = labels.map((framework) => {
        const entry = daByFrameworkData[framework][daProvider];
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
  const getL2L3ByFrameworkChartData = () => {
    const labels = Object.keys(l2L3ByFrameworkData);
    const l2L3Set = new Set();
    labels.forEach((framework) => {
      Object.keys(l2L3ByFrameworkData[framework]).forEach((l2L3) =>
        l2L3Set.add(l2L3)
      );
    });
    const l2L3Types = Array.from(l2L3Set);

    const datasets = l2L3Types.map((l2L3, idx) => {
      const data = labels.map((framework) => {
        const entry = l2L3ByFrameworkData[framework][l2L3];
        return entry ? entry.count : 0;
      });
      const meta = labels.map((framework) => {
        const entry = l2L3ByFrameworkData[framework][l2L3];
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

  // Frameworks Share Pie Chart Data
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

  return (
    <div className="framework-page">
      <Sidebar />
      <div className="main-content">
        {/* Header */}
        <div className="framework-header">
          <div className="heading-container">
            <FontAwesomeIcon icon={faChartPie} className="icon" />
            <div>
              <h2>Frameworks Overview</h2>
              <p className="description">
                Explore the distribution and performance of various chains
                across different frameworks within the ecosystem.
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
        {loading && <div className="loading">Loading framework data...</div>}

        {/* Main Content */}
        {!loading && !error && (
          <>
            <div className="framework-content">
              {/* Left Side: Table */}
              <div className="left-section">
                <div className="table-card">
                  <div className="table-header">
                    <h3>Frameworks Overview</h3>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Framework</th>
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
                        <tr key={row.framework}>
                          <td>
                            <div className="framework-name">
                              <span className="name">{row.framework}</span>
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

              {/* Right Side: Chains by Framework Pie Chart */}
              <div className="right-section">
                <div className="chart-card chains-by-framework-chart">
                  <h3>Chains by Framework</h3>
                  <Pie
                    data={getChainsByFrameworkChartData()}
                    options={generateChartOptions(
                      "Chains by Framework",
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
                {/* Transaction Count by Framework */}
                <div className="chart-card bar-chart-card half-width">
                  <div className="chart-header">
                    <h3>Transaction Count by Framework</h3>
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
                    data={getTransactionCountByFrameworkChartData(
                      showPercentageTransactionCount
                    )}
                    options={generateChartOptions(
                      "Transaction Count by Framework",
                      false,
                      showPercentageTransactionCount
                    )}
                    height={300} // Optional: Adjust height as needed
                  />
                </div>

                {/* TVL by Framework */}
                <div className="chart-card bar-chart-card half-width">
                  <div className="chart-header">
                    <h3>TVL by Framework</h3>
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
                    data={getTvlByFrameworkChartData(showPercentageTvl)}
                    options={generateChartOptions(
                      "TVL by Framework",
                      false,
                      showPercentageTvl
                    )}
                    height={300} // Optional: Adjust height as needed
                  />
                </div>
              </div>

              {/* DA Charts */}
              <div className="charts-row">
                <div className="chart-card half-width">
                  <h3>DA by Framework</h3>
                  <Bar
                    data={getDaByFrameworkChartData()}
                    options={generateChartOptions("DA by Framework", false)}
                    height={300} // Optional: Adjust height as needed
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
                  <h3>L2/L3 by Framework</h3>
                  <Bar
                    data={getL2L3ByFrameworkChartData()}
                    options={generateChartOptions("L2/L3 by Framework", false)}
                    height={300} // Optional: Adjust height as needed
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

              {/* Frameworks Share Charts */}
              <div className="charts-row">
                <div className="chart-card half-width">
                  <h3>Frameworks Share</h3>
                  <Pie
                    data={getFrameworkShareChartData()}
                    options={generateChartOptions("Frameworks Share", true)}
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

export default FrameworkPage;
