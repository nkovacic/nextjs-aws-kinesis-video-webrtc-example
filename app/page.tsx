'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Video, VideoOff, Settings, Play, Square } from 'lucide-react';
import ConfigPanel from '@/components/ConfigPanel';
import Producer from '@/components/Producer';
import Consumer from '@/components/Consumer';

export default function Home() {
  const [mode, setMode] = useState<'select' | 'producer' | 'consumer'>('select');
  const [config, setConfig] = useState({
    region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1',
    accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY || '',
    channelName: process.env.NEXT_PUBLIC_KVS_CHANNEL_NAME || 'test-channel'
  });
  const [showConfig, setShowConfig] = useState(false);

  const isConfigured = config.accessKeyId && config.secretAccessKey;

  if (mode === 'producer') {
    return <Producer config={config} onBack={() => setMode('select')} />;
  }

  if (mode === 'consumer') {
    return <Consumer config={config} onBack={() => setMode('select')} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            AWS KVS WebRTC
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Real-time video streaming with Amazon Kinesis Video Streams WebRTC.
            Choose producer mode to stream from your webcam or consumer mode to view streams.
          </p>
          <div className="mt-6 flex justify-center">
            <Badge 
              variant={isConfigured ? "default" : "destructive"} 
              className="text-sm px-3 py-1"
            >
              {isConfigured ? '✓ Configured' : '⚠ Configuration Required'}
            </Badge>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center mb-8">
            <Button
              onClick={() => setShowConfig(!showConfig)}
              variant="outline"
              className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
            >
              <Settings className="w-4 h-4 mr-2" />
              Configuration
            </Button>
          </div>

          {showConfig && (
            <ConfigPanel 
              config={config} 
              onChange={setConfig} 
              onClose={() => setShowConfig(false)}
            />
          )}

          <div className="grid md:grid-cols-2 gap-8 mt-8">
            <Card className="bg-gray-800 border-gray-700 hover:bg-gray-750 transition-all duration-300 group cursor-pointer">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-4 w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                  <Video className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-2xl text-white">Producer</CardTitle>
                <p className="text-gray-400">Stream from your webcam</p>
              </CardHeader>
              <CardContent className="text-center">
                <div className="space-y-4">
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-white font-semibold mb-2">Features:</h3>
                    <ul className="text-gray-300 text-sm space-y-1">
                      <li>• Live webcam streaming</li>
                      <li>• Real-time connection status</li>
                      <li>• Video quality controls</li>
                      <li>• Stream start/stop controls</li>
                    </ul>
                  </div>
                  <Button 
                    onClick={() => setMode('producer')}
                    disabled={!isConfigured}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Producing
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700 hover:bg-gray-750 transition-all duration-300 group cursor-pointer">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-4 w-16 h-16 bg-green-600 rounded-full flex items-center justify-center group-hover:bg-green-500 transition-colors">
                  <VideoOff className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-2xl text-white">Consumer</CardTitle>
                <p className="text-gray-400">View incoming streams</p>
              </CardHeader>
              <CardContent className="text-center">
                <div className="space-y-4">
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-white font-semibold mb-2">Features:</h3>
                    <ul className="text-gray-300 text-sm space-y-1">
                      <li>• Live stream viewing</li>
                      <li>• Connection monitoring</li>
                      <li>• Video controls</li>
                      <li>• Stream quality info</li>
                    </ul>
                  </div>
                  <Button 
                    onClick={() => setMode('consumer')}
                    disabled={!isConfigured}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Start Viewing
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {!isConfigured && (
            <div className="mt-8 text-center">
              <p className="text-gray-400 mb-4">
                Please configure your AWS credentials to continue
              </p>
              <Button
                onClick={() => setShowConfig(true)}
                className="bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                <Settings className="w-4 h-4 mr-2" />
                Configure Now
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}