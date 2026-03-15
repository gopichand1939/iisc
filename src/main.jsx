import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />


    //update 2024-06-01: removed service worker registration for better performance and reliability
  </React.StrictMode>
);