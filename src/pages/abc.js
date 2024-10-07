import React, { useState, useEffect } from "react";
import Sidebar from "../Sidebar/Sidebar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTachometerAlt } from "@fortawesome/free-solid-svg-icons";
import "./ActiveAccountsPage.css";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  TimeScale,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import "chartjs-adapter-moment";
import {
  fetchGoogleSheetData,
  fetchAllTpsData,
} from "../services/googleTPSService";
import { saveData, getData, clearAllData } from "../services/indexedDBService";
import moment from "moment";

ChartJS.register(
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  TimeScale,
  Title,
  Tooltip,
  Legend
);

const TpssPage = () => {
  const [gelatoChains, setGelatoChains] = useState([]);
  const [tpsData, setTpsData] = useState({});
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [],
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("Monthly");
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const storedData = await getData("tpsData");
      const now = Date.now();
      let newData;

      if (
        storedData &&
        now - storedData.timestamp < 6 * 60 * 60 * 1000 &&
        !forceRefresh
      ) {
        newData = storedData.data;
        setLastUpdated(new Date(storedData.timestamp));
      } else {
        const sheetData = await fetchGoogleSheetData();
        newData = {
          gelatoChains: sheetData.filter(
            (chain) => chain.raas && chain.raas.toLowerCase() === "gelato"
          ),
          tpsData: await fetchAllTpsData(sheetData),
        };
        await saveData("tpsData", newData);
        setLastUpdated(new Date());
      }

      setGelatoChains(newData.gelatoChains);
      setTpsData(newData.tpsData);
      populateChartData(newData.tpsData);
    } catch (error) {
      console.error("Error during data fetching:", error);
      setError("Failed to load data. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
  };

  const handleRefreshData = async () => {
    await clearAllData();
    fetchData(true);
  };

  const filterDataByTimeRange = (data, applyToChart = true) => {
    const now = moment();
    let startDate;

    switch (timeRange) {
      case "Daily":
        startDate = now.clone().startOf("day");
        break;
      case "Monthly":
        startDate = now.clone().subtract(1, "month");
        break;
      case "FourMonths":
        startDate = now.clone().subtract(4, "months");
        break;
      case "SixMonths":
        startDate = now.clone().subtract(6, "months");
        break;
      case "All":
      default:
        startDate = moment(0);
    }

    if (timeRange === "Daily" && !applyToChart) {
      startDate = moment(0);
    }

    return data.filter((item) =>
      moment(item.timestamp * 1000).isAfter(startDate)
    );
  };

  const populateChartData = (allTpsData) => {
    const chainAverages = Object.entries(allTpsData).map(
      ([chainName, tpsArray]) => {
        const filteredData = filterDataByTimeRange(tpsArray, false);
        const averageTps =
          filteredData.reduce((sum, item) => sum + item.tps, 0) /
            filteredData.length || 0;
        return { chainName, averageTps };
      }
    );

    const topChains = chainAverages
      .sort((a, b) => b.averageTps - a.averageTps)
      .slice(0, 10)
      .map((item) => item.chainName);

    const datasets = [];
    let labelsSet = new Set();

    topChains.forEach((chainName) => {
      const tpsArray = allTpsData[chainName];
      const filteredData = filterDataByTimeRange(tpsArray, false);
      const data = filteredData.map((item) => ({
        x: new Date(item.timestamp * 1000),
        y: item.tps,
      }));

      data.forEach((item) => labelsSet.add(item.x));

      datasets.push({
        label: chainName,
        data: data,
        borderColor: getColorForChain(chainName),
        fill: false,
        tension: 0.1,
      });
    });

    const labels = Array.from(labelsSet).sort((a, b) => a - b);

    setChartData({
      labels: labels,
      datasets: datasets,
    });
  };

  const getColorForChain = (chainName) => {
    const colorMap = {
      // Add predefined colors if needed
    };
    return (
      colorMap[chainName] ||
      `#${Math.floor(Math.random() * 16777215).toString(16)}`
    );
  };

  const abbreviateNumber = (num) => {
    if (num === undefined || num === null || isNaN(num)) return "0";
    if (num === 0) return "0";

    const absNum = Math.abs(num);
    const sign = Math.sign(num);

    const suffixes = ["", "k", "M", "B", "T"];
    let suffixIndex = 0;
    let shortNumber = absNum;

    while (shortNumber >= 1000 && suffixIndex < suffixes.length - 1) {
      shortNumber /= 1000;
      suffixIndex++;
    }

    if (shortNumber < 1) {
      return (sign * absNum).toFixed(4);
    }

    shortNumber = parseFloat(shortNumber.toPrecision(3));
    return sign * shortNumber + suffixes[suffixIndex];
  };

  if (loading) {
    return <div className="loading">Loading TPS Data...</div>;
  }

  return (
    <div className="tps-page">
      <Sidebar />
      <div className="main-content">
        <div className="transactions-header">
          <div className="heading-container">
            <FontAwesomeIcon icon={faTachometerAlt} className="icon" />
            <h2>Transactions Per Second</h2>
          </div>
          <p className="description">Tracks TPS data for the top 10 chains.</p>
          {lastUpdated && (
            <p className="last-updated">
              Last updated: {moment(lastUpdated).format("YYYY-MM-DD HH:mm")}
            </p>
          )}
          <button className="refresh-button" onClick={handleRefreshData}>
            Refresh Data
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="time-range-selector">
          <div className="left-buttons">
            <button
              className={timeRange === "Daily" ? "active" : ""}
              onClick={() => handleTimeRangeChange("Daily")}
            >
              Daily
            </button>
            <button
              className={timeRange === "Monthly" ? "active" : ""}
              onClick={() => handleTimeRangeChange("Monthly")}
            >
              Monthly
            </button>
          </div>
          <div className="right-buttons">
            <button
              className={timeRange === "FourMonths" ? "active" : ""}
              onClick={() => handleTimeRangeChange("FourMonths")}
            >
              4 Months
            </button>
            <button
              className={timeRange === "SixMonths" ? "active" : ""}
              onClick={() => handleTimeRangeChange("SixMonths")}
            >
              6 Months
            </button>
            <button
              className={timeRange === "All" ? "active" : ""}
              onClick={() => handleTimeRangeChange("All")}
            >
              All
            </button>
          </div>
        </div>

        <div className="table-chart-container">
          <div className="chain-list">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Chain</th>
                  <th>Current TPS</th>
                  <th>Max TPS</th>
                  <th>Vertical</th>
                </tr>
              </thead>
              <tbody>
                {gelatoChains.length > 0 ? (
                  gelatoChains.map((chain) => (
                    <TableRow
                      key={chain.id}
                      chain={chain}
                      tpsData={tpsData}
                      abbreviateNumber={abbreviateNumber}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center" }}>
                      No data available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="line-chart">
            <Line
              data={chartData}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    position: "bottom",
                    labels: {
                      color: "#FFFFFF",
                    },
                  },
                  title: {
                    display: true,
                    text: "TPS Data for Top 10 Chains",
                    color: "#FFFFFF",
                  },
                  tooltip: {
                    callbacks: {
                      label: function (context) {
                        const value = context.parsed.y || 0;
                        return `${context.dataset.label}: ${abbreviateNumber(
                          value
                        )}`;
                      },
                    },
                    backgroundColor: "rgba(0,0,0,0.7)",
                    titleColor: "#FFFFFF",
                    bodyColor: "#FFFFFF",
                  },
                },
                scales: {
                  x: {
                    type: "time",
                    time: {
                      unit: "month",
                      displayFormats: {
                        month: "MMM YYYY",
                      },
                    },
                    title: {
                      display: true,
                      text: "Month",
                      color: "#FFFFFF",
                    },
                    ticks: {
                      color: "#FFFFFF",
                    },
                  },
                  y: {
                    title: {
                      display: true,
                      text: "TPS",
                      color: "#FFFFFF",
                    },
                    ticks: {
                      color: "#FFFFFF",
                      beginAtZero: true,
                      callback: function (value) {
                        return abbreviateNumber(value);
                      },
                    },
                  },
                },
              }}
              height={100}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const TableRow = React.memo(({ chain, tpsData, abbreviateNumber }) => {
  const chainTpsData = tpsData[chain.name] || [];
  const latestTps =
    chainTpsData.length > 0
      ? chainTpsData[chainTpsData.length - 1]?.tps || 0
      : 0;
  const maxTps =
    chainTpsData.length > 0
      ? Math.max(...chainTpsData.map((data) => data.tps || 0), 0)
      : 0;

  return (
    <tr key={chain.id}>
      <td>
        <img
          src={`https://s2.googleusercontent.com/s2/favicons?domain=${chain.blockScoutUrl}&sz=32`}
          alt={`${chain.name} Logo`}
          className="chain-logo"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "/path/to/placeholder/image.png"; // Use a valid placeholder image path
          }}
        />
      </td>
      <td>{chain.name}</td>
      <td>{abbreviateNumber(latestTps)} TPS</td>
      <td>{abbreviateNumber(maxTps)} TPS</td>
      <td>{chain.vertical || "N/A"}</td>
    </tr>
  );
});

export default TpssPage;
