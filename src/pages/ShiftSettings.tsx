import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Button, Card, Form, Input, TimePicker, Table, Space, Popconfirm, Select, notification } from 'antd';
import dayjs from 'dayjs';
import axios from 'axios';
import Navigation from '../components/Navigation';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4500';

interface Shift {
  id: string;
  name: string;
  employee_type: string;
  start_time: string;
  end_time: string;
}

const ShiftSettings: React.FC = () => {
  const { token } = useAuth();
  const [form] = Form.useForm();
  const [data, setData] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const authHeader = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/shifts`, { headers: authHeader });
      setData(res.data);
    } catch (e: any) {
      notification.error({
        message: 'Failed to Load Shifts',
        description: e.response?.data?.message || 'An error occurred',
        placement: 'topRight',
      });
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  useEffect(() => { load(); }, [load]);

  const onFinish = async (values: any) => {
    try {
      const payload = {
        name: values.name,
        employee_type: values.employee_type,
        start_time: values.start_time.format('HH:mm'),
        end_time: values.end_time.format('HH:mm'),
      };
      await axios.post(`${API_BASE_URL}/api/shifts`, payload, { headers: authHeader });
      notification.success({
        message: 'Shift Saved',
        description: `${values.name} for ${values.employee_type}`,
        placement: 'topRight',
      });
      form.resetFields();
      load();
    } catch (e: any) {
      notification.error({
        message: 'Failed to Save Shift',
        description: e.response?.data?.message || 'An error occurred',
        placement: 'topRight',
      });
    }
  };

  const onDelete = async (id: string) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/shifts/${id}`, { headers: authHeader });
      notification.success({
        message: 'Shift Deleted',
        placement: 'topRight',
      });
      load();
    } catch (e: any) {
      notification.error({
        message: 'Failed to Delete Shift',
        description: e.response?.data?.message || 'An error occurred',
        placement: 'topRight',
      });
    }
  };

  return (
    <div>
      <Navigation />
      <div style={{ padding: '24px' }}>
        <Card title="Shift Settings">
          <Form
            layout="inline"
            form={form}
            onFinish={onFinish}
            style={{ rowGap: 12 }}
          >
            <Form.Item name="name" label="Shift Name" rules={[{ required: true }]}>
              <Input placeholder="e.g., General Shift" />
            </Form.Item>
            <Form.Item name="employee_type" label="Employee Type" rules={[{ required: true }]}>
              <Select placeholder="Select category" style={{ width: 180 }}>
                <Select.Option value="Office Staff">Office Staff</Select.Option>
                <Select.Option value="Factory Staff">Factory Staff</Select.Option>
                <Select.Option value="Intern">Intern</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="start_time" label="Start" rules={[{ required: true }]}>
              <TimePicker format="hh:mm A" defaultOpenValue={dayjs('09:00 AM', 'hh:mm A')} />
            </Form.Item>
            <Form.Item name="end_time" label="End" rules={[{ required: true }]}>
              <TimePicker format="hh:mm A" defaultOpenValue={dayjs('06:00 PM', 'hh:mm A')} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit">Save Shift</Button>
            </Form.Item>
          </Form>

          <div style={{ marginTop: 16 }}>
            <Table
              rowKey="id"
              loading={loading}
              dataSource={data}
              pagination={{ pageSize: 10 }}
              columns={[
                { title: 'Name', dataIndex: 'name' },
                { title: 'Employee Type', dataIndex: 'employee_type' },
                { 
                  title: 'Start', 
                  dataIndex: 'start_time',
                  render: (time: string) => {
                    if (!time) return '-';
                    const [hours, minutes] = time.split(':');
                    const hour = parseInt(hours);
                    const ampm = hour >= 12 ? 'PM' : 'AM';
                    const displayHour = hour % 12 || 12;
                    return `${displayHour.toString().padStart(2, '0')}:${minutes} ${ampm}`;
                  }
                },
                { 
                  title: 'End', 
                  dataIndex: 'end_time',
                  render: (time: string) => {
                    if (!time) return '-';
                    const [hours, minutes] = time.split(':');
                    const hour = parseInt(hours);
                    const ampm = hour >= 12 ? 'PM' : 'AM';
                    const displayHour = hour % 12 || 12;
                    return `${displayHour.toString().padStart(2, '0')}:${minutes} ${ampm}`;
                  }
                },
                {
                  title: 'Actions',
                  render: (_: any, r: Shift) => (
                    <Space>
                      <Popconfirm title="Delete shift?" onConfirm={() => onDelete(r.id)}>
                        <Button danger size="small">Delete</Button>
                      </Popconfirm>
                    </Space>
                  )
                },
              ]}
            />
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ShiftSettings;


