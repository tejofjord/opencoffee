import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ChapterProvider } from "./context/ChapterContext";
import { ToastProvider } from "./context/ToastContext";
import { App } from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ChapterProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </ChapterProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
