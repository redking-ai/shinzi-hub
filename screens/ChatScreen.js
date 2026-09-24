import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, Feather } from '@expo/vector-icons';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from './firebaseConfig';

const COLORS = {
  background: '#000000',
  card: '#0D0D12',
  card2: '#12121A',
  border: '#22222E',
  borderLight: '#333344',
  text: '#FFFFFF',
  secondary: '#8E8EA0',
  blue: '#4DA8DA',
  blueBright: '#00D2FF',
  urgent: '#FF3366',
  green: '#43D17A',
  red: '#FF4D67',
  yellow: '#FFD166',
};

const TABS = ['All', 'Recent', 'Urgent', 'Favorite', 'Groups'];
const MAX_MESSAGE_LENGTH = 4000;
const MAX_POLL_OPTIONS = 20;
const DIRECT_PREFIX = 'dm_';

const directId = (a, b) => `${DIRECT_PREFIX}${[a, b].sort().join('_')}`;

const millis = value => {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return 0;
};

const initials = value => {
  const s = String(value || '').trim();
  if (!s) return '?';
  const p = s.split(/\s+/);
  return (p.length > 1 ? p[0][0] + p[1][0] : s.slice(0, 2)).toUpperCase();
};

const formatTime = value =>
  millis(value)
    ? new Date(millis(value)).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

const dayKey = value => {
  if (!millis(value)) return '';
  const d = new Date(millis(value));
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const dateLabel = value => {
  if (!millis(value)) return '';
  const d = new Date(millis(value));
  const now = new Date();
  const y = new Date();
  y.setDate(y.getDate() - 1);

  if (dayKey(d) === dayKey(now)) return 'Today';
  if (dayKey(d) === dayKey(y)) return 'Yesterday';

  return d.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
};

const mention = (text, username) => {
  if (!text || !username) return false;

  const escaped = String(username).replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );

  return new RegExp(
    `(^|\\s)@${escaped}(\\s|$|[.,!?])`,
    'i'
  ).test(text);
};

const pollTotal = poll =>
  Object.values(poll?.votes || {}).reduce(
    (sum, v) => sum + (typeof v === 'number' ? v : 0),
    0
  );

const pollPercent = (poll, index) => {
  const total = pollTotal(poll);

  return total
    ? Math.round(
        (Number(poll?.votes?.[index] || 0) / total) * 100
      )
    : 0;
};

function Avatar({ name, group = false, small = false }) {
  return (
    <View style={small ? styles.avatarSmall : styles.avatar}>
      {group ? (
        <Ionicons
          name="people"
          size={small ? 17 : 23}
          color={COLORS.secondary}
        />
      ) : (
        <Text style={small ? styles.avatarSmallText : styles.avatarText}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

function Badge({ count }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>
        {count > 9 ? '9+' : count}
      </Text>
    </View>
  );
}

function EmptyState({
  icon = 'chatbubble-outline',
  title,
  text,
}) {
  return (
    <View style={styles.emptyState}>
      <Ionicons
        name={icon}
        size={44}
        color={COLORS.secondary}
      />

      <Text style={styles.emptyTitle}>
        {title}
      </Text>

      <Text style={styles.emptyText}>
        {text}
      </Text>
    </View>
  );
}

export default function ChatScreen({ onNavigate }) {
  const user = auth.currentUser;
  const uid = user?.uid || null;

  const [profile, setProfile] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [dmRequests, setDmRequests] = useState([]);
  const [messages, setMessages] = useState([]);

  const [screen, setScreen] = useState('main');
  const [activeTab, setActiveTab] = useState('All');
  const [selected, setSelected] = useState(null);

  const [search, setSearch] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);

  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingFriends, setLoadingFriends] = useState(true);

  const [typingUsers, setTypingUsers] = useState({});
  const [showModes, setShowModes] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [panel, setPanel] = useState(null);
  const [showGroup, setShowGroup] = useState(false);

  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupSelected, setGroupSelected] = useState({});

  const [pollQuestion, setPollQuestion] = useState('');
  const [pollDescription, setPollDescription] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [creatingPoll, setCreatingPoll] = useState(false);

  const [eventName, setEventName] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventStart, setEventStart] = useState('');
  const [eventEnd, setEventEnd] = useState('');
  const [creatingEvent, setCreatingEvent] = useState(false);

  const [gifMode, setGifMode] = useState('gif');
  const [gifCategory, setGifCategory] = useState('normal');
  const [gifSearch, setGifSearch] = useState('');

  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const [showCall, setShowCall] = useState(false);
  const [callMode, setCallMode] = useState('voice');
  const [callMuted, setCallMuted] = useState(false);

  const typingTimer = useRef(null);
  const recordingTimer = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      return undefined;
    }

    return onSnapshot(
      doc(db, 'users', uid),
      snap => {
        setProfile(
          snap.exists()
            ? { id: snap.id, ...snap.data() }
            : null
        );
      },
      error => {
        console.error('Profile listener error:', error);
      }
    );
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setConversations([]);
      setLoadingChats(false);
      return undefined;
    }

    setLoadingChats(true);

    const q = query(
      collection(db, 'conversations'),
      where('memberIds', 'array-contains', uid)
    );

    return onSnapshot(
      q,
      snap => {
        const rows = snap.docs.map(item => ({
          id: item.id,
          ...item.data(),
        }));

        rows.sort(
          (a, b) =>
            millis(b.updatedAt || b.lastMessageAt) -
            millis(a.updatedAt || a.lastMessageAt)
        );

        setConversations(rows);
        setLoadingChats(false);
      },
      error => {
        console.error('Conversation listener error:', error);
        setLoadingChats(false);
      }
    );
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setFriends([]);
      setLoadingFriends(false);
      return undefined;
    }

    setLoadingFriends(true);

    const q = collection(db, 'users', uid, 'friends');

    return onSnapshot(
      q,
      snap => {
        setFriends(
          snap.docs.map(item => ({
            id: item.id,
            ...item.data(),
          }))
        );

        setLoadingFriends(false);
      },
      error => {
        console.error('Friends listener error:', error);
        setLoadingFriends(false);
      }
    );
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setFriendRequests([]);
      return undefined;
    }

    const q = query(
      collection(db, 'friendRequests'),
      where('toUid', '==', uid),
      where('status', '==', 'pending')
    );

    return onSnapshot(
      q,
      snap => {
        setFriendRequests(
          snap.docs.map(item => ({
            id: item.id,
            ...item.data(),
          }))
        );
      },
      error => {
        console.error(
          'Friend request listener error:',
          error
        );
      }
    );
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setDmRequests([]);
      return undefined;
    }

    const q = query(
      collection(db, 'dmRequests'),
      where('toUid', '==', uid),
      where('status', '==', 'pending')
    );

    return onSnapshot(
      q,
      snap => {
        setDmRequests(
          snap.docs.map(item => ({
            id: item.id,
            ...item.data(),
          }))
        );
      },
      error => {
        console.error(
          'DM request listener error:',
          error
        );
      }
    );
  }, [uid]);

  useEffect(() => {
    if (!selected?.id) {
      setMessages([]);
      return undefined;
    }

    const q = query(
      collection(
        db,
        'conversations',
        selected.id,
        'messages'
      )
    );

    return onSnapshot(
      q,
      snap => {
        const rows = snap.docs.map(item => ({
          id: item.id,
          ...item.data(),
        }));

        rows.sort(
          (a, b) =>
            millis(a.createdAt) - millis(b.createdAt)
        );

        setMessages(rows);
      },
      error => {
        console.error('Messages listener error:', error);
      }
    );
  }, [selected?.id]);

  useEffect(() => {
    if (!selected?.id || !uid) {
      setTypingUsers({});
      return undefined;
    }

    const q = collection(
      db,
      'conversations',
      selected.id,
      'activity'
    );

    return onSnapshot(
      q,
      snap => {
        const now = Date.now();
        const next = {};

        snap.docs.forEach(item => {
          if (item.id === uid) return;

          const data = item.data();
          const expiresAt = millis(data.expiresAt);

          if (
            data.typing === true &&
            expiresAt > now
          ) {
            next[item.id] = data;
          }
        });

        setTypingUsers(next);
      },
      error => {
        console.error(
          'Typing listener error:',
          error
        );
      }
    );
  }, [selected?.id, uid]);

  useEffect(() => {
    return () => {
      if (typingTimer.current) {
        clearTimeout(typingTimer.current);
      }

      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
    };
  }, []);

  const selectedConversation = useMemo(
    () =>
      conversations.find(
        item => item.id === selected?.id
      ) || selected,
    [conversations, selected]
  );

  const unreadCount = useMemo(() => {
    if (!uid) return 0;

    return conversations.reduce((total, conversation) => {
      const lastRead = millis(
        conversation?.lastReadAt?.[uid]
      );

      const lastMessage = millis(
        conversation?.lastMessageAt
      );

      if (
        lastMessage &&
        lastMessage > lastRead &&
        conversation?.lastSenderId !== uid
      ) {
        return total + 1;
      }

      return total;
    }, 0);
  }, [conversations, uid]);

  const requestCount =
    friendRequests.length + dmRequests.length;

  const getConversationName = conversation => {
    if (!conversation) return 'Conversation';

    if (conversation.type === 'group') {
      return conversation.name || 'Group';
    }

    const otherId = (conversation.memberIds || []).find(
      id => id !== uid
    );

    const member =
      conversation.memberProfiles?.[otherId];

    return (
      member?.displayName ||
      member?.username ||
      'User'
    );
  };

  const getConversationUsername = conversation => {
    if (!conversation || conversation.type === 'group') {
      return '';
    }

    const otherId = (conversation.memberIds || []).find(
      id => id !== uid
    );

    return (
      conversation.memberProfiles?.[otherId]?.username ||
      ''
    );
  };

  const isFavorite = conversation =>
    Boolean(conversation?.favoriteBy?.[uid]);

  const isUrgent = conversation =>
    Boolean(conversation?.urgentFor?.[uid]);

  const clearUrgent = async conversation => {
    if (!uid || !conversation?.id) return;

    try {
      await updateDoc(
        doc(db, 'conversations', conversation.id),
        {
          [`urgentFor.${uid}`]: false,
        }
      );
    } catch (error) {
      console.error(
        'Unable to clear urgent state:',
        error
      );
    }
  };

  const markRead = async conversation => {
    if (!uid || !conversation?.id) return;

    try {
      await updateDoc(
        doc(db, 'conversations', conversation.id),
        {
          [`lastReadAt.${uid}`]: serverTimestamp(),
          [`urgentFor.${uid}`]: false,
        }
      );
    } catch (error) {
      console.error(
        'Unable to mark conversation as read:',
        error
      );
    }
  };

  const openConversation = async conversation => {
    if (!conversation?.id) return;

    setSelected(conversation);
    setScreen('conversation');
    setMessageText('');
    await markRead(conversation);
  };

  const openDirectConversation = async otherUser => {
    if (!uid || !otherUser?.id) return;

    if (otherUser.id === uid) {
      Alert.alert(
        'Not available',
        'You cannot open a direct chat with yourself.'
      );
      return;
    }

    const id = directId(uid, otherUser.id);
    const conversationRef = doc(
      db,
      'conversations',
      id
    );

    try {
      const existing = await getDoc(conversationRef);

      if (!existing.exists()) {
        const currentMember = {
          displayName:
            profile?.displayName ||
            user?.displayName ||
            'User',
          username:
            profile?.username ||
            '',
        };

        const otherMember = {
          displayName:
            otherUser.displayName ||
            otherUser.username ||
            'User',
          username:
            otherUser.username ||
            '',
        };

        await setDoc(conversationRef, {
          type: 'direct',
          memberIds: [uid, otherUser.id],
          memberProfiles: {
            [uid]: currentMember,
            [otherUser.id]: otherMember,
          },
          favoriteBy: {
            [uid]: false,
            [otherUser.id]: false,
          },
          urgentFor: {
            [uid]: false,
            [otherUser.id]: false,
          },
          lastReadAt: {
            [uid]: serverTimestamp(),
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessageAt: null,
          lastMessageText: '',
          lastSenderId: null,
        });
      }

      const snapshot = await getDoc(conversationRef);

      await openConversation({
        id,
        ...snapshot.data(),
      });
    } catch (error) {
      console.error(
        'Unable to open direct conversation:',
        error
      );

      Alert.alert(
        'Unable to open chat',
        error?.message ||
          'Please try again.'
      );
    }
  };

  const publishTyping = async typing => {
    if (!uid || !selected?.id) return;

    try {
      await setDoc(
        doc(
          db,
          'conversations',
          selected.id,
          'activity',
          uid
        ),
        {
          uid,
          typing,
          updatedAt: serverTimestamp(),
          expiresAt: new Date(
            Date.now() + (typing ? 6000 : 1000)
          ),
        },
        { merge: true }
      );
    } catch (error) {
      console.error(
        'Typing state error:',
        error
      );
    }
  };

  const handleMessageChange = text => {
    if (text.length > MAX_MESSAGE_LENGTH) {
      Alert.alert(
        'Message too long',
        `Messages can contain up to ${MAX_MESSAGE_LENGTH} characters.`
      );
      return;
    }

    setMessageText(text);

    if (!selected?.id || !uid) return;

    publishTyping(Boolean(text.trim()));

    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
    }

    typingTimer.current = setTimeout(() => {
      publishTyping(false);
    }, 5000);
  };

  const sendMessage = async () => {
    if (!uid || !selected?.id || sending) return;

    const text = messageText.trim();

    if (!text) return;

    if (text.length > MAX_MESSAGE_LENGTH) {
      Alert.alert(
        'Message too long',
        `Messages can contain up to ${MAX_MESSAGE_LENGTH} characters.`
      );
      return;
    }

    setSending(true);

    try {
      const memberIds =
        selected.memberIds || [];

      const urgentFor = {};

      memberIds.forEach(memberId => {
        if (memberId !== uid) {
          const username =
            selected.memberProfiles?.[memberId]
              ?.username;

          if (mention(text, username)) {
            urgentFor[memberId] = true;
          }
        }
      });

      const messageRef = await addDoc(
        collection(
          db,
          'conversations',
          selected.id,
          'messages'
        ),
        {
          type: 'text',
          text,
          senderId: uid,
          senderName:
            profile?.displayName ||
            profile?.username ||
            'User',
          senderUsername:
            profile?.username ||
            '',
          createdAt: serverTimestamp(),
          editedAt: null,
          deleted: false,
        }
      );

      const conversationRef = doc(
        db,
        'conversations',
        selected.id
      );

      await updateDoc(conversationRef, {
        lastMessageId: messageRef.id,
        lastMessageText: text,
        lastMessageAt: serverTimestamp(),
        lastSenderId: uid,
        updatedAt: serverTimestamp(),
        urgentFor,
      });

      setMessageText('');
      await publishTyping(false);

      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd?.({
          animated: true,
        });
      });
    } catch (error) {
      console.error(
        'Send message error:',
        error
      );

      Alert.alert(
        'Message not sent',
        error?.message ||
          'Unable to send this message.'
      );
    } finally {
      setSending(false);
    }
  };

  const toggleFavorite = async conversation => {
    if (!uid || !conversation?.id) return;

    const next = !isFavorite(conversation);

    try {
      await updateDoc(
        doc(db, 'conversations', conversation.id),
        {
          [`favoriteBy.${uid}`]: next,
          updatedAt: serverTimestamp(),
        }
      );
    } catch (error) {
      console.error(
        'Favorite update error:',
        error
      );

      Alert.alert(
        'Unable to update favorite',
        error?.message ||
          'Please try again.'
      );
    }
  };

  const sendFriendRequest = async target => {
    if (!uid || !target?.id) return;

    if (target.id === uid) {
      Alert.alert(
        'Not available',
        'You cannot send yourself a friend request.'
      );
      return;
    }

    try {
      const requestId = `${uid}_${target.id}`;
      const requestRef = doc(
        db,
        'friendRequests',
        requestId
      );

      const existing = await getDoc(requestRef);

      if (
        existing.exists() &&
        existing.data()?.status === 'pending'
      ) {
        Alert.alert(
          'Already sent',
          'A friend request is already pending.'
        );
        return;
      }

      await setDoc(requestRef, {
        fromUid: uid,
        toUid: target.id,
        fromProfile: {
          displayName:
            profile?.displayName ||
            profile?.username ||
            'User',
          username:
            profile?.username ||
            '',
        },
        toProfile: {
          displayName:
            target.displayName ||
            target.username ||
            'User',
          username:
            target.username ||
            '',
        },
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      Alert.alert(
        'Request sent',
        'Your friend request was sent.'
      );
    } catch (error) {
      console.error(
        'Friend request error:',
        error
      );

      Alert.alert(
        'Unable to send request',
        error?.message ||
          'Please try again.'
      );
    }
  };

  const acceptFriendRequest = async request => {
    if (!uid || !request?.id) return;

    const fromUid = request.fromUid;

    if (!fromUid || fromUid === uid) return;

    try {
      await runTransaction(db, async transaction => {
        const requestRef = doc(
          db,
          'friendRequests',
          request.id
        );

        const senderFriendRef = doc(
          db,
          'users',
          fromUid,
          'friends',
          uid
        );

        const receiverFriendRef = doc(
          db,
          'users',
          uid,
          'friends',
          fromUid
        );

        const requestSnap =
          await transaction.get(requestRef);

        if (!requestSnap.exists()) {
          throw new Error(
            'This friend request no longer exists.'
          );
        }

        const data = requestSnap.data();

        if (
          data.status &&
          data.status !== 'pending'
        ) {
          throw new Error(
            'This friend request has already been handled.'
          );
        }

        transaction.set(
          senderFriendRef,
          {
            uid,
            username:
              profile?.username ||
              '',
            displayName:
              profile?.displayName ||
              profile?.username ||
              'User',
            addedAt: serverTimestamp(),
          },
          { merge: true }
        );

        transaction.set(
          receiverFriendRef,
          {
            uid: fromUid,
            username:
              data.fromProfile?.username ||
              '',
            displayName:
              data.fromProfile?.displayName ||
              data.fromProfile?.username ||
              'User',
            addedAt: serverTimestamp(),
          },
          { merge: true }
        );

        transaction.update(requestRef, {
          status: 'accepted',
          updatedAt: serverTimestamp(),
        });
      });

      Alert.alert(
        'Friend added',
        'You are now friends.'
      );
    } catch (error) {
      console.error(
        'Accept friend request error:',
        error
      );

      Alert.alert(
        'Unable to accept',
        error?.message ||
          'Please try again.'
      );
    }
  };

  const rejectFriendRequest = async request => {
    if (!request?.id) return;

    try {
      await updateDoc(
        doc(db, 'friendRequests', request.id),
        {
          status: 'rejected',
          updatedAt: serverTimestamp(),
        }
      );
    } catch (error) {
      console.error(
        'Reject friend request error:',
        error
      );

      Alert.alert(
        'Unable to reject',
        error?.message ||
          'Please try again.'
      );
    }
  };

  const sendDMRequest = async target => {
    if (!uid || !target?.id) return;

    if (target.id === uid) {
      Alert.alert(
        'Not available',
        'You cannot send a DM request to yourself.'
      );
      return;
    }

    try {
      const requestId = `${uid}_${target.id}`;
      const requestRef = doc(
        db,
        'dmRequests',
        requestId
      );

      const existing = await getDoc(requestRef);

      if (
        existing.exists() &&
        existing.data()?.status === 'pending'
      ) {
        Alert.alert(
          'Already sent',
          'A DM request is already pending.'
        );
        return;
      }

      await setDoc(requestRef, {
        fromUid: uid,
        toUid: target.id,
        fromProfile: {
          displayName:
            profile?.displayName ||
            profile?.username ||
            'User',
          username:
            profile?.username ||
            '',
        },
        toProfile: {
          displayName:
            target.displayName ||
            target.username ||
            'User',
          username:
            target.username ||
            '',
        },
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      Alert.alert(
        'DM request sent',
        'Your request was sent.'
      );
    } catch (error) {
      console.error(
        'DM request error:',
        error
      );

      Alert.alert(
        'Unable to send DM request',
        error?.message ||
          'Please try again.'
      );
    }
  };

  const acceptDMRequest = async request => {
    if (!uid || !request?.id) return;

    const fromUid = request.fromUid;

    if (!fromUid || fromUid === uid) return;

    const conversationId = directId(
      uid,
      fromUid
    );

    try {
      await runTransaction(db, async transaction => {
        const requestRef = doc(
          db,
          'dmRequests',
          request.id
        );

        const conversationRef = doc(
          db,
          'conversations',
          conversationId
        );

        const requestSnap =
          await transaction.get(requestRef);

        if (!requestSnap.exists()) {
          throw new Error(
            'This DM request no longer exists.'
          );
        }

        const data = requestSnap.data();

        if (
          data.status &&
          data.status !== 'pending'
        ) {
          throw new Error(
            'This DM request has already been handled.'
          );
        }

        const conversationSnap =
          await transaction.get(conversationRef);

        if (!conversationSnap.exists()) {
          transaction.set(conversationRef, {
            type: 'direct',
            memberIds: [uid, fromUid],
            memberProfiles: {
              [uid]: {
                displayName:
                  profile?.displayName ||
                  profile?.username ||
                  'User',
                username:
                  profile?.username ||
                  '',
              },
              [fromUid]: {
                displayName:
                  data.fromProfile?.displayName ||
                  data.fromProfile?.username ||
                  'User',
                username:
                  data.fromProfile?.username ||
                  '',
              },
            },
            favoriteBy: {
              [uid]: false,
              [fromUid]: false,
            },
            urgentFor: {
              [uid]: false,
              [fromUid]: false,
            },
            lastReadAt: {
              [uid]: serverTimestamp(),
            },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastMessageAt: null,
            lastMessageText: '',
            lastSenderId: null,
          });
        }

        transaction.update(requestRef, {
          status: 'accepted',
          updatedAt: serverTimestamp(),
        });
      });

      Alert.alert(
        'DM request accepted',
        'The conversation is ready.'
      );
    } catch (error) {
      console.error(
        'Accept DM request error:',
        error
      );

      Alert.alert(
        'Unable to accept DM request',
        error?.message ||
          'Please try again.'
      );
    }
  };

  const rejectDMRequest = async request => {
    if (!request?.id) return;

    try {
      await updateDoc(
        doc(db, 'dmRequests', request.id),
        {
          status: 'rejected',
          updatedAt: serverTimestamp(),
        }
      );
    } catch (error) {
      console.error(
        'Reject DM request error:',
        error
      );

      Alert.alert(
        'Unable to reject',
        error?.message ||
          'Please try again.'
      );
    }
  };

  const searchUser = async () => {
    const username = search.trim().toLowerCase();

    if (!username) {
      setSearchResult(null);
      return;
    }

    setSearching(true);

    try {
      const usernameSnap = await getDoc(
        doc(db, 'usernames', username)
      );

      if (!usernameSnap.exists()) {
        setSearchResult(null);
        Alert.alert(
          'Not found',
          'No user was found with that username.'
        );
        return;
      }

      const targetUid =
        usernameSnap.data()?.uid;

      if (!targetUid) {
        setSearchResult(null);
        return;
      }

      if (targetUid === uid) {
        setSearchResult({
          id: targetUid,
          ...(profile || {}),
        });
        return;
      }

      const userSnap = await getDoc(
        doc(db, 'users', targetUid)
      );

      if (!userSnap.exists()) {
        setSearchResult(null);
        Alert.alert(
          'Not found',
          'That user profile could not be loaded.'
        );
        return;
      }

      setSearchResult({
        id: userSnap.id,
        ...userSnap.data(),
      });
    } catch (error) {
      console.error(
        'User search error:',
        error
      );

      Alert.alert(
        'Search failed',
        error?.message ||
          'Unable to search right now.'
      );
    } finally {
      setSearching(false);
    }
  };

  const createGroup = async () => {
    if (!uid) return;

    const name = groupName.trim();

    if (!name) {
      Alert.alert(
        'Group name required',
        'Please enter a group name.'
      );
      return;
    }

    const selectedFriends = friends.filter(
      friend => groupSelected[friend.id]
    );

    if (!selectedFriends.length) {
      Alert.alert(
        'Add friends',
        'Select at least one friend.'
      );
      return;
    }

    setCreatingPoll(false);

    try {
      const memberIds = [
        uid,
        ...selectedFriends.map(friend => friend.id),
      ];

      const memberProfiles = {
        [uid]: {
          displayName:
            profile?.displayName ||
            profile?.username ||
            'User',
          username:
            profile?.username ||
            '',
        },
      };

      selectedFriends.forEach(friend => {
        memberProfiles[friend.id] = {
          displayName:
            friend.displayName ||
            friend.username ||
            'User',
          username:
            friend.username ||
            '',
        };
      });

      const favoriteBy = {};
      const urgentFor = {};
      const lastReadAt = {};

      memberIds.forEach(memberId => {
        favoriteBy[memberId] = false;
        urgentFor[memberId] = false;
        lastReadAt[memberId] = null;
      });

      lastReadAt[uid] = serverTimestamp();

      const conversationRef = await addDoc(
        collection(db, 'conversations'),
        {
          type: 'group',
          name,
          description:
            groupDescription.trim(),
          memberIds,
          memberProfiles,
          favoriteBy,
          urgentFor,
          lastReadAt,
          createdBy: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessageAt: null,
          lastMessageText: '',
          lastSenderId: null,
        }
      );

      const snapshot = await getDoc(
        conversationRef
      );

      setShowGroup(false);
      setGroupName('');
      setGroupDescription('');
      setGroupSelected({});

      await openConversation({
        id: conversationRef.id,
        ...snapshot.data(),
      });
    } catch (error) {
      console.error(
        'Create group error:',
        error
      );

      Alert.alert(
        'Unable to create group',
        error?.message ||
          'Please try again.'
      );
    }
  };

  const addPollOption = () => {
    if (pollOptions.length >= MAX_POLL_OPTIONS) {
      Alert.alert(
        'Limit reached',
        `A poll can have up to ${MAX_POLL_OPTIONS} options.`
      );
      return;
    }

    setPollOptions(options => [
      ...options,
      '',
    ]);
  };

  const updatePollOption = (index, value) => {
    setPollOptions(options =>
      options.map((option, i) =>
        i === index ? value : option
      )
    );
  };

  const removePollOption = index => {
    if (pollOptions.length <= 2) {
      Alert.alert(
        'Poll needs options',
        'A poll needs at least two options.'
      );
      return;
    }

    setPollOptions(options =>
      options.filter((_, i) => i !== index)
    );
  };

  const createPoll = async () => {
    if (!uid || !selected?.id || creatingPoll) {
      return;
    }

    const question = pollQuestion.trim();

    const options = pollOptions
      .map(option => option.trim())
      .filter(Boolean);

    if (!question) {
      Alert.alert(
        'Question required',
        'Enter a poll question.'
      );
      return;
    }

    if (options.length < 2) {
      Alert.alert(
        'More options required',
        'Add at least two poll options.'
      );
      return;
    }

    setCreatingPoll(true);

    try {
      await addDoc(
        collection(
          db,
          'conversations',
          selected.id,
          'messages'
        ),
        {
          type: 'poll',
          question,
          description:
            pollDescription.trim(),
          options,
          votes: Object.fromEntries(
            options.map((_, index) => [
              index,
              0,
            ])
          ),
          voters: {},
          senderId: uid,
          senderName:
            profile?.displayName ||
            profile?.username ||
            'User',
          senderUsername:
            profile?.username ||
            '',
          createdAt: serverTimestamp(),
          deleted: false,
        }
      );

      await updateDoc(
        doc(db, 'conversations', selected.id),
        {
          lastMessageText: `Poll: ${question}`,
          lastMessageAt: serverTimestamp(),
          lastSenderId: uid,
          updatedAt: serverTimestamp(),
        }
      );

      setPollQuestion('');
      setPollDescription('');
      setPollOptions(['', '']);
      setPanel(null);
    } catch (error) {
      console.error(
        'Create poll error:',
        error
      );

      Alert.alert(
        'Unable to create poll',
        error?.message ||
          'Please try again.'
      );
    } finally {
      setCreatingPoll(false);
    }
  };

  const votePoll = async (message, optionIndex) => {
    if (
      !uid ||
      !selected?.id ||
      !message?.id
    ) {
      return;
    }

    try {
      await runTransaction(db, async transaction => {
        const messageRef = doc(
          db,
          'conversations',
          selected.id,
          'messages',
          message.id
        );

        const snap =
          await transaction.get(messageRef);

        if (!snap.exists()) {
          throw new Error(
            'This poll no longer exists.'
          );
        }

        const data = snap.data();

        if (data.type !== 'poll') {
          throw new Error(
            'This message is not a poll.'
          );
        }

        const voters = {
          ...(data.voters || {}),
        };

        const votes = {
          ...(data.votes || {}),
        };

        const previousVote = voters[uid];

        if (
          previousVote !== undefined &&
          previousVote !== null
        ) {
          const oldIndex =
            Number(previousVote);

          votes[oldIndex] = Math.max(
            0,
            Number(votes[oldIndex] || 0) - 1
          );
        }

        const alreadySelected =
          Number(previousVote) ===
          Number(optionIndex);

        if (alreadySelected) {
          delete voters[uid];
        } else {
          voters[uid] = optionIndex;
          votes[optionIndex] =
            Number(votes[optionIndex] || 0) + 1;
        }

        transaction.update(messageRef, {
          voters,
          votes,
          updatedAt: serverTimestamp(),
        });
      });
    } catch (error) {
      console.error(
        'Vote poll error:',
        error
      );

      Alert.alert(
        'Unable to vote',
        error?.message ||
          'Please try again.'
      );
    }
  };

  const createEvent = async () => {
    if (
      !uid ||
      !selected?.id ||
      creatingEvent
    ) {
      return;
    }

    const name = eventName.trim();

    if (!name) {
      Alert.alert(
        'Event name required',
        'Enter an event name.'
      );
      return;
    }

    setCreatingEvent(true);

    try {
      await addDoc(
        collection(
          db,
          'conversations',
          selected.id,
          'messages'
        ),
        {
          type: 'event',
          name,
          description:
            eventDescription.trim(),
          start:
            eventStart.trim(),
          end:
            eventEnd.trim(),
          attendees: {},
          senderId: uid,
          senderName:
            profile?.displayName ||
            profile?.username ||
            'User',
          senderUsername:
            profile?.username ||
            '',
          createdAt: serverTimestamp(),
          deleted: false,
        }
      );

      await updateDoc(
        doc(db, 'conversations', selected.id),
        {
          lastMessageText: `Event: ${name}`,
          lastMessageAt: serverTimestamp(),
          lastSenderId: uid,
          updatedAt: serverTimestamp(),
        }
      );

      setEventName('');
      setEventDescription('');
      setEventStart('');
      setEventEnd('');
      setPanel(null);
    } catch (error) {
      console.error(
        'Create event error:',
        error
      );

      Alert.alert(
        'Unable to create event',
        error?.message ||
          'Please try again.'
      );
    } finally {
      setCreatingEvent(false);
    }
  };

  const toggleEventAttendance = async message => {
    if (
      !uid ||
      !selected?.id ||
      !message?.id
    ) {
      return;
    }

    try {
      await runTransaction(db, async transaction => {
        const messageRef = doc(
          db,
          'conversations',
          selected.id,
          'messages',
          message.id
        );

        const snap =
          await transaction.get(messageRef);

        if (!snap.exists()) {
          throw new Error(
            'This event no longer exists.'
          );
        }

        const data = snap.data();

        if (data.type !== 'event') {
          throw new Error(
            'This message is not an event.'
          );
        }

        const attendees = {
          ...(data.attendees || {}),
        };

        if (attendees[uid]) {
          delete attendees[uid];
        } else {
          attendees[uid] = {
            uid,
            joinedAt: new Date().toISOString(),
          };
        }

        transaction.update(messageRef, {
          attendees,
          updatedAt: serverTimestamp(),
        });
      });
    } catch (error) {
      console.error(
        'Event attendance error:',
        error
      );

      Alert.alert(
        'Unable to update attendance',
        error?.message ||
          'Please try again.'
      );
    }
  };

  const pickImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission required',
          'Photo library permission is required to select media.'
        );
        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.85,
        });

      if (
        result.canceled ||
        !result.assets?.length
      ) {
        return;
      }

      Alert.alert(
        'Attachment selected',
        'The media picker works, but permanent Drive upload and message attachment delivery are not enabled yet.'
      );
    } catch (error) {
      console.error(
        'Image picker error:',
        error
      );

      Alert.alert(
        'Unable to select image',
        error?.message ||
          'Please try again.'
      );
    }
  };

  const startRecordingUI = () => {
    if (recording) {
      setRecording(false);

      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }

      Alert.alert(
        'Voice recording',
        'The voice-recording UI stopped. Real audio recording and Drive upload are not implemented yet.'
      );

      return;
    }

    setRecordSeconds(0);
    setRecording(true);

    recordingTimer.current =
      setInterval(() => {
        setRecordSeconds(seconds => {
          if (seconds >= 3599) {
            clearInterval(
              recordingTimer.current
            );
            recordingTimer.current = null;
            setRecording(false);
            return seconds;
          }

          return seconds + 1;
        });
      }, 1000);
  };

  const formatDuration = seconds => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${String(mins).padStart(2, '0')}:${String(
      secs
    ).padStart(2, '0')}`;
  };

  const startCallUI = mode => {
    setCallMode(mode);
    setShowCall(true);
  };

  const filteredConversations = useMemo(() => {
    let rows = [...conversations];

    if (activeTab === 'Recent') {
      rows = rows
        .filter(item => millis(item.lastMessageAt))
        .sort(
          (a, b) =>
            millis(b.lastMessageAt) -
            millis(a.lastMessageAt)
        );
    }

    if (activeTab === 'Urgent') {
      rows = rows.filter(isUrgent);
    }

    if (activeTab === 'Favorite') {
      rows = rows.filter(isFavorite);
    }

    if (activeTab === 'Groups') {
      rows = rows.filter(
        item => item.type === 'group'
      );
    }

    const queryText =
      search.trim().toLowerCase();

    if (queryText) {
      rows = rows.filter(item => {
        const name =
          getConversationName(item)
            .toLowerCase();

        const username =
          getConversationUsername(item)
            .toLowerCase();

        const preview =
          String(
            item.lastMessageText || ''
          ).toLowerCase();

        return (
          name.includes(queryText) ||
          username.includes(queryText) ||
          preview.includes(queryText)
        );
      });
    }

    rows.sort((a, b) => {
      const favoriteDifference =
        Number(isFavorite(b)) -
        Number(isFavorite(a));

      if (
        favoriteDifference !== 0 &&
        activeTab !== 'Favorite'
      ) {
        return favoriteDifference;
      }

      return (
        millis(b.lastMessageAt || b.updatedAt) -
        millis(a.lastMessageAt || a.updatedAt)
      );
    });

    return rows;
  }, [
    conversations,
    activeTab,
    search,
    uid,
  ]);

  const goBack = () => {
    if (screen === 'conversation') {
      setSelected(null);
      setScreen('main');
      setMessageText('');
      setPanel(null);
      return;
    }

    if (
      screen === 'friends' ||
      screen === 'friendRequests' ||
      screen === 'dmRequests' ||
      screen === 'search'
    ) {
      setScreen('main');
      return;
    }

    if (onNavigate) {
      onNavigate('profile');
    }
  };

  const renderBackHeader = (
    title,
    right = null
  ) => (
    <View style={styles.backHeader}>
      <TouchableOpacity
        style={styles.iconButton}
        onPress={goBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons
          name="arrow-back"
          size={23}
          color={COLORS.text}
        />
      </TouchableOpacity>

      <Text
        style={styles.backHeaderTitle}
        numberOfLines={1}
      >
        {title}
      </Text>

      <View style={styles.backHeaderRight}>
        {right}
      </View>
    </View>
  );

  const renderModesModal = () => (
    <Modal
      visible={showModes}
      transparent
      animationType="fade"
      onRequestClose={() =>
        setShowModes(false)
      }
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modeModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Modes
            </Text>

            <TouchableOpacity
              onPress={() =>
                setShowModes(false)
              }
            >
              <Ionicons
                name="close"
                size={25}
                color={COLORS.text}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.modeRow}
            onPress={() =>
              Alert.alert(
                'Social mode',
                'Social/content mode is selected.'
              )
            }
          >
            <View style={styles.modeIcon}>
              <Ionicons
                name="people-outline"
                size={24}
                color={COLORS.blueBright}
              />
            </View>

            <View style={styles.modeTextWrap}>
              <Text style={styles.modeTitle}>
                Social
              </Text>

              <Text style={styles.modeSubtitle}>
                Chats, friends and social activity
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modeRow}
            onPress={() =>
              Alert.alert(
                'Games mode',
                'Games mode UI is reserved for the future Games system.'
              )
            }
          >
            <View style={styles.modeIcon}>
              <Ionicons
                name="game-controller-outline"
                size={24}
                color={COLORS.green}
              />
            </View>

            <View style={styles.modeTextWrap}>
              <Text style={styles.modeTitle}>
                Games
              </Text>

              <Text style={styles.modeSubtitle}>
                Game-related activity
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modeRow}
            onPress={() => {
              setShowModes(false);
              setScreen('search');
            }}
          >
            <View style={styles.modeIcon}>
              <Ionicons
                name="search-outline"
                size={24}
                color={COLORS.yellow}
              />
            </View>

            <View style={styles.modeTextWrap}>
              <Text style={styles.modeTitle}>
                Search
              </Text>

              <Text style={styles.modeSubtitle}>
                Find users by username
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderGroupModal = () => (
    <Modal
      visible={showGroup}
      transparent
      animationType="slide"
      onRequestClose={() =>
        setShowGroup(false)
      }
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.groupModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Create Group
            </Text>

            <TouchableOpacity
              onPress={() =>
                setShowGroup(false)
              }
            >
              <Ionicons
                name="close"
                size={25}
                color={COLORS.text}
              />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.modalInput}
            placeholder="Group name"
            placeholderTextColor={
              COLORS.secondary
            }
            value={groupName}
            onChangeText={setGroupName}
            maxLength={60}
          />

          <TextInput
            style={[
              styles.modalInput,
              styles.multilineInput,
            ]}
            placeholder="Description"
            placeholderTextColor={
              COLORS.secondary
            }
            value={groupDescription}
            onChangeText={setGroupDescription}
            multiline
            maxLength={300}
          />

          <Text style={styles.sectionLabel}>
            Add friends
          </Text>

          <ScrollView
            style={styles.friendPicker}
            keyboardShouldPersistTaps="handled"
          >
            {friends.length === 0 ? (
              <EmptyState
                icon="people-outline"
                title="No friends yet"
                text="Add friends before creating a group."
              />
            ) : (
              friends.map(friend => {
                const added =
                  Boolean(
                    groupSelected[friend.id]
                  );

                return (
                  <TouchableOpacity
                    key={friend.id}
                    style={styles.friendPickerRow}
                    onPress={() =>
                      setGroupSelected(
                        current => ({
                          ...current,
                          [friend.id]: !current[
                            friend.id
                          ],
                        })
                      )
                    }
                  >
                    <Avatar
                      name={
                        friend.displayName ||
                        friend.username
                      }
                      small
                    />

                    <View
                      style={
                        styles.friendPickerInfo
                      }
                    >
                      <Text
                        style={
                          styles.friendPickerName
                        }
                      >
                        {friend.displayName ||
                          friend.username ||
                          'User'}
                      </Text>

                      <Text
                        style={
                          styles.friendPickerUsername
                        }
                      >
                        @{friend.username || 'user'}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.addButton,
                        added &&
                          styles.addButtonActive,
                      ]}
                    >
                      <Text
                        style={
                          styles.addButtonText
                        }
                      >
                        {added
                          ? 'Added'
                          : 'Add'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          <Text style={styles.addedCount}>
            {
              Object.values(groupSelected).filter(
                Boolean
              ).length
            }{' '}
            added
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={createGroup}
          >
            <Text
              style={styles.primaryButtonText}
            >
              Create Group
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderAttachmentMenu = () => (
    <Modal
      visible={showComposer}
      transparent
      animationType="slide"
      onRequestClose={() =>
        setShowComposer(false)
      }
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.attachmentModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Attach
            </Text>

            <TouchableOpacity
              onPress={() =>
                setShowComposer(false)
              }
            >
              <Ionicons
                name="close"
                size={25}
                color={COLORS.text}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.attachmentGrid}>
            <TouchableOpacity
              style={styles.attachmentTile}
              onPress={() => {
                setShowComposer(false);
                pickImage();
              }}
            >
              <Ionicons
                name="image-outline"
                size={30}
                color={COLORS.blueBright}
              />
              <Text
                style={styles.attachmentTileText}
              >
                Photo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.attachmentTile}
              onPress={() => {
                setShowComposer(false);
                setPanel('gif');
              }}
            >
              <Ionicons
                name="happy-outline"
                size={30}
                color={COLORS.yellow}
              />
              <Text
                style={styles.attachmentTileText}
              >
                GIF / Sticker
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.attachmentTile}
              onPress={() => {
                setShowComposer(false);
                setPanel('poll');
              }}
            >
              <Ionicons
                name="stats-chart-outline"
                size={30}
                color={COLORS.green}
              />
              <Text
                style={styles.attachmentTileText}
              >
                Poll
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.attachmentTile}
              onPress={() => {
                setShowComposer(false);
                setPanel('event');
              }}
            >
              <Ionicons
                name="calendar-outline"
                size={30}
                color={COLORS.urgent}
              />
              <Text
                style={styles.attachmentTileText}
              >
                Event
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.attachmentTile}
              onPress={() => {
                setShowComposer(false);
                startRecordingUI();
              }}
            >
              <Ionicons
                name="mic-outline"
                size={30}
                color={COLORS.text}
              />
              <Text
                style={styles.attachmentTileText}
              >
                Voice
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.attachmentTile}
              onPress={() => {
                setShowComposer(false);
                Alert.alert(
                  'File attachment',
                  'File selection and permanent Drive upload are not connected yet.'
                );
              }}
            >
              <Ionicons
                name="document-outline"
                size={30}
                color={COLORS.secondary}
              />
              <Text
                style={styles.attachmentTileText}
              >
                File
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderPollCreator = () => {
    if (panel !== 'poll') return null;

    return (
      <Modal
        visible
        transparent
        animationType="slide"
        onRequestClose={() =>
          setPanel(null)
        }
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.creatorModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Create Poll
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setPanel(null)
                }
              >
                <Ionicons
                  name="close"
                  size={25}
                  color={COLORS.text}
                />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Question"
              placeholderTextColor={
                COLORS.secondary
              }
              value={pollQuestion}
              onChangeText={setPollQuestion}
              maxLength={300}
            />

            <TextInput
              style={[
                styles.modalInput,
                styles.multilineInput,
              ]}
              placeholder="Description (optional)"
              placeholderTextColor={
                COLORS.secondary
              }
              value={pollDescription}
              onChangeText={setPollDescription}
              multiline
              maxLength={500}
            />

            <ScrollView
              style={styles.optionsScroll}
              keyboardShouldPersistTaps="handled"
            >
              {pollOptions.map(
                (option, index) => (
                  <View
                    key={`poll-${index}`}
                    style={styles.optionRow}
                  >
                    <TextInput
                      style={[
                        styles.modalInput,
                        styles.optionInput,
                      ]}
                      placeholder={`Option ${
                        index + 1
                      }`}
                      placeholderTextColor={
                        COLORS.secondary
                      }
                      value={option}
                      onChangeText={value =>
                        updatePollOption(
                          index,
                          value
                        )
                      }
                      maxLength={150}
                    />

                    <TouchableOpacity
                      style={
                        styles.removeOption
                      }
                      onPress={() =>
                        removePollOption(index)
                      }
                    >
                      <Ionicons
                        name="close-circle"
                        size={23}
                        color={COLORS.red}
                      />
                    </TouchableOpacity>
                  </View>
                )
              )}

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={addPollOption}
              >
                <Ionicons
                  name="add"
                  size={20}
                  color={COLORS.blueBright}
                />

                <Text
                  style={
                    styles.secondaryButtonText
                  }
                >
                  Add option
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                creatingPoll &&
                  styles.disabledButton,
              ]}
              disabled={creatingPoll}
              onPress={createPoll}
            >
              {creatingPoll ? (
                <ActivityIndicator
                  color={COLORS.text}
                />
              ) : (
                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Create Poll
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const renderEventCreator = () => {
    if (panel !== 'event') return null;

    return (
      <Modal
        visible
        transparent
        animationType="slide"
        onRequestClose={() =>
          setPanel(null)
        }
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.creatorModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Create Event
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setPanel(null)
                }
              >
                <Ionicons
                  name="close"
                  size={25}
                  color={COLORS.text}
                />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Event name"
              placeholderTextColor={
                COLORS.secondary
              }
              value={eventName}
              onChangeText={setEventName}
              maxLength={120}
            />

            <TextInput
              style={[
                styles.modalInput,
                styles.multilineInput,
              ]}
              placeholder="Description"
              placeholderTextColor={
                COLORS.secondary
              }
              value={eventDescription}
              onChangeText={
                setEventDescription
              }
              multiline
              maxLength={500}
            />

            <TextInput
              style={styles.modalInput}
              placeholder="Start date / time"
              placeholderTextColor={
                COLORS.secondary
              }
              value={eventStart}
              onChangeText={setEventStart}
              maxLength={100}
            />

            <TextInput
              style={styles.modalInput}
              placeholder="End date / time"
              placeholderTextColor={
                COLORS.secondary
              }
              value={eventEnd}
              onChangeText={setEventEnd}
              maxLength={100}
            />

            <TouchableOpacity
              style={[
                styles.primaryButton,
                creatingEvent &&
                  styles.disabledButton,
              ]}
              disabled={creatingEvent}
              onPress={createEvent}
            >
              {creatingEvent ? (
                <ActivityIndicator
                  color={COLORS.text}
                />
              ) : (
                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Create Event
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const renderGifPanel = () => {
    if (panel !== 'gif') return null;

    return (
      <Modal
        visible
        transparent
        animationType="slide"
        onRequestClose={() =>
          setPanel(null)
        }
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.gifModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                GIFs & Stickers
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setPanel(null)
                }
              >
                <Ionicons
                  name="close"
                  size={25}
                  color={COLORS.text}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.segmentRow}>
              {['gif', 'sticker'].map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.segment,
                    gifMode === type &&
                      styles.segmentActive,
                  ]}
                  onPress={() =>
                    setGifMode(type)
                  }
                >
                  <Text
                    style={[
                      styles.segmentText,
                      gifMode === type &&
                        styles.segmentTextActive,
                    ]}
                  >
                    {type === 'gif'
                      ? 'GIF'
                      : 'Sticker'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder={`Search ${gifMode}s`}
              placeholderTextColor={
                COLORS.secondary
              }
              value={gifSearch}
              onChangeText={setGifSearch}
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.categoryRow
              }
            >
              {[
                'normal',
                'trending',
                'funny',
                'reaction',
                'gaming',
              ].map(category => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryChip,
                    gifCategory === category &&
                      styles.categoryChipActive,
                  ]}
                  onPress={() =>
                    setGifCategory(category)
                  }
                >
                  <Text
                    style={[
                      styles.categoryText,
                      gifCategory ===
                        category &&
                        styles.categoryTextActive,
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.gifEmpty}>
              <Ionicons
                name={
                  gifMode === 'gif'
                    ? 'images-outline'
                    : 'happy-outline'
                }
                size={46}
                color={COLORS.secondary}
              />

              <Text
                style={styles.gifEmptyTitle}
              >
                {gifSearch.trim()
                  ? 'Search UI ready'
                  : 'GIF / sticker browser'}
              </Text>

              <Text
                style={styles.gifEmptyText}
              >
                A real GIF provider API and
                attribution flow still need to be
                connected. This screen does not
                pretend that a GIF was sent.
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderPollMessage = message => {
    const poll = message;

    return (
      <View style={styles.pollCard}>
        <Text style={styles.pollQuestion}>
          {poll.question}
        </Text>

        {!!poll.description && (
          <Text style={styles.pollDescription}>
            {poll.description}
          </Text>
        )}

        {(poll.options || []).map(
          (option, index) => {
            const votes =
              Number(
                poll.votes?.[index] || 0
              );

            const percent =
              pollPercent(
                poll,
                index
              );

            const selectedVote =
              Number(
                poll.voters?.[uid]
              ) === index;

            return (
              <TouchableOpacity
                key={`${message.id}-option-${index}`}
                style={[
                  styles.pollOption,
                  selectedVote &&
                    styles.pollOptionSelected,
                ]}
                onPress={() =>
                  votePoll(
                    message,
                    index
                  )
                }
              >
                <View
                  style={
                    styles.pollOptionTop
                  }
                >
                  <Text
                    style={
                      styles.pollOptionText
                    }
                  >
                    {option}
                  </Text>

                  <Text
                    style={
                      styles.pollPercent
                    }
                  >
                    {percent}%
                  </Text>
                </View>

                <View
                  style={
                    styles.pollProgressTrack
                  }
                >
                  <View
                    style={[
                      styles.pollProgress,
                      {
                        width: `${percent}%`,
                      },
                    ]}
                  />
                </View>

                <Text
                  style={styles.pollVotes}
                >
                  {votes}{' '}
                  {votes === 1
                    ? 'vote'
                    : 'votes'}
                </Text>
              </TouchableOpacity>
            );
          }
        )}

        <Text style={styles.pollTotal}>
          {pollTotal(poll)} total votes
        </Text>
      </View>
    );
  };

  const renderEventMessage = message => {
    const joined = Boolean(
      message.attendees?.[uid]
    );

    const attendeeCount =
      Object.keys(
        message.attendees || {}
      ).length;

    return (
      <View style={styles.eventCard}>
        <View style={styles.eventIcon}>
          <Ionicons
            name="calendar"
            size={26}
            color={COLORS.urgent}
          />
        </View>

        <View style={styles.eventContent}>
          <Text style={styles.eventTitle}>
            {message.name}
          </Text>

          {!!message.description && (
            <Text
              style={styles.eventDescription}
            >
              {message.description}
            </Text>
          )}

          {!!message.start && (
            <Text style={styles.eventTime}>
              Start: {message.start}
            </Text>
          )}

          {!!message.end && (
            <Text style={styles.eventTime}>
              End: {message.end}
            </Text>
          )}

          <Text style={styles.eventAttendees}>
            {attendeeCount}{' '}
            {attendeeCount === 1
              ? 'person'
              : 'people'}{' '}
            joined
          </Text>

          <TouchableOpacity
            style={[
              styles.eventJoinButton,
              joined &&
                styles.eventJoinButtonActive,
            ]}
            onPress={() =>
              toggleEventAttendance(message)
            }
          >
            <Text
              style={
                styles.eventJoinText
              }
            >
              {joined ? 'Joined' : 'Join'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderMessage = ({
    item,
  }) => {
    const own = item.senderId === uid;

    if (item.deleted) {
      return (
        <View
          style={[
            styles.messageRow,
            own &&
              styles.messageRowOwn,
          ]}
        >
          <View
            style={[
              styles.messageBubble,
              styles.deletedBubble,
            ]}
          >
            <Text
              style={styles.deletedText}
            >
              This message was deleted.
            </Text>
          </View>
        </View>
      );
    }

    if (item.type === 'poll') {
      return (
        <View
          style={[
            styles.messageRow,
            own &&
              styles.messageRowOwn,
          ]}
        >
          {!own && (
            <Avatar
              name={item.senderName}
              small
            />
          )}

          {renderPollMessage(item)}
        </View>
      );
    }

    if (item.type === 'event') {
      return (
        <View
          style={[
            styles.messageRow,
            own &&
              styles.messageRowOwn,
          ]}
        >
          {!own && (
            <Avatar
              name={item.senderName}
              small
            />
          )}

          {renderEventMessage(item)}
        </View>
      );
    }

    if (item.type === 'voice') {
      return (
        <View
          style={[
            styles.messageRow,
            own &&
              styles.messageRowOwn,
          ]}
        >
          {!own && (
            <Avatar
              name={item.senderName}
              small
            />
          )}

          <View
            style={[
              styles.voiceBubble,
              own &&
                styles.voiceBubbleOwn,
            ]}
          >
            <Ionicons
              name="mic"
              size={21}
              color={COLORS.text}
            />

            <Text
              style={styles.voiceText}
            >
              Voice message
            </Text>

            <Text
              style={styles.voiceDuration}
            >
              {item.duration || '00:00'}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.messageRow,
          own && styles.messageRowOwn,
        ]}
      >
        {!own && (
          <Avatar
            name={item.senderName}
            small
          />
        )}

        <View
          style={[
            styles.messageBubble,
            own &&
              styles.messageBubbleOwn,
          ]}
        >
          {!own &&
            selected?.type ===
              'group' && (
              <Text
                style={
                  styles.messageSender
                }
              >
                {item.senderName ||
                  item.senderUsername ||
                  'User'}
              </Text>
            )}

          <Text
            style={[
              styles.messageText,
              own &&
                styles.messageTextOwn,
            ]}
          >
            {item.text}
          </Text>

          <View style={styles.messageMeta}>
            <Text
              style={
                own
                  ? styles.messageTimeOwn
                  : styles.messageTime
              }
            >
              {formatTime(
                item.createdAt
              )}
            </Text>

            {own && (
              <Ionicons
                name="checkmark-done"
                size={14}
                color={COLORS.blueBright}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderConversationList = () => {
    if (loadingChats) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={COLORS.blueBright}
          />
        </View>
      );
    }

    if (!filteredConversations.length) {
      return (
        <EmptyState
          icon="chatbubbles-outline"
          title="No chats"
          text={
            activeTab === 'All'
              ? 'Your conversations will appear here.'
              : `There are no ${activeTab.toLowerCase()} chats right now.`
          }
        />
      );
    }

    return (
      <FlatList
        data={filteredConversations}
        keyExtractor={item => item.id}
        contentContainerStyle={
          styles.conversationList
        }
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const unread =
            uid &&
            millis(item.lastMessageAt) >
              millis(
                item.lastReadAt?.[uid]
              ) &&
            item.lastSenderId !== uid;

          const name =
            getConversationName(item);

          return (
            <TouchableOpacity
              style={styles.conversationRow}
              onPress={() =>
                openConversation(item)
              }
            >
              <Avatar
                name={name}
                group={
                  item.type === 'group'
                }
              />

              <View
                style={
                  styles.conversationContent
                }
              >
                <View
                  style={
                    styles.conversationTop
                  }
                >
                  <Text
                    style={[
                      styles.conversationName,
                      unread &&
                        styles.conversationNameUnread,
                    ]}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>

                  <Text
                    style={
                      styles.conversationTime
                    }
                  >
                    {formatTime(
                      item.lastMessageAt
                    )}
                  </Text>
                </View>

                <View
                  style={
                    styles.conversationBottom
                  }
                >
                  <Text
                    style={[
                      styles.conversationPreview,
                      unread &&
                        styles.conversationPreviewUnread,
                    ]}
                    numberOfLines={1}
                  >
                    {item.lastMessageText ||
                      'No messages yet'}
                  </Text>

                  <View
                    style={
                      styles.conversationIcons
                    }
                  >
                    {isFavorite(item) && (
                      <Ionicons
                        name="star"
                        size={15}
                        color={
                          COLORS.yellow
                        }
                      />
                    )}

                    {isUrgent(item) && (
                      <Ionicons
                        name="alert-circle"
                        size={16}
                        color={
                          COLORS.urgent
                        }
                      />
                    )}

                    {unread && (
                      <View
                        style={
                          styles.unreadDot
                        }
                      />
                    )}
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    );
  };

  const renderFriendsScreen = () => (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {renderBackHeader('Friends')}

      {loadingFriends ? (
        <View
          style={styles.loadingContainer}
        >
          <ActivityIndicator
            size="large"
            color={COLORS.blueBright}
          />
        </View>
      ) : friends.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No friends"
          text="Search for users and send friend requests."
        />
      ) : (
        <FlatList
          data={friends}
          keyExtractor={item => item.id}
          contentContainerStyle={
            styles.listContent
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.personRow}
              onPress={() =>
                openDirectConversation(item)
              }
            >
              <Avatar
                name={
                  item.displayName ||
                  item.username
                }
              />

              <View
                style={styles.personInfo}
              >
                <Text
                  style={styles.personName}
                >
                  {item.displayName ||
                    item.username ||
                    'User'}
                </Text>

                <Text
                  style={styles.personUsername}
                >
                  @{item.username ||
                    'user'}
                </Text>
              </View>

              <Ionicons
                name="chatbubble-outline"
                size={21}
                color={COLORS.secondary}
              />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );

  const renderFriendRequestsScreen =
    () => (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />

        {renderBackHeader(
          'Friend Requests'
        )}

        {friendRequests.length === 0 ? (
          <EmptyState
            icon="person-add-outline"
            title="No friend requests"
            text="New friend requests will appear here."
          />
        ) : (
          <FlatList
            data={friendRequests}
            keyExtractor={item => item.id}
            contentContainerStyle={
              styles.listContent
            }
            renderItem={({ item }) => (
              <View
                style={
                  styles.requestCard
                }
              >
                <Avatar
                  name={
                    item.fromProfile
                      ?.displayName ||
                    item.fromProfile
                      ?.username
                  }
                />

                <View
                  style={
                    styles.requestInfo
                  }
                >
                  <Text
                    style={
                      styles.personName
                    }
                  >
                    {item.fromProfile
                      ?.displayName ||
                      item.fromProfile
                        ?.username ||
                      'User'}
                  </Text>

                  <Text
                    style={
                      styles.personUsername
                    }
                  >
                    @
                    {item.fromProfile
                      ?.username ||
                      'user'}
                  </Text>
                </View>

                <View
                  style={
                    styles.requestActions
                  }
                >
                  <TouchableOpacity
                    style={
                      styles.acceptButton
                    }
                    onPress={() =>
                      acceptFriendRequest(
                        item
                      )
                    }
                  >
                    <Ionicons
                      name="checkmark"
                      size={19}
                      color={
                        COLORS.text
                      }
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={
                      styles.rejectButton
                    }
                    onPress={() =>
                      rejectFriendRequest(
                        item
                      )
                    }
                  >
                    <Ionicons
                      name="close"
                      size={19}
                      color={
                        COLORS.text
                      }
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    );

  const renderDMRequestsScreen = () => (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {renderBackHeader('DM Requests')}

      {dmRequests.length === 0 ? (
        <EmptyState
          icon="mail-outline"
          title="No DM requests"
          text="New direct-message requests will appear here."
        />
      ) : (
        <FlatList
          data={dmRequests}
          keyExtractor={item => item.id}
          contentContainerStyle={
            styles.listContent
          }
          renderItem={({ item }) => (
            <View
              style={styles.requestCard}
            >
              <Avatar
                name={
                  item.fromProfile
                    ?.displayName ||
                  item.fromProfile
                    ?.username
                }
              />

              <View
                style={styles.requestInfo}
              >
                <Text
                  style={
                    styles.personName
                  }
                >
                  {item.fromProfile
                    ?.displayName ||
                    item.fromProfile
                      ?.username ||
                    'User'}
                </Text>

                <Text
                  style={
                    styles.personUsername
                  }
                >
                  @
                  {item.fromProfile
                    ?.username ||
                    'user'}
                </Text>
              </View>

              <View
                style={styles.requestActions}
              >
                <TouchableOpacity
                  style={
                    styles.acceptButton
                  }
                  onPress={() =>
                    acceptDMRequest(
                      item
                    )
                  }
                >
                  <Ionicons
                    name="checkmark"
                    size={19}
                    color={COLORS.text}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={
                    styles.rejectButton
                  }
                  onPress={() =>
                    rejectDMRequest(
                      item
                    )
                  }
                >
                  <Ionicons
                    name="close"
                    size={19}
                    color={COLORS.text}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );

  const renderSearchScreen = () => (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {renderBackHeader('Search')}

      <View
        style={styles.searchPageContainer}
      >
        <View
          style={styles.searchInputWrap}
        >
          <Ionicons
            name="search"
            size={20}
            color={COLORS.secondary}
          />

          <TextInput
            style={styles.searchInput}
            placeholder="Username"
            placeholderTextColor={
              COLORS.secondary
            }
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={
              searchUser
            }
            returnKeyType="search"
          />

          <TouchableOpacity
            onPress={searchUser}
            disabled={searching}
          >
            {searching ? (
              <ActivityIndicator
                size="small"
                color={COLORS.blueBright}
              />
            ) : (
              <Ionicons
                name="arrow-forward-circle"
                size={27}
                color={COLORS.blueBright}
              />
            )}
          </TouchableOpacity>
        </View>

        {searchResult ? (
          <View
            style={styles.searchResultCard}
          >
            <Avatar
              name={
                searchResult.displayName ||
                searchResult.username
              }
            />

            <View
              style={
                styles.searchResultInfo
              }
            >
              <Text
                style={
                  styles.personName
                }
              >
                {searchResult.displayName ||
                  searchResult.username ||
                  'User'}
              </Text>

              <Text
                style={
                  styles.personUsername
                }
              >
                @{searchResult.username ||
                  'user'}
              </Text>
            </View>

            {searchResult.id !== uid && (
              <View
                style={
                  styles.searchResultActions
                }
              >
                <TouchableOpacity
                  style={
                    styles.smallActionButton
                  }
                  onPress={() =>
                    sendFriendRequest(
                      searchResult
                    )
                  }
                >
                  <Ionicons
                    name="person-add-outline"
                    size={19}
                    color={
                      COLORS.text
                    }
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={
                    styles.smallActionButton
                  }
                  onPress={() =>
                    sendDMRequest(
                      searchResult
                    )
                  }
                >
                  <Ionicons
                    name="mail-outline"
                    size={19}
                    color={
                      COLORS.text
                    }
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={
                    styles.smallActionButton
                  }
                  onPress={() =>
                    openDirectConversation(
                      searchResult
                    )
                  }
                >
                  <Ionicons
                    name="chatbubble-outline"
                    size={19}
                    color={
                      COLORS.text
                    }
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <EmptyState
            icon="search-outline"
            title="Find someone"
            text="Search using their exact Shinzi username."
          />
        )}
      </View>
    </SafeAreaView>
  );

  const renderConversationScreen =
    () => {
      const name =
        getConversationName(
          selectedConversation
        );

      const username =
        getConversationUsername(
          selectedConversation
        );

      const typingNames =
        Object.values(typingUsers)
          .map(
            item =>
              item.displayName ||
              item.username ||
              'Someone'
          );

      return (
        <SafeAreaView
          style={styles.safeArea}
        >
          <StatusBar style="light" />

          <View
            style={styles.chatHeader}
          >
            <TouchableOpacity
              style={styles.iconButton}
              onPress={goBack}
            >
              <Ionicons
                name="arrow-back"
                size={23}
                color={COLORS.text}
              />
            </TouchableOpacity>

            <Avatar
              name={name}
              group={
                selectedConversation?.type ===
                'group'
              }
              small
            />

            <View
              style={styles.chatHeaderInfo}
            >
              <Text
                style={styles.chatHeaderName}
                numberOfLines={1}
              >
                {name}
              </Text>

              <Text
                style={
                  styles.chatHeaderSubtitle
                }
                numberOfLines={1}
              >
                {selectedConversation?.type ===
                'group'
                  ? `${
                      selectedConversation
                        ?.memberIds
                        ?.length || 0
                    } members`
                  : username
                    ? `@${username}`
                    : 'Direct message'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.iconButton}
              onPress={() =>
                toggleFavorite(
                  selectedConversation
                )
              }
            >
              <Ionicons
                name={
                  isFavorite(
                    selectedConversation
                  )
                    ? 'star'
                    : 'star-outline'
                }
                size={21}
                color={
                  isFavorite(
                    selectedConversation
                  )
                    ? COLORS.yellow
                    : COLORS.text
                }
              />
            </TouchableOpacity>

            {selectedConversation?.type !==
              'group' && (
              <>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() =>
                    startCallUI(
                      'voice'
                    )
                  }
                >
                  <Ionicons
                    name="call-outline"
                    size={21}
                    color={
                      COLORS.text
                    }
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() =>
                    startCallUI(
                      'video'
                    )
                  }
                >
                  <Ionicons
                    name="videocam-outline"
                    size={21}
                    color={
                      COLORS.text
                    }
                  />
                </TouchableOpacity>
              </>
            )}
          </View>

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={item =>
              item.id
            }
            renderItem={
              renderMessage
            }
            contentContainerStyle={
              styles.messagesContent
            }
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd?.({
                animated: false,
              })
            }
            ListEmptyComponent={
              <EmptyState
                icon="chatbubble-ellipses-outline"
                title="Start the conversation"
                text="Send a message to begin."
              />
            }
          />

          {typingNames.length > 0 && (
            <View
              style={styles.typingBar}
            >
              <View
                style={styles.typingDots}
              >
                <View
                  style={styles.dot}
                />
                <View
                  style={styles.dot}
                />
                <View
                  style={styles.dot}
                />
              </View>

              <Text
                style={styles.typingText}
              >
                {typingNames.join(
                  ', '
                )}{' '}
                {typingNames.length === 1
                  ? 'is'
                  : 'are'}{' '}
                typing...
              </Text>
            </View>
          )}

          {recording && (
            <View
              style={styles.recordingBar}
            >
              <View
                style={
                  styles.recordingIndicator
                }
              />

              <Text
                style={
                  styles.recordingText
                }
              >
                Recording{' '}
                {formatDuration(
                  recordSeconds
                )}
              </Text>

              <TouchableOpacity
                onPress={
                  startRecordingUI
                }
              >
                <Text
                  style={
                    styles.recordingStop
                  }
                >
                  Stop
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <KeyboardAvoidingView
            behavior={
              Platform.OS === 'ios'
                ? 'padding'
                : undefined
            }
          >
            <View
              style={styles.composer}
            >
              <TouchableOpacity
                style={
                  styles.composerIcon
                }
                onPress={() =>
                  setShowComposer(true)
                }
              >
                <Ionicons
                  name="add-circle-outline"
                  size={28}
                  color={
                    COLORS.blueBright
                  }
                />
              </TouchableOpacity>

              <TextInput
                style={
                  styles.messageInput
                }
                placeholder="Message"
                placeholderTextColor={
                  COLORS.secondary
                }
                value={messageText}
                onChangeText={
                  handleMessageChange
                }
                multiline
                maxLength={
                  MAX_MESSAGE_LENGTH
                }
              />

              <TouchableOpacity
                style={
                  styles.composerIcon
                }
                onPress={
                  startRecordingUI
                }
              >
                <Ionicons
                  name={
                    recording
                      ? 'stop-circle-outline'
                      : 'mic-outline'
                  }
                  size={25}
                  color={
                    recording
                      ? COLORS.red
                      : COLORS.text
                  }
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!messageText.trim() ||
                    sending) &&
                    styles.sendButtonDisabled,
                ]}
                disabled={
                  !messageText.trim() ||
                  sending
                }
                onPress={
                  sendMessage
                }
              >
                {sending ? (
                  <ActivityIndicator
                    size="small"
                    color={
                      COLORS.text
                    }
                  />
                ) : (
                  <Ionicons
                    name="send"
                    size={19}
                    color={
                      COLORS.text
                    }
                  />
                )}
              </TouchableOpacity>
            </View>

            <View
              style={styles.characterCounter}
            >
              <Text
                style={
                  styles.characterCounterText
                }
              >
                {messageText.length}/
                {MAX_MESSAGE_LENGTH}
              </Text>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      );
    };

  const renderMainHeader = () => (
    <View style={styles.mainHeader}>
      <View>
        <Text style={styles.headerTitle}>
          CHATS
        </Text>

        <Text style={styles.headerSubtitle}>
          {profile?.displayName ||
            profile?.username ||
            'Shinzi'}
        </Text>
      </View>

      <View style={styles.headerActions}>
        <TouchableOpacity
          style={styles.headerIcon}
          onPress={() =>
            setShowModes(true)
          }
        >
          <Ionicons
            name="options-outline"
            size={22}
            color={COLORS.text}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerIcon}
          onPress={() =>
            setScreen('dmRequests')
          }
        >
          <Ionicons
            name="mail-outline"
            size={22}
            color={COLORS.text}
          />

          {dmRequests.length > 0 && (
            <View
              style={styles.headerBadge}
            >
              <Text
                style={
                  styles.headerBadgeText
                }
              >
                {dmRequests.length >
                9
                  ? '9+'
                  : dmRequests.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerIcon}
          onPress={() =>
            setScreen(
              'friendRequests'
            )
          }
        >
          <Ionicons
            name="person-add-outline"
            size={22}
            color={COLORS.text}
          />

          {friendRequests.length >
            0 && (
            <View
              style={styles.headerBadge}
            >
              <Text
                style={
                  styles.headerBadgeText
                }
              >
                {friendRequests.length >
                9
                  ? '9+'
                  : friendRequests.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerIcon}
          onPress={() =>
            setShowGroup(true)
          }
        >
          <Ionicons
            name="people-outline"
            size={22}
            color={COLORS.text}
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSearchBar = () => (
    <View
      style={styles.topSearchContainer}
    >
      <View
        style={styles.topSearch}
      >
        <Ionicons
          name="search"
          size={18}
          color={COLORS.secondary}
        />

        <TextInput
          style={styles.topSearchInput}
          placeholder="Search chats"
          placeholderTextColor={
            COLORS.secondary
          }
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {search.length > 0 && (
          <TouchableOpacity
            onPress={() =>
              setSearch('')
            }
          >
            <Ionicons
              name="close-circle"
              size={19}
              color={
                COLORS.secondary
              }
            />
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={styles.searchUsersButton}
        onPress={() =>
          setScreen('search')
        }
      >
        <Ionicons
          name="person-search-outline"
          size={22}
          color={COLORS.blueBright}
        />
      </TouchableOpacity>
    </View>
  );

  const renderTabs = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={
        false
      }
      contentContainerStyle={
        styles.tabsContent
      }
    >
      {TABS.map(tab => {
        const active =
          activeTab === tab;

        return (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab,
              active &&
                styles.tabActive,
            ]}
            onPress={() =>
              setActiveTab(tab)
            }
          >
            <Text
              style={[
                styles.tabText,
                active &&
                  styles.tabTextActive,
              ]}
            >
              {tab}
            </Text>

            {tab === 'Urgent' &&
              conversations.filter(
                isUrgent
              ).length > 0 && (
                <View
                  style={
                    styles.tabDot
                  }
                />
              )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const renderBottomBar = () => (
    <View style={styles.bottomBar}>
      <TouchableOpacity
        style={styles.bottomItem}
        onPress={() =>
          onNavigate
            ? onNavigate('ai')
            : Alert.alert(
                'AI',
                'AI screen navigation is not connected yet.'
              )
        }
      >
        <Ionicons
          name="sparkles-outline"
          size={22}
          color={COLORS.secondary}
        />

        <Text
          style={styles.bottomText}
        >
          AI
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.bottomItem}
        onPress={() =>
          onNavigate
            ? onNavigate('servers')
            : Alert.alert(
                'Servers',
                'Servers screen navigation is not connected yet.'
              )
        }
      >
        <Ionicons
          name="server-outline"
          size={22}
          color={COLORS.secondary}
        />

        <Text
          style={styles.bottomText}
        >
          Servers
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.bottomItem,
          styles.bottomItemActive,
        ]}
        onPress={() =>
          setScreen('main')
        }
      >
        <Ionicons
          name="chatbubbles"
          size={23}
          color={COLORS.blueBright}
        />

        <Text
          style={[
            styles.bottomText,
            styles.bottomTextActive,
          ]}
        >
          Chat
        </Text>

        {unreadCount > 0 && (
          <View
            style={
              styles.bottomBadge
            }
          >
            <Text
              style={
                styles.bottomBadgeText
              }
            >
              {unreadCount > 9
                ? '9+'
                : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.bottomItem}
        onPress={() =>
          setScreen('search')
        }
      >
        <Ionicons
          name="search-outline"
          size={22}
          color={COLORS.secondary}
        />

        <Text
          style={styles.bottomText}
        >
          Search
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.bottomItem}
        onPress={() =>
          onNavigate
            ? onNavigate('profile')
            : Alert.alert(
                'Profile',
                'Profile navigation is not connected yet.'
              )
        }
      >
        <Ionicons
          name="person-outline"
          size={22}
          color={COLORS.secondary}
        />

        <Text
          style={styles.bottomText}
        >
          Profile
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderCallModal = () => (
    <Modal
      visible={showCall}
      animationType="slide"
      onRequestClose={() =>
        setShowCall(false)
      }
    >
      <SafeAreaView
        style={styles.callScreen}
      >
        <StatusBar style="light" />

        <View
          style={styles.callTop}
        >
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() =>
              setShowCall(false)
            }
          >
            <Ionicons
              name="close"
              size={25}
              color={COLORS.text}
            />
          </TouchableOpacity>

          <Text
            style={styles.callTitle}
          >
            {callMode === 'video'
              ? 'Video Call'
              : 'Voice Call'}
          </Text>

          <View
            style={styles.iconButton}
          />
        </View>

        <View
          style={styles.callCenter}
        >
          <Avatar
            name={getConversationName(
              selectedConversation
            )}
          />

          <Text
            style={styles.callName}
          >
            {getConversationName(
              selectedConversation
            )}
          </Text>

          <Text
            style={styles.callStatus}
          >
            Call UI only — real WebRTC
            signaling/media is not
            connected.
          </Text>
        </View>

        <View
          style={styles.callControls}
        >
          <TouchableOpacity
            style={[
              styles.callControl,
              callMuted &&
                styles.callControlActive,
            ]}
            onPress={() =>
              setCallMuted(
                value => !value
              )
            }
          >
            <Ionicons
              name={
                callMuted
                  ? 'mic-off'
                  : 'mic'
              }
              size={24}
              color={
                COLORS.text
              }
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.callControl,
              styles.callEnd,
            ]}
            onPress={() =>
              setShowCall(false)
            }
          >
            <Ionicons
              name="call"
              size={25}
              color={COLORS.text}
            />
          </TouchableOpacity>

          {callMode === 'video' && (
            <TouchableOpacity
              style={
                styles.callControl
              }
              onPress={() =>
                Alert.alert(
                  'Camera',
                  'Real camera/WebRTC video is not connected yet.'
                )
              }
            >
              <Ionicons
                name="videocam"
                size={24}
                color={
                  COLORS.text
                }
              />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );

  if (!uid) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <StatusBar style="light" />

        <EmptyState
          icon="person-circle-outline"
          title="Sign in required"
          text="Please sign in to use Shinzi Chat."
        />
      </SafeAreaView>
    );
  }

  if (screen === 'conversation') {
    return (
      <>
        {renderConversationScreen()}
        {renderAttachmentMenu()}
        {renderPollCreator()}
        {renderEventCreator()}
        {renderGifPanel()}
        {renderCallModal()}
      </>
    );
  }

  if (screen === 'friends') {
    return renderFriendsScreen();
  }

  if (screen === 'friendRequests') {
    return renderFriendRequestsScreen();
  }

  if (screen === 'dmRequests') {
    return renderDMRequestsScreen();
  }

  if (screen === 'search') {
    return renderSearchScreen();
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <StatusBar style="light" />

      {renderMainHeader()}

      {renderSearchBar()}

      {renderTabs()}

      {renderConversationList()}

      <View
        style={styles.quickActions}
      >
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() =>
            setScreen('friends')
          }
        >
          <Ionicons
            name="people-outline"
            size={20}
            color={
              COLORS.blueBright
            }
          />

          <Text
            style={
              styles.quickActionText
            }
          >
            Friends
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickAction}
          onPress={() =>
            setScreen(
              'friendRequests'
            )
          }
        >
          <Ionicons
            name="person-add-outline"
            size={20}
            color={
              COLORS.green
            }
          />

          <Text
            style={
              styles.quickActionText
            }
          >
            Requests
          </Text>

          {friendRequests.length >
            0 && (
            <Badge
              count={
                friendRequests.length
              }
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickAction}
          onPress={() =>
            setScreen(
              'dmRequests'
            )
          }
        >
          <Ionicons
            name="mail-outline"
            size={20}
            color={
              COLORS.yellow
            }
          />

          <Text
            style={
              styles.quickActionText
            }
          >
            DM
          </Text>

          {dmRequests.length >
            0 && (
            <Badge
              count={
                dmRequests.length
              }
            />
          )}
        </TouchableOpacity>
      </View>

      {renderBottomBar()}
      {renderModesModal()}
      {renderGroupModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },

  mainHeader: {
    minHeight: 72,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
  },

  headerTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1,
  },

  headerSubtitle: {
    color: COLORS.secondary,
    fontSize: 12,
    marginTop: 2,
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },

  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  headerBadge: {
    position: 'absolute',
    top: 3,
    right: 2,
    minWidth: 15,
    height: 15,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: COLORS.urgent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerBadgeText: {
    color: COLORS.text,
    fontSize: 8,
    fontWeight: '900',
  },

  topSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
    marginBottom: 7,
  },

  topSearch: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },

  topSearchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    marginLeft: 8,
    paddingVertical: 7,
  },

  searchUsersButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabsContent: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },

  tab: {
    minWidth: 76,
    height: 37,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
    flexDirection: 'row',
    gap: 5,
  },

  tabActive: {
    backgroundColor: COLORS.card2,
    borderColor: COLORS.blue,
  },

  tabText: {
    color: COLORS.secondary,
    fontSize: 13,
    fontWeight: '700',
  },

  tabTextActive: {
    color: COLORS.blueBright,
  },

  tabDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.urgent,
  },

  conversationList: {
    paddingHorizontal: 10,
    paddingBottom: 120,
  },

  conversationRow: {
    minHeight: 74,
    paddingHorizontal: 7,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.card2,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.card2,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '900',
  },

  avatarSmallText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '900',
  },

  conversationContent: {
    flex: 1,
    marginLeft: 11,
    minWidth: 0,
  },

  conversationTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  conversationName: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '800',
  },

  conversationNameUnread: {
    fontWeight: '900',
  },

  conversationTime: {
    color: COLORS.secondary,
    fontSize: 11,
    marginLeft: 8,
  },

  conversationBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },

  conversationPreview: {
    flex: 1,
    color: COLORS.secondary,
    fontSize: 13,
  },

  conversationPreviewUnread: {
    color: COLORS.text,
    fontWeight: '700',
  },

  conversationIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.blueBright,
  },

  badge: {
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: COLORS.urgent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  badgeText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: '900',
  },

  emptyState: {
    flex: 1,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 35,
  },

  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 13,
    textAlign: 'center',
  },

  emptyText: {
    color: COLORS.secondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'center',
  },

  quickActions: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 67,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 5,
  },

  quickAction: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 8,
  },

  quickActionText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 65,
    backgroundColor: '#08080D',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: Platform.OS === 'ios' ? 5 : 0,
  },

  bottomItem: {
    minWidth: 55,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  bottomItemActive: {
    backgroundColor: '#101019',
    borderRadius: 15,
    paddingHorizontal: 9,
  },

  bottomText: {
    color: COLORS.secondary,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },

  bottomTextActive: {
    color: COLORS.blueBright,
  },

  bottomBadge: {
    position: 'absolute',
    top: 3,
    right: 5,
    minWidth: 15,
    height: 15,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: COLORS.urgent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bottomBadgeText: {
    color: COLORS.text,
    fontSize: 8,
    fontWeight: '900',
  },

  backHeader: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },

  backHeaderTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 19,
    fontWeight: '900',
    marginLeft: 5,
  },

  backHeaderRight: {
    width: 42,
    alignItems: 'center',
  },

  listContent: {
    padding: 12,
    paddingBottom: 30,
  },

  personRow: {
    minHeight: 70,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
  },

  personInfo: {
    flex: 1,
    marginLeft: 11,
  },

  personName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '800',
  },

  personUsername: {
    color: COLORS.secondary,
    fontSize: 12,
    marginTop: 3,
  },

  requestCard: {
    minHeight: 76,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    padding: 10,
    marginBottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
  },

  requestInfo: {
    flex: 1,
    marginLeft: 10,
  },

  requestActions: {
    flexDirection: 'row',
    gap: 7,
  },

  acceptButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
  },

  rejectButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchPageContainer: {
    flex: 1,
    padding: 14,
  },

  searchInputWrap: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },

  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    marginHorizontal: 9,
  },

  searchResultCard: {
    marginTop: 14,
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    flexDirection: 'row',
    alignItems: 'center',
  },

  searchResultInfo: {
    flex: 1,
    marginLeft: 11,
  },

  searchResultActions: {
    flexDirection: 'row',
    gap: 5,
  },

  smallActionButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.card2,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  chatHeader: {
    minHeight: 61,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },

  chatHeaderInfo: {
    flex: 1,
    marginLeft: 8,
    marginRight: 3,
  },

  chatHeaderName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
  },

  chatHeaderSubtitle: {
    color: COLORS.secondary,
    fontSize: 11,
    marginTop: 2,
  },

  messagesContent: {
    paddingHorizontal: 10,
    paddingVertical: 13,
    paddingBottom: 15,
    flexGrow: 1,
  },

  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
    gap: 6,
  },

  messageRowOwn: {
    justifyContent: 'flex-end',
  },

  messageBubble: {
    maxWidth: '82%',
    backgroundColor: COLORS.card2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 17,
    borderBottomLeftRadius: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  messageBubbleOwn: {
    backgroundColor: '#15384A',
    borderColor: '#23566D',
    borderBottomLeftRadius: 17,
    borderBottomRightRadius: 5,
  },

  messageText: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 21,
  },

  messageTextOwn: {
    color: COLORS.text,
  },

  messageSender: {
    color: COLORS.blueBright,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 3,
  },

  messageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    marginTop: 4,
  },

  messageTime: {
    color: COLORS.secondary,
    fontSize: 9,
  },

  messageTimeOwn: {
    color: '#A4CFE2',
    fontSize: 9,
  },

  deletedBubble: {
    backgroundColor: COLORS.card,
    borderStyle: 'dashed',
  },

  deletedText: {
    color: COLORS.secondary,
    fontSize: 13,
    fontStyle: 'italic',
  },

  typingBar: {
    minHeight: 30,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  typingDots: {
    flexDirection: 'row',
    gap: 3,
  },

  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.secondary,
  },

  typingText: {
    color: COLORS.secondary,
    fontSize: 11,
  },

  recordingBar: {
    minHeight: 43,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.card,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },

  recordingIndicator: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: COLORS.red,
    marginRight: 8,
  },

  recordingText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },

  recordingStop: {
    color: COLORS.red,
    fontWeight: '800',
  },

  composer: {
    minHeight: 57,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
  },

  composerIcon: {
    width: 39,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },

  messageInput: {
    flex: 1,
    maxHeight: 120,
    minHeight: 42,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 21,
    backgroundColor: COLORS.card,
    color: COLORS.text,
    fontSize: 15,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },

  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sendButtonDisabled: {
    opacity: 0.35,
  },

  characterCounter: {
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingBottom: 3,
    backgroundColor: COLORS.background,
  },

  characterCounterText: {
    color: COLORS.secondary,
    fontSize: 9,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },

  modeModal: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 23,
    borderTopRightRadius: 23,
    padding: 16,
    paddingBottom: 25,
  },

  groupModal: {
    height: '82%',
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 23,
    borderTopRightRadius: 23,
    padding: 16,
  },

  attachmentModal: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 23,
    borderTopRightRadius: 23,
    padding: 16,
    paddingBottom: 25,
  },

  creatorModal: {
    maxHeight: '88%',
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 23,
    borderTopRightRadius: 23,
    padding: 16,
  },

  gifModal: {
    height: '78%',
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 23,
    borderTopRightRadius: 23,
    padding: 16,
  },

  modalHeader: {
    minHeight: 43,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  modalTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: '900',
  },

  modeRow: {
    minHeight: 68,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    backgroundColor: COLORS.card2,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginTop: 9,
  },

  modeIcon: {
    width: 45,
    height: 45,
    borderRadius: 13,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modeTextWrap: {
    flex: 1,
    marginLeft: 11,
  },

  modeTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '800',
  },

  modeSubtitle: {
    color: COLORS.secondary,
    fontSize: 11,
    marginTop: 3,
  },

  modalInput: {
    minHeight: 45,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.card2,
    color: COLORS.text,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    marginBottom: 9,
  },

  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  sectionLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3,
    marginBottom: 7,
  },

  friendPicker: {
    flex: 1,
    marginBottom: 7,
  },

  friendPickerRow: {
    minHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
  },

  friendPickerInfo: {
    flex: 1,
    marginLeft: 9,
  },

  friendPickerName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '800',
  },

  friendPickerUsername: {
    color: COLORS.secondary,
    fontSize: 11,
    marginTop: 2,
  },

  addButton: {
    minWidth: 62,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },

  addButtonActive: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },

  addButtonText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '800',
  },

  addedCount: {
    color: COLORS.secondary,
    fon