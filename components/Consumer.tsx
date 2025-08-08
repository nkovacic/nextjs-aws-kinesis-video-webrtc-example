'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Play, Square, Wifi, WifiOff, Volume2, VolumeX } from 'lucide-react';

interface ConsumerProps {
  config: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    channelName: string;
  };
  onBack: () => void;
}

export default function Consumer({ config, onBack }: ConsumerProps) {
  const [isViewing, setIsViewing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [error, setError] = useState<string>('');
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const startViewing = async () => {
    try {
      setConnectionStatus('connecting');
      setError('');

      // In a real implementation, you would:
      // 1. Initialize AWS KVS WebRTC client
      // 2. Create RTCPeerConnection
      // 3. Connect as viewer to the channel
      // 4. Handle incoming remote stream
      
      // Simulated connection for demo
      setTimeout(() => {
        setConnectionStatus('connected');
        setIsViewing(true);
        
        // Simulate remote stream (would be actual stream from AWS KVS)
        if (videoRef.current) {
          // In real implementation, this would be the remote stream
          // videoRef.current.srcObject = remoteStream;
        }
      }, 2000);

    } catch (err) {
      setConnectionStatus('error');
      setError(`Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const stopViewing = () => {
    setIsViewing(false);
    setConnectionStatus('disconnected');
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  useEffect(() => {
    return () => {
      stopViewing();
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-900 to-gray-900">
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
            <h1 className="text-3xl font-bold text-white">Consumer Mode</h1>
            <p className="text-gray-300">Viewing channel: {config.channelName}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  Remote Stream View
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
                    playsInline
                    muted={isMuted}
                    className="w-full h-full object-cover"
                  />
                  {!isViewing && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-white text-center">
                        <Play className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                        <p>No stream connected</p>
                        <p className="text-sm text-gray-400">Start viewing to connect</p>
                      </div>
                    </div>
                  )}
                  {isViewing && (
                    <div className="absolute bottom-4 right-4">
                      <Button
                        onClick={toggleMute}
                        size="sm"
                        className="bg-black/50 hover:bg-black/70 text-white"
                      >
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Viewer Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isViewing ? (
                  <Button
                    onClick={startViewing}
                    disabled={connectionStatus === 'connecting'}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {connectionStatus === 'connecting' ? 'Connecting...' : 'Start Viewing'}
                  </Button>
                ) : (
                  <Button
                    onClick={stopViewing}
                    className="w-full bg-red-600 hover:bg-red-700"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Stop Viewing
                  </Button>
                )}
                
                {isViewing && (
                  <Button
                    onClick={toggleMute}
                    variant="outline"
                    className="w-full bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4 mr-2" /> : <Volume2 className="w-4 h-4 mr-2" />}
                    {isMuted ? 'Unmute' : 'Mute'}
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Connection Info</CardTitle>
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
                  <div className="flex justify-between">
                    <span className="text-gray-300">Audio:</span>
                    <span className={isMuted ? "text-red-400" : "text-green-400"}>
                      {isMuted ? "Muted" : "Active"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Stream Quality</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Resolution:</span>
                    <span className="text-white">1280x720</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Framerate:</span>
                    <span className="text-white">30 FPS</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Bitrate:</span>
                    <span className="text-white">2.5 Mbps</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Latency:</span>
                    <span className="text-green-400">~200ms</span>
                  </div>
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