import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Ionicons,
  MaterialCommunityIcons,
  FontAwesome5,
} from '@expo/vector-icons';

import { auth, db } from './firebaseConfig';

import {
  doc,
  getDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';

import { useDriveStore } from './store';

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [assetLoading, setAssetLoading] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('Personal');

  const [userData, setUserData] = useState(null);

  const [profileImageUri, setProfileImageUri] =
    useState(null);

  const [bannerImageUri, setBannerImageUri] =
    useState(null);

  const [editForm, setEditForm] = useState({
    displayName: '',
    username: '',
    bio: '',
    bubleText: '',
  });

  const {
    getFileDataUri,
    getValidAccessToken,
  } = useDriveStore();

  // --------------------------------------------------
  // SAFE DATE
  // --------------------------------------------------

  const safeDate = (timestamp) => {
    if (!timestamp) return null;

    if (
      typeof timestamp.toDate === 'function'
    ) {
      return timestamp.toDate();
    }

    if (
      typeof timestamp.seconds === 'number'
    ) {
      return new Date(
        timestamp.seconds * 1000
      );
    }

    return null;
  };

  // --------------------------------------------------
  // FETCH PROFILE
  // --------------------------------------------------

  const fetchUserData = useCallback(
    async () => {
      try {
        if (!auth.currentUser) {
          setLoading(false);
          return;
        }

        const userRef = doc(
          db,
          'users',
          auth.currentUser.uid
        );

        const docSnap =
          await getDoc(userRef);

        if (!docSnap.exists()) {
          setUserData(null);
          return;
        }

        const data =
          docSnap.data();

        setUserData(data);

        setEditForm({
          displayName:
            data.displayName || '',
          username:
            data.username || '',
          bio:
            data.bio || '',
          bubleText:
            data.bubleText || '',
        });
      } catch (error) {
        console.error(
          'Error fetching profile:',
          error
        );

        Alert.alert(
          'Error',
          'Unable to load your profile.'
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // --------------------------------------------------
  // LOAD ASSET FROM FIREBASE + GOOGLE DRIVE
  // --------------------------------------------------

  const loadAssetImage = useCallback(
    async (assetId) => {
      if (!assetId) {
        return null;
      }

      try {
        // Read Shinzi asset metadata.
        const assetRef = doc(
          db,
          'assets',
          assetId
        );

        const assetSnap =
          await getDoc(assetRef);

        if (!assetSnap.exists()) {
          console.warn(
            `Asset metadata not found: ${assetId}`
          );
          return null;
        }

        const asset =
          assetSnap.data();

        // Only Google Drive assets are
        // supported by this provider.
        if (
          asset.provider !==
          'google_drive'
        ) {
          console.warn(
            `Unsupported asset provider for ${assetId}:`,
            asset.provider
          );
          return null;
        }

        if (!asset.providerFileId) {
          console.warn(
            `Asset has no providerFileId: ${assetId}`
          );
          return null;
        }

        if (
          asset.status &&
          asset.status !== 'active'
        ) {
          console.warn(
            `Asset is not active: ${assetId}`
          );
          return null;
        }

        // This downloads the actual file through
        // the authenticated Google Drive session.
        const dataUri =
          await getFileDataUri(
            asset.providerFileId
          );

        return dataUri;
      } catch (error) {
        console.error(
          `Failed to load asset ${assetId}:`,
          error
        );

        return null;
      }
    },
    [getFileDataUri]
  );

  // --------------------------------------------------
  // LOAD PROFILE/BANNER ASSETS
  // --------------------------------------------------

  const loadProfileAssets =
    useCallback(
      async (data) => {
        if (!data) {
          setProfileImageUri(null);
          setBannerImageUri(null);
          return;
        }

        const hasProfileAsset =
          !!data.profileAssetId;

        // Banner support is future-compatible.
        //
        // If/when users have bannerAssetId,
        // this will automatically use it.
        const hasBannerAsset =
          !!data.bannerAssetId;

        if (
          !hasProfileAsset &&
          !hasBannerAsset
        ) {
          // Backwards compatibility with old
          // profile fields.
          setProfileImageUri(
            data.photoURL || null
          );

          setBannerImageUri(
            data.bannerUrl || null
          );

          return;
        }

        setAssetLoading(true);

        try {
          const results =
            await Promise.all([
              hasProfileAsset
                ? loadAssetImage(
                    data.profileAssetId
                  )
                : Promise.resolve(
                    data.photoURL ||
                      null
                  ),

              hasBannerAsset
                ? loadAssetImage(
                    data.bannerAssetId
                  )
                : Promise.resolve(
                    data.bannerUrl ||
                      null
                  ),
            ]);

          setProfileImageUri(
            results[0] || null
          );

          setBannerImageUri(
            results[1] || null
          );
        } finally {
          setAssetLoading(false);
        }
      },
      [loadAssetImage]
    );

  // --------------------------------------------------
  // INITIAL LOAD
  // --------------------------------------------------

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // --------------------------------------------------
  // LOAD ASSETS AFTER PROFILE LOAD
  // --------------------------------------------------

  useEffect(() => {
    if (!userData) {
      return;
    }

    loadProfileAssets(userData);
  }, [
    userData,
    loadProfileAssets,
  ]);

  // --------------------------------------------------
  // SAVE PROFILE
  // --------------------------------------------------

  const handleSaveProfile =
    async () => {
      if (!auth.currentUser) {
        Alert.alert(
          'Error',
          'You must be logged in to save.'
        );
        return;
      }

      const cleanUsername =
        editForm.username
          .trim()
          .toLowerCase();

      const usernameRegex =
        /^[a-z0-9_]{3,15}$/;

      if (
        !usernameRegex.test(
          cleanUsername
        )
      ) {
        Alert.alert(
          'Invalid Username',
          'Must be 3-15 characters, no spaces, only letters, numbers, and underscores.'
        );
        return;
      }

      try {
        setLoading(true);

        const batch =
          writeBatch(db);

        const userRef =
          doc(
            db,
            'users',
            auth.currentUser.uid
          );

        const updates = {
          displayName:
            editForm.displayName.trim(),

          bio:
            editForm.bio.trim(),

          bubleText:
            editForm.bubleText.trim(),
        };

        if (
          cleanUsername !==
          userData?.username?.toLowerCase()
        ) {
          if (
            !canChangeUsername(
              userData?.usernameLastChanged
            )
          ) {
            Alert.alert(
              'Cooldown Active',
              'You can only change your username once every 30 days.'
            );

            setLoading(false);
            return;
          }

          const newUsernameRef =
            doc(
              db,
              'usernames',
              cleanUsername
            );

          const newUsernameSnap =
            await getDoc(
              newUsernameRef
            );

          if (
            newUsernameSnap.exists()
          ) {
            Alert.alert(
              'Username Taken',
              'That username is already in use by someone else.'
            );

            setLoading(false);
            return;
          }

          // Reserve new username.
          batch.set(
            newUsernameRef,
            {
              uid:
                auth.currentUser.uid,
            }
          );

          // Release old username.
          if (
            userData?.username
          ) {
            const oldUsernameRef =
              doc(
                db,
                'usernames',
                userData.username.toLowerCase()
              );

            batch.delete(
              oldUsernameRef
            );
          }

          updates.username =
            cleanUsername;

          updates.usernameLastChanged =
            serverTimestamp();
        }

        batch.update(
          userRef,
          updates
        );

        await batch.commit();

        await fetchUserData();

        setIsEditing(false);
      } catch (error) {
        console.error(
          'Error updating profile:',
          error
        );

        Alert.alert(
          'Error',
          'Failed to save profile. If you changed your username, someone else may have just claimed it.'
        );
      } finally {
        setLoading(false);
      }
    };

  // --------------------------------------------------
  // PRONOUNS
  // --------------------------------------------------

  const getPronouns = (
    gender
  ) => {
    if (gender === 'Male') {
      return 'He/Him';
    }

    if (gender === 'Female') {
      return 'She/Her';
    }

    return null;
  };

  // --------------------------------------------------
  // USERNAME COOLDOWN
  // --------------------------------------------------

  const canChangeUsername =
    (lastChanged) => {
      const dateObj =
        safeDate(lastChanged);

      if (!dateObj) {
        return true;
      }

      const thirtyDaysInMs =
        30 *
        24 *
        60 *
        60 *
        1000;

      const timeSinceLastChange =
        Date.now() -
        dateObj.getTime();

      return (
        timeSinceLastChange >
        thirtyDaysInMs
      );
    };

  // --------------------------------------------------
  // DATE
  // --------------------------------------------------

  const formatDate =
    (timestamp) => {
      const dateObj =
        safeDate(timestamp);

      if (!dateObj) {
        return 'Recently';
      }

      return `${dateObj.getDate()} ${dateObj.toLocaleString(
        'default',
        {
          month: 'short',
        }
      )} ${dateObj.getFullYear()}`;
    };

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (
    loading &&
    !userData
  ) {
    return (
      <View
        style={[
          styles.container,
          {
            justifyContent:
              'center',
            alignItems:
              'center',
          },
        ]}
      >
        <ActivityIndicator
          size="large"
          color="#4DA8DA"
        />
      </View>
    );
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <View
      style={styles.container}
    >
      <View
        style={styles.topBar}
      >
        <Text
          style={
            styles.topBarTitle
          }
        >
          Profile
        </Text>

        <View
          style={
            styles.topBarIcons
          }
        >
          {isEditing ? (
            <TouchableOpacity
              onPress={
                handleSaveProfile
              }
              style={
                styles.iconBtn
              }
            >
              <Ionicons
                name="checkmark"
                size={24}
                color="#4CAF50"
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() =>
                setIsEditing(true)
              }
              style={
                styles.iconBtn
              }
            >
              <Ionicons
                name="pencil"
                size={24}
                color="#FFF"
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                'Navigating',
                'Will open Settings.js'
              )
            }
            style={
              styles.iconBtn
            }
          >
            <Ionicons
              name="settings-sharp"
              size={24}
              color="#FFF"
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView>
        <View
          style={
            styles.headerContainer
          }
        >
          {/* BANNER */}
          <View
            style={styles.banner}
          >
            {bannerImageUri ? (
              <Image
                source={{
                  uri: bannerImageUri,
                }}
                style={
                  StyleSheet.absoluteFillObject
                }
                resizeMode="cover"
              />
            ) : (
              <Ionicons
                name="triangle-outline"
                size={80}
                color="#333"
                style={{
                  opacity: 0.5,
                }}
              />
            )}

            {assetLoading &&
              !bannerImageUri && (
                <View
                  style={
                    styles.assetLoadingOverlay
                  }
                >
                  <ActivityIndicator
                    color="#4DA8DA"
                  />
                </View>
              )}
          </View>

          {/* AVATAR */}
          <View
            style={
              styles.avatarSection
            }
          >
            <View
              style={
                styles.avatarPlaceholder
              }
            >
              {profileImageUri ? (
                <Image
                  source={{
                    uri:
                      profileImageUri,
                  }}
                  style={
                    styles.avatarImage
                  }
                />
              ) : (
                <Ionicons
                  name="person"
                  size={40}
                  color="#888"
                />
              )}

              {assetLoading &&
                !profileImageUri && (
                  <View
                    style={
                      styles.avatarLoadingOverlay
                    }
                  >
                    <ActivityIndicator
                      size="small"
                      color="#4DA8DA"
                    />
                  </View>
                )}
            </View>

            {userData?.bubleText ? (
              <View
                style={styles.buble}
              >
                <Text
                  style={
                    styles.bubleText
                  }
                >
                  {userData.bubleText}
                </Text>
              </View>
            ) : null}
          </View>

          {/* IDENTITY */}
          <View
            style={
              styles.identityBlock
            }
          >
            <Text
              style={
                styles.displayName
              }
            >
              {userData?.displayName}
            </Text>

            <Text
              style={
                styles.username
              }
            >
              @{userData?.username}
            </Text>

            <View
              style={
                styles.badgesRow
              }
            >
              {getPronouns(
                userData?.gender
              ) && (
                <Text
                  style={
                    styles.pronoun
                  }
                >
                  {getPronouns(
                    userData?.gender
                  )}
                </Text>
              )}

              {userData?.gender ===
                'Male' && (
                <MaterialCommunityIcons
                  name="gender-male"
                  size={16}
                  color="#4DA8DA"
                />
              )}

              {userData?.gender ===
                'Female' && (
                <MaterialCommunityIcons
                  name="gender-female"
                  size={16}
                  color="#E1306C"
                />
              )}

              <View
                style={
                  styles.medalBox
                }
              >
                <Ionicons
                  name="medal"
                  size={14}
                  color="#FFD700"
                />

                <Text
                  style={
                    styles.medalText
                  }
                >
                  Beta
                </Text>
              </View>
            </View>
          </View>
        </View>

        {!isEditing && (
          <View
            style={
              styles.tabContainer
            }
          >
            <TouchableOpacity
              onPress={() =>
                setActiveTab(
                  'Personal'
                )
              }
              style={[
                styles.tab,
                activeTab ===
                  'Personal' &&
                  styles.activeTab,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab ===
                    'Personal' &&
                    styles.activeTabText,
                ]}
              >
                Personal
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() =>
                setActiveTab(
                  'Social'
                )
              }
              style={[
                styles.tab,
                activeTab ===
                  'Social' &&
                  styles.activeTab,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab ===
                    'Social' &&
                    styles.activeTabText,
                ]}
              >
                Social
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* EDIT */}
        {isEditing ? (
          <View
            style={
              styles.editForm
            }
          >
            <Text
              style={styles.label}
            >
              Display Name
            </Text>

            <TextInput
              style={styles.input}
              value={
                editForm.displayName
              }
              onChangeText={(t) =>
                setEditForm({
                  ...editForm,
                  displayName: t,
                })
              }
            />

            <Text
              style={styles.label}
            >
              Style (Requires Google Drive Sync)
            </Text>

            <View
              style={
                styles.styleRow
              }
            >
              <TouchableOpacity
                style={
                  styles.fileUploadBtn
                }
              >
                <Text
                  style={
                    styles.fileUploadText
                  }
                >
                  {userData?.styleFile
                    ? userData.styleFile
                    : 'Select .ttf / .otf'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text
              style={styles.label}
            >
              Pronouns (Derived from Gender)
            </Text>

            <TextInput
              style={[
                styles.input,
                {
                  color: '#666',
                  backgroundColor:
                    '#111',
                },
              ]}
              value={
                getPronouns(
                  userData?.gender
                ) || 'Hidden'
              }
              editable={false}
            />

            <Text
              style={styles.label}
            >
              Bio
            </Text>

            <TextInput
              style={[
                styles.input,
                styles.bioInput,
              ]}
              value={editForm.bio}
              onChangeText={(t) =>
                setEditForm({
                  ...editForm,
                  bio: t,
                })
              }
              multiline
            />

            <Text
              style={styles.label}
            >
              Username (NOTE: you can change by 1 month)
            </Text>

            <View
              style={[
                styles.usernameInputRow,
                !canChangeUsername(
                  userData?.usernameLastChanged
                ) && {
                  borderColor:
                    '#8B0000',
                },
              ]}
            >
              <TextInput
                style={[
                  styles.inputFlex,
                  !canChangeUsername(
                    userData?.usernameLastChanged
                  ) && {
                    color:
                      '#666',
                  },
                ]}
                value={
                  editForm.username
                }
                onChangeText={(t) =>
                  setEditForm({
                    ...editForm,
                    username: t,
                  })
                }
                editable={canChangeUsername(
                  userData?.usernameLastChanged
                )}
              />

              <Ionicons
                name={
                  !canChangeUsername(
                    userData?.usernameLastChanged
                  )
                    ? 'lock-closed'
                    : 'checkmark-circle'
                }
                size={20}
                color={
                  !canChangeUsername(
                    userData?.usernameLastChanged
                  )
                    ? '#8B0000'
                    : '#4CAF50'
                }
              />
            </View>

            <Text
              style={styles.label}
            >
              Buble
            </Text>

            <View
              style={
                styles.usernameInputRow
              }
            >
              <TextInput
                style={
                  styles.inputFlex
                }
                value={
                  editForm.bubleText
                }
                onChangeText={(t) =>
                  setEditForm({
                    ...editForm,
                    bubleText: t,
                  })
                }
              />

              <Ionicons
                name="chatbubble-ellipses-outline"
                size={20}
                color="#888"
              />
            </View>
          </View>
        ) : (
          activeTab ===
          'Personal' ? (
            <View
              style={
                styles.tabContent
              }
            >
              <Text
                style={
                  styles.sectionHeader
                }
              >
                Bio 📄
              </Text>

              <Text
                style={
                  styles.bioTextBody
                }
              >
                {userData?.bio ||
                  'No bio set yet.'}
              </Text>

              <View
                style={
                  styles.memberSince
                }
              >
                <Ionicons
                  name="time-outline"
                  size={16}
                  color="#888"
                />

                <Text
                  style={
                    styles.memberText
                  }
                >
                  Member since{' '}
                  {formatDate(
                    userData?.createdAt
                  )}
                </Text>
              </View>

              <Text
                style={
                  styles.sectionHeader
                }
              >
                Other Platforms
              </Text>

              <View
                style={
                  styles.platformList
                }
              >
                {userData?.otherPlatforms
                  ?.length > 0 ? (
                  userData.otherPlatforms.map(
                    (
                      plat,
                      index
                    ) => (
                      <Text
                        key={index}
                        style={
                          styles.platformItem
                        }
                      >
                        <FontAwesome5
                          name={
                            plat.iconName
                          }
                          size={14}
                          color={
                            plat.color
                          }
                        />{' '}
                        {plat.handle}{' '}
                        {plat.verified &&
                          '✔️'}
                      </Text>
                    )
                  )
                ) : (
                  <Text
                    style={
                      styles.emptyText
                    }
                  >
                    No platforms connected
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <View
              style={
                styles.tabContent
              }
            >
              <Text
                style={
                  styles.sectionHeader
                }
              >
                Network Stats
              </Text>

              <Text
                style={
                  styles.statLine
                }
              >
                Friends:{' '}
                {userData?.socialStats
                  ?.friendsCount || 0}
              </Text>

              <Text
                style={
                  styles.statLine
                }
              >
                Followers:{' '}
                {userData?.socialStats
                  ?.followersCount || 0}
              </Text>

              <Text
                style={
                  styles.statLine
                }
              >
                Mutual Friends:{' '}
                {userData?.socialStats
                  ?.mutualFriends || 0}
              </Text>

              <Text
                style={
                  styles.statLine
                }
              >
                Mutual Servers:{' '}
                {userData?.socialStats
                  ?.mutualServers || 0}
              </Text>

              <Text
                style={
                  styles.statLine
                }
              >
                Servers Joined:{' '}
                {userData?.socialStats
                  ?.serversJoined || 0}
              </Text>
            </View>
          )
        )}
      </ScrollView>
    </View>
  );
}

// --------------------------------------------------
// STYLES
// --------------------------------------------------

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        '#121212',
    },

    topBar: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      padding: 20,
      paddingTop: 50,
      backgroundColor:
        '#1A1A1A',
    },

    topBarTitle: {
      color: '#FFF',
      fontSize: 20,
      fontWeight:
        'bold',
    },

    topBarIcons: {
      flexDirection:
        'row',
    },

    iconBtn: {
      marginLeft: 20,
    },

    headerContainer: {
      paddingBottom: 20,
    },

    banner: {
      height: 120,
      backgroundColor:
        '#2C2C2C',
      justifyContent:
        'center',
      alignItems:
        'center',
      overflow: 'hidden',
    },

    assetLoadingOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      justifyContent:
        'center',
      alignItems:
        'center',
      backgroundColor:
        'rgba(0,0,0,0.35)',
    },

    avatarSection: {
      flexDirection:
        'row',
      alignItems:
        'flex-end',
      marginTop: -40,
      paddingHorizontal:
        20,
    },

    avatarPlaceholder: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor:
        '#444',
      justifyContent:
        'center',
      alignItems:
        'center',
      borderWidth: 4,
      borderColor:
        '#121212',
      overflow: 'hidden',
    },

    avatarImage: {
      width: '100%',
      height: '100%',
    },

    avatarLoadingOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      justifyContent:
        'center',
      alignItems:
        'center',
      backgroundColor:
        'rgba(0,0,0,0.35)',
    },

    buble: {
      backgroundColor:
        '#333',
      padding: 8,
      borderRadius: 15,
      marginLeft: 10,
      marginBottom: 20,
      borderWidth: 1,
      borderColor:
        '#555',
    },

    bubleText: {
      color: '#FFF',
      fontSize: 12,
    },

    identityBlock: {
      paddingHorizontal:
        20,
      marginTop: 10,
    },

    displayName: {
      color: '#FFF',
      fontSize: 24,
      fontWeight:
        'bold',
    },

    username: {
      color: '#AAA',
      fontSize: 14,
      marginBottom: 5,
    },

    badgesRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 8,
    },

    pronoun: {
      color: '#AAA',
      fontSize: 14,
    },

    medalBox: {
      flexDirection:
        'row',
      backgroundColor:
        '#333',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      alignItems:
        'center',
    },

    medalText: {
      color: '#FFF',
      fontSize: 10,
      marginLeft: 4,
    },

    tabContainer: {
      flexDirection:
        'row',
      borderBottomWidth:
        1,
      borderBottomColor:
        '#333',
    },

    tab: {
      flex: 1,
      padding: 15,
      alignItems:
        'center',
    },

    activeTab: {
      borderBottomWidth:
        2,
      borderBottomColor:
        '#4DA8DA',
    },

    tabText: {
      color: '#888',
      fontSize: 16,
    },

    activeTabText: {
      color: '#4DA8DA',
      fontWeight:
        'bold',
    },

    tabContent: {
      padding: 20,
    },

    sectionHeader: {
      color: '#FFF',
      fontSize: 16,
      fontWeight:
        'bold',
      marginTop: 15,
      marginBottom: 10,
    },

    bioTextBody: {
      color: '#DDD',
      fontSize: 14,
      lineHeight: 20,
    },

    memberSince: {
      flexDirection:
        'row',
      alignItems:
        'center',
      marginTop: 15,
    },

    memberText: {
      color: '#888',
      fontSize: 12,
      marginLeft: 5,
    },

    platformList: {
      marginTop: 10,
    },

    platformItem: {
      color: '#DDD',
      fontSize: 14,
      marginBottom: 8,
    },

    emptyText: {
      color: '#666',
      fontStyle:
        'italic',
    },

    statLine: {
      color: '#DDD',
      fontSize: 14,
      marginBottom: 8,
    },

    editForm: {
      padding: 20,
    },

    label: {
      color: '#AAA',
      fontSize: 12,
      marginTop: 15,
      marginBottom: 5,
    },

    input: {
      backgroundColor:
        '#1A1A1A',
      color: '#FFF',
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor:
        '#333',
    },

    inputFlex: {
      flex: 1,
      color: '#FFF',
    },

    bioInput: {
      height: 80,
      textAlignVertical:
        'top',
    },

    styleRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 10,
    },

    fileUploadBtn: {
      flex: 1,
      backgroundColor:
        '#2C2C2C',
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor:
        '#444',
    },

    fileUploadText: {
      color: '#4DA8DA',
    },

    usernameInputRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        '#1A1A1A',
      paddingHorizontal:
        12,
      paddingVertical:
        10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor:
        '#333',
    },
  });