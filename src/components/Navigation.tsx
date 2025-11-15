import React from 'react';
import { Menu, Button } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogoutOutlined } from '@ant-design/icons';

const Navigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, isAuthenticated } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = isAuthenticated
    ? [
        { key: '/dashboard', label: 'Dashboard', onClick: () => navigate('/dashboard') },
        { key: '/shift-settings', label: 'Shift Settings', onClick: () => navigate('/shift-settings') },
        { key: '/employees', label: 'Employees', onClick: () => navigate('/employees') },
        { key: '/register', label: 'Register Employee', onClick: () => navigate('/register') },
        { key: '/mark-attendance', label: 'Mark Attendance', onClick: () => navigate('/mark-attendance') },
        { key: '/organizations', label: 'Organizations', onClick: () => navigate('/organizations') },
        { key: '/email-config', label: 'Email Config', onClick: () => navigate('/email-config') },
        { key: '/whatsapp-config', label: 'WhatsApp Config', onClick: () => navigate('/whatsapp-config') },
        { key: '/reports', label: 'View Reports', onClick: () => navigate('/reports') },
      ]
    : [
        { key: '/mark-attendance', label: 'Mark Attendance', onClick: () => navigate('/mark-attendance') },
      ];

  return (
    <div style={{ 
      background: '#001529', 
      padding: '0 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <div style={{ color: '#fff', fontSize: '18px', fontWeight: 'bold' }}>
        Facial Attendance System
      </div>
      <div style={{ display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'center' }}>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{ 
            background: 'transparent',
            border: 'none',
            flex: 1,
            justifyContent: 'center',
            minWidth: '400px'
          }}
        />
      </div>
      {isAuthenticated ? (
        <Button 
          type="primary" 
          danger 
          icon={<LogoutOutlined />}
          onClick={handleLogout}
        >
          Logout
        </Button>
      ) : location.pathname !== '/mark-attendance' ? (
        <Button type="primary" onClick={() => navigate('/login')}>Login</Button>
      ) : null}
    </div>
  );
};

export default Navigation;

