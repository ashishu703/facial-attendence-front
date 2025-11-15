import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import RegisterEmployee from './pages/RegisterEmployee';
import MarkAttendance from './pages/MarkAttendance';
import AttendanceDashboard from './pages/AttendanceDashboard';
import ShiftSettings from './pages/ShiftSettings';
import Employees from './pages/Employees';
import OrganizationSettings from './pages/OrganizationSettings';
import EmailConfiguration from './pages/EmailConfiguration';
import WhatsAppConfiguration from './pages/WhatsAppConfiguration';
import ViewReports from './pages/ViewReports';
import './App.css';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/register"
          element={
            <ProtectedRoute>
              <RegisterEmployee />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mark-attendance"
          element={
            <MarkAttendance />
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <AttendanceDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shift-settings"
          element={
          <ProtectedRoute>
            <ShiftSettings />
          </ProtectedRoute>
          }
        />
        <Route
          path="/employees"
          element={
          <ProtectedRoute>
            <Employees />
          </ProtectedRoute>
          }
        />
        <Route
          path="/organizations"
          element={
          <ProtectedRoute>
            <OrganizationSettings />
          </ProtectedRoute>
          }
        />
        <Route
          path="/email-config"
          element={
          <ProtectedRoute>
            <EmailConfiguration />
          </ProtectedRoute>
          }
        />
        <Route
          path="/whatsapp-config"
          element={
          <ProtectedRoute>
            <WhatsAppConfiguration />
          </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
          <ProtectedRoute>
            <ViewReports />
          </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
