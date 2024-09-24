import React, { useState } from "react";

const TransactionChart = () => {
  const [view, setView] = useState("total"); // Default view is total transactions

  return (
    <div className="transaction-chart">
      <div className="buttons">
        <button onClick={() => setView("total")}># of Transactions</button>
        <button onClick={() => setView("perChain")}>
          # of Transactions Per Chain
        </button>
      </div>
      {/* Placeholder for Bar/Stacked Chart */}
      <div className="chart">
        {view === "total"
          ? "Total Transactions Chart"
          : "Transactions Per Chain Chart"}
      </div>
    </div>
  );
};

export default TransactionChart;
