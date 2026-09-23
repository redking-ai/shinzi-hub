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

  blue: '#00D2FF',
  blue2: '#4DA8DA',

  urgent: '#FF3366',
  green: '#43D17A',
  red: '#FF4D67',
};

const TABS = [
  'All',
  'Recent',
  'Urgent',
  'Favorite',
  'Groups',
];

const DIRECT_CONVERSATION_PREFIX = 'dm_';

/* =========================================================
   HELPERS
========================================================= */

const makeDirectConversationId = (uid1, uid2) => {
  return (
    DIRECT_CONVERSATION_PREFIX +
    [uid1, uid2]
      .sort()
      .join('_')
  );
};

const getInitials = (name = '') => {
  const clean = String(name).trim();

  if (!clean) return '?';

  const parts = clean.split(/\s+/);

  if (parts.length >= 2) {
    return (
      `${parts[0][0]}${parts[1][0]}`
    ).toUpperCase();
  }

  return clean
    .substring(0, 2)
    .toUpperCase();
};

const timestampToMillis = (timestamp) => {
  if (!timestamp) return 0;

  if (
    typeof timestamp.toMillis === 'function'
  ) {
    return timestamp.toMillis();
  }

  if (timestamp instanceof Date) {
    return timestamp.getTime();
  }

  return 0;
};

const formatTime = (timestamp) => {
  const millis = timestampToMillis(timestamp);

  if (!millis) return '';

  return new Date(millis).toLocaleTimeString(
    [],
    {
      hour: 'numeric',
      minute: '2-digit',
    }
  );
};

const containsMention = (
  text,
  username
) => {
  if (!text || !username) return false;

  const escaped = username.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );

  const regex = new RegExp(
    `(^|\\s)@${escaped}(\\s|$|[.,!?])`,
    'i'
  );

  return regex.test(text);
};

/* =========================================================
   COMPONENT
========================================================= */

export default function ChatScreen({
  onNavigate,
}) {
  const currentUser = auth.currentUser;

  /* -------------------------------------------------------
     MAIN STATE
  ------------------------------------------------------- */

  const [activeTab, setActiveTab] =
    useState('All');

  const [searchQuery, setSearchQuery] =
    useState('');

  const [screen, setScreen] =
    useState('main');

  const [
    currentProfile,
    setCurrentProfile,
  ] = useState(null);

  const [
    conversations,
    setConversations,
  ] = useState([]);

  const [friends, setFriends] =
    useState([]);

  const [
    friendRequests,
    setFriendRequests,
  ] = useState([]);

  const [
    dmRequests,
    setDmRequests,
  ] = useState([]);

  const [
    searchResult,
    setSearchResult,
  ] = useState(null);

  const [searching, setSearching] =
    useState(false);

  const [
    selectedConversation,
    setSelectedConversation,
  ] = useState(null);

  const [messages, setMessages] =
    useState([]);

  const [
    messageText,
    setMessageText,
  ] = useState('');

  const [
    sendingMessage,
    setSendingMessage,
  ] = useState(false);

  const [
    loadingConversations,
    setLoadingConversations,
  ] = useState(true);

  const [
    loadingFriends,
    setLoadingFriends,
  ] = useState(true);

  const [showModes, setShowModes] =
    useState(false);

  const [
    showCreateGroup,
    setShowCreateGroup,
  ] = useState(false);

  const [groupName, setGroupName] =
    useState('');

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

  /* -------------------------------------------------------
     REAL ACTIVITY STATE

     typingUsers:
     {
       uid: {
         username,
         displayName,
         updatedAt
       }
     }
  ------------------------------------------------------- */

  const [typingUsers, setTypingUsers] =
    useState({});

  const typingTimeoutRef =
    useRef(null);

  const searchInputRef =
    useRef(null);

  /* =======================================================
     CURRENT USER PROFILE
  ======================================================= */

  useEffect(() => {
    if (!currentUser) {
      setCurrentProfile(null);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(
        db,
        'users',
        currentUser.uid
      ),
      (snapshot) => {
        if (snapshot.exists()) {
          setCurrentProfile({
            id: snapshot.id,
            ...snapshot.data(),
          });
        }
      },
      (error) => {
        console.error(
          'Chat profile listener error:',
          error
        );
      }
    );

    return unsubscribe;
  }, [currentUser]);

  /* =======================================================
     CONVERSATIONS
  ======================================================= */

  useEffect(() => {
    if (!currentUser) {
      setConversations([]);
      setLoadingConversations(false);
      return;
    }

    setLoadingConversations(true);

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

    const unsubscribe = onSnapshot(
      conversationsQuery,
      (snapshot) => {
        const list =
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }));

        list.sort(
          (a, b) =>
            timestampToMillis(
              b.lastMessageAt
            ) -
            timestampToMillis(
              a.lastMessageAt
            )
        );

        setConversations(list);
        setLoadingConversations(false);
      },
      (error) => {
        console.error(
          'Conversation listener error:',
          error
        );

        setLoadingConversations(false);
      }
    );

    return unsubscribe;
  }, [currentUser]);

  /* =======================================================
     FRIENDS
  ======================================================= */

  useEffect(() => {
    if (!currentUser) {
      setFriends([]);
      setLoadingFriends(false);
      return;
    }

    setLoadingFriends(true);

    const friendsRef = collection(
      db,
      'users',
      currentUser.uid,
      'friends'
    );

    const unsubscribe = onSnapshot(
      friendsRef,
      (snapshot) => {
        const list =
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }));

        list.sort((a, b) => {
          const nameA =
            a.username ||
            a.displayName ||
            '';

          const nameB =
            b.username ||
            b.displayName ||
            '';

          return nameA.localeCompare(
            nameB
          );
        });

        setFriends(list);
        setLoadingFriends(false);
      },
      (error) => {
        console.error(
          'Friends listener error:',
          error
        );

        setLoadingFriends(false);
      }
    );

    return unsubscribe;
  }, [currentUser]);

  /* =======================================================
     FRIEND REQUESTS
  ======================================================= */

  useEffect(() => {
    if (!currentUser) {
      setFriendRequests([]);
      return;
    }

    const requestsRef =
      collection(
        db,
        'users',
        currentUser.uid,
        'friendRequests'
      );

    const requestsQuery = query(
      requestsRef,
      where(
        'status',
        '==',
        'pending'
      )
    );

    const unsubscribe = onSnapshot(
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
          'Friend request listener error:',
          error
        );
      }
    );

    return unsubscribe;
  }, [currentUser]);

  /* =======================================================
     DM REQUESTS
  ======================================================= */

  useEffect(() => {
    if (!currentUser) {
      setDmRequests([]);
      return;
    }

    const requestsRef =
      collection(
        db,
        'users',
        currentUser.uid,
        'dmRequests'
      );

    const requestsQuery = query(
      requestsRef,
      where(
        'status',
        '==',
        'pending'
      )
    );

    const unsubscribe = onSnapshot(
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
          'DM request listener error:',
          error
        );
      }
    );

    return unsubscribe;
  }, [currentUser]);

  /* =======================================================
     ACTIVE CONVERSATION MESSAGES
  ======================================================= */

  useEffect(() => {
    if (!selectedConversation) {
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

    const unsubscribe = onSnapshot(
      messagesRef,
      (snapshot) => {
        const list =
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }));

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
      },
      (error) => {
        console.error(
          'Messages listener error:',
          error
        );
      }
    );

    return unsubscribe;
  }, [selectedConversation]);

  /* =======================================================
     REAL TYPING / CHAT ACTIVITY LISTENER
  ======================================================= */

  useEffect(() => {
    if (!selectedConversation) {
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

    const unsubscribe = onSnapshot(
      activityRef,
      (snapshot) => {
        const now = Date.now();
        const next = {};

        snapshot.docs.forEach(
          (item) => {
            const data = item.data();

            if (
              item.id ===
              currentUser?.uid
            ) {
              return;
            }

            const updated =
              timestampToMillis(
                data.updatedAt
              );

            /*
             * Expire stale typing/activity
             * states after 6 seconds.
             */
            if (
              updated &&
              now - updated < 6000
            ) {
              next[item.id] = {
                id: item.id,
                ...data,
              };
            }
          }
        );

        setTypingUsers(next);
      },
      (error) => {
        console.error(
          'Activity listener error:',
          error
        );
      }
    );

    return unsubscribe;
  }, [
    selectedConversation,
    currentUser,
  ]);

  /* =======================================================
     SEARCH USER
  ======================================================= */

  const searchUser = async () => {
    const username =
      searchQuery
        .trim()
        .toLowerCase();

    if (!username) {
      setSearchResult(null);
      return;
    }

    if (!currentUser) {
      Alert.alert(
        'Not signed in',
        'Please sign in before using Chat.'
      );
      return;
    }

    setSearching(true);

    try {
      const usernameRef = doc(
        db,
        'usernames',
        username
      );

      const usernameSnapshot =
        await getDoc(usernameRef);

      if (!usernameSnapshot.exists()) {
        setSearchResult(null);

        Alert.alert(
          'User not found',
          `No Shinzi user with the username @${username} was found.`
        );

        return;
      }

      const usernameData =
        usernameSnapshot.data();

      const targetUid =
        usernameData.uid;

      if (!targetUid) {
        throw new Error(
          'Username reservation has no uid.'
        );
      }

      if (
        targetUid ===
        currentUser.uid
      ) {
        setSearchResult(null);

        Alert.alert(
          'That is you',
          'You cannot start a chat with your own account.'
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

      if (!userSnapshot.exists()) {
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
        'User search error:',
        error
      );

      Alert.alert(
        'Search failed',
        error.message ||
          'Something went wrong while searching.'
      );
    } finally {
      setSearching(false);
    }
  };

  /* =======================================================
     FRIEND CHECK
  ======================================================= */

  const isFriend = async (
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

  /* =======================================================
     SEND FRIEND REQUEST
  ======================================================= */

  const sendFriendRequest = async (
    targetUser
  ) => {
    if (
      !currentUser ||
      !targetUser
    ) {
      return;
    }

    try {
      const alreadyFriend =
        await isFriend(
          targetUser.id
        );

      if (alreadyFriend) {
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

      const existingRequest =
        await getDoc(requestRef);

      if (
        existingRequest.exists() &&
        existingRequest.data()
          .status === 'pending'
      ) {
        Alert.alert(
          'Already sent',
          'A friend request is already pending.'
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

          status: 'pending',

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
        'Send friend request error:',
        error
      );

      Alert.alert(
        'Could not send request',
        error.message ||
          'Something went wrong.'
      );
    }
  };

  /* =======================================================
     ACCEPT FRIEND REQUEST
  ======================================================= */

  const acceptFriendRequest =
    async (request) => {
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

        if (!senderSnapshot.exists()) {
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

        Alert.alert(
          'Friend added',
          `You and @${request.senderUsername || sender.username} are now friends.`
        );
      } catch (error) {
        console.error(
          'Accept friend request error:',
          error
        );

        Alert.alert(
          'Could not accept',
          error.message ||
            'Something went wrong.'
        );
      }
    };

  /* =======================================================
     REJECT FRIEND REQUEST
  ======================================================= */

  const rejectFriendRequest =
    async (request) => {
      if (
        !currentUser ||
        !request?.senderUid
      ) {
        return;
      }

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
        console.error(
          'Reject friend request error:',
          error
        );

        Alert.alert(
          'Could not reject',
          error.message ||
            'Something went wrong.'
        );
      }
    };

  /* =======================================================
     SEND DM REQUEST
  ======================================================= */

  const sendDMRequest = async (
    targetUser
  ) => {
    if (
      !currentUser ||
      !targetUser
    ) {
      return;
    }

    try {
      const alreadyFriends =
        await isFriend(
          targetUser.id
        );

      if (alreadyFriends) {
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

      const existingRequest =
        await getDoc(requestRef);

      if (
        existingRequest.exists() &&
        existingRequest.data()
          .status === 'pending'
      ) {
        Alert.alert(
          'Already sent',
          'Your DM request is already waiting for them.'
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

          status: 'pending',

          createdAt:
            serverTimestamp(),
        }
      );

      Alert.alert(
        'DM request sent',
        `@${targetUser.username} will see your request in DM requests.`
      );
    } catch (error) {
      console.error(
        'Send DM request error:',
        error
      );

      Alert.alert(
        'Could not send DM request',
        error.message ||
          'Something went wrong.'
      );
    }
  };

  /* =======================================================
     ACCEPT DM REQUEST
  ======================================================= */

  const acceptDMRequest =
    async (request) => {
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

        if (!senderSnapshot.exists()) {
          throw new Error(
            'The sender profile no longer exists.'
          );
        }

        const sender =
          senderSnapshot.data();

        const conversationId =
          makeDirectConversationId(
            currentUser.uid,
            request.senderUid
          );

        await setDoc(
          doc(
            db,
            'conversations',
            conversationId
          ),
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
            lastMessageAt: null,
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

        const conversationSnapshot =
          await getDoc(
            doc(
              db,
              'conversations',
              conversationId
            )
          );

        openConversation({
          id: conversationId,
          ...(conversationSnapshot.exists()
            ? conversationSnapshot.data()
            : {}),
        });
      } catch (error) {
        console.error(
          'Accept DM request error:',
          error
        );

        Alert.alert(
          'Could not accept',
          error.message ||
            'Something went wrong.'
        );
      }
    };

  /* =======================================================
     REJECT DM REQUEST
  ======================================================= */

  const rejectDMRequest =
    async (request) => {
      if (
        !currentUser ||
        !request?.senderUid
      ) {
        return;
      }

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
        console.error(
          'Reject DM request error:',
          error
        );

        Alert.alert(
          'Could not reject',
          error.message ||
            'Something went wrong.'
        );
      }
    };

  /* =======================================================
     OPEN DIRECT CONVERSATION
  ======================================================= */

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

        if (!snapshot.exists()) {
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
              lastMessageAt: null,
              lastMessageSenderUid:
                null,
            }
          );
        }

        const updatedSnapshot =
          await getDoc(
            conversationRef
          );

        openConversation({
          id: conversationId,
          ...(updatedSnapshot.exists()
            ? updatedSnapshot.data()
            : {}),
        });
      } catch (error) {
        console.error(
          'Open direct conversation error:',
          error
        );

        Alert.alert(
          'Could not open chat',
          error.message ||
            'Something went wrong.'
        );
      }
    };

  /* =======================================================
     OPEN CONVERSATION
  ======================================================= */

  const openConversation = async (
    conversation
  ) => {
    if (!conversation) return;

    setSelectedConversation(
      conversation
    );

    setScreen('conversation');
    setMessageText('');
    setTypingUsers({});

    if (!currentUser) return;

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
        'Could not update read state:',
        error
      );
    }
  };

  /* =======================================================
     CLOSE CONVERSATION
  ======================================================= */

  const closeConversation = async () => {
    if (
      selectedConversation &&
      currentUser
    ) {
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
          'Could not clear activity:',
          error
        );
      }
    }

    if (typingTimeoutRef.current) {
      clearTimeout(
        typingTimeoutRef.current
      );
    }

    setTypingUsers({});
    setSelectedConversation(null);
    setMessages([]);
    setMessageText('');
    setScreen('main');
  };

  /* =======================================================
     REAL TYPING INDICATOR
  ======================================================= */

  const publishTypingState = async (
    isTyping
  ) => {
    if (
      !currentUser ||
      !selectedConversation
    ) {
      return;
    }

    const activityRef = doc(
      db,
      'conversations',
      selectedConversation.id,
      'activity',
      currentUser.uid
    );

    if (!isTyping) {
      try {
        await deleteDoc(
          activityRef
        );
      } catch (error) {
        console.log(
          'Could not clear typing state:',
          error
        );
      }

      return;
    }

    try {
      await setDoc(
        activityRef,
        {
          uid: currentUser.uid,

          username:
            currentProfile?.username ||
            '',

          displayName:
            currentProfile?.displayName ||
            '',

          type: 'typing',

          updatedAt:
            serverTimestamp(),
        }
      );
    } catch (error) {
      console.error(
        'Typing state error:',
        error
      );
    }
  };

  const handleMessageTextChange =
    (text) => {
      setMessageText(text);

      if (!text.trim()) {
        publishTypingState(false);

        if (
          typingTimeoutRef.current
        ) {
          clearTimeout(
            typingTimeoutRef.current
          );
        }

        return;
      }

      publishTypingState(true);

      if (
        typingTimeoutRef.current
      ) {
        clearTimeout(
          typingTimeoutRef.current
        );
      }

      typingTimeoutRef.current =
        setTimeout(() => {
          publishTypingState(false);
        }, 5000);
    };

  /* =======================================================
     SEND MESSAGE
  ======================================================= */

  const sendMessage = async () => {
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

    setSendingMessage(true);

    try {
      await publishTypingState(
        false
      );

      const conversationRef =
        doc(
          db,
          'conversations',
          selectedConversation.id
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

      const urgentUpdates = {};

      const memberProfiles =
        selectedConversation.memberProfiles ||
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
          memberProfiles[
            memberUid
          ];

        if (
          memberProfile?.username &&
          containsMention(
            text,
            memberProfile.username
          )
        ) {
          urgentUpdates[
            `urgentFor.${memberUid}`
          ] = true;
        }
      }

      await updateDoc(
        conversationRef,
        {
          lastMessage: text,

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
        'Send message error:',
        error
      );

      Alert.alert(
        'Message failed',
        error.message ||
          'The message could not be sent.'
      );
    } finally {
      setSendingMessage(false);
    }
  };

  /* =======================================================
     FAVORITE
  ======================================================= */

  const toggleFavorite = async (
    conversation
  ) => {
    if (
      !currentUser ||
      !conversation
    ) {
      return;
    }

    const currentValue =
      conversation.favoriteBy?.[
        currentUser.uid
      ] === true;

    try {
      await updateDoc(
        doc(
          db,
          'conversations',
          conversation.id
        ),
        {
          [`favoriteBy.${currentUser.uid}`]:
            !currentValue,
        }
      );
    } catch (error) {
      console.error(
        'Favorite toggle error:',
        error
      );

      Alert.alert(
        'Could not update favorite',
        error.message ||
          'Something went wrong.'
      );
    }
  };

  /* =======================================================
     CHAT TYPE
  ======================================================= */

  const getChatType = (
    conversation
  ) => {
    if (!currentUser) {
      return 'normal';
    }

    if (
      conversation.urgentFor?.[
        currentUser.uid
      ] === true
    ) {
      return 'urgent';
    }

    if (
      conversation.favoriteBy?.[
        currentUser.uid
      ] === true
    ) {
      return 'favorite';
    }

    return 'normal';
  };

  /* =======================================================
     CONVERSATION TITLE
  ======================================================= */

  const getConversationTitle = (
    conversation
  ) => {
    if (!conversation) return '';

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
          uid !== currentUser?.uid
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

  /* =======================================================
     CONVERSATION USERNAME
  ======================================================= */

  const getConversationUsername = (
    conversation
  ) => {
    if (!conversation) return '';

    if (
      conversation.type ===
      'group'
    ) {
      return `${
        conversation.members?.length ||
        0
      } members`;
    }

    const otherUid =
      conversation.members?.find(
        (uid) =>
          uid !== currentUser?.uid
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

  /* =======================================================
     FILTER + SORT
  ======================================================= */

  const filteredConversations =
    useMemo(() => {
      let result = [
        ...conversations,
      ];

      const search =
        searchQuery
          .trim()
          .toLowerCase();

      if (search) {
        result =
          result.filter(
            (conversation) => {
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
                title.includes(search) ||
                username.includes(search) ||
                lastMessage.includes(search)
              );
            }
          );
      }

      if (
        activeTab ===
        'Urgent'
      ) {
        result =
          result.filter(
            (conversation) =>
              getChatType(
                conversation
              ) === 'urgent'
          );
      }

      if (
        activeTab ===
        'Favorite'
      ) {
        result =
          result.filter(
            (conversation) =>
              conversation
                .favoriteBy?.[
                currentUser?.uid
              ] === true
          );
      }

      if (
        activeTab ===
        'Groups'
      ) {
        result =
          result.filter(
            (conversation) =>
              conversation.type ===
              'group'
          );
      }

      if (
        activeTab ===
        'Recent'
      ) {
        result =
          result.filter(
            (conversation) =>
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

      result.sort((a, b) => {
        const rank = {
          urgent: 1,
          favorite: 2,
          normal: 3,
        };

        const typeA =
          getChatType(a);

        const typeB =
          getChatType(b);

        if (
          rank[typeA] !==
          rank[typeB]
        ) {
          return (
            rank[typeA] -
            rank[typeB]
          );
        }

        return (
          timestampToMillis(
            b.lastMessageAt
          ) -
          timestampToMillis(
            a.lastMessageAt
          )
        );
      });

      return result;
    }, [
      conversations,
      activeTab,
      searchQuery,
      currentUser,
    ]);

  /* =======================================================
     GROUP FRIEND SELECTION
  ======================================================= */

  const toggleGroupFriend = (
    friendUid
  ) => {
    setSelectedGroupFriends(
      (previous) => ({
        ...previous,
        [friendUid]:
          !previous[friendUid],
      })
    );
  };

  /* =======================================================
     CREATE GROUP
  ======================================================= */

  const createGroup = async () => {
    if (!currentUser) return;

    const cleanName =
      groupName.trim();

    if (!cleanName) {
      Alert.alert(
        'Group name required',
        'Please enter a name for your group.'
      );

      return;
    }

    const selectedFriends =
      friends.filter(
        (friend) =>
          selectedGroupFriends[
            friend.id
          ] === true
      );

    if (
      selectedFriends.length ===
      0
    ) {
      Alert.alert(
        'Add friends',
        'Select at least one friend for the group.'
      );

      return;
    }

    setCreatingGroup(true);

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

          groupName: cleanName,

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
          lastMessageAt: null,
          lastMessageSenderUid:
            null,
        }
      );

      setGroupName('');
      setGroupDescription('');
      setSelectedGroupFriends(
        {}
      );

      setShowCreateGroup(false);

      Alert.alert(
        'Group created',
        `"${cleanName}" has been created.`
      );
    } catch (error) {
      console.error(
        'Create group error:',
        error
      );

      Alert.alert(
        'Could not create group',
        error.message ||
          'Something went wrong.'
      );
    } finally {
      setCreatingGroup(false);
    }
  };

  /* =======================================================
     EMPTY MESSAGE
  ======================================================= */

  const getEmptyMessage = () => {
    if (searchQuery.trim()) {
      return 'No matching chats found.';
    }

    if (
      activeTab ===
      'Urgent'
    ) {
      return 'No urgent chats right now.';
    }

    if (
      activeTab ===
      'Favorite'
    ) {
      return 'No favorite chats yet.';
    }

    if (
      activeTab ===
      'Groups'
    ) {
      return 'No groups yet. Tap + to create one.';
    }

    if (
      activeTab ===
      'Recent'
    ) {
      return 'No recent chats yet.';
    }

    return 'You can chat with your friends.';
  };

  /* =======================================================
     MODES
  ======================================================= */

  const handleMode = (
    mode
  ) => {
    setShowModes(false);

    if (
      mode ===
      'social'
    ) {
      setScreen('main');
      return;
    }

    if (
      mode ===
      'games'
    ) {
      if (onNavigate) {
        onNavigate('Games');
      } else {
        Alert.alert(
          'Games',
          'Connect the Games screen to onNavigate in App.js.'
        );
      }

      return;
    }

    if (
      mode ===
      'search'
    ) {
      setScreen('main');

      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 150);
    }
  };

  /* =======================================================
     BOTTOM NAV
  ======================================================= */

  const handleBottomNavigation = (
    destination
  ) => {
    if (
      destination ===
      'Chat'
    ) {
      return;
    }

    if (onNavigate) {
      onNavigate(
        destination
      );
    } else {
      Alert.alert(
        destination,
        `Connect the ${destination} screen to onNavigate in App.js.`
      );
    }
  };

  /* =======================================================
     HEADER
  ======================================================= */

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
              setShowModes(true)
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
              styles.iconBtn
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
                    {dmRequests.length >
                    9
                      ? '9+'
                      : dmRequests.length}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={
              styles.iconBtn
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
                    {friendRequests.length >
                    9
                      ? '9+'
                      : friendRequests.length}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={
              styles.iconBtn
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

  /* =======================================================
     SEARCH BAR
  ======================================================= */

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
          style={
            styles.searchIcon
          }
        />

        <TextInput
          ref={
            searchInputRef
          }
          style={
            styles.searchInput
          }
          placeholder="Search by username"
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
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={
            searchUser
          }
        />

        {searching && (
          <ActivityIndicator
            size="small"
            color={
              COLORS.blue
            }
          />
        )}

        {searchQuery.length >
          0 &&
          !searching && (
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
          )}
      </View>
    );

  /* =======================================================
     SEARCH RESULT
  ======================================================= */

  const renderSearchResult =
    () => {
      if (!searchResult) {
        return null;
      }

      return (
        <View
          style={
            styles.searchResultCard
          }
        >
          <View
            style={
              styles.avatarCircle
            }
          >
            <Text
              style={
                styles.avatarText
              }
            >
              {getInitials(
                searchResult.displayName ||
                  searchResult.username
              )}
            </Text>
          </View>

          <View
            style={
              styles.searchResultInfo
            }
          >
            <Text
              style={
                styles.chatName
              }
              numberOfLines={1}
            >
              {searchResult.displayName ||
                searchResult.username}
            </Text>

            <Text
              style={
                styles.chatMessage
              }
              numberOfLines={1}
            >
              @{searchResult.username}
            </Text>
          </View>

          <View
            style={
              styles.searchActions
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
        </View>
      );
    };

  /* =======================================================
     TABS
  ======================================================= */

  const renderTabs = () => (
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
              key={tab}
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
                      'Groups'
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

  /* =======================================================
     STATUS ICON
  ======================================================= */

  const renderStatusIcon =
    (conversation) => {
      const type =
        getChatType(
          conversation
        );

      if (
        type ===
        'urgent'
      ) {
        return (
          <FontAwesome5
            name="exclamation"
            size={14}
            color={
              COLORS.urgent
            }
          />
        );
      }

      if (
        type ===
        'favorite'
      ) {
        return (
          <Ionicons
            name="heart"
            size={15}
            color={
              COLORS.blue
            }
          />
        );
      }

      return (
        <Ionicons
          name="ellipse"
          size={7}
          color={
            COLORS.secondary
          }
        />
      );
    };

  /* =======================================================
     CHAT CARD
  ======================================================= */

  const renderConversation =
    ({ item }) => {
      const title =
        getConversationTitle(
          item
        );

      const username =
        getConversationUsername(
          item
        );

      const type =
        getChatType(item);

      const isFavorite =
        item.favoriteBy?.[
          currentUser?.uid
        ] === true;

      const lastMessage =
        item.lastMessage ||
        (item.type ===
        'group'
          ? 'Group created'
          : 'Start chatting');

      return (
        <TouchableOpacity
          style={[
            styles.chatCard,
            type ===
              'urgent' &&
              styles.urgentChatCard,
          ]}
          onPress={() =>
            openConversation(
              item
            )
          }
          activeOpacity={
            0.75
          }
        >
          <View
            style={
              styles.avatarCircle
            }
          >
            {item.type ===
            'group' ? (
              <Ionicons
                name="people"
                size={23}
                color={
                  COLORS.secondary
                }
              />
            ) : (
              <Text
                style={
                  styles.avatarText
                }
              >
                {getInitials(
                  title
                )}
              </Text>
            )}
          </View>

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
                <View
                  style={
                    styles.groupLabel
                  }
                >
                  <Text
                    style={
                      styles.groupLabelText
                    }
                  >
                    GROUP
                  </Text>
                </View>
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
              {lastMessage}
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
                styles.statusIconContainer
              }
            >
              {renderStatusIcon(
                item
              )}

              <TouchableOpacity
                style={
                  styles.favoriteButton
                }
                onPress={() =>
                  toggleFavorite(
                    item
                  )
                }
              >
                <Ionicons
                  name={
                    isFavorite
                      ? 'heart'
                      : 'heart-outline'
                  }
                  size={14}
                  color={
                    isFavorite
                      ? COLORS.blue
                      : COLORS.secondary
                  }
                />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      );
    };

  /* =======================================================
     MAIN SCREEN
  ======================================================= */

  const renderMainScreen =
    () => (
      <SafeAreaView
        style={
          styles.container
        }
      >
        <StatusBar
          style="light"
        />

        {renderMainHeader()}

        {renderSearchBar()}

        {renderSearchResult()}

        {renderTabs()}

        {loadingConversations ? (
          <View
            style={
              styles.centerLoading
            }
          >
            <ActivityIndicator
              size="small"
              color={
                COLORS.blue
              }
            />

            <Text
              style={
                styles.loadingText
              }
            >
              Loading chats...
            </Text>
          </View>
        ) : (
          <FlatList
            data={
              filteredConversations
            }
            keyExtractor={(
              item
            ) =>
              item.id
            }
            renderItem={
              renderConversation
            }
            contentContainerStyle={[
              styles.listContainer,
              filteredConversations.length ===
                0 &&
                styles.emptyListContainer,
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={
              false
            }
            ListEmptyComponent={
              <View
                style={
                  styles.emptyState
                }
              >
                <Ionicons
                  name={
                    activeTab ===
                    'Groups'
                      ? 'people-outline'
                      : activeTab ===
                        'Favorite'
                      ? 'heart-outline'
                      : 'chatbubble-ellipses-outline'
                  }
                  size={40}
                  color={
                    COLORS.secondary
                  }
                />

                <Text
                  style={
                    styles.emptyTitle
                  }
                >
                  {activeTab ===
                  'All'
                    ? 'Welcome to Shinzi Chats!'
                    : `No ${activeTab.toLowerCase()} chats`}
                </Text>

                <Text
                  style={
                    styles.emptyText
                  }
                >
                  {getEmptyMessage()}
                </Text>
              </View>
            }
          />
        )}

        {renderBottomNavigation()}
        {renderModesModal()}
        {renderCreateGroupModal()}
      </SafeAreaView>
    );

  /* =======================================================
     BOTTOM NAVIGATION
  ======================================================= */

  const renderBottomNavigation =
    () => (
      <View
        style={
          styles.bottomNav
        }
      >
        <TouchableOpacity
          style={
            styles.navItem
          }
          onPress={() =>
            handleBottomNavigation(
              'AI'
            )
          }
        >
          <Ionicons
            name="sparkles"
            size={22}
            color={
              COLORS.secondary
            }
          />

          <Text
            style={
              styles.navText
            }
          >
            AI
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={
            styles.navItem
          }
          onPress={() =>
            handleBottomNavigation(
              'Servers'
            )
          }
        >
          <Ionicons
            name="layers-outline"
            size={24}
            color={
              COLORS.secondary
            }
          />

          <Text
            style={
              styles.navText
            }
          >
            Servers
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={
            styles.navItem
          }
          onPress={() =>
            handleBottomNavigation(
              'Chat'
            )
          }
        >
          <Ionicons
            name="chatbubble-ellipses"
            size={24}
            color={
              COLORS.blue
            }
          />

          <Text
            style={[
              styles.navText,
              {
                color:
                  COLORS.blue,
              },
            ]}
          >
            Chat
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={
            styles.navItem
          }
          onPress={() =>
            handleBottomNavigation(
              'Search'
            )
          }
        >
          <Ionicons
            name="search"
            size={24}
            color={
              COLORS.secondary
            }
          />

          <Text
            style={
              styles.navText
            }
          >
            Search
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={
            styles.navItem
          }
          onPress={() =>
            handleBottomNavigation(
              'Profile'
            )
          }
        >
          <Feather
            name="user"
            size={24}
            color={
              COLORS.secondary
            }
          />

          <Text
            style={
              styles.navText
            }
          >
            Profile
          </Text>
        </TouchableOpacity>
      </View>
    );

  /* =======================================================
     MODES MODAL
  ======================================================= */

  const renderModesModal =
    () => (
      <Modal
        visible={
          showModes
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setShowModes(
            false
          )
        }
      >
        <TouchableOpacity
          style={
            styles.modalOverlay
          }
          activeOpacity={1}
          onPress={() =>
            setShowModes(
              false
            )
          }
        >
          <View
            style={
              styles.modesBox
            }
          >
            <Text
              style={
                styles.modalTitle
              }
            >
              Modes
            </Text>

            <TouchableOpacity
              style={
                styles.modeRow
              }
              onPress={() =>
                handleMode(
                  'social'
                )
              }
            >
              <Ionicons
                name="chatbubbles-outline"
                size={23}
                color={
                  COLORS.blue
                }
              />

              <View
                style={
                  styles.modeInfo
                }
              >
                <Text
                  style={
                    styles.modeRowTitle
                  }
                >
                  Social
                </Text>

                <Text
                  style={
                    styles.modeRowDescription
                  }
                >
                  Chat and social content
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={
                styles.modeRow
              }
              onPress={() =>
                handleMode(
                  'games'
                )
              }
            >
              <Ionicons
                name="game-controller-outline"
                size={23}
                color={
                  COLORS.blue
                }
              />

              <View
                style={
                  styles.modeInfo
                }
              >
                <Text
                  style={
                    styles.modeRowTitle
                  }
                >
                  Games
                </Text>

                <Text
                  style={
                    styles.modeRowDescription
                  }
                >
                  Open Shinzi games
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={
                styles.modeRow
              }
              onPress={() =>
                handleMode(
                  'search'
                )
              }
            >
              <Ionicons
                name="search-outline"
                size={23}
                color={
                  COLORS.blue
                }
              />

              <View
                style={
                  styles.modeInfo
                }
              >
                <Text
                  style={
                    styles.modeRowTitle
                  }
                >
                  Search
                </Text>

                <Text
                  style={
                    styles.modeRowDescription
                  }
                >
                  Search Shinzi users
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    );

  /* =======================================================
     BACK HEADER
  ======================================================= */

  const renderBackHeader = (
    title,
    onBack
  ) => (
    <View
      style={
        styles.innerHeader
      }
    >
      <TouchableOpacity
        style={
          styles.backButton
        }
        onPress={
          onBack
        }
      >
        <Ionicons
          name="arrow-back"
          size={24}
          color={
            COLORS.text
          }
        />
      </TouchableOpacity>

      <Text
        style={
          styles.innerHeaderTitle
        }
      >
        {title}
      </Text>

      <View
        style={
          styles.headerSpacer
        }
      />
    </View>
  );

  /* =======================================================
     FRIENDS
  ======================================================= */

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
              size="small"
              color={
                COLORS.blue
              }
            />
          </View>
        ) : (
          <FlatList
            data={friends}
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
                <View
                  style={
                    styles.avatarCircle
                  }
                >
                  <Text
                    style={
                      styles.avatarText
                    }
                  >
                    {getInitials(
                      item.displayName ||
                        item.username
                    )}
                  </Text>
                </View>

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
              <View
                style={
                  styles.emptyState
                }
              >
                <Ionicons
                  name="people-outline"
                  size={42}
                  color={
                    COLORS.secondary
                  }
                />

                <Text
                  style={
                    styles.emptyTitle
                  }
                >
                  No friends yet
                </Text>

                <Text
                  style={
                    styles.emptyText
                  }
                >
                  Search for a username to add friends.
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    );

  /* =======================================================
     FRIEND REQUESTS
  ======================================================= */

  const renderFriendRequestsScreen =
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
          'Friend requests',
          () =>
            setScreen(
              'main'
            )
        )}

        <FlatList
          data={
            friendRequests
          }
          keyExtractor={(
            item
          ) =>
            item.id
          }
          contentContainerStyle={[
            styles.listContainer,
            friendRequests.length ===
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
              <View
                style={
                  styles.avatarCircle
                }
              >
                <Text
                  style={
                    styles.avatarText
                  }
                >
                  {getInitials(
                    item.senderDisplayName ||
                      item.senderUsername
                  )}
                </Text>
              </View>

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
                  sent you a friend request.
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
                    acceptFriendRequest(
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
                    rejectFriendRequest(
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
            <View
              style={
                styles.emptyState
              }
            >
              <Feather
                name="user-plus"
                size={40}
                color={
                  COLORS.secondary
                }
              />

              <Text
                style={
                  styles.emptyTitle
                }
              >
                No friend requests
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                New requests will appear here.
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    );

  /* =======================================================
     DM REQUESTS
  ======================================================= */

  const renderDMRequestsScreen =
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
          'DM requests',
          () =>
            setScreen(
              'main'
            )
        )}

        <FlatList
          data={
            dmRequests
          }
          keyExtractor={(
            item
          ) =>
            item.id
          }
          contentContainerStyle={[
            styles.listContainer,
            dmRequests.length ===
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
              <View
                style={
                  styles.avatarCircle
                }
              >
                <Text
                  style={
                    styles.avatarText
                  }
                >
                  {getInitials(
                    item.senderDisplayName ||
                      item.senderUsername
                  )}
                </Text>
              </View>

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
                  wants to DM you.
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
                    acceptDMRequest(
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
                    rejectDMRequest(
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
            <View
              style={
                styles.emptyState
              }
            >
              <Feather
                name="mail"
                size={40}
                color={
                  COLORS.secondary
                }
              />

              <Text
                style={
                  styles.emptyTitle
                }
              >
                No DM requests
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Incoming DM requests will appear here.
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    );

  /* =======================================================
     CREATE GROUP MODAL
  ======================================================= */

  const renderCreateGroupModal =
    () => (
      <Modal
        visible={
          showCreateGroup
        }
        animationType="slide"
        transparent
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
                styles.modalHeader
              }
            >
              <Text
                style={
                  styles.modalTitle
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
                styles.groupInput
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
              maxLength={50}
            />

            <TextInput
              style={[
                styles.groupInput,
                styles.groupDescriptionInput,
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
              maxLength={200}
            />

            <Text
              style={
                styles.selectFriendsTitle
              }
            >
              Select friends
            </Text>

            <Text
              style={
                styles.addedCount
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
              {friends.length ===
              0 ? (
                <Text
                  style={
                    styles.emptyText
                  }
                >
                  You need at least one friend to create a group.
                </Text>
              ) : (
                friends.map(
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
                        <View
                          style={
                            styles.avatarSmall
                          }
                        >
                          <Text
                            style={
                              styles.avatarSmallText
                            }
                          >
                            {getInitials(
                              friend.displayName ||
                                friend.username
                            )}
                          </Text>
                        </View>

                        <View
                          style={
                            styles.groupFriendInfo
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
                )
              )}
            </ScrollView>

            <TouchableOpacity
              style={
                styles.createGroupButton
              }
              onPress={
                createGroup
              }
              disabled={
                creatingGroup
              }
            >
              {creatingGroup ? (
                <ActivityIndicator
                  size="small"
                  color={
                    COLORS.text
                  }
                />
              ) : (
                <Text
                  style={
                    styles.createGroupButtonText
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

  /* =======================================================
     ACTIVITY INDICATOR
  ======================================================= */

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
          <View
            style={
              styles.activityAvatar
            }
          >
            <Text
              style={
                styles.activityAvatarText
              }
            >
              {getInitials(
                name
              )}
            </Text>
          </View>

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
            numberOfLines={
              1
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

  /* =======================================================
     CONVERSATION SCREEN
  ======================================================= */

  const renderConversationScreen =
    () => {
      if (
        !selectedConversation
      ) {
        return null;
      }

      const title =
        getConversationTitle(
          selectedConversation
        );

      const username =
        getConversationUsername(
          selectedConversation
        );

      return (
        <SafeAreaView
          style={
            styles.container
          }
        >
          <StatusBar
            style="light"
          />

          <View
            style={
              styles.chatHeader
            }
          >
            <TouchableOpacity
              style={
                styles.backButton
              }
              onPress={
                closeConversation
              }
            >
              <Ionicons
                name="arrow-back"
                size={24}
                color={
                  COLORS.text
                }
              />
            </TouchableOpacity>

            <View
              style={
                styles.conversationAvatar
              }
            >
              {selectedConversation.type ===
              'group' ? (
                <Ionicons
                  name="people"
                  size={20}
                  color={
                    COLORS.secondary
                  }
                />
              ) : (
                <Text
                  style={
                    styles.conversationAvatarText
                  }
                >
                  {getInitials(
                    title
                  )}
                </Text>
              )}
            </View>

            <View
              style={
                styles.conversationHeaderInfo
              }
            >
              <Text
                style={
                  styles.conversationTitle
                }
                numberOfLines={
                  1
                }
              >
                {title}
              </Text>

              <Text
                style={
                  styles.conversationSubtitle
                }
                numberOfLines={
                  1
                }
              >
                {username}
              </Text>
            </View>

            <TouchableOpacity
              style={
                styles.conversationHeaderButton
              }
              onPress={() =>
                Alert.alert(
                  'Chat options',
                  'More chat controls will be connected here.'
                )
              }
            >
              <Ionicons
                name="ellipsis-vertical"
                size={22}
                color={
                  COLORS.text
                }
              />
            </TouchableOpacity>
          </View>

          <FlatList
            data={
              messages
            }
            keyExtractor={(
              item
            ) =>
              item.id
            }
            contentContainerStyle={[
              styles.messagesList,
              messages.length ===
                0 &&
                styles.emptyMessagesList,
            ]}
            renderItem={({
              item,
            }) => {
              const mine =
                item.senderUid ===
                currentUser?.uid;

              return (
                <View
                  style={[
                    styles.messageRow,
                    mine &&
                      styles.myMessageRow,
                  ]}
                >
                  {!mine &&
                    selectedConversation.type ===
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
                        {item.text}
                      </Text>
                    ) : (
                      <Text
                        style={
                          styles.messageText
                        }
                      >
                        Unsupported message type
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
              );
            }}
            ListEmptyComponent={
              <View
                style={
                  styles.emptyConversation
                }
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={40}
                  color={
                    COLORS.secondary
                  }
                />

                <Text
                  style={
                    styles.emptyTitle
                  }
                >
                  Start the conversation
                </Text>

                <Text
                  style={
                    styles.emptyText
                  }
                >
                  Send a message below.
                </Text>
              </View>
            }
          />

          {renderActivityIndicator()}

          <KeyboardAvoidingView
            behavior={
              Platform.OS ===
              'ios'
                ? 'padding'
                : undefined
            }
          >
            <View
              style={
                styles.messageComposer
              }
            >
              <TouchableOpacity
                style={
                  styles.composerIcon
                }
                onPress={() =>
                  Alert.alert(
                    'Attachments',
                    'Images, videos, files, GIFs, stickers, polls and events will connect here.'
                  )
                }
              >
                <Ionicons
                  name="add-circle-outline"
                  size={27}
                  color={
                    COLORS.secondary
                  }
                />
              </TouchableOpacity>

              <TextInput
                style={
                  styles.messageInput
                }
                placeholder="Message..."
                placeholderTextColor={
                  COLORS.secondary
                }
                value={
                  messageText
                }
                onChangeText={
                  handleMessageTextChange
                }
                multiline
                maxLength={
                  4000
                }
              />

              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!messageText.trim() ||
                    sendingMessage) &&
                    styles.sendButtonDisabled,
                ]}
                onPress={
                  sendMessage
                }
                disabled={
                  !messageText.trim() ||
                  sendingMessage
                }
              >
                {sendingMessage ? (
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
          </KeyboardAvoidingView>
        </SafeAreaView>
      );
    };

  /* =======================================================
     AUTH GUARD
  ======================================================= */

  if (!currentUser) {
    return (
      <SafeAreaView
        style={
          styles.container
        }
      >
        <StatusBar
          style="light"
        />

        <View
          style={
            styles.emptyState
          }
        >
          <Ionicons
            name="lock-closed-outline"
            size={42}
            color={
              COLORS.secondary
            }
          />

          <Text
            style={
              styles.emptyTitle
            }
          >
            Sign in required
          </Text>

          <Text
            style={
              styles.emptyText
            }
          >
            Sign in to use Shinzi Chats.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /* =======================================================
     SCREEN ROUTER
  ======================================================= */

  if (
    screen ===
    'conversation'
  ) {
    return renderConversationScreen();
  }

  if (
    screen ===
    'friends'
  ) {
    return renderFriendsScreen();
  }

  if (
    screen ===
    'friendRequests'
  ) {
    return renderFriendRequestsScreen();
  }

  if (
    screen ===
    'dmRequests'
  ) {
    return renderDMRequestsScreen();
  }

  return renderMainScreen();
}

/* =========================================================
   STYLES
========================================================= */

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        COLORS.background,
    },

    topBar: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
      paddingHorizontal:
        20,
      paddingTop: 10,
      paddingBottom: 15,
    },

    headerLeft: {
      flexDirection:
        'row',
      alignItems:
        'center',
      flex: 1,
    },

    headerTitle: {
      color:
        COLORS.text,
      fontSize: 22,
      fontWeight:
        'bold',
      letterSpacing: 1,
    },

    modeButton: {
      flexDirection:
        'row',
      alignItems:
        'center',
      marginLeft: 12,
      paddingHorizontal:
        10,
      paddingVertical: 7,
      borderRadius: 10,
      backgroundColor:
        COLORS.card,
      borderWidth: 1,
      borderColor:
        COLORS.border,
    },

    modeText: {
      color:
        COLORS.secondary,
      fontSize: 12,
      fontWeight:
        '700',
      marginLeft: 5,
    },

    topIcons: {
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    iconBtn: {
      marginLeft: 18,
    },

    badge: {
      position:
        'absolute',
      top: -7,
      right: -9,
      minWidth: 16,
      height: 16,
      paddingHorizontal:
        3,
      borderRadius: 8,
      backgroundColor:
        COLORS.urgent,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    badgeText: {
      color:
        COLORS.text,
      fontSize: 9,
      fontWeight:
        '800',
    },

    searchContainer: {
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        COLORS.card,
      marginHorizontal:
        20,
      borderRadius: 12,
      paddingHorizontal:
        16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor:
        COLORS.border,
    },

    searchIcon: {
      marginRight: 10,
    },

    searchInput: {
      flex: 1,
      color:
        COLORS.text,
      paddingVertical:
        14,
      fontSize: 15,
    },

    searchResultCard: {
      flexDirection:
        'row',
      alignItems:
        'center',
      marginHorizontal:
        20,
      marginBottom: 12,
      padding: 13,
      backgroundColor:
        COLORS.card2,
      borderRadius: 15,
      borderWidth: 1,
      borderColor:
        COLORS.borderLight,
    },

    searchResultInfo: {
      flex: 1,
      marginLeft: 12,
    },

    searchActions: {
      flexDirection:
        'row',
      gap: 7,
    },

    smallActionButton: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor:
        COLORS.card,
      borderWidth: 1,
      borderColor:
        COLORS.borderLight,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    blueActionButton: {
      backgroundColor:
        COLORS.blue2,
      borderColor:
        COLORS.blue2,
    },

    tabContainer: {
      borderBottomWidth: 1,
      borderBottomColor:
        COLORS.border,
      paddingBottom: 12,
      paddingHorizontal: 8,
    },

    tabScrollContent: {
      paddingHorizontal: 2,
    },

    tabButton: {
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal:
        16,
      paddingVertical: 9,
      marginHorizontal: 4,
      borderRadius: 22,
      backgroundColor:
        COLORS.card,
      borderWidth: 1,
      borderColor:
        COLORS.border,
    },

    activeTabButton: {
      backgroundColor:
        COLORS.border,
      borderColor:
        COLORS.borderLight,
    },

    tabText: {
      color:
        COLORS.secondary,
      fontSize: 14,
      fontWeight:
        '700',
    },

    activeTabText: {
      color:
        COLORS.text,
    },

    groupPlus: {
      marginLeft: 5,
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    listContainer: {
      padding: 16,
      paddingBottom: 35,
    },

    emptyListContainer: {
      flexGrow: 1,
    },

    chatCard: {
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        COLORS.card,
      padding: 14,
      borderRadius: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor:
        COLORS.border,
    },

    urgentChatCard: {
      borderColor:
        '#5B1E32',
    },

    avatarCircle: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor:
        '#14141C',
      borderWidth: 1,
      borderColor:
        COLORS.border,
      justifyContent:
        'center',
      alignItems:
        'center',
    },

    avatarText: {
      color:
        COLORS.text,
      fontSize: 15,
      fontWeight:
        '800',
    },

    chatInfo: {
      flex: 1,
      marginLeft: 14,
      minWidth: 0,
    },

    chatTitleRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    chatName: {
      color:
        COLORS.text,
      fontSize: 16,
      fontWeight:
        '700',
      flexShrink: 1,
    },

    chatUsername: {
      color:
        COLORS.secondary,
      fontSize: 11,
      marginTop: 2,
      marginBottom: 4,
    },

    chatMessage: {
      color:
        COLORS.secondary,
      fontSize: 13,
    },

    groupLabel: {
      marginLeft: 7,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor:
        COLORS.border,
    },

    groupLabelText: {
      color:
        COLORS.secondary,
      fontSize: 7,
      fontWeight:
        '800',
    },

    chatMeta: {
      alignItems:
        'flex-end',
      justifyContent:
        'center',
      paddingLeft: 8,
    },

    timeText: {
      color:
        COLORS.secondary,
      fontSize: 11,
      marginBottom: 8,
      fontWeight:
        '600',
    },

    statusIconContainer: {
      height: 18,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 8,
    },

    favoriteButton: {
      padding: 2,
    },

    centerLoading: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    loadingText: {
      color:
        COLORS.secondary,
      marginTop: 10,
      fontSize: 13,
    },

    emptyState: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        35,
    },

    emptyTitle: {
      color:
        COLORS.text,
      fontSize: 17,
      fontWeight:
        '700',
      textAlign:
        'center',
      marginTop: 14,
    },

    emptyText: {
      color:
        COLORS.secondary,
      textAlign:
        'center',
      marginTop: 8,
      fontSize: 14,
      lineHeight: 20,
    },

    bottomNav: {
      flexDirection:
        'row',
      justifyContent:
        'space-around',
      alignItems:
        'center',
      backgroundColor:
        COLORS.card,
      paddingTop: 12,
      paddingBottom: 25,
      borderTopWidth: 1,
      borderTopColor:
        COLORS.border,
    },

    navItem: {
      alignItems:
        'center',
      justifyContent:
        'center',
      minWidth: 55,
    },

    navText: {
      color:
        COLORS.secondary,
      fontSize: 11,
      marginTop: 5,
      fontWeight:
        '700',
    },

    modalOverlay: {
      flex: 1,
      backgroundColor:
        'rgba(0,0,0,0.70)',
      justifyContent:
        'center',
      alignItems:
        'center',
      padding: 20,
    },

    modesBox: {
      width: '90%',
      backgroundColor:
        COLORS.card2,
      borderRadius: 18,
      borderWidth: 1,
      borderColor:
        COLORS.borderLight,
      padding: 18,
    },

    modalTitle: {
      color:
        COLORS.text,
      fontSize: 20,
      fontWeight:
        '800',
    },

    modeRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor:
        COLORS.border,
    },

    modeInfo: {
      marginLeft: 13,
      flex: 1,
    },

    modeRowTitle: {
      color:
        COLORS.text,
      fontSize: 15,
      fontWeight:
        '700',
    },

    modeRowDescription: {
      color:
        COLORS.secondary,
      fontSize: 12,
      marginTop: 3,
    },

    innerHeader: {
      height: 60,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal:
        14,
      borderBottomWidth: 1,
      borderBottomColor:
        COLORS.border,
    },

    backButton: {
      width: 42,
      height: 42,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    innerHeaderTitle: {
      flex: 1,
      color:
        COLORS.text,
      fontSize: 19,
      fontWeight:
        '800',
      marginLeft: 4,
    },

    headerSpacer: {
      width: 42,
    },

    friendCard: {
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        COLORS.card,
      padding: 14,
      marginBottom: 10,
      borderRadius: 15,
      borderWidth: 1,
      borderColor:
        COLORS.border,
    },

    friendInfo: {
      flex: 1,
      marginLeft: 13,
    },

    requestCard: {
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        COLORS.card,
      padding: 13,
      marginBottom: 10,
      borderRadius: 15,
      borderWidth: 1,
      borderColor:
        COLORS.border,
    },

    requestInfo: {
      flex: 1,
      marginLeft: 12,
      minWidth: 0,
    },

    requestButtons: {
      alignItems:
        'flex-end',
      gap: 6,
      marginLeft: 8,
    },

    acceptButton: {
      backgroundColor:
        COLORS.blue2,
      borderRadius: 8,
      paddingHorizontal: 11,
      paddingVertical: 7,
    },

    rejectButton: {
      backgroundColor:
        '#24242D',
      borderRadius: 8,
      paddingHorizontal: 11,
      paddingVertical: 7,
    },

    buttonText: {
      color:
        COLORS.text,
      fontSize: 11,
      fontWeight:
        '800',
    },

    createGroupBox: {
      width: '100%',
      maxHeight: '88%',
      backgroundColor:
        COLORS.card2,
      borderRadius: 20,
      borderWidth: 1,
      borderColor:
        COLORS.borderLight,
      padding: 18,
    },

    modalHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      marginBottom: 15,
    },

    groupInput: {
      backgroundColor:
        COLORS.card,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      borderRadius: 12,
      color:
        COLORS.text,
      paddingHorizontal: 13,
      paddingVertical: 12,
      fontSize: 14,
      marginBottom: 10,
    },

    groupDescriptionInput: {
      minHeight: 80,
      textAlignVertical:
        'top',
    },

    selectFriendsTitle: {
      color:
        COLORS.text,
      fontSize: 14,
      fontWeight:
        '800',
      marginTop: 5,
      marginBottom: 3,
    },

    addedCount: {
      color:
        COLORS.blue,
      fontSize: 12,
      fontWeight:
        '700',
      marginBottom: 8,
    },

    groupFriendsList: {
      maxHeight: 270,
    },

    groupFriendRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingVertical: 9,
      borderBottomWidth: 1,
      borderBottomColor:
        COLORS.border,
    },

    avatarSmall: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor:
        '#14141C',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    avatarSmallText: {
      color:
        COLORS.text,
      fontSize: 11,
      fontWeight:
        '800',
    },

    groupFriendInfo: {
      flex: 1,
      marginLeft: 10,
    },

    checkbox: {
      width: 23,
      height: 23,
      borderRadius: 7,
      borderWidth: 1,
      borderColor:
        COLORS.borderLight,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    checkboxSelected: {
      backgroundColor:
        COLORS.blue2,
      borderColor:
        COLORS.blue2,
    },

    createGroupButton: {
      height: 48,
      borderRadius: 12,
      backgroundColor:
        COLORS.blue2,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop: 15,
    },

    createGroupButtonText: {
      color:
        COLORS.text,
      fontSize: 14,
      fontWeight:
        '800',
    },

    chatHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      height: 64,
      paddingHorizontal: 8,
      borderBottomWidth: 1,
      borderBottomColor:
        COLORS.border,
    },

    conversationAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor:
        '#14141C',
      alignItems:
        'center',
      justifyContent:
        'center',
      borderWidth: 1,
      borderColor:
        COLORS.border,
    },

    conversationAvatarText: {
      color:
        COLORS.text,
      fontSize: 12,
      fontWeight:
        '800',
    },

    conversationHeaderInfo: {
      flex: 1,
      marginLeft: 10,
    },

    conversationTitle: {
      color:
        COLORS.text,
      fontSize: 15,
      fontWeight:
        '800',
    },

    conversationSubtitle: {
      color:
        COLORS.secondary,
      fontSize: 11,
      marginTop: 2,
    },

    conversationHeaderButton: {
      width: 42,
      height: 42,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    messagesList: {
      padding: 15,
      paddingBottom: 20,
    },

    emptyMessagesList: {
      flexGrow: 1,
    },

    emptyConversation: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    messageRow: {
      alignItems:
        'flex-start',
      marginBottom: 9,
    },

    myMessageRow: {
      alignItems:
        'flex-end',
    },

    messageSenderName: {
      color:
        COLORS.secondary,
      fontSize: 10,
      marginLeft: 7,
      marginBottom: 3,
    },

    messageBubble: {
      maxWidth: '82%',
      backgroundColor:
        COLORS.card2,
      borderRadius: 15,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },

    myMessageBubble: {
      backgroundColor:
        '#07566A',
      borderColor:
        '#08748D',
    },

    messageText: {
      color:
        COLORS.text,
      fontSize: 14,
      lineHeight: 19,
    },

    myMessageText: {
      color:
        COLORS.text,
    },

    messageTime: {
      color:
        COLORS.secondary,
      fontSize: 9,
      marginTop: 4,
      textAlign:
        'right',
    },

    myMessageTime: {
      color:
        '#B9EAF3',
    },

    /* =====================================================
       REAL CHAT ACTIVITY INDICATOR
    ===================================================== */

    activityContainer: {
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal: 15,
      paddingBottom: 6,
    },

    activityAvatar: {
      width: 25,
      height: 25,
      borderRadius: 13,
      backgroundColor:
        '#14141C',
      borderWidth: 1,
      borderColor:
        COLORS.border,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    activityAvatarText: {
      color:
        COLORS.text,
      fontSize: 8,
      fontWeight:
        '800',
    },

    typingBubble: {
      marginLeft: 7,
      minWidth: 45,
      height: 29,
      borderRadius: 15,
      backgroundColor:
        COLORS.card2,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal: 10,
    },

    typingDots: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 4,
    },

    typingDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor:
        COLORS.secondary,
    },

    activityText: {
      color:
        COLORS.secondary,
      fontSize: 11,
      marginLeft: 7,
      flex: 1,
    },

    messageComposer: {
      flexDirection:
        'row',
      alignItems:
        'flex-end',
      backgroundColor:
        COLORS.card,
      borderTopWidth: 1,
      borderTopColor:
        COLORS.border,
      paddingHorizontal: 10,
      paddingTop: 9,
      paddingBottom:
        Platform.OS ===
        'ios'
          ? 10
          : 8,
    },

    composerIcon: {
      width: 40,
      height: 44,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    messageInput: {
      flex: 1,
      maxHeight: 110,
      minHeight: 44,
      color:
        COLORS.text,
      backgroundColor:
        COLORS.card2,
      borderRadius: 14,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      paddingHorizontal: 13,
      paddingVertical: 11,
      fontSize: 14,
    },

    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor:
        COLORS.blue2,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginLeft: 8,
    },

    sendButtonDisabled: {
      opacity: 0.45,
    },
  });