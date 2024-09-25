// import React from "react";
// import Header from "../Header/Header";
// import Sidebar from "../Sidebar/Sidebar";
// import ScatterPlot from "../MainContent/Charts/ScatterPlot";
// import "./Home.css";

// const Home = () => {
//   return (
//     <div className="home">
//       <Sidebar />
//       <div className="main-content">
//         <Header />
//         <div className="content-area">
//           <ScatterPlot /> {/* Add your scatter plot here */}
//         </div>
//       </div>
//     </div>
//   );
// };

// export default Home;
// src/Home/Home.js

import React from "react";
import Header from "../Header/Header";
import Sidebar from "../Sidebar/Sidebar";
import LaunchTimelineChart from "../MainContent/Charts/LaunchTimelineChart";
import "./Home.css";

const Home = () => {
  return (
    <div className="home">
      <Sidebar />
      <div className="main-content">
        <Header />
        <div className="content-area">
          <LaunchTimelineChart />
          {/* Other components can go here */}
        </div>
      </div>
    </div>
  );
};

export default Home;
