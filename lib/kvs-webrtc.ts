import AWS from 'aws-sdk';
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
  private kinesisVideoClient: AWS.KinesisVideo;
  private kinesisVideoSignalingClient: AWS.KinesisVideoSignalingChannels;
  private signalingClient?: SignalingClient;
  private peerConnection?: RTCPeerConnection;
  private localStream?: MediaStream;
  private remoteStream?: MediaStream;
  private role: Role;
  private config: KVSConfig;
  private onRemoteStreamCallback?: (stream: MediaStream) => void;
  private onConnectionStateChangeCallback?: (state: RTCPeerConnectionState) => void;
  private onErrorCallback?: (error: Error) => void;

  constructor(config: KVSConfig, role: 'MASTER' | 'VIEWER') {
    this.config = config;
    this.role = role === 'MASTER' ? Role.MASTER : Role.VIEWER;

    AWS.config.update({
      region: config.region,
      credentials: new AWS.Credentials({
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      }),
    });

    this.kinesisVideoClient = new AWS.KinesisVideo({
      region: config.region,
      correctClockSkew: true,
    });

    this.kinesisVideoSignalingClient = new AWS.KinesisVideoSignalingChannels({
      region: config.region,
      correctClockSkew: true,
    });
  }

  async connect(localStream?: MediaStream): Promise<void> {
    try {
      this.localStream = localStream;

      // Get signaling channel ARN
      const describeSignalingChannelResponse = await this.kinesisVideoClient
        .describeSignalingChannel({ ChannelName: this.config.channelName })
        .promise();

      const channelARN = describeSignalingChannelResponse.ChannelInfo?.ChannelARN;
      if (!channelARN) {
        throw new Error('Failed to get channel ARN');
      }

      // Get signaling channel endpoints
      const getSignalingChannelEndpointResponse = await this.kinesisVideoClient
        .getSignalingChannelEndpoint({
          ChannelARN: channelARN,
          SingleMasterChannelEndpointConfiguration: {
            Protocols: ['WSS', 'HTTPS'],
            Role: this.role,
          },
        })
        .promise();

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

      // Get ICE server configuration
      const getIceServerConfigResponse = await this.kinesisVideoSignalingClient
        .getIceServerConfig({ ChannelARN: channelARN })
        .promise();

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

      // Create peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers,
        iceTransportPolicy: 'all',
      });

      // Add local stream tracks to peer connection
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => {
          this.peerConnection?.addTrack(track, this.localStream!);
        });
      }

      // Handle remote stream
      this.peerConnection.ontrack = (event) => {
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
        if (this.onConnectionStateChangeCallback && this.peerConnection) {
          this.onConnectionStateChangeCallback(this.peerConnection.connectionState);
        }
      };

      // Create signaling client
      this.signalingClient = new SignalingClient({
        channelARN,
        channelEndpoint: endpointsByProtocol.WSS,
        role: this.role,
        region: this.config.region,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
        systemClockOffset: this.kinesisVideoClient.config.systemClockOffset,
      });

      // Handle signaling client events
      this.signalingClient.on('open', async () => {
        console.log('Signaling client connected');
      });

      this.signalingClient.on('sdpOffer', async (offer, remoteClientId) => {
        if (this.role === Role.VIEWER && this.peerConnection) {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await this.peerConnection.createAnswer();
          await this.peerConnection.setLocalDescription(answer);
          this.signalingClient?.sendSdpAnswer(answer as RTCSessionDescription, remoteClientId);
        }
      });

      this.signalingClient.on('sdpAnswer', async (answer) => {
        if (this.role === Role.MASTER && this.peerConnection) {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        }
      });

      this.signalingClient.on('iceCandidate', async (candidate) => {
        if (this.peerConnection) {
          await this.peerConnection.addIceCandidate(candidate);
        }
      });

      this.signalingClient.on('error', (error) => {
        console.error('Signaling client error:', error);
        if (this.onErrorCallback) {
          this.onErrorCallback(error);
        }
      });

      this.signalingClient.on('close', () => {
        console.log('Signaling client closed');
      });

      // Set up ICE candidate gathering
      this.peerConnection.onicecandidate = ({ candidate }) => {
        if (candidate) {
          if (this.role === Role.MASTER) {
            this.signalingClient?.sendIceCandidate(candidate);
          } else {
            this.signalingClient?.sendIceCandidate(candidate);
          }
        }
      };

      // Open signaling connection
      this.signalingClient.open();

      // Create and send offer if master
      if (this.role === Role.MASTER && this.peerConnection) {
        const offer = await this.peerConnection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await this.peerConnection.setLocalDescription(offer);
        this.signalingClient.sendSdpOffer(offer as RTCSessionDescription);
      }
    } catch (error) {
      console.error('Connection error:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error instanceof Error ? error : new Error(String(error)));
      }
      throw error;
    }
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