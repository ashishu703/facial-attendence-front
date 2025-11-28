import React, { useState, useEffect, useCallback } from 'react';
import { Button, Card, Table, Modal, Form, Input, message, Space, Popconfirm, Switch, InputNumber, AutoComplete, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import { createApiClient, handleApiError } from '../utils/apiUtils';
import { replacePlaceholders, getSampleData } from '../utils/templateUtils';

const { TextArea } = Input;

interface EmailConfig {
  config_id: number;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  from_email: string;
  from_name: string;
  template_type: string;
  event_type?: string;
  subject: string;
  email_body: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const EVENT_TYPES = [
  { value: 'employee_registered', label: 'Employee Registered' },
  { value: 'check_in_notification', label: 'Check-In Notification' },
  { value: 'check_out_notification', label: 'Check-Out Notification' },
  { value: 'custom', label: 'Custom Event' },
];

const AVAILABLE_VARIABLES: Record<string, string[]> = {
  employee_registered: [
    '{{employee_name}}', '{{employee_code}}', '{{department}}', '{{position}}',
    '{{email}}', '{{phone}}', '{{phone_number}}', '{{employee_type}}',
    '{{organization}}', '{{organization_name}}', '{{registration_date}}', '{{registration_time}}'
  ],
  check_in_notification: [
    '{{name}}', '{{username}}', '{{employee_name}}', '{{code}}', '{{employee_code}}',
    '{{date}}', '{{time}}', '{{in_time}}', '{{organization}}', '{{organization_name}}',
    '{{status}}', '{{shift_name}}'
  ],
  check_out_notification: [
    '{{name}}', '{{username}}', '{{employee_name}}', '{{code}}', '{{employee_code}}',
    '{{date}}', '{{time}}', '{{in_time}}', '{{out_time}}', '{{total_hours}}',
    '{{organization}}', '{{organization_name}}', '{{status}}', '{{shift_name}}'
  ],
  custom: [
    '{{name}}', '{{username}}', '{{employee_name}}', '{{code}}', '{{employee_code}}',
    '{{date}}', '{{time}}', '{{in_time}}', '{{out_time}}', '{{total_hours}}',
    '{{department}}', '{{position}}', '{{email}}', '{{phone}}', '{{phone_number}}',
    '{{employee_type}}', '{{organization}}', '{{organization_name}}', '{{status}}'
  ],
};

const EmailConfiguration: React.FC = () => {
  const [emailConfigs, setEmailConfigs] = useState<EmailConfig[]>([]);
  const [templateTypes, setTemplateTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewData, setPreviewData] = useState<{ subject: string; body: string } | null>(null);
  const [editingConfig, setEditingConfig] = useState<EmailConfig | null>(null);
  const [selectedEventType, setSelectedEventType] = useState<string>('');
  // We only need the setter for this helper state; value itself is never read
  const [, setCustomEventName] = useState<string>('');
  const [form] = Form.useForm();
  const { token } = useAuth();

  const fetchEmailConfigs = useCallback(async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const apiClient = createApiClient(token);
      const response = await apiClient.get('/api/email-config');
      setEmailConfigs(response.data);
    } catch (error: any) {
      message.error(handleApiError(error, 'Failed to fetch email configurations'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchTemplateTypes = useCallback(async () => {
    if (!token) return;
    
    try {
      const apiClient = createApiClient(token);
      const response = await apiClient.get('/api/email-config/templates/list');
      setTemplateTypes(response.data || []);
    } catch (error: any) {
      console.error('Failed to fetch template types:', error);
    }
  }, [token]);

  useEffect(() => {
    fetchEmailConfigs();
    fetchTemplateTypes();
  }, [fetchEmailConfigs, fetchTemplateTypes]);

  const handleAddOrEdit = () => {
    if (!token) return;
    
    form.validateFields().then(async (values) => {
      try {
        const apiClient = createApiClient(token);
        if (editingConfig) {
          await apiClient.put(`/api/email-config/${editingConfig.config_id}`, values);
          message.success('Email configuration updated successfully');
        } else {
          await apiClient.post('/api/email-config', values);
          message.success('Email configuration created successfully');
        }
        setModalVisible(false);
        form.resetFields();
        setEditingConfig(null);
        fetchEmailConfigs();
        fetchTemplateTypes();
      } catch (error: any) {
        message.error(handleApiError(error));
      }
    });
  };

  const handleEdit = (config: EmailConfig) => {
    setEditingConfig(config);
    // Check if event_type is a custom event (not in predefined list)
    const isCustomEvent = config.event_type && !EVENT_TYPES.find(e => e.value === config.event_type);
    const eventType = isCustomEvent ? 'custom' : (config.event_type || '');
    const computedCustomEventName = isCustomEvent ? (config.event_type || '') : '';
    
    form.setFieldsValue({
      ...config,
      event_type: eventType,
      custom_event_name: computedCustomEventName
    });
    setSelectedEventType(eventType);
    setCustomEventName(computedCustomEventName || '');
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    
    try {
      const apiClient = createApiClient(token);
      await apiClient.delete(`/api/email-config/${id}`);
      message.success('Email configuration deleted successfully');
      fetchEmailConfigs();
      fetchTemplateTypes();
    } catch (error: any) {
      message.error(handleApiError(error, 'Failed to delete email configuration'));
    }
  };

  const handlePreview = () => {
    form.validateFields(['subject', 'email_body', 'template_type']).then((values) => {
      const sampleData = getSampleData();
      
      // Strip HTML/CSS from subject - extract only text content
      let plainSubject = values.subject || '';
      plainSubject = plainSubject.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
      plainSubject = plainSubject.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
      plainSubject = plainSubject.replace(/<[^>]+>/g, '');
      const tempDivSubject = document.createElement('div');
      tempDivSubject.innerHTML = plainSubject;
      plainSubject = tempDivSubject.textContent || tempDivSubject.innerText || plainSubject;
      plainSubject = plainSubject
        .replace(/\{[^}]*\}/g, '')
        .replace(/[a-z-]+:\s*[^;]+;/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Strip HTML/CSS from body - extract only text content
      let plainBody = values.email_body || '';
      plainBody = plainBody.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
      plainBody = plainBody.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
      plainBody = plainBody.replace(/<[^>]+>/g, '');
      const tempDivBody = document.createElement('div');
      tempDivBody.innerHTML = plainBody;
      plainBody = tempDivBody.textContent || tempDivBody.innerText || plainBody;
      plainBody = plainBody
        .replace(/\{[^}]*\}/g, '') // Remove CSS blocks
        .replace(/[a-z-]+:\s*[^;]+;/gi, '') // Remove CSS properties
        .replace(/\.([a-z-]+)\s*\{/gi, '') // Remove CSS classes
        .replace(/#([a-z-]+)\s*\{/gi, '') // Remove CSS IDs
        .replace(/@[a-z]+\s*[^{]*\{/gi, '') // Remove CSS at-rules
        .replace(/<!doctype[^>]*>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\n\s*\n/g, '\n\n') // Preserve paragraph breaks
        .trim();
      
      if (!plainBody || plainBody.length < 3) {
        message.warning('No text content found in email body. Please enter a plain text message.');
        return;
      }
      
      const previewSubject = replacePlaceholders(plainSubject, sampleData);
      const previewBody = replacePlaceholders(plainBody, sampleData);
      setPreviewData({ subject: previewSubject, body: previewBody });
      setPreviewVisible(true);
    }).catch(() => {
      message.warning('Please fill in subject, email body, and template type to preview');
    });
  };

  const handleCancel = () => {
    setModalVisible(false);
    form.resetFields();
    setEditingConfig(null);
    setSelectedEventType('');
    setCustomEventName('');
  };

  const columns = [
    {
      title: 'Template Name',
      dataIndex: 'template_type',
      key: 'template_type',
      width: 180,
    },
    {
      title: 'Event Type',
      dataIndex: 'event_type',
      key: 'event_type',
      width: 150,
      render: (eventType: string) => eventType ? EVENT_TYPES.find(e => e.value === eventType)?.label || eventType : '-',
    },
    {
      title: 'From Email',
      dataIndex: 'from_email',
      key: 'from_email',
      width: 200,
    },
    {
      title: 'From Name',
      dataIndex: 'from_name',
      key: 'from_name',
      width: 150,
    },
    {
      title: 'SMTP Host',
      dataIndex: 'smtp_host',
      key: 'smtp_host',
      width: 180,
    },
    {
      title: 'SMTP Port',
      dataIndex: 'smtp_port',
      key: 'smtp_port',
      width: 100,
    },
    {
      title: 'Subject',
      dataIndex: 'subject',
      key: 'subject',
      width: 200,
      ellipsis: true,
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
      render: (_: any, record: EmailConfig) => (
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
          title="Email Configuration"
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingConfig(null);
                form.resetFields();
                form.setFieldsValue({ smtp_port: 587, smtp_secure: false, is_active: true });
                setSelectedEventType('');
                setCustomEventName('');
                setModalVisible(true);
              }}
            >
              Add Configuration
            </Button>
          }
        >
          <Table
            rowKey="config_id"
            dataSource={emailConfigs}
            columns={columns}
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            scroll={{ x: 1400 }}
          />
        </Card>

        <Modal
          title={editingConfig ? 'Edit Email Configuration' : 'Add Email Configuration'}
          open={modalVisible}
          onOk={handleAddOrEdit}
          onCancel={handleCancel}
          width={520}
          okText={editingConfig ? 'Update' : 'Create'}
          bodyStyle={{ maxHeight: '50vh', overflowY: 'auto' }}
        >
          <Form form={form} layout="vertical" initialValues={{ smtp_port: 587, smtp_secure: false, is_active: true }}>
            <Form.Item
              name="template_type"
              label="Template Name"
              rules={[{ required: true, message: 'Please enter template name' }]}
              tooltip="Enter a custom template name (e.g., check_in_notification, check_out_notification, welcome_email)"
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
              name="event_type"
              label="Event Type"
              tooltip="Select the event that will trigger this email template. For custom events, select 'Custom Event' and specify the event name below."
            >
              <Select
                placeholder="Select event type (optional)"
                allowClear
                onChange={(value) => {
                  setSelectedEventType(value || '');
                  if (value !== 'custom') {
                    setCustomEventName('');
                    form.setFieldsValue({ custom_event_name: '' });
                  }
                }}
              >
                {EVENT_TYPES.map(event => (
                  <Select.Option key={event.value} value={event.value}>
                    {event.label}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            {selectedEventType === 'custom' && (
              <Form.Item
                name="custom_event_name"
                label="Custom Event Name"
                rules={[{ required: true, message: 'Please enter custom event name' }]}
                tooltip="Enter a unique name for your custom event (e.g., 'employee_promotion', 'salary_credit', 'leave_approved'). This name will be used to trigger this template from your code."
              >
                <Input 
                  placeholder="e.g., employee_promotion, salary_credit, leave_approved"
                  onChange={(e) => setCustomEventName(e.target.value)}
                />
              </Form.Item>
            )}

            {selectedEventType && AVAILABLE_VARIABLES[selectedEventType] && (
              <Form.Item label="Available Variables">
                <div style={{ 
                  background: '#f5f5f5', 
                  padding: '12px', 
                  borderRadius: '4px',
                  maxHeight: '150px',
                  overflowY: 'auto'
                }}>
                  <div style={{ marginBottom: '8px', fontWeight: 600, fontSize: '12px' }}>
                    You can use these variables in Subject and Email Body:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {AVAILABLE_VARIABLES[selectedEventType].map((variable, idx) => (
                      <span
                        key={idx}
                        style={{
                          background: '#1890ff',
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          fontFamily: 'monospace'
                        }}
                        onClick={() => {
                          const currentBody = form.getFieldValue('email_body') || '';
                          form.setFieldsValue({ 
                            email_body: currentBody + (currentBody ? ' ' : '') + variable 
                          });
                        }}
                        title="Click to insert"
                      >
                        {variable}
                      </span>
                    ))}
                  </div>
                </div>
              </Form.Item>
            )}

            <Form.Item
              name="smtp_host"
              label="SMTP Host"
              rules={[{ required: true, message: 'Please enter SMTP host' }]}
            >
              <Input placeholder="e.g., smtp.gmail.com" />
            </Form.Item>

            <Form.Item
              name="smtp_port"
              label="SMTP Port"
              rules={[{ required: true, message: 'Please enter SMTP port' }]}
            >
              <InputNumber min={1} max={65535} placeholder="587" style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="smtp_secure"
              label="Use SSL/TLS"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>

            <Form.Item
              name="smtp_user"
              label="SMTP Username"
              rules={[{ required: true, message: 'Please enter SMTP username' }]}
            >
              <Input placeholder="Enter SMTP username/email" />
            </Form.Item>

            <Form.Item
              name="smtp_password"
              label="SMTP Password"
              rules={[{ required: !editingConfig, message: 'Please enter SMTP password' }]}
            >
              <Input.Password placeholder="Enter SMTP password" />
            </Form.Item>

            <Form.Item
              name="from_email"
              label="From Email"
              rules={[
                { required: true, message: 'Please enter from email' },
                { type: 'email', message: 'Please enter a valid email' }
              ]}
            >
              <Input placeholder="noreply@example.com" />
            </Form.Item>

            <Form.Item name="from_name" label="From Name">
              <Input placeholder="Your Company Name" />
            </Form.Item>

            <Form.Item
              name="subject"
              label="Email Subject"
              rules={[{ required: true, message: 'Please enter email subject' }]}
            >
              <Input placeholder="Enter email subject (use {{name}}, {{date}}, etc.)" />
            </Form.Item>

            <Form.Item
              name="email_body"
              label="Email Body (HTML supported)"
              rules={[{ required: true, message: 'Please enter email body' }]}
            >
              <TextArea 
                rows={6} 
                placeholder="Enter email body. Use HTML tags and placeholders like {{name}}, {{code}}, {{date}}, etc. Select an Event Type above to see available variables." 
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
                Preview Template
              </Button>
            </Form.Item>
          </Form>
        </Modal>

        {/* Preview Modal */}
        <Modal
          title="Email Template Preview"
          open={previewVisible}
          onCancel={() => setPreviewVisible(false)}
          footer={[
            <Button key="close" onClick={() => setPreviewVisible(false)}>
              Close
            </Button>
          ]}
          width={700}
        >
          {previewData && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <strong style={{ display: 'block', marginBottom: '8px' }}>📧 Subject:</strong>
                <div style={{ 
                  padding: '12px', 
                  background: '#f5f5f5', 
                  borderRadius: '6px', 
                  border: '1px solid #d9d9d9',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  fontSize: '14px'
                }}>
                  {previewData.subject}
                </div>
              </div>
              <div>
                <strong style={{ display: 'block', marginBottom: '8px' }}>📄 Message Body (How it will appear in email):</strong>
                <div 
                  style={{ 
                    padding: '16px', 
                    background: '#f8f9fa', 
                    borderRadius: '6px', 
                    marginTop: '8px',
                    minHeight: '250px',
                    border: '1px solid #dee2e6',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    color: '#212529',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
                  }}
                >
                  {previewData.body.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')}
                </div>
              </div>
              <div style={{ 
                marginTop: 16, 
                padding: '12px', 
                background: '#fff3cd', 
                borderRadius: '6px', 
                fontSize: '12px',
                border: '1px solid #ffc107'
              }}>
                <strong>📧 Email Preview:</strong> This shows the plain text version of your message. HTML tags are stripped to show how the message will appear. Actual emails will use real employee information and will render HTML if your email client supports it.
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default EmailConfiguration;
