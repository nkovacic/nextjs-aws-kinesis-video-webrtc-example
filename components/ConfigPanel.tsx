'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';

interface ConfigPanelProps {
  config: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    channelName: string;
  };
  onChange: (config: any) => void;
  onClose: () => void;
}

export default function ConfigPanel({ config, onChange, onClose }: ConfigPanelProps) {
  const handleChange = (key: string, value: string) => {
    onChange({
      ...config,
      [key]: value
    });
  };

  return (
    <Card className="bg-gray-800 border-gray-700 mb-8">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-white">AWS Configuration</CardTitle>
        <Button
          onClick={onClose}
          variant="ghost"
          size="sm"
          className="text-gray-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="region" className="text-white">AWS Region</Label>
            <Input
              id="region"
              value={config.region}
              onChange={(e) => handleChange('region', e.target.value)}
              placeholder="us-east-1"
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>
          <div>
            <Label htmlFor="channelName" className="text-white">Channel Name</Label>
            <Input
              id="channelName"
              value={config.channelName}
              onChange={(e) => handleChange('channelName', e.target.value)}
              placeholder="test-channel"
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="accessKeyId" className="text-white">Access Key ID</Label>
          <Input
            id="accessKeyId"
            type="password"
            value={config.accessKeyId}
            onChange={(e) => handleChange('accessKeyId', e.target.value)}
            placeholder="Your AWS Access Key ID"
            className="bg-gray-700 border-gray-600 text-white"
          />
        </div>
        <div>
          <Label htmlFor="secretAccessKey" className="text-white">Secret Access Key</Label>
          <Input
            id="secretAccessKey"
            type="password"
            value={config.secretAccessKey}
            onChange={(e) => handleChange('secretAccessKey', e.target.value)}
            placeholder="Your AWS Secret Access Key"
            className="bg-gray-700 border-gray-600 text-white"
          />
        </div>
        <div className="bg-gray-700 rounded-lg p-4 mt-4">
          <p className="text-gray-300 text-sm">
            <strong>Security Note:</strong> In production, use IAM roles or environment variables instead of hardcoded credentials.
            These credentials are only stored in your browser's memory and are not persisted.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}