import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Input, Modal, Popconfirm, Table, message, Select, Tooltip, notification } from 'antd';
import axios from 'axios';
import Navigation from '../components/Navigation';
import { useAuth } from '../context/AuthContext';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4500';

interface Employee {
  employee_id: string;
  employee_name: string;
  department: string;
  position: string;
  email: string;
  phone_number: string;
  employee_type: string;
  aadhar_last4: string | null;
  employee_code: string | null;
}

const Employees: React.FC = () => {
  const { token } = useAuth();
  const [data, setData] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form] = Form.useForm();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/employees`, { headers });
      setData(res.data);
    } catch (e: any) {
      notification.error({
        message: 'Failed to Load Employees',
        description: e.response?.data?.message || 'An error occurred',
        placement: 'topRight',
      });
    } finally {
      setLoading(false);
    }
  }, [token, headers]);

  useEffect(() => { load(); }, [load]);

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    form.setFieldsValue(emp);
  };

  const saveEdit = async () => {
    try {
      const values = await form.validateFields();
      await axios.put(`${API_BASE_URL}/api/employees/${editing?.employee_id}`, values, { headers });
      notification.success({
        message: 'Employee Updated',
        description: values.employee_name,
        placement: 'topRight',
      });
      setEditing(null);
      load();
    } catch (e: any) {
      if (e?.response) {
        notification.error({
          message: 'Failed to Update Employee',
          description: e.response?.data?.message || 'An error occurred',
          placement: 'topRight',
        });
      }
    }
  };

  const remove = async (id: string) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/employees/${id}`, { headers });
      notification.success({
        message: 'Employee Deleted',
        placement: 'topRight',
      });
      load();
    } catch (e: any) {
      notification.error({
        message: 'Failed to Delete Employee',
        description: e.response?.data?.message || 'An error occurred',
        placement: 'topRight',
      });
    }
  };

  return (
    <div>
      <Navigation />
      <div style={{ padding: 24 }}>
        <Card title="All Employees">
          <Table
            rowKey="employee_id"
            loading={loading}
            dataSource={data}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            columns={[
              { title: 'Code', dataIndex: 'employee_code', width: 180 },
              { title: 'Name', dataIndex: 'employee_name' },
              { title: 'Type', dataIndex: 'employee_type', width: 140 },
              { title: 'Department', dataIndex: 'department' },
              { title: 'Position', dataIndex: 'position' },
              { title: 'Email', dataIndex: 'email' },
              { title: 'Phone', dataIndex: 'phone_number' },
              {
                title: 'Actions',
                key: 'actions',
                width: 160,
                render: (_: any, r: Employee) => (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Tooltip title="Edit">
                      <Button size="small" type="text" onClick={() => openEdit(r)} icon={<EditOutlined />} />
                    </Tooltip>
                    <Popconfirm title="Delete employee?" onConfirm={() => remove(r.employee_id)}>
                      <Tooltip title="Delete">
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                      </Tooltip>
                    </Popconfirm>
                  </div>
                )
              },
            ]}
          />
        </Card>

        <Modal
          title="Edit Employee"
          open={!!editing}
          onOk={saveEdit}
          onCancel={() => setEditing(null)}
          okText="Save"
        >
          <Form form={form} layout="vertical">
            <Form.Item name="employee_name" label="Name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="employee_type" label="Employee Type" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="Office Staff">Office Staff</Select.Option>
                <Select.Option value="Factory Staff">Factory Staff</Select.Option>
                <Select.Option value="Intern">Intern</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="department" label="Department" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="position" label="Position" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="phone_number" label="Phone Number" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="aadhar_last4" label="Aadhaar Last 4" rules={[{ len: 4, pattern: /^[0-9]{4}$/, message: 'Enter 4 digits' }]}>
              <Input maxLength={4} />
            </Form.Item>
            <Form.Item name="employee_code" label="Employee Code">
              <Input />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
};

export default Employees;


