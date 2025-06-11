/**
 * Entry point for the React application.
 * Renders the App component into the DOM element with id "root".
 */
import { createRoot } from "react-dom/client";

import "./index.css";
import App from "./App";

const container = document.getElementById("root");
const root = createRoot(container);
root.render(<App />);
