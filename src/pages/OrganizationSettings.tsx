import React, { useState, useEffect } from 'react';
import { Button, Card, Table, Modal, Form, Input, message, Space, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4500';

interface Organization {
  organization_id: number;
  organization_name: string;
  organization_code: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone_number: string;
  email: string;
  employee_count: number;
}

const OrganizationSettings: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [form] = Form.useForm();
  const { token } = useAuth();

  const fetchOrganizations = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/organizations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrganizations(response.data);
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to fetch organizations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, [token]);

  const handleAddOrEdit = () => {
    form.validateFields().then(async (values) => {
      try {
        if (editingOrg) {
          await axios.put(
            `${API_BASE_URL}/api/organizations/${editingOrg.organization_id}`,
            values,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          message.success('Organization updated successfully');
        } else {
          await axios.post(
            `${API_BASE_URL}/api/organizations`,
            values,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          message.success('Organization created successfully');
        }
        setModalVisible(false);
        form.resetFields();
        setEditingOrg(null);
        fetchOrganizations();
      } catch (error: any) {
        message.error(error.response?.data?.message || 'Operation failed');
      }
    });
  };

  const handleEdit = (org: Organization) => {
    setEditingOrg(org);
    form.setFieldsValue(org);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/organizations/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      message.success('Organization deleted successfully');
      fetchOrganizations();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to delete organization');
    }
  };

  const handleCancel = () => {
    setModalVisible(false);
    form.resetFields();
    setEditingOrg(null);
  };

  const columns = [
    {
      title: 'Organization Name',
      dataIndex: 'organization_name',
      key: 'organization_name',
      width: 200,
    },
    {
      title: 'Organization Code',
      dataIndex: 'organization_code',
      key: 'organization_code',
      width: 150,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 200,
    },
    {
      title: 'Phone',
      dataIndex: 'phone_number',
      key: 'phone_number',
      width: 150,
    },
    {
      title: 'City',
      dataIndex: 'city',
      key: 'city',
      width: 120,
    },
    {
      title: 'State',
      dataIndex: 'state',
      key: 'state',
      width: 120,
    },
    {
      title: 'Employees',
      dataIndex: 'employee_count',
      key: 'employee_count',
      width: 100,
      render: (count: number) => count || 0,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: Organization) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Are you sure you want to delete this organization?"
            onConfirm={() => handleDelete(record.organization_id)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Navigation />
      <div style={{ padding: '24px' }}>
        <Card
          title="Organization Settings"
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingOrg(null);
                form.resetFields();
                setModalVisible(true);
              }}
            >
              Add Organization
            </Button>
          }
        >
          <Table
            rowKey="organization_id"
            dataSource={organizations}
            columns={columns}
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            scroll={{ x: 1200 }}
          />
        </Card>

        <Modal
          title={editingOrg ? 'Edit Organization' : 'Add Organization'}
          open={modalVisible}
          onOk={handleAddOrEdit}
          onCancel={handleCancel}
          width={520}
          okText={editingOrg ? 'Update' : 'Create'}
          styles={{ body: { maxHeight: '50vh', overflowY: 'auto' } }}
        >
          <Form form={form} layout="vertical">
            <Form.Item
              name="organization_name"
              label="Organization Name"
              rules={[{ required: true, message: 'Please enter organization name' }]}
            >
              <Input placeholder="Enter organization name" />
            </Form.Item>

            <Form.Item
              name="organization_code"
              label="Organization Code"
              rules={[{ required: false }]}
            >
              <Input placeholder="Enter organization code (optional)" />
            </Form.Item>

            <Form.Item
              name="email"
              label="Email"
              rules={[{ type: 'email', message: 'Please enter a valid email' }]}
            >
              <Input placeholder="Enter email address" />
            </Form.Item>

            <Form.Item name="phone_number" label="Phone Number">
              <Input placeholder="Enter phone number" />
            </Form.Item>

            <Form.Item name="address" label="Address">
              <Input.TextArea rows={2} placeholder="Enter address" />
            </Form.Item>

            <Form.Item name="city" label="City">
              <Input placeholder="Enter city" />
            </Form.Item>

            <Form.Item name="state" label="State">
              <Input placeholder="Enter state" />
            </Form.Item>

            <Form.Item name="country" label="Country">
              <Input placeholder="Enter country" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
};

export default OrganizationSettings;

