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
  Title, // Import the Title plugin from Chart.js
} from "chart.js";

ChartJS.register(
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  TimeScale,
  CategoryScale,
  Title // Register the Title plugin
);

const LaunchTimelineChart = () => {
  const [chartData, setChartData] = useState(null);
  const [timeRange, setTimeRange] = useState("12month");

  const timeRanges = {
    "1week": 7,
    "3month": 90,
    "6month": 180,
    "12month": 365,
    All: 365 * 5,
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await fetchGoogleSheetData();

        const raasColors = {
          gelato: "#ff3b57",
          conduit: "#46BDC6",
          alchemy: "#4185F4",
          caldera: "#EC6731",
          altlayer: "#B28AFE",
        };

        const normalizeRaaS = (provider) => provider.trim().toLowerCase();

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
          color: raasColors[normalizeRaaS(chain.raas)],
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
        },
      },
      y: {
        type: "category",
        labels: ["gelato", "conduit", "alchemy", "caldera", "altlayer"],
        title: {
          display: true,
          text: "RaaS Providers",
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
      },
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: "RaaS Chain Launch Timeline", // Custom heading inside the chart
        align: "start", // Align the title to the start (left)
        color: "#ffffff", // Title color
        font: {
          size: 18, // Font size for the title
        },
        padding: {
          top: 10, // Space above the title
          left: 10, // Space from the left
        },
      },
    },
  };

  return (
    <div className="chart-section">
      <div className="chart-container">
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
