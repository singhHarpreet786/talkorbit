import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';

@Component({
  selector: 'app-testcomponent',
  template: `
    <div class="container">
      <div class="header">
        <h1>🎥 Video Chat</h1>
      </div>
      
      <div class="status" [class.pulse]="connectionStatus.includes('Ready') || connectionStatus.includes('Connected')">
        <div class="status-text">
          Status: {{ connectionStatus }}
          <span *ngIf="busy" class="loading"></span>
        </div>
        <div *ngIf="debugInfo" class="debug">{{ debugInfo }}</div>
      </div>
      
      <div class="video-container">
        <div class="video-wrapper">
          <div class="video-label">📱 Your Video</div>
          <video #localVideo class="local-video" autoplay muted playsinline></video>
        </div>
        <div class="video-wrapper">
          <div class="video-label">🌐 Remote Video</div>
          <video #remoteVideo autoplay playsinline></video>
          <div *ngIf="!remoteVideoActive" class="no-video">
            <div class="no-video-icon">📹</div>
            <div>Waiting for remote video...</div>
          </div>
        </div>
      </div>
      
      <div class="controls">
        <button class="btn btn-primary" (click)="createRoom()" [disabled]="busy">
          <span class="btn-icon">🚀</span>
          <span class="btn-text">Create Room</span>
        </button>
        <button class="btn btn-secondary" (click)="joinRandomRoom()" [disabled]="busy">
          <span class="btn-icon">🎲</span>
          <span class="btn-text">Join Random</span>
        </button>
        <button class="btn btn-danger" (click)="hangup()" [disabled]="!connected && !busy">
          <span class="btn-icon">📞</span>
          <span class="btn-text">Hang Up</span>
        </button>
      </div>
      
      <div class="room-info" *ngIf="roomId">
        <div class="room-label">Room ID</div>
        <div class="room-id">{{ roomId }}</div>
      </div>
      
      <div class="chat" *ngIf="connected">
        <div class="chat-header">
          <span class="chat-icon">💬</span>
          <span>Chat Messages</span>
        </div>
        <div class="messages" #messagesContainer>
          <div *ngFor="let message of messages" class="message" 
               [class.message-own]="message.sender === 'You'"
               [class.message-remote]="message.sender !== 'You'">
            <div class="message-sender">{{ message.sender }}</div>
            <div class="message-text">{{ message.text }}</div>
          </div>
        </div>
        <div class="message-input">
          <input 
            [(ngModel)]="messageText" 
            (keyup.enter)="sendMessage()" 
            placeholder="Type your message here..." 
            class="message-field"
          />
          <button class="btn btn-primary btn-send" (click)="sendMessage()">
            <span class="btn-icon">💬</span>
            <span class="btn-text-mobile">Send</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      border-radius: 20px;
    }
    
    .header {
      text-align: center;
      margin-bottom: 30px;
    }

    h1 {
      color: white;
      font-size: clamp(24px, 4vw, 36px);
      font-weight: 700;
      margin-bottom: 10px;
      text-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    }
    
    .status {
      background: rgba(255, 255, 255, 0.95);
      color: #2c3e50;
      padding: 15px 25px;
      border-radius: 50px;
      font-weight: 600;
      margin: 20px 0;
      text-align: center;
      position: relative;
      overflow: hidden;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
      backdrop-filter: blur(10px);
    }

    .status.pulse {
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.4); }
      70% { box-shadow: 0 0 0 10px rgba(102, 126, 234, 0); }
      100% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0); }
    }

    .status-text {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }

    .loading {
      display: inline-block;
      width: 18px;
      height: 18px;
      border: 2px solid rgba(102, 126, 234, 0.3);
      border-radius: 50%;
      border-top-color: #667eea;
      animation: spin 1s ease-in-out infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .debug {
      font-size: 12px;
      color: #666;
      margin-top: 8px;
      font-weight: 400;
    }
    
    .video-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin: 30px 0;
    }
    
    .video-wrapper {
      position: relative;
      background: #000;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.3);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      aspect-ratio: 4/3;
    }

    .video-wrapper:hover {
      transform: translateY(-5px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    }
    
    .video-label {
      position: absolute;
      top: 15px;
      left: 15px;
      color: white;
      font-size: 14px;
      font-weight: 600;
      z-index: 10;
      background: rgba(0, 0, 0, 0.7);
      padding: 8px 15px;
      border-radius: 20px;
      backdrop-filter: blur(10px);
    }
    
    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      background: #1a1a1a;
    }

    .local-video {
      transform: scaleX(-1);
    }
    
    .no-video {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #999;
      font-size: 16px;
      text-align: center;
      z-index: 5;
    }

    .no-video-icon {
      font-size: 48px;
      margin-bottom: 10px;
      opacity: 0.5;
    }
    
    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      justify-content: center;
      margin: 30px 0;
    }
    
    .btn {
      padding: 15px 30px;
      font-size: 16px;
      font-weight: 600;
      border: none;
      border-radius: 50px;
      cursor: pointer;
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
      min-width: 140px;
      text-transform: uppercase;
      letter-spacing: 1px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .btn-icon {
      font-size: 18px;
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
    }

    .btn-secondary {
      background: linear-gradient(135deg, #f093fb, #f5576c);
      color: white;
      box-shadow: 0 8px 25px rgba(245, 87, 108, 0.3);
    }

    .btn-danger {
      background: linear-gradient(135deg, #ff6b6b, #ee5a24);
      color: white;
      box-shadow: 0 8px 25px rgba(255, 107, 107, 0.3);
    }

    .btn:hover:not(:disabled) {
      transform: translateY(-3px);
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
    }

    .btn:active {
      transform: translateY(-1px);
    }

    .btn:disabled {
      background: #95a5a6 !important;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
      opacity: 0.6;
    }

    .btn-send {
      min-width: auto;
      padding: 15px 25px;
    }

    .btn-text-mobile {
      display: inline;
    }
    
    .room-info {
      text-align: center;
      margin: 25px 0;
      padding: 20px 25px;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 15px;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
      backdrop-filter: blur(10px);
    }

    .room-label {
      font-size: 14px;
      color: #666;
      margin-bottom: 8px;
      font-weight: 500;
    }

    .room-id {
      font-family: 'Courier New', monospace;
      font-size: 18px;
      color: #2c3e50;
      font-weight: 700;
      letter-spacing: 2px;
    }
    
    .chat {
      max-width: 600px;
      margin: 30px auto 0;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
      backdrop-filter: blur(10px);
    }

    .chat-header {
      padding: 20px 25px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      font-weight: 600;
      font-size: 18px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .chat-icon {
      font-size: 24px;
    }
    
    .messages {
      height: 250px;
      overflow-y: auto;
      padding: 20px;
      background: #f8fafc;
    }

    .messages::-webkit-scrollbar {
      width: 6px;
    }

    .messages::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 10px;
    }

    .messages::-webkit-scrollbar-thumb {
      background: #667eea;
      border-radius: 10px;
    }
    
    .message {
      margin-bottom: 15px;
      max-width: 80%;
      animation: slideIn 0.3s ease;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .message-own {
      margin-left: auto;
      text-align: right;
    }

    .message-own .message-sender {
      color: #667eea;
    }

    .message-own .message-text {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
    }

    .message-remote {
      margin-right: auto;
      text-align: left;
    }

    .message-remote .message-sender {
      color: #f5576c;
    }

    .message-remote .message-text {
      background: white;
      color: #2c3e50;
    }

    .message-sender {
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 4px;
      opacity: 0.8;
    }

    .message-text {
      padding: 12px 18px;
      border-radius: 20px;
      font-size: 14px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      word-wrap: break-word;
    }
    
    .message-input {
      display: flex;
      padding: 20px;
      background: white;
      gap: 12px;
    }
    
    .message-field {
      flex: 1;
      padding: 15px 20px;
      border: 2px solid #e1e8ed;
      border-radius: 25px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.3s ease;
      font-family: inherit;
    }

    .message-field:focus {
      border-color: #667eea;
    }

    .message-field::placeholder {
      color: #999;
    }

    /* Mobile Styles */
    @media (max-width: 768px) {
      .container {
        padding: 15px;
        border-radius: 15px;
        margin: 10px;
      }

      .video-container {
        grid-template-columns: 1fr;
        gap: 15px;
        margin: 20px 0;
      }

      .video-wrapper {
        aspect-ratio: 16/9;
      }

      .controls {
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }

      .btn {
        width: 100%;
        max-width: 280px;
        padding: 18px 30px;
        font-size: 18px;
      }

      .chat {
        margin: 20px auto 0;
      }

      .messages {
        height: 200px;
        padding: 15px;
      }

      .message {
        max-width: 95%;
      }

      .message-input {
        padding: 15px;
        flex-direction: column;
        gap: 10px;
      }

      .btn-send {
        width: 100%;
        max-width: none;
      }

      .btn-text-mobile {
        display: inline;
      }
    }

    /* Small mobile devices */
    @media (max-width: 480px) {
      .container {
        margin: 5px;
        padding: 10px;
      }

      h1 {
        font-size: 24px;
      }

      .status {
        padding: 12px 20px;
        font-size: 14px;
      }

      .video-label {
        font-size: 12px;
        padding: 6px 12px;
        top: 10px;
        left: 10px;
      }

      .btn {
        font-size: 16px;
        padding: 15px 25px;
      }

      .btn-text {
        font-size: 14px;
      }
    }

    /* Landscape mobile */
    @media (max-width: 768px) and (orientation: landscape) {
      .video-container {
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }

      .video-wrapper {
        aspect-ratio: 4/3;
      }

      .controls {
        flex-direction: row;
        flex-wrap: wrap;
      }

      .btn {
        width: auto;
        min-width: 120px;
        flex: 1;
      }
    }

    /* Large screens */
    @media (min-width: 1200px) {
      .video-container {
        gap: 30px;
      }

      .video-wrapper {
        aspect-ratio: 16/10;
      }

      .btn {
        padding: 18px 35px;
        font-size: 18px;
        min-width: 160px;
      }
    }
  `]
})
export class TestComponent implements OnInit, OnDestroy {
  @ViewChild('localVideo') localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLDivElement>;

  // Firebase configuration
  private firebaseConfig = {
    apiKey: "AIzaSyBWwNvekEx7Jt5TRWGINkHkdYkcQ7UeT6w",
    authDomain: "talkorbit-d3c43.firebaseapp.com",
    projectId: "talkorbit-d3c43",
    storageBucket: "talkorbit-d3c43.firebasestorage.app",
    messagingSenderId: "255813108622",
    appId: "1:255813108622:web:1729cd21efcd5d00c61adf",
    measurementId: "G-YLC68KRXGS"
  };

  private app: any;
  private db: any;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private unsubscribes: (() => void)[] = [];

  connectionStatus = 'Initializing...';
  debugInfo = '';
  busy = false;
  connected = false;
  remoteVideoActive = false;
  roomId: string | null = null;
  messages: {sender: string, text: string}[] = [];
  messageText = '';
  isOfferer = false;

  private servers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  async ngOnInit() {
    await this.initializeFirebase();
    await this.initializeMedia();
  }

  ngOnDestroy() {
    this.cleanup();
  }

  private async initializeFirebase() {
    try {
      this.app = initializeApp(this.firebaseConfig);
      this.db = getFirestore(this.app);
      this.connectionStatus = 'Firebase connected';
      console.log('Firebase initialized successfully');
    } catch (error) {
      console.error('Firebase initialization failed:', error);
      this.connectionStatus = 'Firebase connection failed';
    }
  }

  private async initializeMedia() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true
      });

      if (this.localVideo) {
        this.localVideo.nativeElement.srcObject = this.localStream;
      }

      this.connectionStatus = 'Ready to connect';
      console.log('Media initialized successfully');
    } catch (error) {
      console.error('Media access failed:', error);
      this.connectionStatus = 'Camera/microphone access denied';
    }
  }

  async createRoom() {
    if (!this.localStream || !this.db) {
      alert('Not ready - check camera and Firebase connection');
      return;
    }

    this.busy = true;
    this.isOfferer = true;
    this.connectionStatus = 'Creating room...';

    try {
      // Create peer connection
      this.createPeerConnection();

      // Add local stream
      this.localStream.getTracks().forEach(track => {
        this.pc!.addTrack(track, this.localStream!);
      });

      // Create data channel
      this.dataChannel = this.pc!.createDataChannel('chat');
      this.setupDataChannel();

      // Create room document
      const roomRef = await addDoc(collection(this.db, 'rooms'), {
        created: new Date().toISOString(),
        createdBy: 'user1'
      });

      this.roomId = roomRef.id;
      console.log('Room created:', this.roomId);

      // Create offer
      const offer = await this.pc!.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true
      });
      
      await this.pc!.setLocalDescription(offer);
      console.log('Local description set (offer)');

      // Save offer to Firestore
      await updateDoc(roomRef, {
        offer: {
          type: offer.type,
          sdp: offer.sdp
        }
      });

      this.connectionStatus = 'Waiting for someone to join...';
      this.debugInfo = `Room ID: ${this.roomId}`;

      // Listen for answer
      const unsubscribe1 = onSnapshot(doc(this.db, 'rooms', this.roomId), async (snapshot) => {
        const data = snapshot.data();
        if (data && data['answer'] && !this.pc?.remoteDescription) {
          console.log('Answer received');
          const answer = new RTCSessionDescription(data['answer']);
          await this.pc!.setRemoteDescription(answer);
          console.log('Remote description set (answer)');
        }
      });

      // Listen for remote ICE candidates
      const unsubscribe2 = onSnapshot(collection(this.db, 'rooms', this.roomId, 'answerCandidates'), (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            console.log('Adding remote ICE candidate:', data);
            try {
              await this.pc!.addIceCandidate(new RTCIceCandidate(data));
            } catch (error) {
              console.error('Error adding remote candidate:', error);
            }
          }
        });
      });

      this.unsubscribes.push(unsubscribe1, unsubscribe2);

    } catch (error) {
      console.error('Error creating room:', error);
      this.connectionStatus = 'Failed to create room';
      this.busy = false;
    }
  }

  async joinRandomRoom() {
    if (!this.localStream || !this.db) {
      alert('Not ready - check camera and Firebase connection');
      return;
    }

    this.busy = true;
    this.isOfferer = false;
    this.connectionStatus = 'Looking for room...';

    try {
      // Get all rooms and filter client-side (simpler than complex Firestore queries)
      const querySnapshot = await getDocs(collection(this.db, 'rooms'));
      let roomToJoin = null;
      let availableRooms = [];

      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        if (data['offer'] && !data['answer']) {
          availableRooms.push({ id: docSnap.id, data, created: data['created'] });
        }
      }

      // Sort by creation time (newest first) and pick the first available
      if (availableRooms.length > 0) {
        availableRooms.sort((a, b) => {
          const timeA = a.created ? new Date(a.created).getTime() : 0;
          const timeB = b.created ? new Date(b.created).getTime() : 0;
          return timeB - timeA; // Newest first
        });
        roomToJoin = availableRooms[0];
      }

      if (!roomToJoin) {
        this.connectionStatus = 'No available rooms found';
        this.busy = false;
        return;
      }

      console.log('Joining room:', roomToJoin.id);
      this.roomId = roomToJoin.id;

      // Create peer connection
      this.createPeerConnection();

      // Add local stream
      this.localStream.getTracks().forEach(track => {
        this.pc!.addTrack(track, this.localStream!);
      });

      // Handle incoming data channel
      this.pc!.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        this.setupDataChannel();
      };

      // Set remote description (offer)
      const offer = new RTCSessionDescription(roomToJoin.data['offer']);
      await this.pc!.setRemoteDescription(offer);
      console.log('Remote description set (offer)');

      // Create answer
      const answer = await this.pc!.createAnswer();
      await this.pc!.setLocalDescription(answer);
      console.log('Local description set (answer)');

      // Save answer to Firestore
      await updateDoc(doc(this.db, 'rooms', this.roomId), {
        answer: {
          type: answer.type,
          sdp: answer.sdp
        },
        answeredBy: 'user2'
      });

      this.connectionStatus = 'Connecting...';

      // Listen for remote ICE candidates
      const unsubscribe = onSnapshot(collection(this.db, 'rooms', this.roomId, 'offerCandidates'), (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            console.log('Adding remote ICE candidate:', data);
            try {
              await this.pc!.addIceCandidate(new RTCIceCandidate(data));
            } catch (error) {
              console.error('Error adding remote candidate:', error);
            }
          }
        });
      });

      this.unsubscribes.push(unsubscribe);

    } catch (error) {
      console.error('Error joining room:', error);
      this.connectionStatus = 'Failed to join room';
      this.busy = false;
    }
  }

  private createPeerConnection() {
    this.pc = new RTCPeerConnection(this.servers);
    console.log('Peer connection created');

    // Handle remote stream
    this.pc.ontrack = (event) => {
      console.log('Remote track received:', event);
      const remoteStream = event.streams[0];
      
      if (this.remoteVideo) {
        this.remoteVideo.nativeElement.srcObject = remoteStream;
        this.remoteVideoActive = true;
        console.log('Remote video set');
      }
    };

    // Handle ICE candidates
    this.pc.onicecandidate = async (event) => {
      if (event.candidate && this.roomId) {
        const candidateData = event.candidate.toJSON();
        const collectionName = this.isOfferer ? 'offerCandidates' : 'answerCandidates';
        
        console.log('Adding local ICE candidate to', collectionName);
        try {
          await addDoc(collection(this.db, 'rooms', this.roomId, collectionName), candidateData);
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    };

    // Handle connection state changes
    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      console.log('Connection state:', state);
      
      switch (state) {
        case 'connected':
          this.connectionStatus = 'Connected!';
          this.connected = true;
          this.busy = false;
          break;
        case 'disconnected':
          this.connectionStatus = 'Disconnected';
          this.connected = false;
          break;
        case 'failed':
          this.connectionStatus = 'Connection failed';
          this.connected = false;
          this.busy = false;
          break;
        case 'connecting':
          this.connectionStatus = 'Connecting...';
          break;
      }
    };

    // Handle ICE connection state
    this.pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', this.pc?.iceConnectionState);
    };
  }

  private setupDataChannel() {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log('Data channel opened');
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.messages.push({
          sender: 'Remote',
          text: message.text
        });
        this.scrollToBottom();
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    this.dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
    };
  }

  sendMessage() {
    if (!this.messageText.trim() || !this.dataChannel || this.dataChannel.readyState !== 'open') {
      return;
    }

    const message = {
      sender: 'You',
      text: this.messageText.trim()
    };

    this.messages.push(message);
    
    try {
      this.dataChannel.send(JSON.stringify({ text: message.text }));
    } catch (error) {
      console.error('Error sending message:', error);
    }

    this.messageText = '';
    this.scrollToBottom();
  }

  private scrollToBottom() {
    setTimeout(() => {
      if (this.messagesContainer) {
        const element = this.messagesContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    }, 100);
  }

  hangup() {
    this.cleanup();
    this.connectionStatus = 'Disconnected';
    this.busy = false;
    this.connected = false;
    this.remoteVideoActive = false;
    this.messages = [];
    this.roomId = null;
    this.debugInfo = '';
  }

  private cleanup() {
    // Unsubscribe from all Firestore listeners
    this.unsubscribes.forEach(unsubscribe => unsubscribe());
    this.unsubscribes = [];

    // Close peer connection
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    // Close data channel
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    // Clear remote video
    if (this.remoteVideo) {
      this.remoteVideo.nativeElement.srcObject = null;
    }

    // Clean up Firestore room
    if (this.roomId && this.db) {
      deleteDoc(doc(this.db, 'rooms', this.roomId)).catch(console.error);
    }
  }
}