import { KinesisVideoClient, DescribeSignalingChannelCommand, GetSignalingChannelEndpointCommand } from '@aws-sdk/client-kinesis-video';
import { KinesisVideoSignalingClient, GetIceServerConfigCommand } from '@aws-sdk/client-kinesis-video-signaling';
import { SignalingClient, Role } from 'amazon-kinesis-video-streams-webrtc';

export interface KVSConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  channelName: string;
}

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export class KVSWebRTCClient {
  private kinesisVideoClient: KinesisVideoClient;
  private kinesisVideoSignalingClient: KinesisVideoSignalingClient;
  private signalingClient?: SignalingClient;
  private peerConnection?: RTCPeerConnection;
  private localStream?: MediaStream;
  private remoteStream?: MediaStream;
  private role: Role;
  private config: KVSConfig;
  private onRemoteStreamCallback?: (stream: MediaStream) => void;
  private onConnectionStateChangeCallback?: (state: RTCPeerConnectionState) => void;
  private onErrorCallback?: (error: Error) => void;
  private pendingICECandidates: RTCIceCandidate[] = [];

  constructor(config: KVSConfig, role: 'MASTER' | 'VIEWER') {
    this.config = config;
    this.role = role === 'MASTER' ? Role.MASTER : Role.VIEWER;

    const credentials = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    };

    this.kinesisVideoClient = new KinesisVideoClient({
      region: config.region,
      credentials,
    });

    this.kinesisVideoSignalingClient = new KinesisVideoSignalingClient({
      region: config.region,
      credentials,
    });
  }

  async connect(localStream?: MediaStream): Promise<void> {
    try {
      this.localStream = localStream;

      // Get signaling channel ARN
      const describeSignalingChannelCommand = new DescribeSignalingChannelCommand({
        ChannelName: this.config.channelName,
      });
      const describeSignalingChannelResponse = await this.kinesisVideoClient.send(describeSignalingChannelCommand);

      const channelARN = describeSignalingChannelResponse.ChannelInfo?.ChannelARN;
      if (!channelARN) {
        throw new Error('Failed to get channel ARN');
      }

      console.log('Channel ARN:', channelARN);

      // Get signaling channel endpoints
      const getSignalingChannelEndpointCommand = new GetSignalingChannelEndpointCommand({
        ChannelARN: channelARN,
        SingleMasterChannelEndpointConfiguration: {
          Protocols: ['WSS', 'HTTPS'],
          Role: this.role,
        },
      });
      const getSignalingChannelEndpointResponse = await this.kinesisVideoClient.send(getSignalingChannelEndpointCommand);

      const endpointsByProtocol = getSignalingChannelEndpointResponse.ResourceEndpointList?.reduce(
        (endpoints: any, endpoint: any) => {
          endpoints[endpoint.Protocol] = endpoint.ResourceEndpoint;
          return endpoints;
        },
        {}
      );

      if (!endpointsByProtocol) {
        throw new Error('Failed to get signaling endpoints');
      }

      console.log('Role:', this.role === Role.MASTER ? 'MASTER' : 'VIEWER');
      console.log('WSS Endpoint:', endpointsByProtocol.WSS);

      // Get ICE server configuration
      const getIceServerConfigCommand = new GetIceServerConfigCommand({
        ChannelARN: channelARN,
      });
      const getIceServerConfigResponse = await this.kinesisVideoSignalingClient.send(getIceServerConfigCommand);

      const iceServers: IceServer[] = [];
      if (getIceServerConfigResponse.IceServerList) {
        getIceServerConfigResponse.IceServerList.forEach((iceServer: any) => {
          iceServers.push({
            urls: iceServer.Uris,
            username: iceServer.Username,
            credential: iceServer.Password,
          });
        });
      }

      console.log('ICE servers configured:', iceServers.length);

      // Create peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers,
        iceTransportPolicy: 'all',
      });

      // Add local stream tracks to peer connection
      // Master always adds tracks for streaming
      // Viewer can optionally add tracks for bidirectional communication
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          console.log(`${this.role === Role.MASTER ? 'Master' : 'Viewer'} adding local track:`, track.kind);
          this.peerConnection?.addTrack(track, this.localStream!);
        });
      }

      // Handle remote stream
      this.peerConnection.ontrack = (event) => {
        console.log('Received remote track:', event.track.kind);
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        this.remoteStream.addTrack(event.track);
        if (this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(this.remoteStream);
        }
      };

      // Monitor connection state
      this.peerConnection.onconnectionstatechange = () => {
        if (this.peerConnection) {
          console.log('Peer connection state:', this.peerConnection.connectionState);
          if (this.onConnectionStateChangeCallback) {
            this.onConnectionStateChangeCallback(this.peerConnection.connectionState);
          }
        }
      };

      // Monitor ICE connection state
      this.peerConnection.oniceconnectionstatechange = () => {
        if (this.peerConnection) {
          console.log('ICE connection state:', this.peerConnection.iceConnectionState);
        }
      };

      // Set up ICE candidate handling
      this.peerConnection.onicecandidate = ({ candidate }) => {
        if (candidate && this.signalingClient) {
          console.log('Sending ICE candidate');
          this.signalingClient.sendIceCandidate(candidate);
        }
      };

      // Create signaling client
      console.log('Creating signaling client...');
      const signalingConfig: any = {
        channelARN,
        channelEndpoint: endpointsByProtocol.WSS,
        role: this.role,
        region: this.config.region,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
        systemClockOffset: 0,
      };

      // Viewer needs a clientId
      if (this.role === Role.VIEWER) {
        signalingConfig.clientId = `viewer-${Date.now()}-${Math.random().toString(36).substring(2)}`;
        console.log('Viewer clientId:', signalingConfig.clientId);
      }

      this.signalingClient = new SignalingClient(signalingConfig);

      // Set up signaling event handlers
      this.setupSignalingHandlers();

      // Open signaling connection
      console.log('Opening signaling connection...');
      this.signalingClient.open();

      // Wait for connection
      await this.waitForConnection();

    } catch (error) {
      console.error('Connection error:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error instanceof Error ? error : new Error(String(error)));
      }
      throw error;
    }
  }

  private setupSignalingHandlers(): void {
    if (!this.signalingClient) return;

    this.signalingClient.on('open', async () => {
      console.log('Signaling connected, role:', this.role === Role.MASTER ? 'MASTER' : 'VIEWER');
      
      if (this.role === Role.VIEWER) {
        // Viewer initiates connection by sending offer
        console.log('Viewer connected, sending offer to master...');
        await this.createAndSendOffer();
      }
      // Master waits for offers from viewers
    });

    this.signalingClient.on('sdpOffer', async (offer: any, remoteClientId: string) => {
      console.log('Received SDP offer from:', remoteClientId);
      
      // Master receives offers from viewers and responds with answers
      if (this.role === Role.MASTER && this.peerConnection) {
        try {
          await this.peerConnection.setRemoteDescription(offer);
          const answer = await this.peerConnection.createAnswer();
          await this.peerConnection.setLocalDescription(answer);
          this.signalingClient?.sendSdpAnswer(answer as RTCSessionDescription, remoteClientId);
          console.log('Master sent SDP answer to viewer:', remoteClientId);
          
          // Process pending ICE candidates
          for (const candidate of this.pendingICECandidates) {
            await this.peerConnection.addIceCandidate(candidate);
          }
          this.pendingICECandidates = [];
        } catch (error) {
          console.error('Error handling offer:', error);
        }
      }
    });

    this.signalingClient.on('sdpAnswer', async (answer: any, remoteClientId: string) => {
      console.log('Received SDP answer from:', remoteClientId || 'master');
      
      // Viewer receives answer from master
      if (this.role === Role.VIEWER && this.peerConnection) {
        try {
          await this.peerConnection.setRemoteDescription(answer);
          console.log('Viewer set remote description from master');
          
          // Process pending ICE candidates
          for (const candidate of this.pendingICECandidates) {
            await this.peerConnection.addIceCandidate(candidate);
          }
          this.pendingICECandidates = [];
        } catch (error) {
          console.error('Error handling answer:', error);
        }
      }
    });

    this.signalingClient.on('iceCandidate', async (candidate: any) => {
      console.log('Received ICE candidate');
      
      if (this.peerConnection) {
        if (!this.peerConnection.remoteDescription) {
          this.pendingICECandidates.push(candidate);
        } else {
          try {
            await this.peerConnection.addIceCandidate(candidate);
          } catch (error) {
            console.error('Error adding ICE candidate:', error);
          }
        }
      }
    });

    this.signalingClient.on('error', (error: any) => {
      console.error('Signaling error:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
    });

    this.signalingClient.on('close', () => {
      console.log('Signaling closed');
    });
  }

  private async createAndSendOffer(): Promise<void> {
    if (this.role !== Role.VIEWER || !this.peerConnection || !this.signalingClient) return;

    try {
      // Viewer creates offer to send to master
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await this.peerConnection.setLocalDescription(offer);
      this.signalingClient.sendSdpOffer(offer as RTCSessionDescription);
      console.log('Viewer sent SDP offer to master');
    } catch (error) {
      console.error('Error creating/sending offer:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000);
      
      this.signalingClient?.on('open', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      this.signalingClient?.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  disconnect(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = undefined;
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => track.stop());
      this.remoteStream = undefined;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = undefined;
    }

    if (this.signalingClient) {
      this.signalingClient.close();
      this.signalingClient = undefined;
    }
  }

  onRemoteStream(callback: (stream: MediaStream) => void): void {
    this.onRemoteStreamCallback = callback;
  }

  onConnectionStateChange(callback: (state: RTCPeerConnectionState) => void): void {
    this.onConnectionStateChangeCallback = callback;
  }

  onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  getStats(): Promise<RTCStatsReport> | undefined {
    return this.peerConnection?.getStats();
  }
}