import React, { useState, useEffect } from 'react';
import { Button, Card, Table, Select, DatePicker, message, Space, Row, Col, Statistic, Input } from 'antd';
import { DownloadOutlined, PrinterOutlined, FileExcelOutlined, FilterOutlined, SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import dayjs, { Dayjs } from 'dayjs';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4500';
const { RangePicker } = DatePicker;
const { Option } = Select;

interface Organization {
  organization_id: number;
  organization_name: string;
}

interface AttendanceRecord {
  employee_code: string;
  employee_name: string;
  employee_type: string;
  organization_name: string;
  attendance_date: string;
  in_time: string;
  out_time: string | null;
  delay_by_minutes: number;
  extra_time_minutes: number;
  total_working_hours_decimal: number;
  ot_hours_decimal?: number;
  is_ot?: boolean;
  shift_name?: string;
  location_in: string;
  location_out: string | null;
}

interface OrgSummary {
  organization_id: number;
  organization_name: string;
  total_employees: number;
  present_today: number;
  ot_today: number;
}

const ViewReports: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [reportData, setReportData] = useState<AttendanceRecord[]>([]);
  const [orgSummary, setOrgSummary] = useState<OrgSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState<string>('');
  const [filteredData, setFilteredData] = useState<AttendanceRecord[]>([]);
  const { token } = useAuth();

  const fetchOrganizations = async () => {
    if (!token) return;
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/organizations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrganizations(response.data);
    } catch (error: any) {
      message.error('Failed to fetch organizations');
    }
  };

  const fetchOrgSummary = async () => {
    if (!token) return;
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/reports/organizations/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrgSummary(response.data);
    } catch (error: any) {
      console.error('Failed to fetch organization summary');
    }
  };

  useEffect(() => {
    fetchOrganizations();
    fetchOrgSummary();
  }, [token]);

  // Auto-fetch report on component mount or when filters change
  useEffect(() => {
    if (token) {
      // Auto-load all data on page load (last 30 days)
      fetchReport();
    }
  }, [token]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params: any = {};
      
      // Add organization filter if selected
      if (selectedOrg) {
        params.organizationId = selectedOrg;
      }
      
      // Add date range if selected
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
      } else {
        // Default to last 30 days if no date range selected
        const endDate = dayjs();
        const startDate = endDate.subtract(30, 'day');
        params.startDate = startDate.format('YYYY-MM-DD');
        params.endDate = endDate.format('YYYY-MM-DD');
      }

      const response = await axios.get(
        `${API_BASE_URL}/api/reports/detailed-report`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params,
        }
      );
      const data = response.data || [];
      setReportData(data);
      setFilteredData(data);
      
      if (data.length === 0) {
        message.info('No attendance records found for the selected criteria');
      } else {
        message.success(`Found ${data.length} attendance record(s)`);
      }
    } catch (error: any) {
      console.error('Error fetching report:', error);
      message.error(error.response?.data?.message || 'Failed to fetch report');
      setReportData([]);
      setFilteredData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const params: any = {};
      
      // Add organization filter if selected
      if (selectedOrg) {
        params.organizationId = selectedOrg;
      }
      
      // Add date range if selected
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
      } else {
        // Default to last 30 days if no date range selected
        const endDate = dayjs();
        const startDate = endDate.subtract(30, 'day');
        params.startDate = startDate.format('YYYY-MM-DD');
        params.endDate = endDate.format('YYYY-MM-DD');
      }

      const response = await axios.get(
        `${API_BASE_URL}/api/reports/detailed-report`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params,
        }
      );

      // Convert to Excel format (simple CSV for now)
      const data = response.data || [];
      if (data.length === 0) {
        message.warning('No data to export');
        return;
      }

      // Create CSV content
      const headers = ['Employee Code', 'Employee Name', 'Organization', 'Employee Type', 'Date', 'Check-in', 'Check-out', 'Delay (HH:MM)', 'Extra Time (HH:MM)', 'OT Hours', 'Shift', 'Total Hours'];
      const rows = data.map((record: AttendanceRecord) => [
        record.employee_code || '',
        record.employee_name || '',
        record.organization_name || '',
        record.employee_type || '',
        formatDate(record.attendance_date),
        formatTime(record.in_time),
        formatTime(record.out_time),
        formatMinutesToHHMM(record.delay_by_minutes),
        formatExtraTime(record.extra_time_minutes),
        record.ot_hours_decimal ? `${Number(record.ot_hours_decimal).toFixed(2)} hrs` : '-',
        record.shift_name || (record.is_ot ? 'OT' : 'Regular'),
        record.total_working_hours_decimal ? `${Number(record.total_working_hours_decimal).toFixed(2)} hrs` : 'N/A'
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row: any[]) => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = selectedOrg 
        ? `organization_report_${selectedOrg}_${dayjs().format('YYYY-MM-DD')}.csv`
        : `all_employees_report_${dayjs().format('YYYY-MM-DD')}.csv`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      message.success('Excel file downloaded successfully!');
    } catch (error: any) {
      console.error('Error downloading Excel:', error);
      message.error('Failed to download Excel file');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '';
    return dayjs(dateString).format('DD/MM/YYYY');
  };

  const formatTime = (dateString: string | null): string => {
    if (!dateString) return 'Not checked out';
    return dayjs(dateString).format('hh:mm:ss A');
  };

  const formatMinutesToHHMM = (minutes: number | null | undefined): string => {
    if (minutes === null || minutes === undefined) return 'N/A';
    const n = Number(minutes);
    if (!Number.isFinite(n) || n < 0) return 'N/A';
    if (n === 0) return '00:00';
    const hrs = Math.floor(n / 60);
    const mins = Math.round(n % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const formatExtraTime = (minutes: number | null | undefined): string => {
    if (minutes === null || minutes === undefined) return 'N/A';
    const n = Number(minutes);
    if (!Number.isFinite(n) || n < 0) return 'N/A';
    if (n === 0) return '00:00';
    const hrs = Math.floor(n / 60);
    const mins = Math.round(n % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Filter data based on search text
  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredData(reportData);
    } else {
      const filtered = reportData.filter((record) => {
        const searchLower = searchText.toLowerCase();
        return (
          record.employee_name?.toLowerCase().includes(searchLower) ||
          record.employee_code?.toLowerCase().includes(searchLower) ||
          record.organization_name?.toLowerCase().includes(searchLower) ||
          record.employee_type?.toLowerCase().includes(searchLower)
        );
      });
      setFilteredData(filtered);
    }
  }, [searchText, reportData]);

  const columns = [
    { title: 'Employee Code', dataIndex: 'employee_code', key: 'employee_code', width: 150 },
    { title: 'Employee Name', dataIndex: 'employee_name', key: 'employee_name', width: 180 },
    { title: 'Organization', dataIndex: 'organization_name', key: 'organization_name', width: 180 },
    { title: 'Employee Type', dataIndex: 'employee_type', key: 'employee_type', width: 130 },
    { title: 'Date', dataIndex: 'attendance_date', key: 'attendance_date', width: 120,
      render: (value: string) => formatDate(value) },
    { title: 'Check-in', dataIndex: 'in_time', key: 'in_time', width: 130,
      render: (value: string) => formatTime(value) },
    { title: 'Check-out', dataIndex: 'out_time', key: 'out_time', width: 130,
      render: (value: string | null) => formatTime(value) },
    { title: 'Delay', dataIndex: 'delay_by_minutes', key: 'delay_by_minutes', width: 100,
      render: (v: any) => {
        const delay = Math.max(0, Number(v) || 0);
        return delay > 0 ? (
          <span style={{ color: '#ff4d4f', fontWeight: 500 }}>{formatMinutesToHHMM(delay)}</span>
        ) : (
          <span style={{ color: '#52c41a' }}>On Time</span>
        );
      }},
    { title: 'Extra Time', dataIndex: 'extra_time_minutes', key: 'extra_time_minutes', width: 100,
      render: (v: any) => {
        const extra = Math.max(0, Number(v) || 0);
        return extra > 0 ? (
          <span style={{ color: '#1890ff', fontWeight: 500 }}>{formatExtraTime(extra)}</span>
        ) : (
          <span>00:00</span>
        );
      }},
    { title: 'OT Hours', dataIndex: 'ot_hours_decimal', key: 'ot_hours_decimal', width: 100,
      render: (v: any, r: AttendanceRecord) => {
        const otHours = Number(r.ot_hours_decimal || 0);
        return otHours > 0 ? (
          <span style={{ color: '#ff4d4f', fontWeight: 600 }}>{otHours.toFixed(2)} hrs</span>
        ) : (
          <span>-</span>
        );
      }},
    { title: 'Shift', dataIndex: 'shift_name', key: 'shift_name', width: 120,
      render: (shiftName: string, r: AttendanceRecord) => {
        if (shiftName) return <span style={{ color: '#1890ff', fontWeight: 500 }}>{shiftName}</span>;
        return r.is_ot ? <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>OT</span> : 
               <span style={{ color: '#52c41a' }}>Regular</span>;
      }},
    { title: 'Total Hours', dataIndex: 'total_working_hours_decimal', key: 'total_working_hours_decimal', width: 120,
      render: (v: any) => {
        const n = Number(v);
        return Number.isFinite(n) ? (
          <span style={{ fontWeight: 600 }}>{Math.max(0, n).toFixed(2)} hrs</span>
        ) : 'N/A';
      } },
  ];

  const selectedOrgSummary = orgSummary.find(s => s.organization_id === selectedOrg);

  return (
    <div>
      <Navigation />
      <div style={{ padding: '24px' }}>
        <Card title="Organization Reports">
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Summary Cards */}
            {selectedOrgSummary && (
              <Row gutter={16}>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="Total Employees"
                      value={selectedOrgSummary.total_employees}
                      valueStyle={{ color: '#3f8600' }}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="Present Today"
                      value={selectedOrgSummary.present_today}
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card>
                    <Statistic
                      title="OT Today"
                      value={selectedOrgSummary.ot_today}
                      valueStyle={{ color: '#cf1322' }}
                    />
                  </Card>
                </Col>
              </Row>
            )}

            {/* Filters and Search */}
            <Row gutter={[16, 16]} align="middle">
              <Col flex="auto">
                <Space size="middle" style={{ width: '100%' }}>
                  <FilterOutlined style={{ fontSize: '18px', color: '#1890ff' }} />
                  <Select
                    style={{ minWidth: 200 }}
                    placeholder="Organization"
                    allowClear
                    onChange={(value) => setSelectedOrg(value)}
                    value={selectedOrg}
                  >
                    {organizations.map((org) => (
                      <Option key={org.organization_id} value={org.organization_id}>
                        {org.organization_name}
                      </Option>
                    ))}
                  </Select>
                  <RangePicker
                    onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs])}
                    value={dateRange}
                    format="DD/MM/YYYY"
                    placeholder={['Start date', 'End date']}
                  />
                  <Input
                    placeholder="Search by name, code, organization..."
                    prefix={<SearchOutlined />}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{ width: 300 }}
                    allowClear
                  />
                </Space>
              </Col>
              <Col>
                <Space>
                  <Button type="primary" onClick={fetchReport} loading={loading}>
                    Generate Report
                  </Button>
                  <Button
                    icon={<FileExcelOutlined />}
                    onClick={handleDownloadExcel}
                    disabled={loading}
                  >
                    Excel
                  </Button>
                  <Button
                    type="text"
                    icon={<PrinterOutlined />}
                    onClick={handlePrint}
                    disabled={filteredData.length === 0}
                    title="Print Report"
                  />
                </Space>
              </Col>
            </Row>

            {/* Report Table */}
            <Table
              rowKey={(r) => `${r.employee_code}-${r.attendance_date}-${r.in_time}`}
              dataSource={filteredData}
              columns={columns}
              loading={loading}
              pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `Total ${total} records` }}
              scroll={{ x: 1500 }}
            />
          </Space>
        </Card>
      </div>

      <style>{`
        @media print {
          .ant-layout-header,
          .ant-btn,
          .ant-select,
          .ant-picker {
            display: none !important;
          }
          .ant-card {
            box-shadow: none !important;
            border: 1px solid #000 !important;
          }
          .ant-table {
            font-size: 10px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ViewReports;

