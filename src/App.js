// src/App.js
import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import DailyTransactionsPage from "./pages/DailyTransactionsPage";
import ActiveAccountsPage from "./pages/ActiveAccountsPage";
import TPSPage from "./pages/TPS"; // Import the new TPSPage component
import TVLPage from "./pages/TVL";
const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/daily-transactions" element={<DailyTransactionsPage />} />
        <Route path="/active-accounts" element={<ActiveAccountsPage />} />
        <Route path="/tps" element={<TPSPage />} /> {/* New Route */}
        <Route path="/tvl" element={<TVLPage />} /> {/* New Route */}
      </Routes>
    </Router>
  );
};

export default App;
