import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button, App as AntApp, Modal } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import Webcam from 'react-webcam';
import axios from 'axios';
import * as faceapi from 'face-api.js';
import { useAuth } from '../context/AuthContext';

const MARK_API_URL = process.env.REACT_APP_MARK_API_URL || 'http://localhost:5001';

// Load face detection models from CDN
let modelsLoaded = false;
const loadFaceDetectionModels = async () => {
  if (modelsLoaded) return;
  try {
    const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    modelsLoaded = true;
    console.log('✅ Face detection models loaded successfully');
  } catch (error) {
    console.error('❌ Failed to load face detection models:', error);
  }
};

const MarkAttendance: React.FC = () => {
  const webcamRef = useRef<Webcam>(null);
  const [loading, setLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment' | undefined>('user');
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraKey, setCameraKey] = useState(0);
  const { token } = useAuth();
  const autoTriggeredRef = useRef(false);
  const presenceStartRef = useRef<number | null>(null);
  const successAudioRef = useRef<HTMLAudioElement | null>(null);
  const { notification } = AntApp.useApp();
  const [resultOpen, setResultOpen] = useState(false);
  const [resultTitle, setResultTitle] = useState<string>('');
  const [resultSub, setResultSub] = useState<string>('');
  const [resultStatus, setResultStatus] = useState<'success' | 'info' | 'error'>('success');
  const [faceBox, setFaceBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [faceDetected, setFaceDetected] = useState<boolean>(false);
  const cooldownUntilRef = useRef<number>(0);
  const lastFaceSigRef = useRef<string | null>(null);
  const [modelsReady, setModelsReady] = useState(false);
  const COOLDOWN_MS = 4000;

  // Load face detection models on mount
  useEffect(() => {
    loadFaceDetectionModels().then(() => {
      setModelsReady(true);
    });
  }, []);

  const CheckBoxIcon = ({ size = 96 }: { size?: number }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', margin: '0 auto 12px auto' }}
    >
      <rect x="12" y="12" width="60" height="60" rx="8" ry="8" fill="none" stroke="#111" strokeWidth="8" />
      <path
        d="M30 50 L44 62 L84 26"
        fill="none"
        stroke="#16a34a"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const ErrorIcon = ({ size = 96 }: { size?: number }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', margin: '0 auto 12px auto' }}
    >
      <circle cx="50" cy="50" r="40" fill="none" stroke="#ef4444" strokeWidth="8" />
      <path
        d="M30 30 L70 70 M70 30 L30 70"
        fill="none"
        stroke="#ef4444"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  useEffect(() => {
    const audio = new Audio('data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//sQZAAAAAADwAAAAnECAAA=');
    successAudioRef.current = audio;
  }, []);

  const handleCameraError = (error: string | DOMException) => {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorName = error instanceof DOMException ? error.name : 'Unknown';
    
    if (webcamRef.current?.video?.srcObject) {
      const stream = webcamRef.current.video.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    
    setCameraError(errorMessage);
    
    // Check if it's the "getUserMedia is not implemented" error (HTTPS issue)
    const isHTTPS = window.location.protocol === 'https:';
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isNotImplementedError = errorMessage.includes('not implemented') || 
                                   errorMessage.includes('getUserMedia is not implemented') ||
                                   errorMessage.includes('getUserMedia') && errorMessage.includes('not available');
    
    if (isNotImplementedError && !isHTTPS && !isLocalhost) {
      notification.error({
        message: 'HTTPS Required for Camera Access',
        description: `Camera access requires HTTPS. Your current URL is HTTP (${window.location.href}). Browser security policy blocks camera access on HTTP for non-localhost domains. Please configure SSL/HTTPS on your VPS server. For VPS: Use Nginx with Let's Encrypt SSL certificate.`,
        duration: 15,
      });
      return;
    }
    
    if (errorMessage.includes('NotReadableError') || errorMessage.includes('Could not start video source') || errorName === 'NotReadableError') {
      notification.error({
        message: 'Camera In Use',
        description: 'Camera is in use or cannot be accessed. Please: 1) Close all apps using the camera (Zoom, Teams, Skype, etc.), 2) Check Windows Camera Privacy settings, 3) Try restarting your browser.',
        duration: 8,
      });
    } else if (errorMessage.includes('NotFoundError') || errorMessage.includes('not found') || errorName === 'NotFoundError') {
      notification.error({
        message: 'No Camera Found',
        description: 'No camera device detected. Please connect a camera and refresh the page.',
        duration: 5,
      });
    } else if (errorMessage.includes('NotAllowedError') || errorMessage.includes('Permission denied') || errorName === 'NotAllowedError') {
      notification.error({
        message: 'Camera Permission Denied',
        description: 'Please allow camera access in browser settings (click the camera icon in the address bar).',
        duration: 5,
      });
    } else {
      notification.error({
        message: 'Camera Access Failed',
        description: errorMessage || 'Please check camera permissions and ensure no other app is using the camera.',
        duration: 5,
      });
    }
  };

  const switchCamera = () => {
    if (webcamRef.current?.video?.srcObject) {
      const stream = webcamRef.current.video.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    
    autoTriggeredRef.current = false;
    setLoading(false);
    
    if (availableDevices.length > 1 && deviceId) {
      const currentIndex = availableDevices.findIndex(device => device.deviceId === deviceId);
      const nextIndex = (currentIndex + 1) % availableDevices.length;
      setDeviceId(availableDevices[nextIndex].deviceId);
      setFacingMode(undefined);
    } else {
      setFacingMode(facingMode === 'user' ? 'environment' : 'user');
      setDeviceId(undefined);
    }
    setCameraError(null);
    setCameraKey(prev => prev + 1);
  };

  const retryCamera = async () => {
    if (webcamRef.current?.video?.srcObject) {
      const stream = webcamRef.current.video.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    
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
          duration: 8,
        });
        setCameraError('Camera is in use by another application');
        return;
      }
    }
    
    autoTriggeredRef.current = false;
    setCameraError(null);
    setDeviceId(undefined);
    setFacingMode('user');
    setLoading(false);
    setCameraKey(prev => prev + 1);
  };

  React.useEffect(() => {
    const webcam = webcamRef.current;
    return () => {
      if (webcam?.video?.srcObject) {
        const stream = webcam.video.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position),
        (error) => reject(error),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  };

  const handleMarkAttendance = useCallback(async () => {
    if (loading) return;
    
    setLoading(true);
    // start cooldown immediately to prevent duplicate submissions
    cooldownUntilRef.current = Date.now() + COOLDOWN_MS;

    try {

      // Start geolocation request early (with shorter timeout for faster UX)
      const geoPromise = getCurrentPosition().catch((geoError: any) => {
        throw geoError;
      });

      // Capture image immediately at lower quality to speed up upload/processing
      const imageSrc = webcamRef.current?.getScreenshot();
      if (!imageSrc) {
        setLoading(false);
        notification.error({
          message: 'Capture Failed',
          description: 'Failed to capture image. Please try again.',
          duration: 3,
        });
        return;
      }
      const imgFetch = fetch(imageSrc).then(r => r.blob());

      const [position, blob] = await Promise.all([geoPromise, imgFetch]);
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const file = new File([blob], 'attendance-photo.jpg', { type: 'image/jpeg' });

      const now = new Date();
      const timestamp = now.toISOString();
      const date = now.toISOString().split('T')[0];

      const formData = new FormData();
      formData.append('latitude', latitude.toString());
      formData.append('longitude', longitude.toString());
      formData.append('timestamp', timestamp);
      formData.append('date', date);
      formData.append('image', file);

      const headers: Record<string, string> = {
        'Content-Type': 'multipart/form-data',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const result = await axios.post(`${MARK_API_URL}/api/attendance/mark`, formData, {
        headers,
        timeout: 45000,
      });

      const responseData = result.data || {};
      const { status, employee_name, in_time, out_time } = responseData;
      
      if (!status || !employee_name) {
        setLoading(false);
        notification.error({
          message: '❌ Invalid Response',
          description: 'Server returned invalid data. Please try again.',
          duration: 5,
          placement: 'topRight',
        });
        return;
      }

      const formatTime = (time: string) => {
        try {
          const date = new Date(time);
          if (isNaN(date.getTime())) return time;
          const hours = date.getHours();
          const minutes = date.getMinutes();
          const seconds = date.getSeconds();
          const hour12 = hours % 12 || 12;
          const ampm = hours >= 12 ? 'pm' : 'am';
          return `${hour12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`;
        } catch {
          return time;
        }
      };
      
      setLoading(false);
      
      let overlayTitle = '';
      let overlaySub = '';
      if (status === 'checked_in') {
        const checkInTime = in_time ? formatTime(in_time) : 'N/A';
        overlayTitle = `Hi ${employee_name}!`;
        overlaySub = `Your check-in time is ${checkInTime}. Thank you.`;
        setResultStatus('success');
        successAudioRef.current?.play().catch(() => {});
      } else if (status === 'checked_out') {
        const checkOutTime = out_time ? formatTime(out_time) : 'N/A';
        overlayTitle = `Hi ${employee_name}!`;
        overlaySub = `You have checked out at ${checkOutTime}. Thank you.`;
        setResultStatus('success');
        successAudioRef.current?.play().catch(() => {});
      } else if (status === 'already_marked') {
        overlayTitle = `Hi ${employee_name || 'User'}!`;
        overlaySub = `Your attendance is already marked.`;
        setResultStatus('info');
      } else {
        overlayTitle = `Hi ${employee_name}!`;
        overlaySub = `Marked successfully.`;
        setResultStatus('success');
      }

      setResultTitle(overlayTitle);
      setResultSub(overlaySub);
      setResultOpen(true);
      // Auto-close result after 5 seconds for success/info
      setTimeout(() => {
        setResultOpen(false);
      }, 5000);

      // after successful mark, reset presence and last face signature after a short delay
      setTimeout(() => {
        presenceStartRef.current = null;
        lastFaceSigRef.current = null;
        autoTriggeredRef.current = false;
      }, 500);
    } catch (error: any) {
      setLoading(false);
      
      if (error.response) {
        const status = error.response.status;
        const errorMessage = error.response.data?.message || 'An error occurred';
        
        // Handle unregistered face (401) - face not registered
        if (status === 401) {
          setLoading(false);
          
          // Show toast notification
          notification.error({
            message: 'Face Not Registered',
            description: 'Your face is not registered. Please try again or contact admin.',
            duration: 5,
            placement: 'topRight',
          });
          
          // Reset detection state
          const centerBox = {
            x: 0.25,
            y: 0.15,
            width: 0.5,
            height: 0.7
          };
          setFaceBox(centerBox);
          setFaceDetected(false);
          presenceStartRef.current = null;
          autoTriggeredRef.current = false;
          lastFaceSigRef.current = null;
          
          // Small cooldown before trying again
          cooldownUntilRef.current = Date.now() + 2000;
          setTimeout(() => {
            autoTriggeredRef.current = false;
          }, 2000);
          
          return;
        }
        
        const statusMessages: Record<number, { message: string; description: string }> = {
          400: { message: '❌ Invalid Request', description: errorMessage || 'No face detected in the image. Please try again.' },
          404: { message: '❌ No Employees Found', description: errorMessage || 'No employees are registered in the system.' },
          500: { message: '❌ Server Error', description: errorMessage || 'An error occurred on the server. Please try again later.' }
        };
        
        const statusInfo = statusMessages[status] || { 
          message: '❌ Error', 
          description: errorMessage || 'An error occurred. Please try again.' 
        };
        
        notification.error({
          ...statusInfo,
          duration: 6,
          placement: 'topRight',
        });
      } else {
        const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
        notification.error({
          message: isTimeout ? '❌ Request Timeout' : '❌ Network Error',
          description: isTimeout 
            ? 'The request took too long. Face recognition is processing. Please try again.'
            : error.message || 'Failed to connect to server. Please check your connection.',
          duration: 6,
          placement: 'topRight',
        });
      }
    }
  }, [token, loading, notification]);

  const onCameraReady = () => {
    setCameraError(null);
    // No immediate auto-mark. We rely on 3s continuous face detection below.
  };

  // Client-side face detection with face-api.js (NO API calls for detection!)
  useEffect(() => {
    let isMounted = true;
    let checkTimer: any = null;
    let isDetecting = false;
    
    const detectFaceLocally = async () => {
      // Wait for models to load
      if (!modelsReady || isDetecting) {
        if (isMounted) {
          checkTimer = setTimeout(detectFaceLocally, 1000);
        }
        return;
      }
      
      // Basic checks
      // NOTE: Token is optional for unprotected route (/mark-attendance), so we allow face detection without token
      // The API call will handle authentication separately
      if (loading) {
        if (isMounted) {
          checkTimer = setTimeout(detectFaceLocally, 1000);
        }
        return;
      }
      
      const video = webcamRef.current?.video as HTMLVideoElement | undefined;
      // Check if video exists, is ready, AND has valid dimensions (CRITICAL for tablets!)
      if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        if (isMounted) {
          checkTimer = setTimeout(detectFaceLocally, 1000);
        }
        return;
      }

      // Check cooldown
      const nowTime = Date.now();
      if (nowTime < cooldownUntilRef.current) {
        presenceStartRef.current = null;
        setFaceDetected(false);
        setFaceBox(null);
        if (isMounted) {
          checkTimer = setTimeout(detectFaceLocally, 1000);
        }
        return;
      }

      isDetecting = true;

      try {
        // Detect face using TinyFaceDetector (FAST! - runs in browser, no API call)
        const options = new faceapi.TinyFaceDetectorOptions({
          inputSize: 224,  // Small input = faster detection
          scoreThreshold: 0.5
        });
        
        const detection = await faceapi.detectSingleFace(video, options);
        
        if (!isMounted) return;
        
        if (detection) {
          // ✅ FACE DETECTED! - Show GREEN oval
          const { box } = detection;
          const videoWidth = video.videoWidth;
          const videoHeight = video.videoHeight;
          
          // CRITICAL FIX: Double-check dimensions are valid before division (prevents NaN/Infinity on tablets)
          if (videoWidth <= 0 || videoHeight <= 0) {
            console.warn('[MarkAttendance] Video dimensions invalid:', { videoWidth, videoHeight });
            if (isMounted) {
              checkTimer = setTimeout(detectFaceLocally, 1000);
            }
            return;
          }
          
          // Normalized box coordinates for oval
          const normalizedBox = {
            x: box.x / videoWidth,
            y: box.y / videoHeight,
            width: box.width / videoWidth,
            height: box.height / videoHeight
          };
          
          setFaceBox(normalizedBox);
          setFaceDetected(true);
          
          const now = Date.now();
          // Start timer when face is first detected
          if (presenceStartRef.current === null) {
            presenceStartRef.current = now;
            console.log('[MarkAttendance] ✅ Face detected, timer started');
          }
          
          const elapsed = now - (presenceStartRef.current || now);
          
          // After 3 seconds continuous face detection, call mark API
          if (elapsed >= 3000 && !autoTriggeredRef.current) {
            autoTriggeredRef.current = true;
            console.log('[MarkAttendance] 🎯 3 seconds continuous face detected, calling mark API...');
            
            // Call mark API (it will match face with DB and mark attendance)
            handleMarkAttendance().then(() => {
              presenceStartRef.current = null;
              cooldownUntilRef.current = Date.now() + COOLDOWN_MS;
              
              setTimeout(() => { 
                if (isMounted) {
                  autoTriggeredRef.current = false;
                  console.log('[MarkAttendance] Ready for next attempt');
                }
              }, COOLDOWN_MS);
            });
          }
        } else {
          // ❌ NO FACE DETECTED - Show RED oval
          const centerBox = {
            x: 0.25,
            y: 0.15,
            width: 0.5,
            height: 0.7
          };
          setFaceBox(centerBox);
          setFaceDetected(false);
          presenceStartRef.current = null;
          lastFaceSigRef.current = null;
        }
      } catch (error) {
        console.error('[MarkAttendance] Face detection error:', error);
        // Show red oval on error
        const centerBox = {
          x: 0.25,
          y: 0.15,
          width: 0.5,
          height: 0.7
        };
        setFaceBox(centerBox);
        setFaceDetected(false);
      } finally {
        isDetecting = false;
        
        // Check again after 1 second (fast detection loop)
        if (isMounted) {
          checkTimer = setTimeout(detectFaceLocally, 1000);
        }
      }
    };
    
    // Start detection loop
    checkTimer = setTimeout(detectFaceLocally, 1000);
    
    // Cleanup
    return () => {
      isMounted = false;
      if (checkTimer) {
        clearTimeout(checkTimer);
      }
    };
  }, [token, loading, handleMarkAttendance, notification, modelsReady]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      padding: '20px',
      background: '#f5f5f5'
    }}>
      <div style={{ 
        position: 'relative',
        width: '500px',
        height: '500px',
        maxWidth: '90vw',
        maxHeight: '90vw'
      }}>
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {cameraError ? (
            <div style={{ 
              padding: '40px', 
              textAlign: 'center', 
              background: '#fff3cd', 
              borderRadius: '50%',
              border: '3px solid #ffc107',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <p style={{ color: '#856404', marginBottom: '15px', fontSize: '16px', fontWeight: 'bold' }}>
                Camera Access Failed
              </p>
              <p style={{ color: '#856404', marginBottom: '10px', fontSize: '14px' }}>
                {cameraError}
              </p>
              <Button 
                type="primary"
                onClick={retryCamera}
                style={{ marginTop: '20px' }}
              >
                Retry Camera Access
              </Button>
            </div>
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              border: '3px solid #16a34a',
              overflow: 'hidden',
              backgroundColor: '#f0f0f0',
              position: 'relative',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
              <Webcam
                key={`webcam-${cameraKey}-${deviceId || facingMode || 'default'}`}
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                screenshotQuality={0.6}
                width="100%"
                videoConstraints={deviceId ? {
                  deviceId: { exact: deviceId }
                } : {
                  facingMode: facingMode || 'user',
                  width: { ideal: 500 },
                  height: { ideal: 500 }
                }}
                onUserMedia={(stream) => {
                  setCameraError(null);
                  onCameraReady();
                  
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
                  
                  // CRITICAL FIX: Wait for video metadata to load (dimensions available) - especially important for tablets
                  const video = webcamRef.current?.video;
                  if (video) {
                    const checkVideoReady = () => {
                      if (video.videoWidth > 0 && video.videoHeight > 0) {
                        console.log('[MarkAttendance] ✅ Video ready with dimensions:', { 
                          width: video.videoWidth, 
                          height: video.videoHeight 
                        });
                        if (video.paused) {
                          video.play().catch(() => {});
                        }
                      } else {
                        // Retry after a short delay (tablets need more time)
                        setTimeout(checkVideoReady, 100);
                      }
                    };
                    
                    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
                      // Already ready
                      if (video.paused) {
                        video.play().catch(() => {});
                      }
                    } else {
                      // Wait for loadedmetadata event (fires when dimensions are available)
                      video.addEventListener('loadedmetadata', checkVideoReady, { once: true });
                      // Fallback timeout for tablets that might not fire event properly
                      setTimeout(checkVideoReady, 500);
                    }
                  }
                }}
                onUserMediaError={(error) => {
                  handleCameraError(error);
                }}
                forceScreenshotSourceSize={false}
                style={{ 
                  borderRadius: '50%',
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  objectFit: 'cover',
                  background: 'transparent'
                }}
                mirrored={true}
              />
              {/* Face overlay ring - Green when clear, Red when not clear */}
              {faceBox && webcamRef.current?.video && (
                (() => {
                  // scale the oval to be ~40% larger than before (0.7 -> 0.98)
                  const scale = 0.98;
                  const marginX = (1 - scale) / 2;
                  const marginY = (1 - scale) / 2;
                  const left = (faceBox.x + faceBox.width * marginX) * 100;
                  const top = (faceBox.y + faceBox.height * marginY) * 100;
                  const width = faceBox.width * scale * 100;
                  const height = faceBox.height * scale * 100;
                  return (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${left}%`,
                        top: `${top}%`,
                        width: `${width}%`,
                        height: `${height}%`,
                        border: `3px solid ${faceDetected ? '#16a34a' : '#ef4444'}`,
                        borderRadius: '50%',
                        boxShadow: `0 0 0 2px ${faceDetected ? 'rgba(22,163,74,0.2)' : 'rgba(239,68,68,0.2)'}`,
                        pointerEvents: 'none',
                        zIndex: 9
                      }}
                    />
                  );
                })()
              )}
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
              {/* Processing overlay when marking attendance */}
              {loading && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 15,
                    backdropFilter: 'blur(2px)'
                  }}
                >
                  <LoadingOutlined style={{ fontSize: 48, color: '#16a34a', marginBottom: 16 }} spin />
                  <div style={{ color: '#fff', fontSize: 18, fontWeight: 600 }}>
                    Processing Attendance...
                  </div>
                  <div style={{ color: '#fff', fontSize: 14, marginTop: 8, opacity: 0.8 }}>
                    Please wait
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <Modal
        open={resultOpen}
        footer={null}
        onCancel={() => setResultOpen(false)}
        closable={true}
        centered
        width={520}
        style={{ maxWidth: '90vw' }}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: '24px 16px', textAlign: 'center' }}>
          {resultStatus === 'error' ? <ErrorIcon size={96} /> : <CheckBoxIcon size={96} />}
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
            {resultTitle}
          </div>
          <div style={{ fontSize: 16, color: '#666' }}>
            {resultSub}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MarkAttendance;

