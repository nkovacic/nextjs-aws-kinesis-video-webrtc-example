'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Video, VideoOff, Wifi, WifiOff } from 'lucide-react';
import { KVSWebRTCClient } from '@/lib/kvs-webrtc';

interface ProducerProps {
  config: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    channelName: string;
  };
  onBack: () => void;
}

export default function Producer({ config, onBack }: ProducerProps) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [error, setError] = useState<string>('');
  const [cameraPermission, setCameraPermission] = useState<'prompt' | 'granted' | 'denied' | 'checking'>('checking');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const kvsClientRef = useRef<KVSWebRTCClient | null>(null);

  const checkCameraPermission = async () => {
    try {
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      setCameraPermission(result.state);
      
      result.addEventListener('change', () => {
        setCameraPermission(result.state);
      });
      
      return result.state;
    } catch (err) {
      console.log('Permission API not supported, will request directly');
      return 'prompt';
    }
  };

  const requestCameraPermission = async () => {
    setCameraPermission('checking');
    setError('');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: true
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraPermission('granted');
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraPermission('denied');
          setError('Camera permission denied. Please enable camera access in your browser settings.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera device found. Please connect a camera.');
        } else {
          setError(`Camera access failed: ${err.message}`);
        }
      } else {
        setError('Camera access failed: Unknown error');
      }
    }
  };

  const startCamera = async () => {
    const permission = await checkCameraPermission();
    
    if (permission === 'granted') {
      await requestCameraPermission();
    } else if (permission === 'prompt') {
      await requestCameraPermission();
    } else if (permission === 'denied') {
      setCameraPermission('denied');
      setError('Camera permission denied. Please enable camera access in your browser settings.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startStreaming = async () => {
    try {
      setConnectionStatus('connecting');
      setError('');

      if (!streamRef.current) {
        setError('No camera stream available');
        setConnectionStatus('error');
        return;
      }

      // Initialize KVS WebRTC client as master (producer)
      kvsClientRef.current = new KVSWebRTCClient(config, 'MASTER');

      // Set up event handlers
      kvsClientRef.current.onConnectionStateChange((state) => {
        console.log('Connection state:', state);
        switch (state) {
          case 'connected':
            setConnectionStatus('connected');
            setIsStreaming(true);
            break;
          case 'failed':
          case 'disconnected':
            setConnectionStatus('error');
            setIsStreaming(false);
            break;
          case 'connecting':
            setConnectionStatus('connecting');
            break;
        }
      });

      kvsClientRef.current.onError((error) => {
        console.error('KVS WebRTC error:', error);
        setError(`Streaming error: ${error.message}`);
        setConnectionStatus('error');
        setIsStreaming(false);
      });

      // Connect with local stream
      await kvsClientRef.current.connect(streamRef.current);

    } catch (err) {
      setConnectionStatus('error');
      setError(`Streaming failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsStreaming(false);
    }
  };

  const stopStreaming = () => {
    setIsStreaming(false);
    setConnectionStatus('disconnected');
    if (kvsClientRef.current) {
      kvsClientRef.current.disconnect();
      kvsClientRef.current = null;
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      stopStreaming();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-600';
      case 'connecting': return 'bg-yellow-600';
      case 'error': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  const getStatusIcon = () => {
    return connectionStatus === 'connected' || connectionStatus === 'connecting' ? 
      <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-8">
          <Button
            onClick={onBack}
            variant="ghost"
            className="text-white hover:bg-gray-800 mr-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white">Producer Mode</h1>
            <p className="text-gray-300">Streaming to channel: {config.channelName}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  Local Camera Feed
                  <Badge className={`${getStatusColor()} text-white`}>
                    {getStatusIcon()}
                    {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  {!streamRef.current && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-white text-center">
                        {cameraPermission === 'checking' ? (
                          <>
                            <div className="w-12 h-12 mx-auto mb-2 border-4 border-gray-400 border-t-white rounded-full animate-spin" />
                            <p>Checking camera permission...</p>
                          </>
                        ) : cameraPermission === 'denied' ? (
                          <>
                            <VideoOff className="w-12 h-12 mx-auto mb-2 text-red-400" />
                            <p className="mb-4">Camera access denied</p>
                            <Button
                              onClick={requestCameraPermission}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              Request Permission
                            </Button>
                          </>
                        ) : cameraPermission === 'prompt' ? (
                          <>
                            <Video className="w-12 h-12 mx-auto mb-2 text-yellow-400" />
                            <p className="mb-4">Camera permission required</p>
                            <Button
                              onClick={requestCameraPermission}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              Enable Camera
                            </Button>
                          </>
                        ) : (
                          <>
                            <VideoOff className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                            <p>Camera not available</p>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Stream Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isStreaming ? (
                  <Button
                    onClick={startStreaming}
                    disabled={!streamRef.current || connectionStatus === 'connecting'}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    <Video className="w-4 h-4 mr-2" />
                    {connectionStatus === 'connecting' ? 'Connecting...' : 'Start Streaming'}
                  </Button>
                ) : (
                  <Button
                    onClick={stopStreaming}
                    className="w-full bg-red-600 hover:bg-red-700"
                  >
                    <VideoOff className="w-4 h-4 mr-2" />
                    Stop Streaming
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Connection Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Status:</span>
                    <Badge className={`${getStatusColor()} text-white`}>
                      {connectionStatus}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Camera:</span>
                    <Badge className={`${
                      cameraPermission === 'granted' ? 'bg-green-600' :
                      cameraPermission === 'denied' ? 'bg-red-600' :
                      cameraPermission === 'checking' ? 'bg-yellow-600' :
                      'bg-gray-600'
                    } text-white`}>
                      {cameraPermission}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Channel:</span>
                    <span className="text-white">{config.channelName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Region:</span>
                    <span className="text-white">{config.region}</span>
                  </div>
                  {isStreaming && (
                    <div className="flex justify-between">
                      <span className="text-gray-300">Duration:</span>
                      <span className="text-green-400">Live</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {error && (
              <Card className="bg-red-900 border-red-700">
                <CardHeader>
                  <CardTitle className="text-white">Error</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-red-200 text-sm">{error}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}