import React, { useRef, useState } from 'react';
import { Form, Input, Select, Button, Card, Row, Col, Spin, Tooltip, Modal, App as AntApp } from 'antd';
import { CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';
import Webcam from 'react-webcam';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';

const { Option } = Select;

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4500';
const VERIFY_API_URL = process.env.REACT_APP_VERIFY_API_URL || 'http://localhost:5002';
const REGISTER_API_URL = process.env.REACT_APP_REGISTER_API_URL || 'http://localhost:5003';

interface Organization {
  organization_id: number;
  organization_name: string;
}

const RegisterEmployee: React.FC = () => {
  const webcamRef = useRef<Webcam>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [faceVerified, setFaceVerified] = useState<boolean | null>(null);
  const [form] = Form.useForm();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const successAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const { token } = useAuth();

  React.useEffect(() => {
    // Short success beep (base64)
    const audio = new Audio('data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//sQZAAAAAADwAAAAnECAAA=');
    successAudioRef.current = audio;
    
    // Fetch organizations
    const fetchOrganizations = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/organizations`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setOrganizations(response.data);
      } catch (error) {
        console.error('Error fetching organizations:', error);
      }
    };
    
    if (token) {
      fetchOrganizations();
    }
  }, [token]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment' | undefined>('user');
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraKey, setCameraKey] = useState(0); // Force remount on retry
  const { message, notification } = AntApp.useApp();

  const verifyFace = async (imageSrc: string) => {
    setIsVerifying(true);
    try {
      const response = await fetch(imageSrc);
      const blob = await response.blob();
      const file = new File([blob], 'verify-face.jpg', { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('image', file);

      const result = await axios.post(`${VERIFY_API_URL}/api/employees/verify-face`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`,
        },
      });

      setFaceVerified(result.data.success);
      if (result.data.success) {
        notification.success({
          message: 'Face Verified',
          description: 'Your face has been verified successfully.',
          placement: 'topRight',
        });
      } else {
        notification.error({
          message: 'Face Not Detected',
          description: 'Please ensure the face is clearly visible and try again.',
          placement: 'topRight',
        });
      }
    } catch {
      notification.error({
        message: 'Face Verification Failed',
        description: 'Failed to verify face. Please try again.',
        placement: 'topRight',
      });
      setFaceVerified(false);
    } finally {
      setIsVerifying(false);
    }
  };

  const capturePhoto = async () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setCapturedImage(imageSrc);
      setFaceVerified(null);
      await verifyFace(imageSrc);
    } else {
      notification.error({
        message: 'Capture Failed',
        description: 'Failed to capture photo. Please ensure the camera is working and try again.',
        placement: 'topRight',
      });
    }
  };

  const handleCameraError = (error: string | DOMException) => {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorName = error instanceof DOMException ? error.name : 'Unknown';
    
    if (webcamRef.current?.video?.srcObject) {
      const stream = webcamRef.current.video.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    
    setCameraError(errorMessage);
    
    const errorMessages: Record<string, string> = {
      'NotReadableError': 'Camera is in use or cannot be accessed. Please: 1) Close all apps using the camera (Zoom, Teams, Skype, etc.), 2) Check Windows Camera Privacy settings, 3) Try restarting your browser.',
      'NotFoundError': 'No camera found. Please connect a camera and refresh the page.',
      'NotAllowedError': 'Camera permission denied. Please allow camera access in browser settings (click the camera icon in the address bar).'
    };
    
    const errorKey = Object.keys(errorMessages).find(key => 
      errorMessage.includes(key) || errorName === key
    );
    
    notification.error({
      message: 'Camera Error',
      description: errorKey ? errorMessages[errorKey] : `Camera access failed: ${errorMessage}. Please check permissions and try again.`,
      placement: 'topRight',
    });
  };

  const switchCamera = () => {
    // Stop current stream first
    if (webcamRef.current?.video?.srcObject) {
      const stream = webcamRef.current.video.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    
    if (availableDevices.length > 1 && deviceId) {
      // Switch between available devices
      const currentIndex = availableDevices.findIndex(device => device.deviceId === deviceId);
      const nextIndex = (currentIndex + 1) % availableDevices.length;
      setDeviceId(availableDevices[nextIndex].deviceId);
      setFacingMode(undefined); // Clear facingMode when using deviceId
    } else {
      // Fallback to facingMode switching
      setFacingMode(facingMode === 'user' ? 'environment' : 'user');
      setDeviceId(undefined);
    }
    setCameraError(null);
    setCameraKey(prev => prev + 1); // Force remount
  };

  const retryCamera = async () => {
    // Stop any existing streams
    if (webcamRef.current?.video?.srcObject) {
      const stream = webcamRef.current.video.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    
    // Wait a bit to ensure streams are fully stopped
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      const testStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      testStream.getTracks().forEach(track => track.stop());
    } catch (testError: any) {
      const errorMsg = testError.message || testError.name || 'Unknown error';
      if (errorMsg.includes('NotReadableError') || errorMsg.includes('Could not start video source')) {
        notification.error({
          message: 'Camera In Use',
          description: 'Camera is currently in use by another application. Please close all apps using the camera (Zoom, Teams, Skype, etc.) and try again.',
          placement: 'topRight',
        });
        setCameraError('Camera is in use by another application');
        return;
      }
    }
    
    // Reset everything
    setCameraError(null);
    setDeviceId(undefined);
    setFacingMode('user');
    setCameraKey(prev => prev + 1); // Force remount
  };

  // Cleanup: stop any active streams when component unmounts
  React.useEffect(() => {
    return () => {
      if (webcamRef.current?.video?.srcObject) {
        const stream = webcamRef.current.video.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const [isRegistering, setIsRegistering] = useState(false);

  const onFinish = async (values: any) => {
    if (!capturedImage) {
      notification.error({
        message: 'Photo Required',
        description: 'Please capture a photo before submitting.',
        placement: 'topRight',
      });
      return;
    }

    if (faceVerified === false) {
      notification.error({
        message: 'Face Verification Required',
        description: 'Please verify your face before submitting.',
        placement: 'topRight',
      });
      return;
    }

    if (!token) {
      notification.error({
        message: 'Authentication Required',
        description: 'You must be logged in to register employees.',
        placement: 'topRight',
      });
      return;
    }

    setIsRegistering(true);
    const loadingMessage = message.loading('Processing face recognition and registering employee. This may take 15-20 seconds...', 0);

    try {
      // Convert Base64 to Blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const file = new File([blob], 'employee-photo.jpg', { type: 'image/jpeg' });

      // Create FormData
      const formData = new FormData();
      formData.append('employee_name', values.employee_name);
      formData.append('department', values.department);
      formData.append('position', values.position);
      // job_role removed
      formData.append('email', values.email);
      formData.append('phone_number', values.phone_number);
      formData.append('employee_type', values.employee_type);
      formData.append('organization_id', values.organization_id);
      formData.append('aadhar_last4', values.aadhar_last4);
      formData.append('employee_code', generatedCode);
      formData.append('image', file);

      // Send to backend with increased timeout for face recognition (60 seconds)
      const responseData = await axios.post(`${REGISTER_API_URL}/api/employees/register`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`,
        },
        timeout: 60000, // 60 seconds timeout
      });

      loadingMessage();
      
      notification.success({
        message: 'Employee Registered',
        description: `Hi ${responseData.data.employee_name}! Your registration was successful.`,
        placement: 'topRight',
        icon: <CheckCircleFilled style={{ color: '#52c41a' }} />
      });
      Modal.success({
        title: 'Success',
        content: `Hi ${responseData.data.employee_name}! Your employee registration was completed successfully.`,
        centered: true,
        okText: 'Great'
      });
      successAudioRef.current?.play().catch(() => {});
      
      form.resetFields();
      setCapturedImage(null);
      setFaceVerified(null);
    } catch (error: any) {
      loadingMessage();
      
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        notification.error({
          message: '❌ Request Timeout',
          description: 'Face recognition is taking longer than expected. Please try again.',
          duration: 6,
          placement: 'topRight',
        });
      } else if (error.response) {
        const status = error.response.status;
        const errorMessage = error.response?.data?.message || 'Failed to register employee.';
        
        if (status === 400) {
          notification.error({
            message: '❌ Registration Failed',
            description: errorMessage || 'Invalid data provided. Please check all fields.',
            duration: 6,
            placement: 'topRight',
          });
        } else if (status === 401) {
          notification.error({
            message: '❌ Authentication Failed',
            description: 'You must be logged in to register employees.',
            duration: 6,
            placement: 'topRight',
          });
        } else {
          notification.error({
            message: '❌ Registration Error',
            description: errorMessage,
            duration: 6,
            placement: 'topRight',
          });
        }
      } else {
        notification.error({
          message: '❌ Network Error',
          description: error.message || 'Failed to connect to server. Please check your connection.',
          duration: 6,
          placement: 'topRight',
        });
      }
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div>
      <Navigation />
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <Card title="Register New Employee" style={{ marginBottom: '24px' }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          autoComplete="off"
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Employee Name"
                name="employee_name"
                rules={[{ required: true, message: 'Please enter employee name' }]}
              >
                <Input placeholder="Enter employee name" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Department"
                name="department"
                rules={[{ required: true, message: 'Please enter department' }]}
              >
                <Input placeholder="Enter department" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Position"
                name="position"
                rules={[{ required: true, message: 'Please enter position' }]}
              >
                <Input placeholder="Enter position" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Email"
                name="email"
                rules={[
                  { required: true, message: 'Please enter email' },
                  { type: 'email', message: 'Please enter a valid email' },
                ]}
              >
                <Input placeholder="Enter email address" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Phone Number"
                name="phone_number"
                rules={[{ required: true, message: 'Please enter phone number' }]}
              >
                <Input placeholder="Enter phone number" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Employee Type"
                name="employee_type"
                rules={[{ required: true, message: 'Please select employee type' }]}
              >
                <Select placeholder="Select employee type">
                  <Option value="Office Staff">Office Staff</Option>
                  <Option value="Factory Staff">Factory Staff</Option>
                  <Option value="Intern">Intern</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Organization"
                name="organization_id"
                rules={[{ required: true, message: 'Please select organization' }]}
              >
                <Select placeholder="Select organization" loading={organizations.length === 0}>
                  {organizations.map(org => (
                    <Option key={org.organization_id} value={org.organization_id}>
                      {org.organization_name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Aadhaar Last 4 Digits"
                name="aadhar_last4"
                rules={[
                  { required: true, message: 'Please enter last 4 digits' },
                  { len: 4, message: 'Enter exactly 4 digits' },
                  { pattern: /^[0-9]{4}$/, message: 'Only digits allowed' },
                ]}
              >
                <Input
                  maxLength={4}
                  placeholder="e.g., 1234"
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    const now = new Date();
                    const y = now.getFullYear();
                    const m = String(now.getMonth() + 1).padStart(2, '0');
                    const code = val.length === 4 ? `ANO/${y}${m}/${val}` : '';
                    setGeneratedCode(code);
                  }}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Generated Employee Code">
                <Input value={generatedCode} placeholder="Will generate after Aadhaar last 4" readOnly />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginTop: '24px' }}>
            <Col xs={24} md={12}>
              <Card 
                title={
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span>Capture Photo</span>
                    {faceVerified !== null && (
                      <span style={{ marginLeft: '10px' }}>
                        {faceVerified ? (
                          <Tooltip title="Face verified">
                            <CheckCircleFilled style={{ color: '#52c41a', fontSize: '20px' }} />
                          </Tooltip>
                        ) : (
                          <Tooltip title="Face not detected">
                            <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: '20px' }} />
                          </Tooltip>
                        )}
                      </span>
                    )}
                  </div>
                } 
                size="small"
                headStyle={{ 
                  backgroundColor: faceVerified === true ? '#f6ffed' : 
                                  faceVerified === false ? '#fff2f0' : 'inherit',
                  borderColor: faceVerified === true ? '#b7eb8f' : 
                                 faceVerified === false ? '#ffccc7' : 'inherit'
                }}
              >
                {cameraError ? (
                  <div style={{ 
                    padding: '20px', 
                    textAlign: 'center', 
                    background: '#fff3cd', 
                    borderRadius: '4px',
                    marginBottom: '16px'
                  }}>
                    <p style={{ color: '#856404', marginBottom: '10px' }}>
                      Camera Error: {cameraError}
                    </p>
                    <p style={{ color: '#856404', fontSize: '12px', marginBottom: '10px' }}>
                      Please check:
                    </p>
                    <ul style={{ color: '#856404', fontSize: '12px', textAlign: 'left', display: 'inline-block' }}>
                      {cameraError?.includes('not found') || cameraError?.includes('NotFoundError') ? (
                        <>
                          <li><strong>No camera detected</strong> - Connect a camera device</li>
                          <li>Check if camera is properly connected</li>
                          <li>Try unplugging and reconnecting the camera</li>
                          <li>Restart your browser after connecting camera</li>
                        </>
                      ) : cameraError?.includes('Permission') || cameraError?.includes('NotAllowed') ? (
                        <>
                          <li><strong>Camera permission denied</strong></li>
                          <li>Click the camera icon in the address bar</li>
                          <li>Select "Allow" for camera access</li>
                          <li>Or go to browser Settings → Privacy → Camera</li>
                        </>
                      ) : cameraError?.includes('in use') || cameraError?.includes('NotReadable') || cameraError?.includes('Could not start') ? (
                        <>
                          <li><strong>Camera is in use or blocked</strong></li>
                          <li><strong>Step 1:</strong> Close ALL apps using the camera:</li>
                          <li style={{ marginLeft: '20px' }}>• Zoom, Microsoft Teams, Skype, Discord</li>
                          <li style={{ marginLeft: '20px' }}>• Windows Camera app, Photo Booth</li>
                          <li style={{ marginLeft: '20px' }}>• Any other video conferencing apps</li>
                          <li><strong>Step 2:</strong> Check Windows Camera Privacy:</li>
                          <li style={{ marginLeft: '20px' }}>• Open Windows Settings → Privacy → Camera</li>
                          <li style={{ marginLeft: '20px' }}>• Enable "Allow apps to access your camera"</li>
                          <li style={{ marginLeft: '20px' }}>• Enable "Allow desktop apps to access your camera"</li>
                          <li><strong>Step 3:</strong> Check Task Manager:</li>
                          <li style={{ marginLeft: '20px' }}>• Press Ctrl+Shift+Esc</li>
                          <li style={{ marginLeft: '20px' }}>• Look for processes using the camera</li>
                          <li><strong>Step 4:</strong> Restart your browser completely</li>
                          <li><strong>Step 5:</strong> If still not working, restart your computer</li>
                        </>
                      ) : (
                        <>
                          <li>Camera permissions are allowed</li>
                          <li>No other app is using the camera</li>
                          <li>You're using HTTPS or localhost</li>
                          <li>Camera is properly connected</li>
                        </>
                      )}
                    </ul>
                    <Button 
                      type="primary" 
                      onClick={retryCamera}
                      style={{ marginTop: '10px' }}
                    >
                      Retry Camera
                    </Button>
                  </div>
                ) : (
                  <div style={{ 
                    marginBottom: '16px', 
                    position: 'relative',
                    border: '2px solid #d9d9d9',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    backgroundColor: '#f0f0f0',
                    minHeight: '240px'
                  }}>
                    <Webcam
                      key={`webcam-${cameraKey}-${deviceId || facingMode || 'default'}`}
                      audio={false}
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      width="100%"
                      videoConstraints={deviceId ? {
                        deviceId: { exact: deviceId }
                      } : {
                        facingMode: facingMode || 'user',
                        width: { ideal: 640 },
                        height: { ideal: 480 }
                      }}
                      onUserMedia={() => {
                        setCameraError(null);
                        
                        if (availableDevices.length === 0) {
                          navigator.mediaDevices.enumerateDevices()
                            .then(devices => {
                              const videoDevices = devices.filter(device => 
                                device.kind === 'videoinput' && device.deviceId && device.deviceId !== ''
                              );
                              if (videoDevices.length > 0) {
                                setAvailableDevices(videoDevices);
                                if (!deviceId && !facingMode) {
                                  setDeviceId(videoDevices[0].deviceId);
                                }
                              }
                            })
                            .catch(() => {});
                        }
                        
                        setTimeout(() => {
                          if (webcamRef.current?.video) {
                            const video = webcamRef.current.video;
                            if (video.paused) {
                              video.play().catch(() => {});
                            }
                          }
                        }, 200);
                      }}
                      onUserMediaError={(error) => {
                        handleCameraError(error);
                      }}
                      forceScreenshotSourceSize={false}
                      style={{ 
                        width: '100%', 
                        height: 'auto',
                        borderRadius: '4px',
                        minHeight: '240px',
                        maxHeight: '480px',
                        display: 'block',
                        objectFit: 'contain',
                        background: 'transparent'
                      }}
                      mirrored={true}
                    />
                    <Button 
                      type="default" 
                      size="small"
                      onClick={switchCamera}
                      style={{ 
                        position: 'absolute', 
                        top: '10px', 
                        right: '10px',
                        zIndex: 10
                      }}
                    >
                      Switch Camera
                    </Button>
                  </div>
                )}
                <Button 
                  type="primary" 
                  onClick={capturePhoto} 
                  block
                  disabled={!!cameraError}
                >
                  Capture Photo
                </Button>
              </Card>
            </Col>

            <Col xs={24} md={12}>
              <Card title="Captured Photo Preview" size="small">
                {capturedImage ? (
                  <div>
                    <img
                      src={capturedImage}
                      alt="Captured"
                      style={{ width: '100%', height: 'auto', marginBottom: '16px' }}
                    />
                    <Button
                      type="default"
                      onClick={() => setCapturedImage(null)}
                      block
                    >
                      Retake Photo
                    </Button>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                    No photo captured yet
                  </div>
                )}
              </Card>
            </Col>
          </Row>

          <Form.Item style={{ marginTop: '24px' }}>
            <Button 
              type="primary" 
              htmlType="submit" 
              size="large" 
              block
              loading={isRegistering}
              disabled={isRegistering}
            >
              {isRegistering ? 'Processing Face Recognition...' : 'Register Employee'}
            </Button>
          </Form.Item>
        </Form>
        </Card>
      </div>
    </div>
  );
};

export default RegisterEmployee;

