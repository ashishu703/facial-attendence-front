import React, { useState, useEffect } from 'react';
import { Button, Card, Table, Modal, Form, Input, message, Space, Popconfirm, Switch, AutoComplete } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import { createApiClient, handleApiError } from '../utils/apiUtils';
import { replacePlaceholders, getSampleData } from '../utils/templateUtils';

const { TextArea } = Input;

interface WhatsAppConfig {
  config_id: number;
  api_url: string;
  api_key: string;
  phone_number_id: string;
  business_account_id: string;
  from_number: string;
  template_type: string;
  message_body: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const WhatsAppConfiguration: React.FC = () => {
  const [whatsappConfigs, setWhatsappConfigs] = useState<WhatsAppConfig[]>([]);
  const [templateTypes, setTemplateTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewMessage, setPreviewMessage] = useState<string>('');
  const [editingConfig, setEditingConfig] = useState<WhatsAppConfig | null>(null);
  const [form] = Form.useForm();
  const { token } = useAuth();

  const fetchWhatsAppConfigs = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const apiClient = createApiClient(token);
      const response = await apiClient.get('/api/whatsapp-config');
      setWhatsappConfigs(response.data);
    } catch (error: any) {
      message.error(handleApiError(error, 'Failed to fetch WhatsApp configurations'));
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplateTypes = async () => {
    if (!token) return;
    
    try {
      const apiClient = createApiClient(token);
      const response = await apiClient.get('/api/whatsapp-config/templates/list');
      setTemplateTypes(response.data || []);
    } catch (error: any) {
      console.error('Failed to fetch template types:', error);
    }
  };

  useEffect(() => {
    if (token) {
      fetchWhatsAppConfigs();
      fetchTemplateTypes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleAddOrEdit = () => {
    if (!token) return;
    
    form.validateFields().then(async (values) => {
      try {
        const apiClient = createApiClient(token);
        if (editingConfig) {
          await apiClient.put(`/api/whatsapp-config/${editingConfig.config_id}`, values);
          message.success('WhatsApp configuration updated successfully');
        } else {
          await apiClient.post('/api/whatsapp-config', values);
          message.success('WhatsApp configuration created successfully');
        }
        setModalVisible(false);
        form.resetFields();
        setEditingConfig(null);
        fetchWhatsAppConfigs();
        fetchTemplateTypes();
      } catch (error: any) {
        message.error(handleApiError(error));
      }
    });
  };

  const handleEdit = (config: WhatsAppConfig) => {
    setEditingConfig(config);
    form.setFieldsValue(config);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    
    try {
      const apiClient = createApiClient(token);
      await apiClient.delete(`/api/whatsapp-config/${id}`);
      message.success('WhatsApp configuration deleted successfully');
      fetchWhatsAppConfigs();
      fetchTemplateTypes();
    } catch (error: any) {
      message.error(handleApiError(error, 'Failed to delete WhatsApp configuration'));
    }
  };

  const handlePreview = () => {
    form.validateFields(['message_body', 'template_type']).then((values) => {
      const sampleData = getSampleData();
      let messageBody = values.message_body || '';
      
      // Completely strip all HTML/CSS and extract only visible text
      let plainText = messageBody;
      
      // Remove all HTML tags including style, script, etc.
      plainText = plainText.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
      plainText = plainText.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
      plainText = plainText.replace(/<[^>]+>/g, '');
      
      // Decode HTML entities
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = plainText;
      plainText = tempDiv.textContent || tempDiv.innerText || plainText;
      
      // Clean up: remove CSS-like patterns, extra whitespace
      plainText = plainText
        .replace(/\{[^}]*\}/g, '') // Remove CSS blocks { ... }
        .replace(/[a-z-]+:\s*[^;]+;/gi, '') // Remove CSS properties
        .replace(/\.([a-z-]+)\s*\{/gi, '') // Remove CSS class definitions
        .replace(/#([a-z-]+)\s*\{/gi, '') // Remove CSS ID definitions
        .replace(/@[a-z]+\s*[^{]*\{/gi, '') // Remove CSS at-rules
        .replace(/<!doctype[^>]*>/gi, '') // Remove doctype
        .replace(/<!--[\s\S]*?-->/g, '') // Remove HTML comments
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      // If after stripping we have nothing meaningful, show a message
      if (!plainText || plainText.length < 3) {
        message.warning('No text content found. Please enter a plain text message.');
        return;
      }
      
      // Replace placeholders with sample data
      const previewMsg = replacePlaceholders(plainText, sampleData);
      setPreviewMessage(previewMsg);
      setPreviewVisible(true);
    }).catch(() => {
      message.warning('Please fill in message body and template type to preview');
    });
  };

  const handleCancel = () => {
    setModalVisible(false);
    form.resetFields();
    setEditingConfig(null);
  };

  const columns = [
    {
      title: 'Template Type',
      dataIndex: 'template_type',
      key: 'template_type',
      width: 180,
    },
    {
      title: 'API URL',
      dataIndex: 'api_url',
      key: 'api_url',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'From Number',
      dataIndex: 'from_number',
      key: 'from_number',
      width: 150,
    },
    {
      title: 'Phone Number ID',
      dataIndex: 'phone_number_id',
      key: 'phone_number_id',
      width: 150,
      ellipsis: true,
    },
    {
      title: 'Message Preview',
      dataIndex: 'message_body',
      key: 'message_body',
      width: 200,
      ellipsis: true,
      render: (text: string) => text ? text.substring(0, 50) + '...' : '',
    },
    {
      title: 'Active',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (active: boolean) => (
        <span style={{ color: active ? '#52c41a' : '#ff4d4f' }}>
          {active ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: WhatsAppConfig) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Are you sure you want to delete this configuration?"
            onConfirm={() => handleDelete(record.config_id)}
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
          title="WhatsApp Configuration"
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingConfig(null);
                form.resetFields();
                form.setFieldsValue({ is_active: true });
                setModalVisible(true);
              }}
            >
              Add Configuration
            </Button>
          }
        >
          <Table
            rowKey="config_id"
            dataSource={whatsappConfigs}
            columns={columns}
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            scroll={{ x: 1400 }}
          />
        </Card>

        <Modal
          title={editingConfig ? 'Edit WhatsApp Configuration' : 'Add WhatsApp Configuration'}
          open={modalVisible}
          onOk={handleAddOrEdit}
          onCancel={handleCancel}
          width={520}
          okText={editingConfig ? 'Update' : 'Create'}
          bodyStyle={{ maxHeight: '50vh', overflowY: 'auto' }}
        >
          <Form form={form} layout="vertical" initialValues={{ is_active: true }}>
            <Form.Item
              name="template_type"
              label="Template Name"
              rules={[{ required: true, message: 'Please enter template name' }]}
              tooltip="Enter a custom template name (e.g., check_in_notification, check_out_notification)"
            >
              <AutoComplete
                placeholder="Enter template name (e.g., check_in_notification)"
                options={templateTypes.map(t => ({ value: t }))}
                filterOption={(inputValue, option) =>
                  option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                }
                allowClear
              />
            </Form.Item>

            <Form.Item
              name="api_url"
              label="WhatsApp API URL"
              rules={[{ required: true, message: 'Please enter API URL' }]}
              tooltip="Your WhatsApp Business API endpoint (e.g., https://graph.facebook.com/v18.0/{phone-number-id}/messages)"
            >
              <Input placeholder="https://graph.facebook.com/v18.0/{phone-number-id}/messages" />
            </Form.Item>

            <Form.Item
              name="api_key"
              label="API Key / Access Token"
              rules={[{ required: true, message: 'Please enter API key' }]}
            >
              <Input.Password placeholder="Enter WhatsApp API access token" />
            </Form.Item>

            <Form.Item
              name="phone_number_id"
              label="Phone Number ID"
              tooltip="WhatsApp Business Phone Number ID"
            >
              <Input placeholder="Enter phone number ID (optional)" />
            </Form.Item>

            <Form.Item
              name="business_account_id"
              label="Business Account ID"
              tooltip="WhatsApp Business Account ID"
            >
              <Input placeholder="Enter business account ID (optional)" />
            </Form.Item>

            <Form.Item
              name="from_number"
              label="From Number"
              tooltip="The WhatsApp number that will send messages"
            >
              <Input placeholder="Enter WhatsApp number (e.g., +1234567890)" />
            </Form.Item>

            <Form.Item
              name="message_body"
              label="Message Body"
              rules={[{ required: true, message: 'Please enter message body' }]}
              tooltip="Use placeholders: {{name}}, {{code}}, {{date}}, {{time}}, {{in_time}}, {{out_time}}, {{total_hours}}, {{organization}}, {{status}}"
            >
              <TextArea 
                rows={6} 
                placeholder="Enter message body. Use placeholders: {{name}}, {{code}}, {{date}}, {{time}}, {{in_time}}, {{out_time}}, {{total_hours}}, {{organization}}, {{status}}" 
              />
            </Form.Item>

            <Form.Item
              name="is_active"
              label="Active"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item>
              <Button 
                type="default" 
                icon={<EyeOutlined />} 
                onClick={handlePreview}
                style={{ width: '100%' }}
              >
                Preview Message
              </Button>
            </Form.Item>
          </Form>
        </Modal>

        {/* Preview Modal */}
        <Modal
          title="WhatsApp Message Preview"
          open={previewVisible}
          onCancel={() => setPreviewVisible(false)}
          footer={[
            <Button key="close" onClick={() => setPreviewVisible(false)}>
              Close
            </Button>
          ]}
          width={500}
          styles={{ body: { padding: '24px' } }}
        >
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            margin: '0',
            padding: '0'
          }}>
            <div style={{ 
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '8px',
              padding: '0 0'
            }}>
              <div style={{ 
                padding: '12px 16px', 
                background: '#dcf8c6', 
                borderRadius: '12px',
                maxWidth: '90%',
                width: '100%',
                margin: '0 auto',
                border: '1px solid #b2d8a0',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: '14px',
                lineHeight: '1.5',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                textAlign: 'left'
              }}>
                {previewMessage}
              </div>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center',
              marginBottom: '16px',
              fontSize: '11px',
              color: '#999',
              width: '100%'
            }}>
              <span>✓✓</span>
            </div>
            <div style={{ 
              padding: '12px 16px', 
              background: '#f0f2f5', 
              borderRadius: '8px', 
              fontSize: '12px',
              color: '#666',
              margin: '0',
              width: '100%',
              textAlign: 'left'
            }}>
              <strong>📱 Preview:</strong> This is how the message will appear in WhatsApp. Placeholders are replaced with sample data.
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default WhatsAppConfiguration;

