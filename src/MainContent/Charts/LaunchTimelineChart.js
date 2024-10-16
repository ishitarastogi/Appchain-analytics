import React, { useState, useEffect } from "react";
import { fetchGoogleSheetData } from "../../services/googleSheetService";
import { Scatter } from "react-chartjs-2";
import "chartjs-adapter-moment";
import * as d3 from "d3";
import "./LaunchTimelineChart.css";
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  TimeScale,
  CategoryScale,
  Title,
} from "chart.js";

ChartJS.register(
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  TimeScale,
  CategoryScale,
  Title
);

const LaunchTimelineChart = () => {
  const [chartData, setChartData] = useState(null);
  const [timeRange, setTimeRange] = useState("3month");

  const timeRanges = {
    "1week": 7,
    "3month": 90,
    "6month": 180,
    "12month": 365,
    All: 365 * 5,
  };

  // Function to capitalize the first letter
  const capitalizeFirstLetter = (str) => {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const normalizeRaaS = (provider) => capitalizeFirstLetter(provider.trim());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await fetchGoogleSheetData();

        const raasColors = {
          Gelato: "#ff3b57",
          Conduit: "#46BDC6",
          Alchemy: "#4185F4",
          Caldera: "#EC6731",
          Altlayer: "#B28AFE",
        };

        const now = new Date();
        const rangeDays = timeRanges[timeRange];

        const filteredData = data.filter((chain) => {
          const launchDate = new Date(chain.launchDate);
          const diffTime = now - launchDate;
          const diffDays = diffTime / (1000 * 60 * 60 * 24);
          return diffDays <= rangeDays;
        });

        const jitterDate = (date, index) => {
          const jitterAmount = (Math.random() - 0.5) * 0.2;
          const jitteredDate = new Date(date);
          jitteredDate.setDate(jitteredDate.getDate() + jitterAmount * index);
          return jitteredDate;
        };

        const chartPoints = filteredData.map((chain, index) => ({
          x: jitterDate(chain.launchDate, index),
          y: normalizeRaaS(chain.raas),
          color: raasColors[normalizeRaaS(chain.raas)] || "#ffffff", // Fallback color
          name: chain.name,
        }));

        const raasProviders = [...new Set(chartPoints.map((point) => point.y))];

        setChartData({
          datasets: [
            {
              label: "Chain Launches",
              data: chartPoints,
              backgroundColor: chartPoints.map((point) => point.color),
              pointRadius: 6,
            },
          ],
        });
      } catch (error) {
        console.error("Error fetching chain data:", error);
      }
    };

    fetchData();
  }, [timeRange]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: "time",
        time: {
          unit: "month",
        },
        title: {
          display: true,
          text: "Launch Date",
          color: "#ffffff", // X-axis title color
          font: {
            size: 14,
            weight: "bold",
          },
        },
        ticks: {
          color: "#ffffff", // X-axis labels color
        },
        grid: {
          display: false, // Remove X-axis grid lines
        },
      },
      y: {
        type: "category",
        labels: ["Gelato", "Conduit", "Alchemy", "Caldera", "Altlayer"],
        title: {
          display: true,
          text: "RaaS Providers",
          color: "#ffffff", // Y-axis title color
          font: {
            size: 14,
            weight: "bold",
          },
        },
        ticks: {
          color: "#ffffff", // Y-axis labels color
        },
        grid: {
          display: false, // Remove Y-axis grid lines
        },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => {
            const point = context.raw;
            return `${point.name} (${point.y})`;
          },
        },
        titleColor: "#ffffff", // Tooltip title color
        bodyColor: "#ffffff", // Tooltip body color
        backgroundColor: "rgba(0, 0, 0, 0.7)", // Tooltip background
      },
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
    },
  };

  return (
    <div className="chart-section">
      <div className="chart-container">
        {/* New Flex Container for Header */}
        <div className="chart-header">
          <h2 className="metrics-heading">RaaS Launch Timeline Chart</h2>

          <div className="time-range-buttons">
            {Object.keys(timeRanges).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={timeRange === range ? "active" : ""}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        <div className="chart-wrapper">
          {chartData ? (
            <Scatter data={chartData} options={options} />
          ) : (
            <p>Loading chart...</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LaunchTimelineChart;
