import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// Disable console.log in production for security
if (import.meta.env.PROD) {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
