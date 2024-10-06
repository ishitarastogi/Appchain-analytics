import React, { useState, useEffect } from "react";
import Sidebar from "../Sidebar/Sidebar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUsers } from "@fortawesome/free-solid-svg-icons";
import "./ActiveAccountsPage.css";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import {
  fetchGoogleSheetData,
  fetchAllTpsDataForGelatoChains,
} from "../services/googleTPSService";
import moment from "moment";

ChartJS.register(
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
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
  const [timeRange, setTimeRange] = useState("Monthly");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sheetData = await fetchGoogleSheetData();
        console.log("Fetched Google Sheets Data:", sheetData);

        const gelatoData = await fetchAllTpsDataForGelatoChains(sheetData);
        console.log("Fetched TPS Data for Gelato Chains:", gelatoData);

        setGelatoChains(
          sheetData.filter((chain) => chain.raas.toLowerCase() === "gelato")
        );
        setTpsData(gelatoData);

        populateChartData(gelatoData);
      } catch (error) {
        console.error("Error during data fetching:", error);
        setError("Failed to load data. Please try again later.");
      }
    };

    fetchData();
  }, [timeRange]);

  const populateChartData = (gelatoData) => {
    const aggregatedData = {};

    for (const [chainName, tpsArray] of Object.entries(gelatoData)) {
      console.log(`Processing TPS Data for ${chainName}:`, tpsArray);
      tpsArray.forEach(({ timestamp, tps }) => {
        const date = moment(timestamp * 1000).format("YYYY-MM-DD"); // Convert timestamp to date

        if (!aggregatedData[chainName]) {
          aggregatedData[chainName] = {};
        }

        if (!aggregatedData[chainName][date]) {
          aggregatedData[chainName][date] = 0;
        }

        aggregatedData[chainName][date] += tps; // Aggregate TPS values
      });
    }

    console.log("Aggregated TPS Data:", aggregatedData);

    const labels = Array.from(
      new Set(
        Object.values(aggregatedData).flatMap((data) => Object.keys(data))
      )
    );

    const datasets = Object.entries(aggregatedData).map(
      ([chainName, data]) => ({
        label: chainName,
        data: labels.map((label) => data[label] || 0),
        fill: false,
        borderColor: getColorForChain(chainName),
        tension: 0.1,
      })
    );

    setChartData({ labels, datasets });
  };

  const getColorForChain = (chainName) => {
    const colorMap = {
      Gelato: "#ff3b57", // Gelato
      Conduit: "#46BDC6",
      Alchemy: "#4185F4",
      Caldera: "#EC6731",
      Altlayer: "#B28AFE",
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

  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
  };

  // Define abbreviateNumber function
  const abbreviateNumber = (num) => {
    if (num === undefined || num === null || isNaN(num)) {
      console.warn("AbbreviateNumber received:", num);
      return "0"; // Handle undefined, null, and NaN
    }
    if (num === 0) return "0"; // Return '0' for zero

    const suffixes = ["", "k", "M", "B", "T"];
    const suffixNum = Math.floor(("" + num).length / 3);
    let shortNumber = parseFloat(
      (suffixNum !== 0 ? num / Math.pow(1000, suffixNum) : num).toPrecision(2)
    );
    return shortNumber + suffixes[suffixNum];
  };

  return (
    <div className="active-accounts-page">
      <Sidebar />
      <div className="main-content">
        <div className="transactions-header">
          <div className="heading-container">
            <FontAwesomeIcon icon={faUsers} className="icon" />
            <h2>TPS Data</h2>
          </div>
          <p className="description">Tracks TPS data for Gelato chains.</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="time-range-selector">
          <button onClick={() => handleTimeRangeChange("Daily")}>Daily</button>
          <button onClick={() => handleTimeRangeChange("Monthly")}>
            Monthly
          </button>
          <button onClick={() => handleTimeRangeChange("FourMonths")}>
            4 Months
          </button>
          <button onClick={() => handleTimeRangeChange("SixMonths")}>
            6 Months
          </button>
          <button onClick={() => handleTimeRangeChange("All")}>All</button>
        </div>

        <div className="table-chart-container">
          <div className="chain-list">
            {gelatoChains.map((chain, index) => {
              const currentTps = tpsData[chain.name]
                ? tpsData[chain.name].slice(-1)[0]?.tps || 0
                : 0; // Last TPS value, default to 0 if not available
              const maxTps = tpsData[chain.name]
                ? Math.max(
                    ...tpsData[chain.name].map((data) => {
                      console.log(`TPS for ${chain.name}:`, data.tps);
                      return data.tps;
                    })
                  ) || 0
                : 0; // Max TPS, default to 0 if not available

              console.log(
                `Chain: ${chain.name}, Current TPS: ${currentTps}, Max TPS: ${maxTps}`
              );

              return (
                <div key={index} className="chain-item">
                  <img
                    src={`https://s2.googleusercontent.com/s2/favicons?domain=${chain.blockScoutUrl}&sz=32`}
                    alt={`${chain.name} Logo`}
                    className="chain-logo"
                  />
                  <span className="chain-name">{chain.name}</span>
                  <span className="daily-tps">
                    Current TPS: {abbreviateNumber(currentTps)} TPS
                  </span>
                  <span className="max-tps">
                    Max TPS: {abbreviateNumber(maxTps)} TPS
                  </span>
                </div>
              );
            })}
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
                    text: `TPS Data for Gelato Chains`,
                    color: "#FFFFFF",
                  },
                  tooltip: {
                    callbacks: {
                      label: function (context) {
                        const value = context.parsed.y || 0; // Fallback to 0 if undefined
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
                    title: {
                      display: true,
                      text: "Date",
                      color: "#FFFFFF",
                    },
                    ticks: {
                      color: "#FFFFFF",
                      maxRotation: 0,
                      minRotation: 0,
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
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TpssPage;
