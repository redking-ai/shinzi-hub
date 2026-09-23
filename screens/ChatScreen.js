import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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

import {
  Ionicons,
  Feather,
  FontAwesome5,
} from '@expo/vector-icons';

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

import { auth, db } from './firebaseConfig';

/* =========================================================
   SHINZI CHAT
   =========================================================

   REAL FIRESTORE SYSTEMS
   ----------------------
   - Conversations
   - Direct messages
   - DM requests
   - Friend requests
   - Friends
   - Groups
   - Favorites
   - Urgent chats
   - Mentions
   - Read state
   - Typing state
   - Poll creation
   - Poll voting
   - Event creation
   - Event joining

   UI-READY SYSTEMS
   ----------------
   - GIF picker
   - Sticker picker
   - Server GIFs
   - Server stickers
   - Voice message UI
   - Call UI
   - Video-call UI

   IMPORTANT
   ----------
   No fake successful upload/send is written for systems
   whose backend/provider has not been connected yet.
========================================================= */


/* =========================================================
   COLORS
========================================================= */

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


/* =========================================================
   CONSTANTS
========================================================= */

const TABS = [
  'All',
  'Recent',
  'Urgent',
  'Favorite',
  'Groups',
];

const DIRECT_CONVERSATION_PREFIX = 'dm_';

const MAX_MESSAGE_LENGTH = 4000;

const MAX_POLL_OPTIONS = 20;


/* =========================================================
   HELPERS
========================================================= */

const makeDirectConversationId = (
  uid1,
  uid2
) => {
  return (
    DIRECT_CONVERSATION_PREFIX +
    [uid1, uid2]
      .sort()
      .join('_')
  );
};


const getInitials = (
  name = ''
) => {
  const clean =
    String(name).trim();

  if (!clean) {
    return '?';
  }

  const parts =
    clean.split(/\s+/);

  if (parts.length >= 2) {
    return (
      `${parts[0][0]}${parts[1][0]}`
    ).toUpperCase();
  }

  return clean
    .substring(0, 2)
    .toUpperCase();
};


const timestampToMillis = (
  timestamp
) => {
  if (!timestamp) {
    return 0;
  }

  if (
    typeof timestamp.toMillis ===
    'function'
  ) {
    return timestamp.toMillis();
  }

  if (
    timestamp instanceof Date
  ) {
    return timestamp.getTime();
  }

  if (
    typeof timestamp ===
    'number'
  ) {
    return timestamp;
  }

  return 0;
};


const formatTime = (
  timestamp
) => {
  const millis =
    timestampToMillis(
      timestamp
    );

  if (!millis) {
    return '';
  }

  return new Date(
    millis
  ).toLocaleTimeString(
    [],
    {
      hour: 'numeric',
      minute: '2-digit',
    }
  );
};


const getDayKey = (
  timestamp
) => {
  const millis =
    timestampToMillis(
      timestamp
    );

  if (!millis) {
    return '';
  }

  const date =
    new Date(millis);

  return [
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ].join('-');
};


const getDateLabel = (
  timestamp
) => {
  const millis =
    timestampToMillis(
      timestamp
    );

  if (!millis) {
    return '';
  }

  const date =
    new Date(millis);

  const today =
    new Date();

  const yesterday =
    new Date();

  yesterday.setDate(
    yesterday.getDate() - 1
  );

  if (
    getDayKey(date) ===
    getDayKey(today)
  ) {
    return 'Today';
  }

  if (
    getDayKey(date) ===
    getDayKey(yesterday)
  ) {
    return 'Yesterday';
  }

  return date.toLocaleDateString(
    [],
    {
      day: 'numeric',
      month: 'short',
      year:
        date.getFullYear() !==
        today.getFullYear()
          ? 'numeric'
          : undefined,
    }
  );
};


const containsMention = (
  text,
  username
) => {
  if (
    !text ||
    !username
  ) {
    return false;
  }

  const escaped =
    String(username).replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );

  const regex =
    new RegExp(
      `(^|\\s)@${escaped}(\\s|$|[.,!?])`,
      'i'
    );

  return regex.test(text);
};


const getPollTotalVotes = (
  poll
) => {
  if (
    !poll ||
    !poll.votes
  ) {
    return 0;
  }

  return Object.values(
    poll.votes
  ).reduce(
    (total, optionVotes) =>
      total +
      (
        typeof optionVotes ===
        'number'
          ? optionVotes
          : 0
      ),
    0
  );
};


const getPollPercentage = (
  poll,
  optionIndex
) => {
  const total =
    getPollTotalVotes(
      poll
    );

  if (!total) {
    return 0;
  }

  const votes =
    Number(
      poll?.votes?.[
        optionIndex
      ] || 0
    );

  return Math.round(
    (
      votes /
      total
    ) *
      100
  );
};


/* =========================================================
   SMALL REUSABLE COMPONENTS
========================================================= */

function Avatar({
  name,
  group = false,
  small = false,
}) {
  return (
    <View
      style={
        small
          ? styles.avatarSmall
          : styles.avatar
      }
    >
      {group ? (
        <Ionicons
          name="people"
          size={
            small
              ? 17
              : 23
          }
          color={
            COLORS.secondary
          }
        />
      ) : (
        <Text
          style={
            small
              ? styles.avatarSmallText
              : styles.avatarText
          }
        >
          {getInitials(name)}
        </Text>
      )}
    </View>
  );
}


function Badge({
  count,
}) {
  return (
    <View
      style={
        styles.badge
      }
    >
      <Text
        style={
          styles.badgeText
        }
      >
        {count > 9
          ? '9+'
          : count}
      </Text>
    </View>
  );
}


/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function ChatScreen({
  onNavigate,
}) {
  const currentUser =
    auth.currentUser;


  /* =======================================================
     MAIN STATE
  ======================================================= */

  const [
    currentProfile,
    setCurrentProfile,
  ] = useState(null);

  const [
    conversations,
    setConversations,
  ] = useState([]);

  const [
    friends,
    setFriends,
  ] = useState([]);

  const [
    friendRequests,
    setFriendRequests,
  ] = useState([]);

  const [
    dmRequests,
    setDmRequests,
  ] = useState([]);


  /* =======================================================
     NAVIGATION STATE
  ======================================================= */

  const [
    screen,
    setScreen,
  ] = useState('main');

  const [
    activeTab,
    setActiveTab,
  ] = useState('All');


  /* =======================================================
     SEARCH
  ======================================================= */

  const [
    searchQuery,
    setSearchQuery,
  ] = useState('');

  const [
    searchResult,
    setSearchResult,
  ] = useState(null);

  const [
    searching,
    setSearching,
  ] = useState(false);


  /* =======================================================
     CONVERSATION STATE
  ======================================================= */

  const [
    selectedConversation,
    setSelectedConversation,
  ] = useState(null);

  const [
    messages,
    setMessages,
  ] = useState([]);

  const [
    messageText,
    setMessageText,
  ] = useState('');

  const [
    sendingMessage,
    setSendingMessage,
  ] = useState(false);


  /* =======================================================
     LOADING
  ======================================================= */

  const [
    loadingConversations,
    setLoadingConversations,
  ] = useState(true);

  const [
    loadingFriends,
    setLoadingFriends,
  ] = useState(true);


  /* =======================================================
     TYPING
  ======================================================= */

  const [
    typingUsers,
    setTypingUsers,
  ] = useState({});

  const typingTimeoutRef =
    useRef(null);


  /* =======================================================
     MODALS
  ======================================================= */

  const [
    showModes,
    setShowModes,
  ] = useState(false);

  const [
    showCreateGroup,
    setShowCreateGroup,
  ] = useState(false);

  const [
    showComposerMenu,
    setShowComposerMenu,
  ] = useState(false);

  const [
    composerPanel,
    setComposerPanel,
  ] = useState(null);


  /* =======================================================
     GROUP CREATION
  ======================================================= */

  const [
    groupName,
    setGroupName,
  ] = useState('');

  const [
    groupDescription,
    setGroupDescription,
  ] = useState('');

  const [
    selectedGroupFriends,
    setSelectedGroupFriends,
  ] = useState({});

  const [
    creatingGroup,
    setCreatingGroup,
  ] = useState(false);


  /* =======================================================
     POLL CREATION
  ======================================================= */

  const [
    pollQuestion,
    setPollQuestion,
  ] = useState('');

  const [
    pollDescription,
    setPollDescription,
  ] = useState('');

  const [
    pollOptions,
    setPollOptions,
  ] = useState([
    '',
    '',
  ]);

  const [
    creatingPoll,
    setCreatingPoll,
  ] = useState(false);


  /* =======================================================
     EVENT CREATION
  ======================================================= */

  const [
    eventName,
    setEventName,
  ] = useState('');

  const [
    eventDescription,
    setEventDescription,
  ] = useState('');

  const [
    eventStart,
    setEventStart,
  ] = useState('');

  const [
    eventEnd,
    setEventEnd,
  ] = useState('');

  const [
    creatingEvent,
    setCreatingEvent,
  ] = useState(false);


  /* =======================================================
     GIF / STICKER UI
  ======================================================= */

  const [
    gifStickerMode,
    setGifStickerMode,
  ] = useState('gif');

  const [
    gifStickerSearch,
    setGifStickerSearch,
  ] = useState('');

  const [
    gifStickerCategory,
    setGifStickerCategory,
  ] = useState('normal');


  /* =======================================================
     CALL UI
  ======================================================= */

  const [
    showCallScreen,
    setShowCallScreen,
  ] = useState(false);

  const [
    callMode,
    setCallMode,
  ] = useState('voice');

  const [
    callParticipants,
    setCallParticipants,
  ] = useState([]);

  const [
    mutedParticipants,
    setMutedParticipants,
  ] = useState({});

  const [
    callOutput,
    setCallOutput,
  ] = useState('Mobile');


  /* =======================================================
     VOICE MESSAGE UI
  ======================================================= */

  const [
    voiceRecording,
    setVoiceRecording,
  ] = useState(false);

  const [
    voiceDuration,
    setVoiceDuration,
  ] = useState(0);

  const voiceTimerRef =
    useRef(null);


  /* =======================================================
     SEARCH INPUT
  ======================================================= */

  const searchInputRef =
    useRef(null);

  const messagesListRef =
    useRef(null);


  /* =========================================================
     CURRENT PROFILE
  ========================================================= */

  useEffect(() => {
    if (!currentUser) {
      setCurrentProfile(null);
      return;
    }

    const unsubscribe =
      onSnapshot(
        doc(
          db,
          'users',
          currentUser.uid
        ),
        (snapshot) => {
          if (
            snapshot.exists()
          ) {
            setCurrentProfile({
              id: snapshot.id,
              ...snapshot.data(),
            });
          }
        },
        (error) => {
          console.error(
            'Chat profile listener:',
            error
          );
        }
      );

    return unsubscribe;
  }, [
    currentUser?.uid,
  ]);


  /* =========================================================
     CONVERSATIONS
  ========================================================= */

  useEffect(() => {
    if (!currentUser) {
      setConversations([]);
      setLoadingConversations(
        false
      );
      return;
    }

    setLoadingConversations(
      true
    );

    const conversationsQuery =
      query(
        collection(
          db,
          'conversations'
        ),
        where(
          'members',
          'array-contains',
          currentUser.uid
        )
      );

    const unsubscribe =
      onSnapshot(
        conversationsQuery,
        (snapshot) => {
          const list =
            snapshot.docs.map(
              (item) => ({
                id: item.id,
                ...item.data(),
              })
            );

          list.sort(
            (a, b) =>
              timestampToMillis(
                b.lastMessageAt
              ) -
              timestampToMillis(
                a.lastMessageAt
              )
          );

          setConversations(
            list
          );

          setLoadingConversations(
            false
          );
        },
        (error) => {
          console.error(
            'Conversation listener:',
            error
          );

          setLoadingConversations(
            false
          );
        }
      );

    return unsubscribe;
  }, [
    currentUser?.uid,
  ]);


  /* =========================================================
     FRIENDS
  ========================================================= */

  useEffect(() => {
    if (!currentUser) {
      setFriends([]);
      setLoadingFriends(
        false
      );
      return;
    }

    setLoadingFriends(true);

    const unsubscribe =
      onSnapshot(
        collection(
          db,
          'users',
          currentUser.uid,
          'friends'
        ),
        (snapshot) => {
          const list =
            snapshot.docs.map(
              (item) => ({
                id: item.id,
                ...item.data(),
              })
            );

          list.sort(
            (a, b) =>
              String(
                a.username ||
                  a.displayName ||
                  ''
              ).localeCompare(
                String(
                  b.username ||
                    b.displayName ||
                    ''
                )
              )
          );

          setFriends(list);

          setLoadingFriends(
            false
          );
        },
        (error) => {
          console.error(
            'Friends listener:',
            error
          );

          setLoadingFriends(
            false
          );
        }
      );

    return unsubscribe;
  }, [
    currentUser?.uid,
  ]);


  /* =========================================================
     FRIEND REQUESTS
  ========================================================= */

  useEffect(() => {
    if (!currentUser) {
      setFriendRequests([]);
      return;
    }

    const requestsQuery =
      query(
        collection(
          db,
          'users',
          currentUser.uid,
          'friendRequests'
        ),
        where(
          'status',
          '==',
          'pending'
        )
      );

    const unsubscribe =
      onSnapshot(
        requestsQuery,
        (snapshot) => {
          setFriendRequests(
            snapshot.docs.map(
              (item) => ({
                id: item.id,
                ...item.data(),
              })
            )
          );
        },
        (error) => {
          console.error(
            'Friend requests:',
            error
          );
        }
      );

    return unsubscribe;
  }, [
    currentUser?.uid,
  ]);


  /* =========================================================
     DM REQUESTS
  ========================================================= */

  useEffect(() => {
    if (!currentUser) {
      setDmRequests([]);
      return;
    }

    const requestsQuery =
      query(
        collection(
          db,
          'users',
          currentUser.uid,
          'dmRequests'
        ),
        where(
          'status',
          '==',
          'pending'
        )
      );

    const unsubscribe =
      onSnapshot(
        requestsQuery,
        (snapshot) => {
          setDmRequests(
            snapshot.docs.map(
              (item) => ({
                id: item.id,
                ...item.data(),
              })
            )
          );
        },
        (error) => {
          console.error(
            'DM requests:',
            error
          );
        }
      );

    return unsubscribe;
  }, [
    currentUser?.uid,
  ]);


  /* =========================================================
     ACTIVE MESSAGES
  ========================================================= */

  useEffect(() => {
    if (
      !selectedConversation
    ) {
      setMessages([]);
      return;
    }

    const messagesRef =
      collection(
        db,
        'conversations',
        selectedConversation.id,
        'messages'
      );

    const unsubscribe =
      onSnapshot(
        messagesRef,
        (snapshot) => {
          const list =
            snapshot.docs.map(
              (item) => ({
                id: item.id,
                ...item.data(),
              })
            );

          list.sort(
            (a, b) =>
              timestampToMillis(
                a.createdAt
              ) -
              timestampToMillis(
                b.createdAt
              )
          );

          setMessages(list);

          setTimeout(() => {
            messagesListRef.current?.scrollToEnd?.({
              animated: false,
            });
          }, 50);
        },
        (error) => {
          console.error(
            'Messages listener:',
            error
          );
        }
      );

    return unsubscribe;
  }, [
    selectedConversation?.id,
  ]);


  /* =========================================================
     REAL-TIME ACTIVITY
  ========================================================= */

  useEffect(() => {
    if (
      !selectedConversation ||
      !currentUser
    ) {
      setTypingUsers({});
      return;
    }

    const activityRef =
      collection(
        db,
        'conversations',
        selectedConversation.id,
        'activity'
      );

    const unsubscribe =
      onSnapshot(
        activityRef,
        (snapshot) => {
          const now =
            Date.now();

          const next = {};

          snapshot.docs.forEach(
            (item) => {
              if (
                item.id ===
                currentUser.uid
              ) {
                return;
              }

              const data =
                item.data();

              const updated =
                timestampToMillis(
                  data.updatedAt
                );

              if (
                updated &&
                now - updated <
                  6000 &&
                data.type ===
                  'typing'
              ) {
                next[item.id] = {
                  id: item.id,
                  ...data,
                };
              }
            }
          );

          setTypingUsers(
            next
          );
        },
        (error) => {
          console.error(
            'Activity listener:',
            error
          );
        }
      );

    return unsubscribe;
  }, [
    selectedConversation?.id,
    currentUser?.uid,
  ]);


  /* =========================================================
     CONVERSATION HELPERS
  ========================================================= */

  const getConversationTitle =
    (conversation) => {
      if (
        !conversation
      ) {
        return '';
      }

      if (
        conversation.type ===
        'group'
      ) {
        return (
          conversation.groupName ||
          'Unnamed group'
        );
      }

      const otherUid =
        conversation.members?.find(
          (uid) =>
            uid !==
            currentUser?.uid
        );

      return (
        conversation
          .memberProfiles?.[
          otherUid
        ]?.displayName ||
        conversation
          .memberProfiles?.[
          otherUid
        ]?.username ||
        'Unknown user'
      );
    };


  const getConversationUsername =
    (conversation) => {
      if (
        !conversation
      ) {
        return '';
      }

      if (
        conversation.type ===
        'group'
      ) {
        return `${
          conversation.members
            ?.length || 0
        } members`;
      }

      const otherUid =
        conversation.members?.find(
          (uid) =>
            uid !==
            currentUser?.uid
        );

      const username =
        conversation
          .memberProfiles?.[
          otherUid
        ]?.username;

      return username
        ? `@${username}`
        : '';
    };


  const isFavorite =
    (conversation) =>
      conversation
        ?.favoriteBy?.[
        currentUser?.uid
      ] === true;


  const isUrgent =
    (conversation) =>
      conversation
        ?.urgentFor?.[
        currentUser?.uid
      ] === true;


  /* =========================================================
     OPEN DIRECT
  ========================================================= */

  const openDirectConversation =
    async (targetUser) => {
      if (
        !currentUser ||
        !targetUser
      ) {
        return;
      }

      try {
        const conversationId =
          makeDirectConversationId(
            currentUser.uid,
            targetUser.id
          );

        const conversationRef =
          doc(
            db,
            'conversations',
            conversationId
          );

        const snapshot =
          await getDoc(
            conversationRef
          );

        if (
          !snapshot.exists()
        ) {
          await setDoc(
            conversationRef,
            {
              type: 'direct',

              members: [
                currentUser.uid,
                targetUser.id,
              ],

              memberProfiles: {
                [currentUser.uid]: {
                  username:
                    currentProfile?.username ||
                    '',

                  displayName:
                    currentProfile?.displayName ||
                    '',
                },

                [targetUser.id]: {
                  username:
                    targetUser.username ||
                    '',

                  displayName:
                    targetUser.displayName ||
                    '',
                },
              },

              favoriteBy: {},
              urgentFor: {},
              lastReadAt: {},

              createdAt:
                serverTimestamp(),

              lastMessage: '',
              lastMessageAt:
                null,

              lastMessageSenderUid:
                null,
            }
          );
        }

        const updated =
          await getDoc(
            conversationRef
          );

        await openConversation({
          id: conversationId,
          ...(updated.exists()
            ? updated.data()
            : {}),
        });
      } catch (error) {
        console.error(
          'Open direct conversation:',
          error
        );

        Alert.alert(
          'Could not open chat',
          error.message ||
            'Something went wrong.'
        );
      }
    };


  /* =========================================================
     OPEN CONVERSATION
  ========================================================= */

  const openConversation =
    async (
      conversation
    ) => {
      if (
        !conversation
      ) {
        return;
      }

      setSelectedConversation(
        conversation
      );

      setScreen(
        'conversation'
      );

      setMessageText('');

      setTypingUsers({});

      setComposerPanel(
        null
      );

      setShowComposerMenu(
        false
      );

      if (
        !currentUser
      ) {
        return;
      }

      try {
        await updateDoc(
          doc(
            db,
            'conversations',
            conversation.id
          ),
          {
            [`urgentFor.${currentUser.uid}`]:
              false,

            [`lastReadAt.${currentUser.uid}`]:
              serverTimestamp(),
          }
        );
      } catch (error) {
        console.log(
          'Read state update:',
          error
        );
      }
    };


  /* =========================================================
     CLOSE CONVERSATION
  ========================================================= */

  const clearTypingState =
    async () => {
      if (
        !currentUser ||
        !selectedConversation
      ) {
        return;
      }

      try {
        await deleteDoc(
          doc(
            db,
            'conversations',
            selectedConversation.id,
            'activity',
            currentUser.uid
          )
        );
      } catch (error) {
        console.log(
          'Clear activity:',
          error
        );
      }
    };


  const closeConversation =
    async () => {
      if (
        typingTimeoutRef.current
      ) {
        clearTimeout(
          typingTimeoutRef.current
        );
      }

      await clearTypingState();

      setSelectedConversation(
        null
      );

      setMessages([]);

      setMessageText('');

      setTypingUsers({});

      setScreen('main');
    };


  /* =========================================================
     SEARCH
  ========================================================= */

  const searchUser =
    async () => {
      const username =
        searchQuery
          .trim()
          .toLowerCase();

      if (!username) {
        setSearchResult(
          null
        );
        return;
      }

      if (!currentUser) {
        Alert.alert(
          'Not signed in',
          'Please sign in first.'
        );
        return;
      }

      setSearching(true);

      try {
        const usernameSnapshot =
          await getDoc(
            doc(
              db,
              'usernames',
              username
            )
          );

        if (
          !usernameSnapshot.exists()
        ) {
          setSearchResult(
            null
          );

          Alert.alert(
            'User not found',
            `No Shinzi user with @${username} was found.`
          );

          return;
        }

        const targetUid =
          usernameSnapshot.data()
            ?.uid;

        if (
          !targetUid
        ) {
          throw new Error(
            'Username record has no uid.'
          );
        }

        if (
          targetUid ===
          currentUser.uid
        ) {
          setSearchResult(
            null
          );

          Alert.alert(
            'That is you',
            'You cannot start a chat with yourself.'
          );

          return;
        }

        const userSnapshot =
          await getDoc(
            doc(
              db,
              'users',
              targetUid
            )
          );

        if (
          !userSnapshot.exists()
        ) {
          throw new Error(
            'User profile does not exist.'
          );
        }

        setSearchResult({
          id: targetUid,
          ...userSnapshot.data(),
        });
      } catch (error) {
        console.error(
          'Search user:',
          error
        );

        Alert.alert(
          'Search failed',
          error.message ||
            'Something went wrong.'
        );
      } finally {
        setSearching(false);
      }
    };


  /* =========================================================
     FRIEND CHECK
  ========================================================= */

  const isFriend =
    async (
      targetUid
    ) => {
      if (
        !currentUser ||
        !targetUid
      ) {
        return false;
      }

      const snapshot =
        await getDoc(
          doc(
            db,
            'users',
            currentUser.uid,
            'friends',
            targetUid
          )
        );

      return snapshot.exists();
    };


  /* =========================================================
     SEND FRIEND REQUEST
  ========================================================= */

  const sendFriendRequest =
    async (
      targetUser
    ) => {
      if (
        !currentUser ||
        !targetUser
      ) {
        return;
      }

      try {
        if (
          await isFriend(
            targetUser.id
          )
        ) {
          Alert.alert(
            'Already friends',
            `@${targetUser.username} is already your friend.`
          );

          return;
        }

        const requestRef =
          doc(
            db,
            'users',
            targetUser.id,
            'friendRequests',
            currentUser.uid
          );

        const existing =
          await getDoc(
            requestRef
          );

        if (
          existing.exists() &&
          existing.data()
            ?.status ===
            'pending'
        ) {
          Alert.alert(
            'Already sent',
            'That friend request is already pending.'
          );

          return;
        }

        await setDoc(
          requestRef,
          {
            senderUid:
              currentUser.uid,

            senderUsername:
              currentProfile?.username ||
              '',

            senderDisplayName:
              currentProfile?.displayName ||
              '',

            status:
              'pending',

            createdAt:
              serverTimestamp(),
          }
        );

        Alert.alert(
          'Request sent',
          `Friend request sent to @${targetUser.username}.`
        );
      } catch (error) {
        console.error(
          'Friend request:',
          error
        );

        Alert.alert(
          'Could not send request',
          error.message ||
            'Something went wrong.'
        );
      }
    };


  /* =========================================================
     ACCEPT FRIEND
  ========================================================= */

  const acceptFriendRequest =
    async (
      request
    ) => {
      if (
        !currentUser ||
        !request?.senderUid
      ) {
        return;
      }

      try {
        const senderSnapshot =
          await getDoc(
            doc(
              db,
              'users',
              request.senderUid
            )
          );

        if (
          !senderSnapshot.exists()
        ) {
          throw new Error(
            'The sender profile no longer exists.'
          );
        }

        const sender =
          senderSnapshot.data();

        await setDoc(
          doc(
            db,
            'users',
            currentUser.uid,
            'friends',
            request.senderUid
          ),
          {
            uid:
              request.senderUid,

            username:
              sender.username ||
              request.senderUsername ||
              '',

            displayName:
              sender.displayName ||
              request.senderDisplayName ||
              '',

            addedAt:
              serverTimestamp(),
          }
        );

        await setDoc(
          doc(
            db,
            'users',
            request.senderUid,
            'friends',
            currentUser.uid
          ),
          {
            uid:
              currentUser.uid,

            username:
              currentProfile?.username ||
              '',

            displayName:
              currentProfile?.displayName ||
              '',

            addedAt:
              serverTimestamp(),
          }
        );

        await deleteDoc(
          doc(
            db,
            'users',
            currentUser.uid,
            'friendRequests',
            request.senderUid
          )
        );
      } catch (error) {
        console.error(
          'Accept friend:',
          error
        );

        Alert.alert(
          'Could not accept',
          error.message ||
            'Something went wrong.'
        );
      }
    };


  const rejectFriendRequest =
    async (
      request
    ) => {
      try {
        await deleteDoc(
          doc(
            db,
            'users',
            currentUser.uid,
            'friendRequests',
            request.senderUid
          )
        );
      } catch (error) {
        Alert.alert(
          'Could not reject',
          error.message ||
            'Something went wrong.'
        );
      }
    };


  /* =========================================================
     DM REQUEST
  ========================================================= */

  const sendDMRequest =
    async (
      targetUser
    ) => {
      if (
        !currentUser ||
        !targetUser
      ) {
        return;
      }

      try {
        if (
          await isFriend(
            targetUser.id
          )
        ) {
          await openDirectConversation(
            targetUser
          );

          return;
        }

        const requestRef =
          doc(
            db,
            'users',
            targetUser.id,
            'dmRequests',
            currentUser.uid
          );

        const existing =
          await getDoc(
            requestRef
          );

        if (
          existing.exists() &&
          existing.data()
            ?.status ===
            'pending'
        ) {
          Alert.alert(
            'Already sent',
            'Your DM request is already pending.'
          );

          return;
        }

        await setDoc(
          requestRef,
          {
            senderUid:
              currentUser.uid,

            senderUsername:
              currentProfile?.username ||
              '',

            senderDisplayName:
              currentProfile?.displayName ||
              '',

            status:
              'pending',

            createdAt:
              serverTimestamp(),
          }
        );

        Alert.alert(
          'DM request sent',
          `@${targetUser.username} will see your request.`
        );
      } catch (error) {
        Alert.alert(
          'Could not send DM request',
          error.message ||
            'Something went wrong.'
        );
      }
    };


  const acceptDMRequest =
    async (
      request
    ) => {
      try {
        const senderSnapshot =
          await getDoc(
            doc(
              db,
              'users',
              request.senderUid
            )
          );

        if (
          !senderSnapshot.exists()
        ) {
          throw new Error(
            'Sender profile no longer exists.'
          );
        }

        const sender =
          senderSnapshot.data();

        const conversationId =
          makeDirectConversationId(
            currentUser.uid,
            request.senderUid
          );

        const conversationRef =
          doc(
            db,
            'conversations',
            conversationId
          );

        await setDoc(
          conversationRef,
          {
            type: 'direct',

            members: [
              currentUser.uid,
              request.senderUid,
            ],

            memberProfiles: {
              [currentUser.uid]: {
                username:
                  currentProfile?.username ||
                  '',

                displayName:
                  currentProfile?.displayName ||
                  '',
              },

              [request.senderUid]: {
                username:
                  sender.username ||
                  request.senderUsername ||
                  '',

                displayName:
                  sender.displayName ||
                  request.senderDisplayName ||
                  '',
              },
            },

            favoriteBy: {},
            urgentFor: {},
            lastReadAt: {},

            createdAt:
              serverTimestamp(),

            lastMessage: '',
            lastMessageAt:
              null,

            lastMessageSenderUid:
              null,
          },
          {
            merge: true,
          }
        );

        await deleteDoc(
          doc(
            db,
            'users',
            currentUser.uid,
            'dmRequests',
            request.senderUid
          )
        );

        const latest =
          await getDoc(
            conversationRef
          );

        await openConversation({
          id: conversationId,
          ...(latest.exists()
            ? latest.data()
            : {}),
        });
      } catch (error) {
        Alert.alert(
          'Could not accept',
          error.message ||
            'Something went wrong.'
        );
      }
    };


  const rejectDMRequest =
    async (
      request
    ) => {
      try {
        await deleteDoc(
          doc(
            db,
            'users',
            currentUser.uid,
            'dmRequests',
            request.senderUid
          )
        );
      } catch (error) {
        Alert.alert(
          'Could not reject',
          error.message ||
            'Something went wrong.'
        );
      }
    };


  /* =========================================================
     TYPING
  ========================================================= */

  const publishTypingState =
    async (
      active
    ) => {
      if (
        !currentUser ||
        !selectedConversation
      ) {
        return;
      }

      const activityRef =
        doc(
          db,
          'conversations',
          selectedConversation.id,
          'activity',
          currentUser.uid
        );

      if (!active) {
        try {
          await deleteDoc(
            activityRef
          );
        } catch (error) {
          console.log(
            'Typing clear:',
            error
          );
        }

        return;
      }

      try {
        await setDoc(
          activityRef,
          {
            uid:
              currentUser.uid,

            username:
              currentProfile?.username ||
              '',

            displayName:
              currentProfile?.displayName ||
              '',

            type:
              'typing',

            updatedAt:
              serverTimestamp(),
          }
        );
      } catch (error) {
        console.error(
          'Typing state:',
          error
        );
      }
    };


  const handleMessageTextChange =
    (value) => {
      setMessageText(
        value
      );

      if (
        typingTimeoutRef.current
      ) {
        clearTimeout(
          typingTimeoutRef.current
        );
      }

      if (
        !value.trim()
      ) {
        publishTypingState(
          false
        );

        return;
      }

      publishTypingState(
        true
      );

      typingTimeoutRef.current =
        setTimeout(
          () => {
            publishTypingState(
              false
            );
          },
          5000
        );
    };


  /* =========================================================
     SEND TEXT MESSAGE
  ========================================================= */

  const sendMessage =
    async () => {
      const text =
        messageText.trim();

      if (
        !text ||
        !currentUser ||
        !selectedConversation ||
        sendingMessage
      ) {
        return;
      }

      setSendingMessage(
        true
      );

      try {
        await publishTypingState(
          false
        );

        const messageRef =
          await addDoc(
            collection(
              db,
              'conversations',
              selectedConversation.id,
              'messages'
            ),
            {
              senderUid:
                currentUser.uid,

              senderUsername:
                currentProfile?.username ||
                '',

              senderDisplayName:
                currentProfile?.displayName ||
                '',

              text,

              type: 'text',

              createdAt:
                serverTimestamp(),
            }
          );

        const urgentUpdates =
          {};

        for (
          const memberUid of
          selectedConversation.members ||
          []
        ) {
          if (
            memberUid ===
            currentUser.uid
          ) {
            continue;
          }

          const memberProfile =
            selectedConversation
              .memberProfiles?.[
              memberUid
            ];

          if (
            containsMention(
              text,
              memberProfile?.username
            )
          ) {
            urgentUpdates[
              `urgentFor.${memberUid}`
            ] = true;
          }
        }

        await updateDoc(
          doc(
            db,
            'conversations',
            selectedConversation.id
          ),
          {
            lastMessage:
              text,

            lastMessageAt:
              serverTimestamp(),

            lastMessageSenderUid:
              currentUser.uid,

            lastMessageId:
              messageRef.id,

            ...urgentUpdates,
          }
        );

        setMessageText('');
      } catch (error) {
        console.error(
          'Send message:',
          error
        );

        Alert.alert(
          'Message failed',
          error.message ||
            'The message could not be sent.'
        );
      } finally {
        setSendingMessage(
          false
        );
      }
    };


  /* =========================================================
     FAVORITE
  ========================================================= */

  const toggleFavorite =
    async (
      conversation
    ) => {
      if (
        !currentUser ||
        !conversation
      ) {
        return;
      }

      try {
        await updateDoc(
          doc(
            db,
            'conversations',
            conversation.id
          ),
          {
            [`favoriteBy.${currentUser.uid}`]:
              !isFavorite(
                conversation
              ),
          }
        );
      } catch (error) {
        Alert.alert(
          'Could not update favorite',
          error.message ||
            'Something went wrong.'
        );
      }
    };


  /* =========================================================
     GROUPS
  ========================================================= */

  const toggleGroupFriend =
    (friendUid) => {
      setSelectedGroupFriends(
        (previous) => ({
          ...previous,

          [friendUid]:
            !previous[
              friendUid
            ],
        })
      );
    };


  const createGroup =
    async () => {
      if (!currentUser) {
        return;
      }

      const cleanName =
        groupName.trim();

      const selectedFriends =
        friends.filter(
          (friend) =>
            selectedGroupFriends[
              friend.id
            ] === true
        );

      if (!cleanName) {
        Alert.alert(
          'Group name required',
          'Please enter a group name.'
        );

        return;
      }

      if (
        selectedFriends.length ===
        0
      ) {
        Alert.alert(
          'Add friends',
          'Select at least one friend.'
        );

        return;
      }

      setCreatingGroup(
        true
      );

      try {
        const members = [
          currentUser.uid,
          ...selectedFriends.map(
            (friend) =>
              friend.id
          ),
        ];

        const memberProfiles = {
          [currentUser.uid]: {
            username:
              currentProfile?.username ||
              '',

            displayName:
              currentProfile?.displayName ||
              '',
          },
        };

        selectedFriends.forEach(
          (friend) => {
            memberProfiles[
              friend.id
            ] = {
              username:
                friend.username ||
                '',

              displayName:
                friend.displayName ||
                '',
            };
          }
        );

        const conversationRef =
          doc(
            collection(
              db,
              'conversations'
            )
          );

        await setDoc(
          conversationRef,
          {
            type: 'group',

            groupName:
              cleanName,

            groupDescription:
              groupDescription.trim(),

            groupOwnerUid:
              currentUser.uid,

            members,

            memberProfiles,

            favoriteBy: {},
            urgentFor: {},
            lastReadAt: {},

            createdAt:
              serverTimestamp(),

            lastMessage: '',
            lastMessageAt:
              null,

            lastMessageSenderUid:
              null,
          }
        );

        setGroupName('');
        setGroupDescription('');
        setSelectedGroupFriends(
          {}
        );

        setShowCreateGroup(
          false
        );

        setActiveTab(
          'Groups'
        );
      } catch (error) {
        Alert.alert(
          'Could not create group',
          error.message ||
            'Something went wrong.'
        );
      } finally {
        setCreatingGroup(
          false
        );
      }
    };


  /* =========================================================
     POLL CREATION
  ========================================================= */

  const addPollOption =
    () => {
      if (
        pollOptions.length >=
        MAX_POLL_OPTIONS
      ) {
        Alert.alert(
          'Maximum reached',
          `A poll can have up to ${MAX_POLL_OPTIONS} options.`
        );

        return;
      }

      setPollOptions(
        (previous) => [
          ...previous,
          '',
        ]
      );
    };


  const removePollOption =
    (index) => {
      if (
        pollOptions.length <=
        2
      ) {
        return;
      }

      setPollOptions(
        (previous) =>
          previous.filter(
            (_, i) =>
              i !== index
          )
      );
    };


  const updatePollOption =
    (
      index,
      value
    ) => {
      setPollOptions(
        (previous) =>
          previous.map(
            (
              option,
              i
            ) =>
              i === index
                ? value
                : option
          )
      );
    };


  const resetPoll =
    () => {
      setPollQuestion('');
      setPollDescription('');
      setPollOptions([
        '',
        '',
      ]);
    };


  const createPoll =
    async () => {
      if (
        !currentUser ||
        !selectedConversation
      ) {
        return;
      }

      const question =
        pollQuestion.trim();

      const options =
        pollOptions
          .map(
            (option) =>
              option.trim()
          )
          .filter(Boolean);

      if (!question) {
        Alert.alert(
          'Question required',
          'Enter your poll question.'
        );

        return;
      }

      if (
        options.length <
        2
      ) {
        Alert.alert(
          'More options required',
          'A poll needs at least two options.'
        );

        return;
      }

      if (
        options.length >
        MAX_POLL_OPTIONS
      ) {
        Alert.alert(
          'Too many options',
          `A poll can have up to ${MAX_POLL_OPTIONS} options.`
        );

        return;
      }

      setCreatingPoll(
        true
      );

      try {
        const votes = {};

        options.forEach(
          (_, index) => {
            votes[index] = 0;
          }
        );

        const messageRef =
          await addDoc(
            collection(
              db,
              'conversations',
              selectedConversation.id,
              'messages'
            ),
            {
              type: 'poll',

              senderUid:
                currentUser.uid,

              senderUsername:
                currentProfile?.username ||
                '',

              senderDisplayName:
                currentProfile?.displayName ||
                '',

              text: question,

              poll: {
                question,

                description:
                  pollDescription.trim(),

                options,

                votes,

                voters: {},

                createdBy:
                  currentUser.uid,

                allowMultiple:
                  false,

                createdAt:
                  serverTimestamp(),
              },

              createdAt:
                serverTimestamp(),
            }
          );

        await updateDoc(
          doc(
            db,
            'conversations',
            selectedConversation.id
          ),
          {
            lastMessage:
              `📊 Poll: ${question}`,

            lastMessageAt:
              serverTimestamp(),

            lastMessageSenderUid:
              currentUser.uid,

            lastMessageId:
              messageRef.id,
          }
        );

        resetPoll();

        setComposerPanel(
          null
        );
      } catch (error) {
        console.error(
          'Create poll:',
          error
        );

        Alert.alert(
          'Poll failed',
          error.message ||
            'The poll could not be created.'
        );
      } finally {
        setCreatingPoll(
          false
        );
      }
    };


  /* =========================================================
     POLL VOTING
  ========================================================= */

  const votePoll =
    async (
      message,
      optionIndex
    ) => {
      if (
        !currentUser ||
        !selectedConversation ||
        !message?.poll
      ) {
        return;
      }

      const messageRef =
        doc(
          db,
          'conversations',
          selectedConversation.id,
          'messages',
          message.id
        );

      try {
        const snapshot =
          await getDoc(
            messageRef
          );

        if (
          !snapshot.exists()
        ) {
          return;
        }

        const data =
          snapshot.data();

        const poll =
          data.poll || {};

        const voters = {
          ...(poll.voters || {}),
        };

        const votes = {
          ...(poll.votes || {}),
        };

        const previousVote =
          voters[
            currentUser.uid
          ];

        /*
         * This poll implementation allows
         * one vote per user.
         */

        if (
          previousVote !==
          undefined
        ) {
          if (
            previousVote ===
            optionIndex
          ) {
            return;
          }

          votes[
            previousVote
          ] = Math.max(
            0,
            Number(
              votes[
                previousVote
              ] || 0
            ) - 1
          );
        }

        votes[
          optionIndex
        ] =
          Number(
            votes[
              optionIndex
            ] || 0
          ) + 1;

        voters[
          currentUser.uid
        ] =
          optionIndex;

        await updateDoc(
          messageRef,
          {
            'poll.votes':
              votes,

            'poll.voters':
              voters,
          }
        );
      } catch (error) {
        console.error(
          'Vote poll:',
          error
        );

        Alert.alert(
          'Vote failed',
          error.message ||
            'Your vote could not be saved.'
        );
      }
    };


  /* =========================================================
     EVENT CREATION
  ========================================================= */

  const createEvent =
    async () => {
      if (
        !currentUser ||
        !selectedConversation
      ) {
        return;
      }

      const name =
        eventName.trim();

      if (!name) {
        Alert.alert(
          'Event name required',
          'Enter an event name.'
        );

        return;
      }

      setCreatingEvent(
        true
      );

      try {
        const messageRef =
          await addDoc(
            collection(
              db,
              'conversations',
              selectedConversation.id,
              'messages'
            ),
            {
              type: 'event',

              senderUid:
                currentUser.uid,

              senderUsername:
                currentProfile?.username ||
                '',

              senderDisplayName:
                currentProfile?.displayName ||
                '',

              text:
                `📅 Event: ${name}`,

              event: {
                name,

                description:
                  eventDescription.trim(),

                startTime:
                  eventStart.trim(),

                endTime:
                  eventEnd.trim(),

                participants: {},

                createdBy:
                  currentUser.uid,

                createdAt:
                  serverTimestamp(),
              },

              createdAt:
                serverTimestamp(),
            }
          );

        await updateDoc(
          doc(
            db,
            'conversations',
            selectedConversation.id
          ),
          {
            lastMessage:
              `📅 Event: ${name}`,

            lastMessageAt:
              serverTimestamp(),

            lastMessageSenderUid:
              currentUser.uid,

            lastMessageId:
              messageRef.id,
          }
        );

        setEventName('');
        setEventDescription('');
        setEventStart('');
        setEventEnd('');

        setComposerPanel(
          null
        );
      } catch (error) {
        console.error(
          'Create event:',
          error
        );

        Alert.alert(
          'Event failed',
          error.message ||
            'The event could not be created.'
        );
      } finally {
        setCreatingEvent(
          false
        );
      }
    };


  /* =========================================================
     EVENT JOIN
  ========================================================= */

  const joinEvent =
    async (
      message
    ) => {
      if (
        !currentUser ||
        !selectedConversation ||
        !message?.event
      ) {
        return;
      }

      const messageRef =
        doc(
          db,
          'conversations',
          selectedConversation.id,
          'messages',
          message.id
        );

      try {
        const snapshot =
          await getDoc(
            messageRef
          );

        if (
          !snapshot.exists()
        ) {
          return;
        }

        const data =
          snapshot.data();

        const participants = {
          ...(data.event
            ?.participants ||
            {}),
        };

        participants[
          currentUser.uid
        ] = {
          uid:
            currentUser.uid,

          username:
            currentProfile?.username ||
            '',

          displayName:
            currentProfile?.displayName ||
            '',

          joinedAt:
            new Date().toISOString(),
        };

        await updateDoc(
          messageRef,
          {
            'event.participants':
              participants,
          }
        );
      } catch (error) {
        console.error(
          'Join event:',
          error
        );

        Alert.alert(
          'Could not join',
          error.message ||
            'The event could not be joined.'
        );
      }
    };


  /* =========================================================
     MEDIA PICKER
  ========================================================= */

  const pickImages =
    async (
      useCamera = false
    ) => {
      try {
        let result;

        if (
          useCamera
        ) {
          const permission =
            await ImagePicker.requestCameraPermissionsAsync();

          if (
            !permission.granted
          ) {
            Alert.alert(
              'Camera permission',
              'Camera permission is required to take a photo.'
            );

            return;
          }

          result =
            await ImagePicker.launchCameraAsync(
              {
                mediaTypes:
                  ['images'],
                quality: 0.85,
              }
            );
        } else {
          const permission =
            await ImagePicker.requestMediaLibraryPermissionsAsync();

          if (
            !permission.granted
          ) {
            Alert.alert(
              'Photo permission',
              'Photo library permission is required.'
            );

            return;
          }

          result =
            await ImagePicker.launchImageLibraryAsync(
              {
                mediaTypes:
                  ['images'],
                allowsMultipleSelection:
                  true,
                selectionLimit:
                  10,
                quality: 0.85,
              }
            );
        }

        if (
          result.canceled
        ) {
          return;
        }

        /*
         * IMPORTANT:
         *
         * The selected URI is intentionally NOT written
         * into Firestore as if it were a permanent attachment.
         *
         * Your Drive/assetService system needs to upload
         * this file and return a real shz-SPhXXXXX asset ID
         * before a message is created.
         */

        Alert.alert(
          'Image selected',
          `${result.assets?.length || 1} image${
            result.assets?.length === 1
              ? ''
              : 's'
          } selected. Connect the existing Drive asset uploader to create the real attachment message.`
        );
      } catch (error) {
        console.error(
          'Image picker:',
          error
        );

        Alert.alert(
          'Could not select image',
          error.message ||
            'Something went wrong.'
        );
      }
    };


  /* =========================================================
     COMPOSER PANEL
  ========================================================= */

  const openComposerPanel =
    (panel) => {
      setShowComposerMenu(
        false
      );

      setComposerPanel(
        panel
      );
    };


  /* =========================================================
     GIF/STICKER
  ========================================================= */

  const renderGifStickerPanel =
    () => {
      if (
        composerPanel !==
        'gifSticker'
      ) {
        return null;
      }

      return (
        <View
          style={
            styles.inlinePanel
          }
        >
          <View
            style={
              styles.gifTabs
            }
          >
            <TouchableOpacity
              style={[
                styles.gifTab,
                gifStickerMode ===
                  'gif' &&
                  styles.gifTabActive,
              ]}
              onPress={() =>
                setGifStickerMode(
                  'gif'
                )
              }
            >
              <Text
                style={
                  styles.gifTabText
                }
              >
                GIF
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.gifTab,
                gifStickerMode ===
                  'sticker' &&
                  styles.gifTabActive,
              ]}
              onPress={() =>
                setGifStickerMode(
                  'sticker'
                )
              }
            >
              <Text
                style={
                  styles.gifTabText
                }
              >
                Sticker
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={
              styles.gifCategoryRow
            }
          >
            <TouchableOpacity
              onPress={() =>
                setGifStickerCategory(
                  'normal'
                )
              }
              style={[
                styles.categoryButton,
                gifStickerCategory ===
                  'normal' &&
                  styles.categoryButtonActive,
              ]}
            >
              <Text
                style={
                  styles.categoryText
                }
              >
                Normal
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() =>
                setGifStickerCategory(
                  'server'
                )
              }
              style={[
                styles.categoryButton,
                gifStickerCategory ===
                  'server' &&
                  styles.categoryButtonActive,
              ]}
            >
              <Text
                style={
                  styles.categoryText
                }
              >
                Server
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={
              styles.gifSearch
            }
          >
            <Ionicons
              name="search"
              size={18}
              color={
                COLORS.secondary
              }
            />

            <TextInput
              style={
                styles.gifSearchInput
              }
              placeholder={
                gifStickerMode ===
                'gif'
                  ? 'Search GIFs'
                  : 'Search stickers'
              }
              placeholderTextColor={
                COLORS.secondary
              }
              value={
                gifStickerSearch
              }
              onChangeText={
                setGifStickerSearch
              }
            />
          </View>

          <View
            style={
              styles.gifEmpty
            }
          >
            <Ionicons
              name={
                gifStickerMode ===
                'gif'
                  ? 'images-outline'
                  : 'happy-outline'
              }
              size={38}
              color={
                COLORS.secondary
              }
            />

            <Text
              style={
                styles.emptyTitle
              }
            >
              {gifStickerCategory ===
              'server'
                ? 'Server content'
                : gifStickerMode ===
                  'gif'
                ? 'GIFs'
                : 'Stickers'}
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              {gifStickerCategory ===
              'server'
                ? 'Server GIFs and stickers will appear here when the server system is connected.'
                : 'GIF and sticker API is intentionally not connected yet.'}
            </Text>
          </View>
        </View>
      );
    };


  /* =========================================================
     VOICE MESSAGE UI
  ========================================================= */

  const startVoiceRecording =
    () => {
      setVoiceRecording(
        true
      );

      setVoiceDuration(
        0
      );

      if (
        voiceTimerRef.current
      ) {
        clearInterval(
          voiceTimerRef.current
        );
      }

      voiceTimerRef.current =
        setInterval(
          () => {
            setVoiceDuration(
              (
                value
              ) =>
                value + 1
            );
          },
          1000
        );
      };


  const cancelVoiceRecording =
    () => {
      setVoiceRecording(
        false
      );

      setVoiceDuration(
        0
      );

      if (
        voiceTimerRef.current
      ) {
        clearInterval(
          voiceTimerRef.current
        );
      }
    };


  const sendVoiceMessage =
    () => {
      /*
       * No fake audio message is sent.
       *
       * Actual implementation requires:
       * - microphone permission
       * - audio recording
       * - Drive/storage upload
       * - shz asset record
       * - message asset reference
       */

      Alert.alert(
        'Voice message',
        'The voice-message UI is ready, but real microphone recording/storage is not connected yet.'
      );

      cancelVoiceRecording();
    };


  useEffect(() => {
    return () => {
      if (
        voiceTimerRef.current
      ) {
        clearInterval(
          voiceTimerRef.current
        );
      }

      if (
        typingTimeoutRef.current
      ) {
        clearTimeout(
          typingTimeoutRef.current
        );
      }
    };
  }, []);


  /* =========================================================
     CALL UI
  ========================================================= */

  const startCall =
    (mode) => {
      setCallMode(
        mode
      );

      setCallParticipants([
        {
          uid:
            currentUser?.uid,
          name:
            currentProfile?.displayName ||
            currentProfile?.username ||
            'You',
          speaking:
            false,
        },
      ]);

      setShowCallScreen(
        true
      );
    };


  const toggleParticipantMute =
    (uid) => {
      setMutedParticipants(
        (previous) => ({
          ...previous,

          [uid]:
            !previous[
              uid
            ],
        })
      );
    };


  const endCall =
    () => {
      setShowCallScreen(
        false
      );

      setCallParticipants(
        []
      );

      setMutedParticipants(
        {}
      );
    };


  const renderCallScreen =
    () => {
      if (
        !showCallScreen
      ) {
        return null;
      }

      return (
        <Modal
          visible={
            showCallScreen
          }
          animationType="slide"
          onRequestClose={
            endCall
          }
        >
          <SafeAreaView
            style={
              styles.callScreen
            }
          >
            <View
              style={
                styles.callHeader
              }
            >
              <Text
                style={
                  styles.callTitle
                }
              >
                {callMode ===
                'video'
                  ? 'Video call'
                  : 'Voice call'}
              </Text>

              <Text
                style={
                  styles.callParticipantsCount
                }
              >
                {
                  callParticipants.length
                }{' '}
                participant
                {callParticipants.length ===
                1
                  ? ''
                  : 's'}
              </Text>
            </View>

            <View
              style={
                styles.participantGrid
              }
            >
              {callParticipants.map(
                (
                  participant
                ) => {
                  const muted =
                    mutedParticipants[
                      participant.uid
                    ];

                  return (
                    <View
                      key={
                        participant.uid
                      }
                      style={
                        styles.participantCard
                      }
                    >
                      <Avatar
                        name={
                          participant.name
                        }
                      />

                      <Text
                        style={
                          styles.participantName
                        }
                      >
                        {
                          participant.name
                        }
                      </Text>

                      <View
                        style={
                          styles.voiceActivity
                        }
                      >
                        <Ionicons
                          name={
                            muted
                              ? 'mic-off'
                              : 'mic'
                          }
                          size={
                            17
                          }
                          color={
                            muted
                              ? COLORS.red
                              : COLORS.green
                          }
                        />

                        {!muted &&
                          participant.speaking && (
                            <View
                              style={
                                styles.voiceBars
                              }
                            >
                              <View
                                style={
                                  styles.voiceBar
                                }
                              />
                              <View
                                style={
                                  styles.voiceBar
                                }
                              />
                              <View
                                style={
                                  styles.voiceBar
                                }
                              />
                            </View>
                          )}
                      </View>

                      <TouchableOpacity
                        style={
                          styles.muteParticipantButton
                        }
                        onPress={() =>
                          toggleParticipantMute(
                            participant.uid
                          )
                        }
                      >
                        <Text
                          style={
                            styles.buttonText
                          }
                        >
                          {muted
                            ? 'Unmute'
                            : 'Mute'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                }
              )}
            </View>

            <View
              style={
                styles.callOutputRow
              }
            >
              {[
                'Mobile',
                'Speaker',
                'Device',
              ].map(
                (
                  output
                ) => (
                  <TouchableOpacity
                    key={
                      output
                    }
                    style={[
                      styles.outputButton,
                      callOutput ===
                        output &&
                        styles.outputButtonActive,
                    ]}
                    onPress={() =>
                      setCallOutput(
                        output
                      )
                    }
                  >
                    <Ionicons
                      name={
                        output ===
                        'Mobile'
                          ? 'phone-portrait-outline'
                          : output ===
                            'Speaker'
                          ? 'volume-high-outline'
                          : 'headset-outline'
                      }
                      size={
                        18
                      }
                      color={
                        COLORS.text
                      }
                    />

                    <Text
                      style={
                        styles.outputText
                      }
                    >
                      {
                        output
                      }
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </View>

            <View
              style={
                styles.callControls
              }
            >
              <TouchableOpacity
                style={
                  styles.callControl
                }
                onPress={() =>
                  Alert.alert(
                    'Add participant',
                    'Friend selection for live calls will connect when call signaling is implemented.'
                  )
                }
              >
                <Ionicons
                  name="person-add"
                  size={23}
                  color={
                    COLORS.text
                  }
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={
                  styles.callControl
                }
                onPress={() =>
                  setCallMode(
                    callMode ===
                      'voice'
                      ? 'video'
                      : 'voice'
                  )
                }
              >
                <Ionicons
                  name={
                    callMode ===
                    'voice'
                      ? 'videocam'
                      : 'mic'
                  }
                  size={23}
                  color={
                    COLORS.text
                  }
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.callControl,
                  styles.endCall,
                ]}
                onPress={
                  endCall
                }
              >
                <Ionicons
                  name="call"
                  size={23}
                  color={
                    COLORS.text
                  }
                />
              </TouchableOpacity>
            </View>

            <Text
              style={
                styles.callNotice
              }
            >
              Call interface ready. Real-time voice/video
              transport and signaling are not connected yet.
            </Text>
          </SafeAreaView>
        </Modal>
      );
    };


  /* =========================================================
     POLL CREATOR
  ========================================================= */

  const renderPollCreator =
    () => {
      if (
        composerPanel !==
        'poll'
      ) {
        return null;
      }

      return (
        <View
          style={
            styles.inlinePanel
          }
        >
          <View
            style={
              styles.panelHeader
            }
          >
            <Text
              style={
                styles.panelTitle
              }
            >
              Create Poll
            </Text>

            <TouchableOpacity
              onPress={() =>
                setComposerPanel(
                  null
                )
              }
            >
              <Ionicons
                name="close"
                size={23}
                color={
                  COLORS.text
                }
              />
            </TouchableOpacity>
          </View>

          <TextInput
            style={
              styles.panelInput
            }
            placeholder="Question"
            placeholderTextColor={
              COLORS.secondary
            }
            value={
              pollQuestion
            }
            onChangeText={
              setPollQuestion
            }
            maxLength={
              250
            }
          />

          <TextInput
            style={[
              styles.panelInput,
              styles.multilineInput,
            ]}
            placeholder="Description (optional)"
            placeholderTextColor={
              COLORS.secondary
            }
            value={
              pollDescription
            }
            onChangeText={
              setPollDescription
            }
            multiline
            maxLength={
              500
            }
          />

          <Text
            style={
              styles.sectionTitle
            }
          >
            Options
          </Text>

          <ScrollView
            style={
              styles.optionScroll
            }
          >
            {pollOptions.map(
              (
                option,
                index
              ) => (
                <View
                  key={
                    index
                  }
                  style={
                    styles.optionRow
                  }
                >
                  <TextInput
                    style={
                      styles.optionInput
                    }
                    placeholder={`Option ${
                      index + 1
                    }`}
                    placeholderTextColor={
                      COLORS.secondary
                    }
                    value={
                      option
                    }
                    onChangeText={(
                      value
                    ) =>
                      updatePollOption(
                        index,
                        value
                      )
                    }
                    maxLength={
                      100
                    }
                  />

                  {pollOptions.length >
                    2 && (
                    <TouchableOpacity
                      onPress={() =>
                        removePollOption(
                          index
                        )
                      }
                    >
                      <Ionicons
                        name="close-circle"
                        size={
                          22
                        }
                        color={
                          COLORS.red
                        }
                      />
                    </TouchableOpacity>
                  )}
                </View>
              )
            )}
          </ScrollView>

          {pollOptions.length <
            MAX_POLL_OPTIONS && (
            <TouchableOpacity
              style={
                styles.addOptionButton
              }
              onPress={
                addPollOption
              }
            >
              <Ionicons
                name="add"
                size={18}
                color={
                  COLORS.blue
                }
              />

              <Text
                style={
                  styles.addOptionText
                }
              >
                Add option
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={
              styles.primaryButton
            }
            disabled={
              creatingPoll
            }
            onPress={
              createPoll
            }
          >
            {creatingPoll ? (
              <ActivityIndicator
                color={
                  COLORS.text
              />
            ) : (
              <Text
                style={
                  styles.primaryButtonText
                }
              >
                Send Poll
              </Text>
            )}
          </TouchableOpacity>
        </View>
      );
    };


  /* =========================================================
     EVENT CREATOR
  ========================================================= */

  const renderEventCreator =
    () => {
      if (
        composerPanel !==
        'event'
      ) {
        return null;
      }

      return (
        <View
          style={
            styles.inlinePanel
          }
        >
          <View
            style={
              styles.panelHeader
            }
          >
            <Text
              style={
                styles.panelTitle
              }
            >
              Create Event
            </Text>

            <TouchableOpacity
              onPress={() =>
                setComposerPanel(
                  null
                )
              }
            >
              <Ionicons
                name="close"
                size={23}
                color={
                  COLORS.text
                }
              />
            </TouchableOpacity>
          </View>

          <TextInput
            style={
              styles.panelInput
            }
            placeholder="Event name"
            placeholderTextColor={
              COLORS.secondary
            }
            value={
              eventName
            }
            onChangeText={
              setEventName
            }
            maxLength={
              100
            }
          />

          <TextInput
            style={[
              styles.panelInput,
              styles.multilineInput,
            ]}
            placeholder="Description"
            placeholderTextColor={
              COLORS.secondary
            }
            value={
              eventDescription
            }
            onChangeText={
              setEventDescription
            }
            multiline
            maxLength={
              500
            }
          />

          <TextInput
            style={
              styles.panelInput
            }
            placeholder="Start time"
            placeholderTextColor={
              COLORS.secondary
            }
            value={
              eventStart
            }
            onChangeText={
              setEventStart
            }
            maxLength={
              100
            }
          />

          <TextInput
            style={
              styles.panelInput
            }
            placeholder="End time (optional)"
            placeholderTextColor={
              COLORS.secondary
            }
            value={
              eventEnd
            }
            onChangeText={
              setEventEnd
            }
            maxLength={
              100
            }
          />

          <TouchableOpacity
            style={
              styles.advancedButton
            }
            onPress={() =>
              Alert.alert(
                'Advanced settings',
                'Advanced event settings are reserved for the next event-system phase.'
              )
            }
          >
            <Text
              style={
                styles.advancedText
              }
            >
              Advanced settings
            </Text>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={
                COLORS.secondary
              }
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={
              styles.primaryButton
            }
            disabled={
              creatingEvent
            }
            onPress={
              createEvent
            }
          >
            {creatingEvent ? (
              <ActivityIndicator
                color={
                  COLORS.text
                }
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
      );
    };


  /* =========================================================
     MESSAGE RENDERERS
  ========================================================= */

  const renderPollMessage =
    (
      message,
      mine
    ) => {
      const poll =
        message.poll;

      if (!poll) {
        return null;
      }

      const myVote =
        poll.voters?.[
          currentUser?.uid
        ];

      return (
        <View
          style={
            styles.pollCard
          }
        >
          <View
            style={
              styles.pollHeader
            }
          >
            <Ionicons
              name="stats-chart"
              size={19}
              color={
                COLORS.blue
              }
            />

            <Text
              style={
                styles.pollTitle
              }
            >
              POLL
            </Text>
          </View>

          <Text
            style={
              styles.pollQuestion
            }
          >
            {
              poll.question
            }
          </Text>

          {!!poll.description && (
            <Text
              style={
                styles.pollDescription
              }
            >
              {
                poll.description
              }
            </Text>
          )}

          {(
            poll.options ||
            []
          ).map(
            (
              option,
              index
            ) => {
              const percentage =
                getPollPercentage(
                  poll,
                  index
                );

              const selected =
                myVote ===
                index;

              return (
                <TouchableOpacity
                  key={
                    `${message.id}_${index}`
                  }
                  style={[
                    styles.pollOption,
                    selected &&
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
                      {
                        option
                      }
                    </Text>

                    <Text
                      style={
                        styles.pollPercentage
                      }
                    >
                      {
                        percentage
                      }%
                    </Text>
                  </View>

                  <View
                    style={
                      styles.pollProgress
                    }
                  >
                    <View
                      style={[
                        styles.pollProgressFill,
                        {
                          width: `${percentage}%`,
                        },
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              );
            }
          )}

          <Text
            style={
              styles.pollVotes
            }
          >
            {
              getPollTotalVotes(
                poll
              )
            }{' '}
            vote
            {getPollTotalVotes(
              poll
            ) === 1
              ? ''
              : 's'}
          </Text>
        </View>
      );
    };


  const renderEventMessage =
    (
      message
    ) => {
      const event =
        message.event;

      if (!event) {
        return null;
      }

      const participants =
        Object.values(
          event.participants ||
            {}
        );

      const joined =
        !!event.participants?.[
          currentUser?.uid
        ];

      return (
        <View
          style={
            styles.eventCard
          }
        >
          <View
            style={
              styles.eventHeader
            }
          >
            <Ionicons
              name="calendar"
              size={20}
              color={
                COLORS.blue
              }
            />

            <Text
              style={
                styles.eventLabel
              }
            >
              EVENT
            </Text>
          </View>

          <Text
            style={
              styles.eventName
            }
          >
            {
              event.name
            }
          </Text>

          {!!event.description && (
            <Text
              style={
                styles.eventDescription
              }
            >
              {
                event.description
              }
            </Text>
          )}

          {!!event.startTime && (
            <View
              style={
                styles.eventInfoRow
              }
            >
              <Ionicons
                name="time-outline"
                size={17}
                color={
                  COLORS.secondary
                }
              />

              <Text
                style={
                  styles.eventInfoText
                }
              >
                {
                  event.startTime
                }
              </Text>
            </View>
          )}

          {!!event.endTime && (
            <View
              style={
                styles.eventInfoRow
              }
            >
              <Ionicons
                name="time-outline"
                size={17}
                color={
                  COLORS.secondary
                }
              />

              <Text
                style={
                  styles.eventInfoText
                }
              >
                Ends: {
                  event.endTime
                }
              </Text>
            </View>
          )}

          <View
            style={
              styles.eventParticipants
            }
          >
            <Text
              style={
                styles.eventParticipantsTitle
              }
            >
              {
                participants.length
              }{' '}
              joined
            </Text>

            {participants
              .slice(
                0,
                5
              )
              .map(
                (
                  participant
                ) => (
                  <View
                    key={
                      participant.uid
                    }
                    style={
                      styles.eventParticipant
                    }
                  >
                    <Avatar
                      name={
                        participant.displayName ||
                        participant.username
                      }
                      small
                    />

                    <Text
                      style={
                        styles.eventParticipantName
                      }
                    >
                      {
                        participant.displayName ||
                        participant.username
                      }
                    </Text>
                  </View>
                )
              )}
          </View>

          <TouchableOpacity
            style={[
              styles.joinEventButton,
              joined &&
                styles.joinedEventButton,
            ]}
            onPress={() =>
              joinEvent(
                message
              )
            }
          >
            <Text
              style={
                styles.joinEventText
              }
            >
              {joined
                ? 'Joined'
                : 'Join'}
            </Text>
          </TouchableOpacity>
        </View>
      );
    };


  const renderVoiceMessage =
    (
      message,
      mine
    ) => {
      return (
        <View
          style={
            styles.voiceMessageCard
          }
        >
          <TouchableOpacity
            style={
              styles.voicePlayButton
            }
          >
            <Ionicons
              name="play"
              size={17}
              color={
                COLORS.text
              }
            />
          </TouchableOpacity>

          <View
            style={
              styles.waveform
            }
          >
            {Array.from(
              {
                length: 28,
              }
            ).map(
              (
                _,
                index
              ) => (
                <View
                  key={
                    index
                  }
                  style={[
                    styles.waveBar,
                    {
                      height:
                        7 +
                        (
                          index *
                          13
                        ) %
                          21,
                    },
                  ]}
                />
              )
            )}
          </View>

          <Text
            style={
              styles.voiceDuration
            }
          >
            {message.duration ||
              '0:00'}
          </Text>
        </View>
      );
    };


  const renderMessage =
    ({
      item,
      index,
    }) => {
      const mine =
        item.senderUid ===
        currentUser?.uid;

      const previous =
        messages[
          index - 1
        ];

      const showDate =
        !previous ||
        getDayKey(
          previous.createdAt
        ) !==
          getDayKey(
            item.createdAt
          );

      return (
        <View>
          {showDate && (
            <View
              style={
                styles.dateSeparator
              }
            >
              <Text
                style={
                  styles.dateSeparatorText
                }
              >
                {
                  getDateLabel(
                    item.createdAt
                  )
                }
              </Text>
            </View>
          )}

          <View
            style={[
              styles.messageRow,
              mine &&
                styles.myMessageRow,
            ]}
          >
            {!mine &&
              selectedConversation?.type ===
                'group' && (
                <Text
                  style={
                    styles.messageSenderName
                  }
                >
                  {item.senderDisplayName ||
                    item.senderUsername}
                </Text>
              )}

            <View
              style={[
                styles.messageBubble,
                mine &&
                  styles.myMessageBubble,
                (
                  item.type ===
                    'poll' ||
                  item.type ===
                    'event'
                ) &&
                  styles.specialMessageBubble,
              ]}
            >
              {item.type ===
              'text' ? (
                <Text
                  style={[
                    styles.messageText,
                    mine &&
                      styles.myMessageText,
                  ]}
                >
                  {
                    item.text
                  }
                </Text>
              ) : item.type ===
                'poll' ? (
                renderPollMessage(
                  item,
                  mine
                )
              ) : item.type ===
                'event' ? (
                renderEventMessage(
                  item
                )
              ) : item.type ===
                'voice' ? (
                renderVoiceMessage(
                  item,
                  mine
                )
              ) : (
                <Text
                  style={
                    styles.messageText
                  }
                >
                  Message type not connected yet.
                </Text>
              )}

              <Text
                style={[
                  styles.messageTime,
                  mine &&
                    styles.myMessageTime,
                ]}
              >
                {formatTime(
                  item.createdAt
                )}
              </Text>
            </View>
          </View>
        </View>
      );
    };


  /* =========================================================
     ACTIVITY INDICATOR
  ========================================================= */

  const renderActivityIndicator =
    () => {
      const users =
        Object.values(
          typingUsers
        );

      if (
        users.length ===
        0
      ) {
        return null;
      }

      const first =
        users[0];

      const name =
        first.displayName ||
        first.username ||
        'Someone';

      return (
        <View
          style={
            styles.activityContainer
          }
        >
          <Avatar
            name={
              name
            }
            small
          />

          <View
            style={
              styles.typingBubble
            }
          >
            <View
              style={
                styles.typingDots
              }
            >
              <View
                style={
                  styles.typingDot
                }
              />

              <View
                style={
                  styles.typingDot
                }
              />

              <View
                style={
                  styles.typingDot
                }
              />
            </View>
          </View>

          <Text
            style={
              styles.activityText
            }
          >
            {users.length ===
            1
              ? `${name} is typing`
              : `${users.length} people are typing`}
          </Text>
        </View>
      );
    };


  /* =========================================================
     ATTACHMENT MENU
  ========================================================= */

  const renderAttachmentMenu =
    () => {
      return (
        <Modal
          visible={
            showComposerMenu
          }
          transparent
          animationType="fade"
          onRequestClose={() =>
            setShowComposerMenu(
              false
            )
          }
        >
          <TouchableOpacity
            style={
              styles.modalOverlayBottom
            }
            activeOpacity={1}
            onPress={() =>
              setShowComposerMenu(
                false
              )
            }
          >
            <View
              style={
                styles.attachmentBox
              }
            >
              <View
                style={
                  styles.panelHeader
                }
              >
                <Text
                  style={
                    styles.panelTitle
                  }
                >
                  Attach
                </Text>

                <TouchableOpacity
                  onPress={() =>
                    setShowComposerMenu(
                      false
                    )
                  }
                >
                  <Ionicons
                    name="close"
                    size={23}
                    color={
                      COLORS.text
                    }
                  />
                </TouchableOpacity>
              </View>

              <View
                style={
                  styles.attachmentGrid
                }
              >
                <AttachmentButton
                  icon="image-outline"
                  title="Image"
                  onPress={() =>
                    pickImages(
                      false
                    )
                  }
                />

                <AttachmentButton
                  icon="document-outline"
                  title="Files"
                  onPress={() =>
                    Alert.alert(
                      'Files',
                      'Connect the real document picker and Drive file upload here. No fake file message is created.'
                    )
                  }
                />

                <AttachmentButton
                  icon="stats-chart-outline"
                  title="Poll"
                  onPress={() =>
                    openComposerPanel(
                      'poll'
                    )
                  }
                />

                <AttachmentButton
                  icon="calendar-outline"
                  title="Event"
                  onPress={() =>
                    openComposerPanel(
                      'event'
                    )
                  }
                />

                <AttachmentButton
                  icon="camera-outline"
                  title="Camera"
                  onPress={() =>
                    pickImages(
                      true
                    )
                  }
                />

                <AttachmentButton
                  icon="person-add-outline"
                  title="Invite"
                  onPress={() =>
                    Alert.alert(
                      'Invite',
                      'Friend/call invitation flow will connect to the real call/chat membership system.'
                    )
                  }
                />
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      );
    };


  /* =========================================================
     ATTACHMENT BUTTON
  ========================================================= */

  function AttachmentButton({
    icon,
    title,
    onPress,
  }) {
    return (
      <TouchableOpacity
        style={
          styles.attachmentItem
        }
        onPress={
          onPress
        }
      >
        <View
          style={
            styles.attachmentIcon
          }
        >
          <Ionicons
            name={icon}
            size={25}
            color={
              COLORS.blue
            }
          />
        </View>

        <Text
          style={
            styles.attachmentText
          }
        >
          {title}
        </Text>
      </TouchableOpacity>
    );
  }


  /* =========================================================
     FRIENDS SCREEN
  ========================================================= */

  const renderFriendsScreen =
    () => (
      <SafeAreaView
        style={
          styles.container
        }
      >
        <StatusBar
          style="light"
        />

        {renderBackHeader(
          'Friends',
          () =>
            setScreen(
              'main'
            )
        )}

        {loadingFriends ? (
          <View
            style={
              styles.centerLoading
            }
          >
            <ActivityIndicator
              color={
                COLORS.blue
              }
            />
          </View>
        ) : (
          <FlatList
            data={
              friends
            }
            keyExtractor={(
              item
            ) =>
              item.id
            }
            contentContainerStyle={[
              styles.listContainer,
              friends.length ===
                0 &&
                styles.emptyListContainer,
            ]}
            renderItem={({
              item,
            }) => (
              <TouchableOpacity
                style={
                  styles.friendCard
                }
                onPress={() =>
                  openDirectConversation(
                    item
                  )
                }
              >
                <Avatar
                  name={
                    item.displayName ||
                    item.username
                  }
                />

                <View
                  style={
                    styles.friendInfo
                  }
                >
                  <Text
                    style={
                      styles.chatName
                    }
                  >
                    {item.displayName ||
                      item.username}
                  </Text>

                  <Text
                    style={
                      styles.chatMessage
                    }
                  >
                    @{item.username}
                  </Text>
                </View>

                <Feather
                  name="message-circle"
                  size={22}
                  color={
                    COLORS.blue
                  }
                />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <EmptyState
                icon="people-outline"
                title="No friends yet"
                text="Search for a username to add friends."
              />
            }
          />
        )}
      </SafeAreaView>
    );


  /* =========================================================
     REQUEST SCREEN
  ========================================================= */

  const renderRequestsScreen =
    (
      type
    ) => {
      const isFriendRequest =
        type ===
        'friend';

      const data =
        isFriendRequest
          ? friendRequests
          : dmRequests;

      return (
        <SafeAreaView
          style={
            styles.container
          }
        >
          <StatusBar
            style="light"
          />

          {renderBackHeader(
            isFriendRequest
              ? 'Friend requests'
              : 'DM requests',
            () =>
              setScreen(
                'main'
              )
          )}

          <FlatList
            data={
              data
            }
            keyExtractor={(
              item
            ) =>
              item.id
            }
            contentContainerStyle={[
              styles.listContainer,
              data.length ===
                0 &&
                styles.emptyListContainer,
            ]}
            renderItem={({
              item,
            }) => (
              <View
                style={
                  styles.requestCard
                }
              >
                <Avatar
                  name={
                    item.senderDisplayName ||
                    item.senderUsername
                  }
                />

                <View
                  style={
                    styles.requestInfo
                  }
                >
                  <Text
                    style={
                      styles.chatName
                    }
                  >
                    {item.senderDisplayName ||
                      item.senderUsername}
                  </Text>

                  <Text
                    style={
                      styles.chatMessage
                    }
                  >
                    @{item.senderUsername}{' '}
                    {isFriendRequest
                      ? 'sent you a friend request.'
                      : 'wants to DM you.'}
                  </Text>
                </View>

                <View
                  style={
                    styles.requestButtons
                  }
                >
                  <TouchableOpacity
                    style={
                      styles.acceptButton
                    }
                    onPress={() =>
                      isFriendRequest
                        ? acceptFriendRequest(
                            item
                          )
                        : acceptDMRequest(
                            item
                          )
                    }
                  >
                    <Text
                      style={
                        styles.buttonText
                      }
                    >
                      Accept
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={
                      styles.rejectButton
                    }
                    onPress={() =>
                      isFriendRequest
                        ? rejectFriendRequest(
                            item
                          )
                        : rejectDMRequest(
                            item
                          )
                    }
                  >
                    <Text
                      style={
                        styles.buttonText
                      }
                    >
                      Reject
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <EmptyState
                icon={
                  isFriendRequest
                    ? 'user-plus'
                    : 'mail-outline'
                }
                title={
                  isFriendRequest
                    ? 'No friend requests'
                    : 'No DM requests'
                }
                text="New requests will appear here."
              />
            }
          />
        </SafeAreaView>
      );
    };


  /* =========================================================
     GROUP MODAL
  ========================================================= */

  const renderCreateGroupModal =
    () => (
      <Modal
        visible={
          showCreateGroup
        }
        transparent
        animationType="slide"
        onRequestClose={() =>
          setShowCreateGroup(
            false
          )
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={
              styles.createGroupBox
            }
          >
            <View
              style={
                styles.panelHeader
              }
            >
              <Text
                style={
                  styles.panelTitle
                }
              >
                Create group
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setShowCreateGroup(
                    false
                  )
                }
              >
                <Ionicons
                  name="close"
                  size={25}
                  color={
                    COLORS.text
                  }
                />
              </TouchableOpacity>
            </View>

            <TextInput
              style={
                styles.panelInput
              }
              placeholder="Group name"
              placeholderTextColor={
                COLORS.secondary
              }
              value={
                groupName
              }
              onChangeText={
                setGroupName
              }
              maxLength={
                50
              }
            />

            <TextInput
              style={[
                styles.panelInput,
                styles.multilineInput,
              ]}
              placeholder="Description"
              placeholderTextColor={
                COLORS.secondary
              }
              value={
                groupDescription
              }
              onChangeText={
                setGroupDescription
              }
              multiline
              maxLength={
                200
              }
            />

            <Text
              style={
                styles.sectionTitle
              }
            >
              Select friends
            </Text>

            <Text
              style={
                styles.addedText
              }
            >
              {
                Object.values(
                  selectedGroupFriends
                ).filter(
                  Boolean
                ).length
              }{' '}
              added
            </Text>

            <ScrollView
              style={
                styles.groupFriendsList
              }
            >
              {friends.map(
                (
                  friend
                ) => {
                  const selected =
                    selectedGroupFriends[
                      friend.id
                    ] === true;

                  return (
                    <TouchableOpacity
                      key={
                        friend.id
                      }
                      style={
                        styles.groupFriendRow
                      }
                      onPress={() =>
                        toggleGroupFriend(
                          friend.id
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
                          styles.friendInfo
                        }
                      >
                        <Text
                          style={
                            styles.chatName
                          }
                        >
                          {friend.displayName ||
                            friend.username}
                        </Text>

                        <Text
                          style={
                            styles.chatMessage
                          }
                        >
                          @{friend.username}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.checkbox,
                          selected &&
                            styles.checkboxSelected,
                        ]}
                      >
                        {selected && (
                          <Ionicons
                            name="checkmark"
                            size={16}
                            color={
                              COLORS.text
                            }
                          />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                }
              )}
            </ScrollView>

            <TouchableOpacity
              style={
                styles.primaryButton
              }
              disabled={
                creatingGroup
              }
              onPress={
                createGroup
              }
            >
              {creatingGroup ? (
                <ActivityIndicator
                  color={
                    COLORS.text
                  }
                />
              ) : (
                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Create group
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );


  /* =========================================================
     MAIN HEADER
  ========================================================= */

  const renderMainHeader =
    () => (
      <View
        style={
          styles.topBar
        }
      >
        <View
          style={
            styles.headerLeft
          }
        >
          <Text
            style={
              styles.headerTitle
            }
          >
            CHATS
          </Text>

          <TouchableOpacity
            style={
              styles.modeButton
            }
            onPress={() =>
              setShowModes(
                true
              )
            }
          >
            <Ionicons
              name="grid-outline"
              size={17}
              color={
                COLORS.secondary
              }
            />

            <Text
              style={
                styles.modeText
              }
            >
              Modes
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={
            styles.topIcons
          }
        >
          <TouchableOpacity
            style={
              styles.iconButton
            }
            onPress={() =>
              setScreen(
                'dmRequests'
              )
            }
          >
            <View>
              <Feather
                name="mail"
                size={23}
                color={
                  COLORS.text
                }
              />

              {dmRequests.length >
                0 && (
                <Badge
                  count={
                    dmRequests.length
                  }
                />
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={
              styles.iconButton
            }
            onPress={() =>
              setScreen(
                'friendRequests'
              )
            }
          >
            <View>
              <Feather
                name="user-plus"
                size={23}
                color={
                  COLORS.text
                }
              />

              {friendRequests.length >
                0 && (
                <Badge
                  count={
                    friendRequests.length
                  }
                />
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={
              styles.iconButton
            }
            onPress={() =>
              setScreen(
                'friends'
              )
            }
          >
            <Ionicons
              name="people-outline"
              size={25}
              color={
                COLORS.text
              }
            />
          </TouchableOpacity>
        </View>
      </View>
    );


  /* =========================================================
     SEARCH BAR
  ========================================================= */

  const renderSearchBar =
    () => (
      <View
        style={
          styles.searchContainer
        }
      >
        <Ionicons
          name="search"
          size={18}
          color={
            COLORS.secondary
          }
        />

        <TextInput
          ref={
            searchInputRef
          }
          style={
            styles.searchInput
          }
          placeholder="Search by username or chat"
          placeholderTextColor={
            COLORS.secondary
          }
          value={
            searchQuery
          }
          onChangeText={(
            text
          ) => {
            setSearchQuery(
              text
            );

            if (
              !text.trim()
            ) {
              setSearchResult(
                null
              );
            }
          }}
          onSubmitEditing={
            searchUser
          }
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />

        {searching ? (
          <ActivityIndicator
            size="small"
            color={
              COLORS.blue
            }
          />
        ) : (
          searchQuery.length >
            0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery(
                  ''
                );
                setSearchResult(
                  null
                );
              }}
            >
              <Ionicons
                name="close-circle"
                size={19}
                color={
                  COLORS.secondary
                }
              />
            </TouchableOpacity>
          )
        )}
      </View>
    );


  /* =========================================================
     SEARCH RESULT
  ========================================================= */

  const renderSearchResult =
    () => {
      if (
        !searchResult
      ) {
        return null;
      }

      return (
        <View
          style={
            styles.searchResultCard
          }
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
                styles.chatName
              }
              numberOfLines={
                1
              }
            >
              {searchResult.displayName ||
                searchResult.username}
            </Text>

            <Text
              style={
                styles.chatMessage
              }
            >
              @{searchResult.username}
            </Text>
          </View>

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
            <Feather
              name="user-plus"
              size={17}
              color={
                COLORS.text
              }
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.smallActionButton,
              styles.blueActionButton,
            ]}
            onPress={() =>
              sendDMRequest(
                searchResult
              )
            }
          >
            <Feather
              name="message-circle"
              size={17}
              color={
                COLORS.text
              }
            />
          </TouchableOpacity>
        </View>
      );
    };


  /* =========================================================
     TABS
  ========================================================= */

  const renderTabs =
    () => (
      <View
        style={
          styles.tabContainer
        }
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.tabScrollContent
          }
        >
          {TABS.map(
            (tab) => (
              <TouchableOpacity
                key={
                  tab
                }
                style={[
                  styles.tabButton,
                  activeTab ===
                    tab &&
                    styles.activeTabButton,
                ]}
                onPress={() =>
                  setActiveTab(
                    tab
                  )
                }
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab ===
                      tab &&
                      styles.activeTabText,
                  ]}
                >
                  {tab}
                </Text>

                {tab ===
                  'Groups' && (
                  <TouchableOpacity
                    style={
                      styles.groupPlus
                    }
                    onPress={() =>
                      setShowCreateGroup(
                        true
                      )
                    }
                  >
                    <Feather
                      name="plus"
                      size={14}
                      color={
                        activeTab ===
                        tab
                          ? COLORS.text
                          : COLORS.secondary
                      }
                    />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            )
          )}
        </ScrollView>
      </View>
    );


  /* =========================================================
     FILTERED CONVERSATIONS
  ========================================================= */

  const filteredConversations =
    useMemo(() => {
      let result =
        [
          ...conversations,
        ];

      const search =
        searchQuery
          .trim()
          .toLowerCase();

      if (search) {
        result =
          result.filter(
            (
              conversation
            ) => {
              const title =
                getConversationTitle(
                  conversation
                ).toLowerCase();

              const username =
                getConversationUsername(
                  conversation
                ).toLowerCase();

              const lastMessage =
                String(
                  conversation.lastMessage ||
                    ''
                ).toLowerCase();

              return (
                title.includes(
                  search
                ) ||
                username.includes(
                  search
                ) ||
                lastMessage.includes(
                  search
                )
              );
            }
          );
      }

      if (
        activeTab ===
        'Recent'
      ) {
        result =
          result.filter(
            (
              conversation
            ) =>
              !!conversation.lastMessageAt
          );

        result.sort(
          (a, b) =>
            timestampToMillis(
              b.lastMessageAt
            ) -
            timestampToMillis(
              a.lastMessageAt
            )
        );

        return result;
      }

      if (
        activeTab ===
        'Urgent'
      ) {
        result =
          result.filter(
            isUrgent
          );
      }

      if (
        activeTab ===
        'Favorite'
      ) {
        result =
          result.filter(
            isFavorite
          );
      }

      if (
        activeTab ===
        'Groups'
      ) {
        result =
          result.filter(
            (
              conversation
            ) =>
              conversation.type ===
              'group'
          );
      }

      result.sort(
        (a, b) => {
          const rank =
            (conversation) => {
              if (
                isUrgent(
                  conversation
                )
              ) {
                return 1;
              }

              if (
                isFavorite(
                  conversation
                )
              ) {
                return 2;
              }

              return 3;
            };

          return (
            rank(a) -
              rank(b) ||
            timestampToMillis(
              b.lastMessageAt
            ) -
              timestampToMillis(
                a.lastMessageAt
              )
          );
        }
      );

      return result;
    }, [
      conversations,
      activeTab,
      searchQuery,
      currentUser?.uid,
    ]);


  /* =========================================================
     CONVERSATION CARD
  ========================================================= */

  const renderConversation =
    ({
      item,
    }) => {
      const title =
        getConversationTitle(
          item
        );

      const username =
        getConversationUsername(
          item
        );

      const urgent =
        isUrgent(item);

      const favorite =
        isFavorite(item);

      const lastMessage =
        item.lastMessage ||
        (
          item.type ===
          'group'
            ? 'Group created'
            : 'Start chatting'
        );

      return (
        <TouchableOpacity
          style={[
            styles.chatCard,
            urgent &&
              styles.urgentChatCard,
          ]}
          activeOpacity={
            0.75
          }
          onPress={() =>
            openConversation(
              item
            )
          }
        >
          <Avatar
            name={
              title
            }
            group={
              item.type ===
              'group'
            }
          />

          <View
            style={
              styles.chatInfo
            }
          >
            <View
              style={
                styles.chatTitleRow
              }
            >
              <Text
                style={
                  styles.chatName
                }
                numberOfLines={
                  1
                }
              >
                {title}
              </Text>

              {item.type ===
                'group' && (
                <Text
                  style={
                    styles.groupLabel
                  }
                >
                  GROUP
                </Text>
              )}
            </View>

            <Text
              style={
                styles.chatUsername
              }
              numberOfLines={
                1
              }
            >
              {username}
            </Text>

            <Text
              style={
                styles.chatMessage
              }
              numberOfLines={
                1
              }
            >
              {
                lastMessage
              }
            </Text>
          </View>

          <View
            style={
              styles.chatMeta
            }
          >
            <Text
              style={
                styles.timeText
              }
            >
              {formatTime(
                item.lastMessageAt
              )}
            </Text>

            <View
              style={
 