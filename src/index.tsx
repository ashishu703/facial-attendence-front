import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, notification, App as AntApp } from 'antd';
import 'antd/dist/reset.css';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { AuthProvider } from './context/AuthContext';

// Fix for webdriver property redefinition error (caused by browser extensions/automation tools)
if (typeof navigator !== 'undefined' && navigator.webdriver !== undefined) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'webdriver');
    if (descriptor && descriptor.configurable) {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => descriptor.value,
        configurable: true
      });
    }
  } catch (e) {
    // Silently ignore if we can't fix it
    console.warn('Could not fix webdriver property:', e);
  }
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <ConfigProvider>
    <AntApp>
      <AuthProvider>
        <App />
      </AuthProvider>
    </AntApp>
  </ConfigProvider>
);

// Global notification defaults
notification.config({
  placement: 'topRight',
  top: 24,
  duration: 4.5
});

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
