import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import DailyTransactionsPage from "./pages/DailyTransactionsPage"; // Import the new DailyTransactionsPage component

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/daily-transactions" element={<DailyTransactionsPage />} />
      </Routes>
    </Router>
  );
};

export default App;
