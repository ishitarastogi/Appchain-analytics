import React, { useState, useEffect } from "react";
import { fetchGoogleSheetData } from "../../services/googleSheetService";
import { Scatter } from "react-chartjs-2";
import "chartjs-adapter-moment";
import * as d3 from "d3";

import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  TimeScale,
  CategoryScale,
} from "chart.js";

ChartJS.register(
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  TimeScale,
  CategoryScale
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

        // Map RaaS providers to colors
        const raasColors = {
          gelato: "#ff3b57",
          conduit: "#46BDC6",
          alchemy: "#4185F4", // Fix Alchemy color
          caldera: "#EC6731",
          altlayer: "#B28AFE",
        };

        // Normalize RaaS provider names to lowercase to avoid duplicates
        const normalizeRaaS = (provider) => provider.trim().toLowerCase();

        // Filter data based on selected time range
        const now = new Date();
        const rangeDays = timeRanges[timeRange];

        const filteredData = data.filter((chain) => {
          const launchDate = new Date(chain.launchDate);
          const diffTime = now - launchDate;
          const diffDays = diffTime / (1000 * 60 * 60 * 24);
          return diffDays <= rangeDays;
        });

        // Add jitter to the x-axis to separate dots for chains launched on the same day
        const jitterDate = (date, index) => {
          const jitterAmount = (Math.random() - 0.5) * 0.2; // Random jitter between -0.1 and 0.1 days
          const jitteredDate = new Date(date);
          jitteredDate.setDate(jitteredDate.getDate() + jitterAmount * index); // Slightly adjust the date
          return jitteredDate;
        };

        // Prepare data points for the chart
        const chartPoints = filteredData.map((chain, index) => ({
          x: jitterDate(chain.launchDate, index), // Apply jitter to the launch date
          y: normalizeRaaS(chain.raas), // Use normalized RaaS provider for y-axis
          color: raasColors[normalizeRaaS(chain.raas)], // Set color based on normalized provider
          name: chain.name, // Chain name for tooltip
        }));

        // Set unique RaaS providers for y-axis labels
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
        labels: ["gelato", "conduit", "alchemy", "caldera", "altlayer"], // Ensure RaaS providers are consistent
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
            return `${point.name} (${point.y})`; // Correct tooltip formatting
          },
        },
      },
      legend: {
        display: false,
      },
    },
  };

  return (
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
  );
};

export default LaunchTimelineChart;
