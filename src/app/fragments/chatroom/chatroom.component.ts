import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, updateDoc, deleteDoc, getDoc, onSnapshot, query, where, arrayUnion } from 'firebase/firestore';

@Component({
  selector: 'app-chatroom',
  templateUrl: './chatroom.component.html',
  styleUrls: ['./chatroom.component.css']
})
export class ChatroomComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('localVideo', { static: false }) localVideo!: ElementRef<HTMLVideoElement>;
@ViewChild('remoteVideo', { static: false }) remoteVideo!: ElementRef<HTMLVideoElement>;

  userId: string | null = null;
  sessionId: string | null = null;
  db: any = null;
  loading: boolean = true;
  queueStatus: 'inQueue' | 'inChat' | null = null;
  partnerId: string | null = null;
  chatMessages: any[] = [];
  messageInput: string = '';

  localStream!: MediaStream;
  peerConnection!: RTCPeerConnection | null;

  private appId: string = 'AIzaSyBWwNvekEx7Jt5TRWGINkHkdYkcQ7UeT6w';
  private publicDataPath: string = `/artifacts/${this.appId}/public/data`;
  private queueCollection: any;
  private usersCollection: any;
  private chatsCollection: any;
  private callsCollection: any;

  private userSub: (() => void) | null = null;
  private queueSub: (() => void) | null = null;
  private chatSub: (() => void) | null = null;
  private callSub: (() => void) | null = null;

  private auth: any;

  async ngOnInit(): Promise<void> {
    try {
      const firebaseConfig = {
        apiKey: "AIzaSyBWwNvekEx7Jt5TRWGINkHkdYkcQ7UeT6w",
        authDomain: "talkorbit-d3c43.firebaseapp.com",
        projectId: "talkorbit-d3c43",
        storageBucket: "talkorbit-d3c43.firebasestorage.app",
        messagingSenderId: "255813108622",
        appId: "1:255813108622:web:1729cd21efcd5d00c61adf",
        measurementId: "G-YLC68KRXGS"
      };

      const app = initializeApp(firebaseConfig);
      this.auth = getAuth(app);
      this.db = getFirestore(app);

      this.queueCollection = collection(this.db, `${this.publicDataPath}/queue`);
      this.usersCollection = collection(this.db, `${this.publicDataPath}/users`);
      this.chatsCollection = collection(this.db, `${this.publicDataPath}/chats`);
      this.callsCollection = collection(this.db, `${this.publicDataPath}/calls`);

      this.sessionId = crypto.randomUUID();

      onAuthStateChanged(this.auth, async (user) => {
        if (user) {
          this.userId = user.uid;
          this.setupListeners();
        } else {
          const initialAuthToken = null;
          if (initialAuthToken) {
            await signInWithCustomToken(this.auth, initialAuthToken);
          } else {
            await signInAnonymously(this.auth);
          }
        }
      });
    } catch (error) {
      console.error("Initialization failed:", error);
      this.loading = false;
    }
  }

  async ngAfterViewInit(): Promise<void> {
   this.setupLocalCamera();
  }

  async setupLocalCamera(){
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    

      if (this.localVideo?.nativeElement) {
        console.log("coming herer==========>")
        this.localVideo.nativeElement.srcObject = this.localStream;
        this.localVideo.nativeElement.muted = true;
        await this.localVideo.nativeElement.play().catch(err => console.error('Local video play error:', err));
      }
    } catch (err) {
      console.error('Error accessing webcam:', err);
    }
  }

  setupListeners(): void {
    if (!this.userId || !this.db || !this.sessionId) {
      console.error("Missing IDs or Firestore.");
      return;
    }

    this.userSub = onSnapshot(doc(this.usersCollection, this.userId), async (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        this.queueStatus = userData['queueStatus'];
        this.partnerId = userData['partnerId'];

        if (this.partnerId && !this.chatSub) {
          this.setupChatListener();
          await this.setupPeerConnection();
        } else if (!this.partnerId && this.chatSub) {
          this.chatSub();
          this.chatSub = null;
          this.chatMessages = [];
          this.closePeerConnection();
        }
      } else {
        this.queueStatus = null;
        this.partnerId = null;
        this.chatMessages = [];
        if (this.chatSub) {
          this.chatSub();
          this.chatSub = null;
        }
        this.closePeerConnection();
      }
      this.loading = false;
    });

    this.queueSub = onSnapshot(query(this.queueCollection, where("userId", "!=", this.userId)), async (queueSnapshot) => {
      if (queueSnapshot.empty || this.queueStatus !== 'inQueue') return;

      const potentialPartnerDocs = queueSnapshot.docs.filter(doc => (doc.data() as any)['userId'] !== this.userId);
      if (potentialPartnerDocs.length === 0) return;

      const potentialPartnerDoc = potentialPartnerDocs[0];
      const potentialPartnerId = (potentialPartnerDoc.data() as any)['userId'];
      const potentialPartnerSessionId = potentialPartnerDoc.id;

      const chatId = [this.userId, potentialPartnerId].sort().join('-');
      const chatDocRef = doc(this.chatsCollection, chatId);

      await setDoc(doc(this.usersCollection, this.userId!), {
        partnerId: potentialPartnerId,
        queueStatus: 'inChat',
      }, { merge: true });

      await setDoc(doc(this.usersCollection, potentialPartnerId), {
        partnerId: this.userId,
        queueStatus: 'inChat',
      }, { merge: true });

      await setDoc(chatDocRef, {
        participants: [this.userId, potentialPartnerId],
        messages: [],
        createdAt: new Date().toISOString(),
      });

      await deleteDoc(doc(this.queueCollection, this.sessionId!));
      await deleteDoc(doc(this.queueCollection, potentialPartnerSessionId));

      await this.createOffer();
    });
  }

  setupChatListener(): void {
    if (!this.userId || !this.partnerId || !this.db) return;

    const chatId = [this.userId, this.partnerId].sort().join('-');
    const chatDocRef = doc(this.chatsCollection, chatId);
    this.chatSub = onSnapshot(chatDocRef, (docSnap) => {
      if (docSnap.exists()) {
        this.chatMessages = docSnap.data()['messages'];
      } else {
        this.partnerId = null;
        this.queueStatus = null;
        this.chatMessages = [];
        this.chatSub = null;
        this.closePeerConnection();
      }
    });
  }

  async setupPeerConnection() {
    if (this.peerConnection) {
      this.closePeerConnection();
    }

    if (!this.userId || !this.partnerId || !this.db) return;
  
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
  
    console.log('PeerConnection created.');

    this.peerConnection.onconnectionstatechange = () => {
      console.log("Connection state:", this.peerConnection?.connectionState);
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log("ICE state:", this.peerConnection?.iceConnectionState);
    };

    this.localStream.getTracks().forEach(track => {
      this.peerConnection!.addTrack(track, this.localStream);
    });

    this.peerConnection.ontrack = (event) => {
      console.log('Remote track received:', event.streams);
    
      if (this.remoteVideo?.nativeElement) {
        const videoEl = this.remoteVideo.nativeElement;
    
        // Set srcObject only if it's different
        if (videoEl.srcObject !== event.streams[0]) {
          console.log('Setting remote video stream...');
          videoEl.srcObject = event.streams[0];
          videoEl.muted = false;
    
          videoEl.onloadedmetadata = async () => {
            try {
              await videoEl.play();
            } catch (err) {
              console.error('Remote video play error:', err);
            }
          };
        }
      } else {
        console.warn("⚠️ remoteVideo ViewChild not available");
      }
    
};

    const callId = [this.userId, this.partnerId].sort().join('-');
    const callDocRef = doc(this.callsCollection, callId);

    this.callSub = onSnapshot(callDocRef, async (docSnap) => {
      if (!docSnap.exists() || !this.peerConnection) return;
      const data = docSnap.data() as any;

      if (data.offer && !data.answer && this.peerConnection.signalingState === 'stable') {
        console.log('Setting remote description with offer.');
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        await this.createAnswer(callId);
      } else if (data.answer && this.peerConnection.signalingState !== 'stable') {
        console.log('Setting remote description with answer.');
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      }

      if (data.candidates) {
        for (const candidate of data.candidates) {
          if (candidate.senderId !== this.userId) {
            try {
              console.log("Adding ICE candidate:", candidate);
              await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
              console.error('Error adding ICE candidate:', err);
            }
          }
        }
      }
    });

    this.peerConnection.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate.');
        await updateDoc(callDocRef, {
          candidates: arrayUnion({ ...event.candidate.toJSON(), senderId: this.userId })
        });
      }
    };
  }

  async createOffer() {
    if (!this.peerConnection || this.peerConnection.signalingState === 'closed') {
      await this.setupPeerConnection();
    }
    if (!this.peerConnection) return;

    await new Promise(res => setTimeout(res, 300));

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    const callId = [this.userId, this.partnerId].sort().join('-');
    const callDocRef = doc(this.callsCollection, callId);

    await setDoc(callDocRef, {
      offer: { type: offer.type, sdp: offer.sdp },
      candidates: [],
    });
  }

  async createAnswer(callId: string) {
    if (!this.peerConnection || this.peerConnection.signalingState === 'closed') {
      await this.setupPeerConnection();
    }
    if (!this.peerConnection) return;

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    const callDocRef = doc(this.callsCollection, callId);
    await updateDoc(callDocRef, {
      answer: { type: answer.type, sdp: answer.sdp },
    });
  }

  closePeerConnection() {
    if (this.peerConnection) {
      try {
        this.peerConnection.ontrack = null;
        this.peerConnection.onicecandidate = null;
        this.peerConnection.close();
      } catch (err) {
        console.error('Error closing peer connection:', err);
      }
      this.peerConnection = null;
    }
    if (this.callSub) {
      this.callSub();
      this.callSub = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
  }

  ngOnDestroy(): void {
    if (this.userSub) this.userSub();
    if (this.queueSub) this.queueSub();
    if (this.chatSub) this.chatSub();
    if (this.callSub) this.callSub();
    this.closePeerConnection();
  }

  // handle joinning queue
  async handleJoinQueue(): Promise<void> {
    this.setupLocalCamera()
    if (!this.db || !this.userId || !this.sessionId) return;
    this.loading = true;
    await setDoc(doc(this.usersCollection, this.userId), {
      userId: this.userId,
      queueStatus: 'inQueue',
      partnerId: null
    }, { merge: true });
    await setDoc(doc(this.queueCollection, this.sessionId), {
      userId: this.userId,
      joinedAt: new Date().toISOString(),
    });
    this.loading = false;
  }

  // handle leaving chat
  async handleLeaveChat(): Promise<void> {
    if (!this.db || !this.userId || !this.partnerId) return;

    const chatId = [this.userId, this.partnerId].sort().join('-');
    const chatDocRef = doc(this.chatsCollection, chatId);
    const partnerId = this.partnerId;

    await updateDoc(doc(this.usersCollection, this.userId), {
      partnerId: null,
      queueStatus: null,
    });

    await updateDoc(doc(this.usersCollection, partnerId), {
      partnerId: null,
      queueStatus: null,
    });

    await deleteDoc(chatDocRef);
    this.closePeerConnection();
  }

  // responsible to send the message
  async handleSendMessage(e: Event): Promise<void> {
    e.preventDefault();
    if (!this.db || !this.userId || !this.partnerId || !this.messageInput.trim()) return;

    const chatId = [this.userId, this.partnerId].sort().join('-');
    const chatDocRef = doc(this.chatsCollection, chatId);

    const newMessages = [...this.chatMessages, {
      senderId: this.userId,
      text: this.messageInput,
      timestamp: new Date().toISOString(),
    }];

    await updateDoc(chatDocRef, { messages: newMessages });
    this.messageInput = '';
  }
}
