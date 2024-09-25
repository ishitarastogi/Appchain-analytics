import React, { useEffect, useState } from "react";
import {
  fetchGoogleSheetData,
  fetchAllTransactions,
} from "./services/googleSheetService";

const App = () => {
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [weeklyTransactions, setWeeklyTransactions] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sheetData = await fetchGoogleSheetData();
        console.log("Sheet Data:", sheetData); // <-- Check if Google Sheets data is fetched correctly

        // Fetch weekly transactions and total transactions
        const { transactionDataByWeek, totalTransactionsCombined } =
          await fetchAllTransactions(sheetData);

        setWeeklyTransactions(transactionDataByWeek); // Set weekly data for last month
        setTotalTransactions(totalTransactionsCombined); // Set total transaction count
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  return (
    <div>
      <h1>Appchain Growth Insights</h1>

      {/* Display Total Transactions */}
      <div>
        <h2>Total Transactions Executed by All Chains: {totalTransactions}</h2>
      </div>

      {/* Display Last Month's Weekly Transaction Data */}
      <div>
        <h2>Last Month's Weekly Transactions:</h2>
        {Object.keys(weeklyTransactions).length === 0 ? (
          <p>No transactions found for the last month.</p>
        ) : (
          <ul>
            {Object.entries(weeklyTransactions).map(([week, value]) => (
              <li key={week}>
                <strong>{week}:</strong> {value} transactions
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default App;
