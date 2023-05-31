import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket, io } from 'socket.io-client';
import { useRouter } from 'next/router';
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@/utils/socket.types';

const ICE_SERVERS = {
  iceServers: [
    {
      urls: 'stun:openrelay.metered.ca:80',
    },
  ],
};

const Room = () => {
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');

  const userVideoRef = useRef<HTMLVideoElement>(null);
  const peerVideoRef = useRef<HTMLVideoElement>(null);
  const rtcConnectionRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<
    Socket<ServerToClientEvents, ClientToServerEvents> | undefined
  >();
  const userStreamRef = useRef<MediaStream>();

  const hostRef = useRef(false);

  const { id: roomId } = useRouter().query;
  const dbUrl = process.env.NEXT_PUBLIC_DB_URL;
  const token =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjQzYTBkMDhmLThhY2UtNDUwOS05MzBmLTJkN2Y2ZDg5MzM0MSIsImlhdCI6MTY4NTU0NDQwOCwiZXhwIjoxNjg4MTM2NDA4fQ.6yGG5zKh3YVZjzpWFABjQPS-tUOSk9EYXHoqAKm0aco';

  const getMessages = async () => {
    const data = await fetch(
      `${process.env.NEXT_PUBLIC_DB_API_URL}room/messages/${roomId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    ).then((r) => r.json());
    console.log(data);

    const messages = await data.data.map(
      (totalMessage: {
        businessId: string;
        id: string;
        messageBody: string;
        roomId: string;
        timeStamp: string;
        userId: string;
      }) => totalMessage.messageBody
    );
    setMessages(messages);
  };

  useEffect(() => {
    getMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    socketRef.current = io(`${dbUrl}`)!;

    socketRef.current.emit('join', roomId as string);

    socketRef.current.on('joined', handleRoomJoined);
    socketRef.current.on('created', handleRoomCreated);
    socketRef.current.on('ready', initiateCall);
    socketRef.current.on('leave', onPeerLeave);
    socketRef.current.on('full', () => {
      window.location.href = '/';
    });
    socketRef.current.on('offer', handleReceivedOffer);
    socketRef.current.on('answer', handleAnswer);
    socketRef.current.on('iceCandidate', handlerNewIceCandidateMsg);

    socketRef.current.on('chatMessage', () => getMessages());

    return () => {
      socketRef.current!.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const sendMessage = (event: React.FormEvent) => {
    event.preventDefault();
    if (currentMessage.trim() !== '') {
      try {
        socketRef.current?.emit(
          'chatMessage',
          currentMessage,
          roomId as string,
          '61d35439-8c20-46b2-9cc0-3f5ccf020dfa',
          '79a63af6-50ef-487b-9819-1a84a861ac3b'
        );
        setCurrentMessage('');
      } catch (error) {
        console.error(error);
      }
    }
  };

  const handleRoomJoined = () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({
          audio: true,
          video: { width: 500, height: 500 },
        })
        .then((stream) => {
          userStreamRef.current = stream;
          if (userVideoRef.current) {
            userVideoRef.current.srcObject = stream;
            userVideoRef.current.onloadedmetadata = () => {
              userVideoRef.current!.play();
            };
          }
          userStreamRef.current.getVideoTracks()[0].stop();
          socketRef.current!.emit('ready', roomId as string);
        })
        .catch((err) => {
          /* handle the error */
          console.log('error', err);
        });
    } else {
      console.error('getUserMedia is not supported in this browser.');
    }
  };

  const handleRoomCreated = () => {
    hostRef.current = true;
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({
          audio: true,
          video: { width: 500, height: 500 },
        })
        .then((stream) => {
          userStreamRef.current = stream;
          if (userVideoRef.current) {
            userVideoRef.current.srcObject = stream;
            userVideoRef.current.onloadedmetadata = () => {
              userVideoRef.current!.play();
            };
          }
          userStreamRef.current.getVideoTracks()[0].stop();
          socketRef.current!.emit('ready', roomId as string);
        })
        .catch((err) => {
          /* handle the error */
          console.error(err);
        });
    } else {
      console.error('getUserMedia is not supported in this browser.');
    }
  };

  const initiateCall = () => {
    if (hostRef.current) {
      rtcConnectionRef.current = createPeerConnection();
      rtcConnectionRef.current.addTrack(
        userStreamRef.current!.getTracks()[0],
        userStreamRef.current!
      );
      rtcConnectionRef.current.addTrack(
        userStreamRef.current!.getTracks()[1],
        userStreamRef.current!
      );

      rtcConnectionRef.current
        .createOffer()
        .then((offer) => {
          rtcConnectionRef.current!.setLocalDescription(offer);
          socketRef.current!.emit('offer', offer, roomId as string);
        })
        .catch((error) => {
          console.log(error);
        });
    }
  };

  const onPeerLeave = () => {
    hostRef.current = true;

    if (rtcConnectionRef.current) {
      rtcConnectionRef.current.close();
    }

    userVideoRef.current!.srcObject = null;
  };

  const handleReceivedOffer = (offer: RTCSessionDescriptionInit) => {
    rtcConnectionRef.current = createPeerConnection();
    rtcConnectionRef.current
      .setRemoteDescription(new RTCSessionDescription(offer))
      .then(() => {
        rtcConnectionRef.current!.createAnswer().then((answer) => {
          rtcConnectionRef.current!.setLocalDescription(answer);
          socketRef.current!.emit('answer', answer, roomId as string);
        });
      })
      .catch((error) => {
        console.log(error);
      });
  };

  const handleAnswer = (answer: RTCSessionDescriptionInit) => {
    rtcConnectionRef
      .current!.setRemoteDescription(new RTCSessionDescription(answer))
      .catch((error) => {
        console.log(error);
      });
  };

  const handlerNewIceCandidateMsg = (msg: RTCIceCandidate) => {
    const candidate = new RTCIceCandidate(msg);
    rtcConnectionRef.current!.addIceCandidate(candidate).catch((error) => {
      console.log(error);
    });
  };

  const createPeerConnection = () => {
    const rtcConnection = new RTCPeerConnection(ICE_SERVERS);

    rtcConnectionRef.current!.ontrack = (event) => {
      if (peerVideoRef.current) {
        peerVideoRef.current.srcObject = event.streams[0];
      }
    };

    rtcConnectionRef.current!.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current!.emit(
          'iceCandidate',
          event.candidate,
          roomId as string
        );
      }
    };

    rtcConnectionRef.current!.oniceconnectionstatechange = (event) => {
      if (rtcConnectionRef.current!.iceConnectionState === 'disconnected') {
        onPeerLeave();
      }
    };

    return rtcConnection;
  };

  const toggleMic = useCallback(() => {
    if (userStreamRef.current) {
      userStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !micActive;
      });
      setMicActive(!micActive);
    }
  }, [micActive]);

  const toggleCamera = useCallback(() => {
    if (userStreamRef.current) {
      const videoTracks = userStreamRef.current.getVideoTracks();
      videoTracks.forEach((track) => {
        if (cameraActive) {
          track.stop();
        } else {
          navigator.mediaDevices
            .getUserMedia({ video: { width: 500, height: 500 } })
            .then((stream) => {
              const newVideoTrack = stream.getVideoTracks()[0];
              userStreamRef.current!.addTrack(newVideoTrack);
              userStreamRef.current = stream;
              userVideoRef.current!.srcObject = stream;
              userVideoRef.current!.onloadedmetadata = () => {
                userVideoRef.current!.play();
              };
            })
            .catch((error) => {
              console.error('Error accessing camera:', error);
            });
        }
      });
    }
    setCameraActive(!cameraActive);
  }, [cameraActive]);

  const leaveRoom = useCallback(() => {
    socketRef.current!.emit('leave', roomId as string);
    onPeerLeave();
    window.location.href = '/';
  }, [roomId]);

  return (
    <div>
      <div>
        <video
          ref={userVideoRef}
          autoPlay
          muted
          playsInline
          style={{ display: cameraActive ? 'block' : 'none' }}
        />
      </div>
      <div
        style={{
          width: 500,
          height: 500,
          backgroundColor: 'green',
          display: cameraActive ? 'none' : 'block',
        }}
      ></div>
      <div>
        <video ref={peerVideoRef} autoPlay playsInline />
      </div>
      <div>
        {/* Chat Section */}
        <div>
          {messages.map((message, index) => (
            <div key={index}>{message}</div>
          ))}
        </div>
        <form onSubmit={sendMessage}>
          <input
            type='text'
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
          />
          <button type='submit'>Send</button>
        </form>
      </div>
      <div>
        <button onClick={toggleMic}>
          {micActive ? 'Mute Mic' : 'Unmute Mic'}
        </button>
        <button onClick={toggleCamera}>
          {cameraActive ? 'Disable Camera' : 'Enable Camera'}
        </button>
        <button onClick={leaveRoom}>Leave Room</button>
      </div>
    </div>
  );
};

export default Room;
