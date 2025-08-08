'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Video, VideoOff, Wifi, WifiOff } from 'lucide-react';

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const startCamera = async () => {
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
    } catch (err) {
      setError(`Camera access failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
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

      // In a real implementation, you would:
      // 1. Initialize AWS KVS WebRTC client
      // 2. Create RTCPeerConnection
      // 3. Add local stream to peer connection
      // 4. Handle signaling through AWS KVS
      
      // Simulated connection for demo
      setTimeout(() => {
        setConnectionStatus('connected');
        setIsStreaming(true);
      }, 2000);

    } catch (err) {
      setConnectionStatus('error');
      setError(`Streaming failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const stopStreaming = () => {
    setIsStreaming(false);
    setConnectionStatus('disconnected');
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      stopStreaming();
    };
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
                        <VideoOff className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                        <p>Camera not available</p>
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