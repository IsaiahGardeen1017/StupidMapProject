import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ProjectionTunerApp from "./ProjectionTunerApp";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {window.location.pathname === "/projection" ? <ProjectionTunerApp /> : <App />}
  </React.StrictMode>
);
