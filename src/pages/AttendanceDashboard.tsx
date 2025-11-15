import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Spin, Select, message } from 'antd';
import { UserOutlined, TeamOutlined, ClockCircleOutlined, RiseOutlined } from '@ant-design/icons';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4500';
const { Option } = Select;

interface OrganizationStats {
  organization_id: number;
  organization_name: string;
  total_employees: number;
  present_today: number;
  on_leave_today: number;
  late_arrivals: number;
  early_departures: number;
  ot_employees: number;
  attendance_percentage: number;
}

interface EmployeeAttendance {
  employee_id: number;
  employee_code: string;
  employee_name: string;
  employee_type: string;
  organization_name: string;
  status: string; // Present, Absent, On Leave
  in_time: string | null;
  out_time: string | null;
  total_hours: number;
  is_ot: boolean;
}

const AttendanceDashboard: React.FC = () => {
  const [orgStats, setOrgStats] = useState<OrganizationStats[]>([]);
  const [employeeData, setEmployeeData] = useState<EmployeeAttendance[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeAttendance[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [attendanceTrend, setAttendanceTrend] = useState<any[]>([]);
  const { token } = useAuth();

  const COLORS = ['#1890ff', '#52c41a', '#faad14', '#722ed1', '#eb2f96', '#13c2c2', '#f5222d'];

  const formatTime = (timeStr: string | null): string => {
    if (!timeStr) return 'N/A';
    try {
      const date = new Date(timeStr);
      return date.toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    } catch {
      return 'N/A';
    }
  };

  const fetchDashboardData = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      // Fetch organization-wise stats
      const orgResponse = await axios.get(`${API_BASE_URL}/api/reports/organization-stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrgStats(orgResponse.data);

      // Fetch today's employee attendance
      const today = new Date().toISOString().split('T')[0];
      const empResponse = await axios.get(`${API_BASE_URL}/api/reports/employee-attendance`, {
        params: { date: today },
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmployeeData(empResponse.data);
      setFilteredEmployees(empResponse.data);

      // Fetch attendance trend (last 7 days)
      try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 6);
        
        const trendResponse = await axios.get(`${API_BASE_URL}/api/reports/attendance-trend`, {
          params: { 
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
          },
          headers: { Authorization: `Bearer ${token}` }
        });
        setAttendanceTrend(trendResponse.data || []);
      } catch (trendError) {
        console.error('Error fetching attendance trend:', trendError);
        setAttendanceTrend([]); // Set empty array on error
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      message.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [token]);

  useEffect(() => {
    if (selectedOrg) {
      setFilteredEmployees(employeeData.filter(emp => 
        orgStats.find(org => org.organization_name === emp.organization_name && org.organization_id === selectedOrg)
      ));
    } else {
      setFilteredEmployees(employeeData);
    }
  }, [selectedOrg, employeeData, orgStats]);

  // Calculate overall stats
  const totalEmployees = orgStats.reduce((sum, org) => sum + org.total_employees, 0);
  const totalPresent = orgStats.reduce((sum, org) => sum + org.present_today, 0);
  const totalOT = orgStats.reduce((sum, org) => sum + org.ot_employees, 0);
  const overallAttendance = totalEmployees > 0 
    ? ((totalPresent / totalEmployees) * 100).toFixed(1) 
    : '0';

  const employeeColumns = [
    {
      title: 'Employee Code',
      dataIndex: 'employee_code',
      key: 'employee_code',
      width: 150,
    },
    {
      title: 'Employee Name',
      dataIndex: 'employee_name',
      key: 'employee_name',
      width: 200,
    },
    {
      title: 'Organization',
      dataIndex: 'organization_name',
      key: 'organization_name',
      width: 200,
    },
    {
      title: 'Type',
      dataIndex: 'employee_type',
      key: 'employee_type',
      width: 150,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => (
        <span style={{ 
          color: status === 'Present' ? '#52c41a' : status === 'Absent' ? '#ff4d4f' : '#faad14',
          fontWeight: 600 
        }}>
          {status}
        </span>
      ),
    },
    {
      title: 'Check-in',
      dataIndex: 'in_time',
      key: 'in_time',
      width: 120,
      render: formatTime,
    },
    {
      title: 'Check-out',
      dataIndex: 'out_time',
      key: 'out_time',
      width: 120,
      render: formatTime,
    },
    {
      title: 'Total Hours',
      dataIndex: 'total_hours',
      key: 'total_hours',
      width: 120,
      render: (hours: number | string | null) => {
        if (!hours) return 'N/A';
        const numHours = typeof hours === 'string' ? parseFloat(hours) : hours;
        return isNaN(numHours) ? 'N/A' : `${numHours.toFixed(2)} hrs`;
      },
    },
    {
      title: 'OT',
      dataIndex: 'is_ot',
      key: 'is_ot',
      width: 80,
      render: (isOT: boolean) => (
        <span style={{ color: isOT ? '#faad14' : '#52c41a', fontWeight: 600 }}>
          {isOT ? 'OT' : 'Regular'}
        </span>
      ),
    },
  ];

  const orgColumns = [
    {
      title: 'Organization',
      dataIndex: 'organization_name',
      key: 'organization_name',
    },
    {
      title: 'Total Employees',
      dataIndex: 'total_employees',
      key: 'total_employees',
      align: 'center' as const,
    },
    {
      title: 'Present Today',
      dataIndex: 'present_today',
      key: 'present_today',
      align: 'center' as const,
      render: (value: number) => <span style={{ color: '#52c41a', fontWeight: 600 }}>{value}</span>,
    },
    {
      title: 'Late Arrivals',
      dataIndex: 'late_arrivals',
      key: 'late_arrivals',
      align: 'center' as const,
      render: (value: number) => <span style={{ color: value > 0 ? '#faad14' : '#52c41a' }}>{value}</span>,
    },
    {
      title: 'OT Employees',
      dataIndex: 'ot_employees',
      key: 'ot_employees',
      align: 'center' as const,
      render: (value: number) => <span style={{ color: '#722ed1', fontWeight: 600 }}>{value}</span>,
    },
    {
      title: 'Attendance %',
      dataIndex: 'attendance_percentage',
      key: 'attendance_percentage',
      align: 'center' as const,
      render: (value: number) => (
        <span style={{ 
          color: value >= 90 ? '#52c41a' : value >= 70 ? '#faad14' : '#ff4d4f',
          fontWeight: 600 
        }}>
          {value.toFixed(1)}%
        </span>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      <Navigation />
      <div style={{ maxWidth: 1600, margin: '0 auto', paddingTop: '80px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <Spin size="large" />
          </div>
        ) : (
          <>
            {/* Overall Statistics */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Total Employees"
                    value={totalEmployees}
                    prefix={<TeamOutlined />}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Present Today"
                    value={totalPresent}
                    prefix={<UserOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Attendance Rate"
                    value={overallAttendance}
                    suffix="%"
                    prefix={<RiseOutlined />}
                    valueStyle={{ color: parseFloat(overallAttendance) >= 90 ? '#52c41a' : '#faad14' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="OT Employees"
                    value={totalOT}
                    prefix={<ClockCircleOutlined />}
                    valueStyle={{ color: '#722ed1' }}
                  />
                </Card>
              </Col>
            </Row>

            {/* Charts Section */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              {/* Attendance Trend Chart */}
              <Col xs={24} lg={16}>
                <Card title="Attendance Trend (Last 7 Days)">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={attendanceTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          return `${date.getDate()}/${date.getMonth() + 1}`;
                        }}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip 
                        labelFormatter={(value) => {
                          const date = new Date(value);
                          return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="present" 
                        stroke="#52c41a" 
                        strokeWidth={2}
                        name="Present"
                        dot={{ r: 4 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="absent" 
                        stroke="#ff4d4f" 
                        strokeWidth={2}
                        name="Absent"
                        dot={{ r: 4 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="ot" 
                        stroke="#722ed1" 
                        strokeWidth={2}
                        name="OT"
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </Col>

              {/* Organization Distribution Pie Chart */}
              <Col xs={24} lg={8}>
                <Card title="Employee Distribution by Organization">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={orgStats.map(org => ({
                          name: org.organization_name,
                          value: org.total_employees
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {orgStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            </Row>

            {/* Employee Type and Attendance Charts */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              {/* Employee Type Distribution */}
              <Col xs={24} lg={12}>
                <Card title="Employee Distribution by Type">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={(() => {
                      const typeCount: Record<string, number> = {};
                      employeeData.forEach(emp => {
                        typeCount[emp.employee_type] = (typeCount[emp.employee_type] || 0) + 1;
                      });
                      return Object.entries(typeCount).map(([type, count]) => ({
                        type,
                        count
                      }));
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="type" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#1890ff" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </Col>

              {/* Attendance Status Distribution */}
              <Col xs={24} lg={12}>
                <Card title="Today's Attendance Status">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={(() => {
                      const statusCount: Record<string, number> = {};
                      employeeData.forEach(emp => {
                        statusCount[emp.status] = (statusCount[emp.status] || 0) + 1;
                      });
                      return Object.entries(statusCount).map(([status, count]) => ({
                        status,
                        count
                      }));
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count">
                        {(() => {
                          const statusCount: Record<string, number> = {};
                          employeeData.forEach(emp => {
                            statusCount[emp.status] = (statusCount[emp.status] || 0) + 1;
                          });
                          return Object.entries(statusCount).map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={entry[0] === 'Present' ? '#52c41a' : entry[0] === 'Absent' ? '#ff4d4f' : '#faad14'} 
                            />
                          ));
                        })()}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            </Row>

            {/* Organization-wise Statistics */}
            <Card title="Organization-wise Statistics" style={{ marginBottom: 24 }}>
              <Table
                dataSource={orgStats}
                columns={orgColumns}
                rowKey="organization_id"
                pagination={false}
                size="middle"
              />
            </Card>

            {/* Employee Attendance Today */}
            <Card 
              title="Employee Attendance (Today)" 
              extra={
                <Select
                  placeholder="Filter by Organization"
                  allowClear
                  style={{ width: 250 }}
                  onChange={(value) => setSelectedOrg(value)}
                >
                  {orgStats.map(org => (
                    <Option key={org.organization_id} value={org.organization_id}>
                      {org.organization_name}
                    </Option>
                  ))}
                </Select>
              }
            >
              <Table
                dataSource={filteredEmployees}
                columns={employeeColumns}
                rowKey="employee_id"
                pagination={{ pageSize: 20, showSizeChanger: true }}
                scroll={{ x: 1200 }}
                size="middle"
              />
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default AttendanceDashboard;
