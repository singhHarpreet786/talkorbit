import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';

@Component({
  selector: 'app-chatroom',
  templateUrl: './chatroom.component.html',
  styleUrls: ['./chatroom.component.css']
})
export class ChatroomComponent implements OnInit, OnDestroy {
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
  public chatToggle=false;
  visible = false;
  open(): void {
    this.visible = true;
  }

  close(): void {
    this.visible = false;
  }

  change(value: boolean): void {
    console.log(value);
  }

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
        audio: true   // keep mic so it can be sent to peer
      });
  
      if (this.localVideo) {
        // Only attach video tracks to your local preview
        const videoOnlyStream = new MediaStream(this.localStream.getVideoTracks());
        this.localVideo.nativeElement.srcObject = videoOnlyStream;
        this.localVideo.nativeElement.muted = true; // extra safety
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


  toogleChat(){
    this.chatToggle = !this.chatToggle;
  }
}
