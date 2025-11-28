import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Card, Table, Select, DatePicker, message, Space, Row, Col, Statistic, Input, Modal, Form, TimePicker, DatePicker as AntDatePicker, Popconfirm, InputNumber, Tag, Tooltip } from 'antd';
import { PrinterOutlined, FileExcelOutlined, FilterOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
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
  attendance_id?: number;
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
  is_edited?: boolean;
  edit_remark?: string | null;
  edited_at?: string | null;
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
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const editingAttendanceIdRef = useRef<number | null>(null);
  const [form] = Form.useForm();

  const fetchOrganizations = useCallback(async () => {
    if (!token) return;
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/organizations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrganizations(response.data);
    } catch (error: any) {
      message.error('Failed to fetch organizations');
    }
  }, [token]);

  const fetchOrgSummary = useCallback(async () => {
    if (!token) return;
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/reports/organizations/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrgSummary(response.data);
    } catch (error: any) {
      // Silently fail - summary will just be empty
    }
  }, [token]);

  useEffect(() => {
    fetchOrganizations();
    fetchOrgSummary();
  }, [fetchOrganizations, fetchOrgSummary]);
  
  const fetchReport = useCallback(async () => {
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
      
      // Debug: Check if attendance_id is in the response
      if (data.length > 0) {
        console.log('First record from API:', data[0]);
        console.log('attendance_id in first record:', data[0].attendance_id);
        console.log('Keys in first record:', Object.keys(data[0]));
        
        // Count records without attendance_id (they can't be edited but will still be shown)
        const recordsWithoutId = data.filter((record: any) => !record.attendance_id).length;
        if (recordsWithoutId > 0) {
          console.warn(`${recordsWithoutId} record(s) without attendance_id - edit will be disabled for these`);
        }
      }
      
      // Show all records (even without attendance_id) - edit button will be disabled for those
      setReportData(data);
      setFilteredData(data);
      
      if (data.length === 0) {
        message.info('No attendance records found for the selected criteria');
      } else {
        message.success(`Found ${data.length} attendance record(s)`);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to fetch report');
      setReportData([]);
      setFilteredData([]);
    } finally {
      setLoading(false);
    }
  }, [token, selectedOrg, dateRange]);

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

  // Handle Edit
  const handleEdit = (record: AttendanceRecord) => {
    // Even if attendance_id is missing (older data), allow editing.
    // For such cases, backend will locate the record using keys (employee_code + date + in_time).
    setEditingRecord(record);
    editingAttendanceIdRef.current = record.attendance_id ?? null;
    
    // Parse times properly for the form
    const inTime = record.in_time ? dayjs(record.in_time) : null;
    const outTime = record.out_time ? dayjs(record.out_time) : null;
    
    // Set form values with dayjs objects for time pickers
    form.setFieldsValue({
      attendance_date: record.attendance_date ? dayjs(record.attendance_date) : null,
      in_time: inTime,
      out_time: outTime,
      location_in: record.location_in || '',
      location_out: record.location_out || '',
      ot_hours_decimal: record.ot_hours_decimal || 0,
      edit_remark: record.edit_remark || '',
    });
    
    // Open modal
    setEditModalVisible(true);
  };

  // Handle Update
  const handleUpdate = async (values?: any) => {
    // Get attendance ID from ref first, then fallback to state (may be null for old data)
    const attendanceId = editingAttendanceIdRef.current ?? editingRecord?.attendance_id ?? null;
    
    if (!editingRecord) {
      message.error('Cannot update: Record data is missing. Please close and reopen the edit modal.');
      console.error('Update failed - editingRecord is null');
      return;
    }
    
    try {
      // Use provided values or validate form
      const formValues = values || await form.validateFields();
      
      // Combine date and time for in_time and out_time
      const attendanceDate = formValues.attendance_date || dayjs(editingRecord.attendance_date);
      const dateStr = attendanceDate.format('YYYY-MM-DD');
      
      let inTimeISO = editingRecord.in_time;
      if (formValues.in_time) {
        // Combine the date from attendance_date with the time from in_time
        const combinedInTime = attendanceDate
          .hour(formValues.in_time.hour())
          .minute(formValues.in_time.minute())
          .second(formValues.in_time.second());
        inTimeISO = combinedInTime.toISOString();
      }

      let outTimeISO: string | null = null;
      if (formValues.out_time) {
        // Combine the date from attendance_date with the time from out_time
        const combinedOutTime = attendanceDate
          .hour(formValues.out_time.hour())
          .minute(formValues.out_time.minute())
          .second(formValues.out_time.second());
        outTimeISO = combinedOutTime.toISOString();
      } else if (editingRecord.out_time) {
        outTimeISO = editingRecord.out_time;
      }

      const updateData: any = {
        attendance_date: dateStr,
        in_time: inTimeISO,
        location_in: formValues.location_in || editingRecord.location_in || '',
      };

      // Include out_time if provided or keep existing
      if (outTimeISO !== null) {
        updateData.out_time = outTimeISO;
      }
      
      // Include location_out if provided
      if (formValues.location_out !== undefined) {
        updateData.location_out = formValues.location_out || null;
      }

      // Include OT hours if provided
      if (formValues.ot_hours_decimal !== undefined && formValues.ot_hours_decimal !== null) {
        updateData.ot_hours_decimal = parseFloat(formValues.ot_hours_decimal);
      }

      // Include edit remark (required)
      if (formValues.edit_remark) {
        updateData.edit_remark = formValues.edit_remark.trim();
      }
      
      if (attendanceId) {
        // Normal path when attendance_id is available
        await axios.put(
          `${API_BASE_URL}/api/attendance/${attendanceId}`,
          updateData,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      } else {
        // Fallback path for older records without attendance_id in the report
        await axios.put(
          `${API_BASE_URL}/api/attendance/by-keys/update`,
          {
            employee_code: editingRecord.employee_code,
            attendance_date: dateStr,
            in_time: inTimeISO,
            ...updateData,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      }

      message.success('Attendance record updated successfully!');
      setEditModalVisible(false);
      setEditingRecord(null);
      editingAttendanceIdRef.current = null;
      form.resetFields();
      fetchReport(); // Refresh the report
    } catch (error: any) {
      if (error.response) {
        message.error(error.response?.data?.message || 'Failed to update attendance record');
      } else if (error.errorFields) {
        // Form validation errors
        message.error('Please fill all required fields correctly');
      } else {
        message.error(error.message || 'Failed to update attendance record');
      }
    }
  };

  // Handle Delete
  const handleDelete = async (record: AttendanceRecord) => {
    try {
      if (record.attendance_id) {
        // Normal delete by ID
        await axios.delete(
          `${API_BASE_URL}/api/attendance/${record.attendance_id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      } else {
        // Fallback delete by composite keys for older data
        await axios.delete(
          `${API_BASE_URL}/api/attendance/by-keys/delete`,
          {
            headers: { Authorization: `Bearer ${token}` },
            data: {
              employee_code: record.employee_code,
              attendance_date: record.attendance_date,
              in_time: record.in_time,
            },
          }
        );
      }

      message.success('Attendance record deleted successfully!');
      fetchReport(); // Refresh the report
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to delete attendance record');
    }
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
    {
      title: 'Status',
      key: 'status',
      width: 100,
      render: (_: any, record: AttendanceRecord) => {
        if (record.is_edited) {
          return (
            <Tooltip title={record.edit_remark ? `Remark: ${record.edit_remark}` : 'This record has been edited'}>
              <Tag color="orange">Edited</Tag>
            </Tooltip>
          );
        }
        return null;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: AttendanceRecord) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleEdit(record);
            }}
            title="Edit Attendance Record"
          />
          <Popconfirm
            title="Are you sure you want to delete this record?"
            description="This action cannot be undone."
            onConfirm={(e) => {
              e?.stopPropagation();
              handleDelete(record);
            }}
            okText="Yes"
            cancelText="No"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              title="Delete Attendance Record"
            />
          </Popconfirm>
        </Space>
      ),
    },
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
              rowKey={(r) => `${r.attendance_id || r.employee_code}-${r.attendance_date}-${r.in_time}`}
              dataSource={filteredData}
              columns={columns}
              loading={loading}
              pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `Total ${total} records` }}
              scroll={{ x: 1600 }}
            />
          </Space>
        </Card>
      </div>

      {/* Edit Modal */}
      <Modal
        title={`Edit Attendance - ${editingRecord?.employee_name || ''}`}
        open={editModalVisible}
        onOk={() => {
          form.submit();
        }}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingRecord(null);
          editingAttendanceIdRef.current = null;
          form.resetFields();
        }}
        okText="Update"
        cancelText="Cancel"
        width={600}
        centered
        maskClosable={false}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUpdate}
          initialValues={{
            attendance_date: editingRecord?.attendance_date ? dayjs(editingRecord.attendance_date) : null,
            in_time: editingRecord?.in_time ? dayjs(editingRecord.in_time) : null,
            out_time: editingRecord?.out_time ? dayjs(editingRecord.out_time) : null,
            location_in: editingRecord?.location_in || '',
            location_out: editingRecord?.location_out || '',
            ot_hours_decimal: editingRecord?.ot_hours_decimal || 0,
            edit_remark: editingRecord?.edit_remark || '',
          }}
        >
          <Form.Item
            label="Attendance Date"
            name="attendance_date"
            rules={[{ required: true, message: 'Please select attendance date' }]}
          >
            <AntDatePicker
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
            />
          </Form.Item>

          <Form.Item
            label="Check-in Time"
            name="in_time"
            rules={[{ required: true, message: 'Please select check-in time' }]}
          >
            <TimePicker
              style={{ width: '100%' }}
              format="hh:mm A"
              showNow
              use12Hours
            />
          </Form.Item>

          <Form.Item
            label="Check-out Time"
            name="out_time"
            help="Leave empty if not checked out"
          >
            <TimePicker
              style={{ width: '100%' }}
              format="hh:mm A"
              showNow
              allowClear
              use12Hours
            />
          </Form.Item>

          <Form.Item
            label="Location (Check-in)"
            name="location_in"
          >
            <Input placeholder="e.g., (28.6139, 77.2090)" />
          </Form.Item>

          <Form.Item
            label="Location (Check-out)"
            name="location_out"
          >
            <Input placeholder="e.g., (28.6139, 77.2090)" allowClear />
          </Form.Item>

          <Form.Item
            label="OT Hours (Overtime)"
            name="ot_hours_decimal"
            help="Manually set OT hours if different from calculated"
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              step={0.5}
              precision={2}
              placeholder="0.00"
            />
          </Form.Item>

          <Form.Item
            label="Edit Remark"
            name="edit_remark"
            rules={[{ required: true, message: 'Please provide a reason for editing this record' }]}
            help="Required: Explain why this record is being edited"
          >
            <Input.TextArea
              rows={2}
              placeholder="e.g., Time correction due to system error, Manual adjustment for late arrival, etc."
              maxLength={500}
              showCount
            />
          </Form.Item>

          {editingRecord && (
            <div style={{ marginTop: 12, padding: 10, background: '#f5f5f5', borderRadius: 4, fontSize: '13px' }}>
              <p style={{ margin: '4px 0' }}><strong>Employee:</strong> {editingRecord.employee_name} ({editingRecord.employee_code})</p>
              <p style={{ margin: '4px 0' }}><strong>Organization:</strong> {editingRecord.organization_name}</p>
              <p style={{ margin: '4px 0' }}><strong>Type:</strong> {editingRecord.employee_type}</p>
              {editingRecord.is_edited && (
                <p style={{ color: '#ff9800', marginTop: 6, marginBottom: 0, fontSize: '12px' }}>
                  <strong>⚠️ Previously Edited:</strong> {editingRecord.edit_remark || 'No remark'}
                </p>
              )}
            </div>
          )}
        </Form>
      </Modal>

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

