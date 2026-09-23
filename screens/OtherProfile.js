import React, {
  useState,
  useEffect,
} from 'react';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
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
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';

import { useDriveStore } from './store';

export default function OtherProfile({
  route,
  navigation,
}) {

  const targetUid =
    route?.params?.targetUid;

  const [loading, setLoading] =
    useState(true);

  const [userData, setUserData] =
    useState(null);

  // Asset image state
  const [profileImageUri, setProfileImageUri] =
    useState(null);

  const [bannerImageUri, setBannerImageUri] =
    useState(null);

  const [assetLoading, setAssetLoading] =
    useState(false);

  const [showMenu, setShowMenu] =
    useState(false);

  const [activeTab, setActiveTab] =
    useState('Social');

  // Moderation state
  const [isFavourited, setIsFavourited] =
    useState(false);

  const [isBlocked, setIsBlocked] =
    useState(false);

  const [isMuted, setIsMuted] =
    useState(false);

  const {
    getFileDataUri,
  } = useDriveStore();


  // ==========================================
  // LOAD PROFILE
  // ==========================================

  useEffect(() => {

    if (!targetUid) {

      Alert.alert(
        'Error',
        'No user specified.'
      );

      navigation.goBack();

      return;
    }

    // ========================================
    // SELF-PROFILE PROTECTION
    // ========================================

    if (
      auth.currentUser &&
      targetUid === auth.currentUser.uid
    ) {

      navigation.replace('Profile');

      return;
    }

    fetchTargetProfile();
    fetchRelationshipStatus();

  }, [targetUid]);


  // ==========================================
  // LOAD DRIVE ASSET IMAGE
  // ==========================================

  const loadAssetImage = async (
    assetId
  ) => {

    if (!assetId) {
      return null;
    }

    try {

      const assetRef =
        doc(
          db,
          'assets',
          assetId
        );

      const assetSnap =
        await getDoc(assetRef);

      if (!assetSnap.exists()) {

        console.warn(
          'Asset metadata not found:',
          assetId
        );

        return null;
      }

      const asset =
        assetSnap.data();

      // Make sure this is a Google Drive asset.
      if (
        asset?.provider !==
        'google_drive'
      ) {

        console.warn(
          'Unsupported asset provider:',
          asset?.provider
        );

        return null;
      }

      // Do not load deleted/failed assets.
      if (
        asset?.status &&
        asset.status !== 'active'
      ) {

        return null;
      }

      if (!asset?.providerFileId) {

        console.warn(
          'Asset has no Drive file ID:',
          assetId
        );

        return null;
      }

      const dataUri =
        await getFileDataUri(
          asset.providerFileId
        );

      return dataUri;

    } catch (error) {

      console.error(
        'Failed to load profile asset:',
        error
      );

      return null;
    }
  };


  // ==========================================
  // LOAD PROFILE/BANNER ASSETS
  // ==========================================

  const loadProfileAssets =
    async (data) => {

      try {

        setAssetLoading(true);

        // -------------------------------
        // PROFILE PHOTO
        // -------------------------------

        if (data?.profileAssetId) {

          const imageUri =
            await loadAssetImage(
              data.profileAssetId
            );

          if (imageUri) {

            setProfileImageUri(
              imageUri
            );

          } else {

            setProfileImageUri(null);
          }

        } else {

          // Backward compatibility with
          // older profiles.
          setProfileImageUri(
            data?.photoURL || null
          );
        }


        // -------------------------------
        // BANNER
        // -------------------------------

        if (data?.bannerAssetId) {

          const imageUri =
            await loadAssetImage(
              data.bannerAssetId
            );

          if (imageUri) {

            setBannerImageUri(
              imageUri
            );

          } else {

            setBannerImageUri(null);
          }

        } else {

          // Backward compatibility with
          // older profiles.
          setBannerImageUri(
            data?.bannerUrl || null
          );
        }

      } catch (error) {

        console.error(
          'Failed to load profile assets:',
          error
        );

        // Fallback to legacy fields.
        setProfileImageUri(
          data?.photoURL || null
        );

        setBannerImageUri(
          data?.bannerUrl || null
        );

      } finally {

        setAssetLoading(false);
      }
    };


  // ==========================================
  // FETCH TARGET USER
  // ==========================================

  const fetchTargetProfile =
    async () => {

      try {

        setLoading(true);

        const userRef =
          doc(
            db,
            'users',
            targetUid
          );

        const docSnap =
          await getDoc(userRef);

        if (docSnap.exists()) {

          const data =
            docSnap.data();

          setUserData(data);

          // Load profile/banners from
          // the new asset system.
          await loadProfileAssets(
            data
          );

        } else {

          Alert.alert(
            'User Not Found',
            'This profile does not exist.'
          );

          navigation.goBack();
        }

      } catch (error) {

        console.error(
          'Error fetching other profile:',
          error
        );

        Alert.alert(
          'Error',
          'Failed to load user profile.'
        );

      } finally {

        setLoading(false);
      }
    };


  // ==========================================
  // FETCH BLOCK / MUTE / FAVOURITE STATUS
  // ==========================================

  const fetchRelationshipStatus =
    async () => {

      if (!auth.currentUser) {
        return;
      }

      try {

        const currentUid =
          auth.currentUser.uid;

        const favSnap =
          await getDoc(
            doc(
              db,
              'users',
              currentUid,
              'favourites',
              targetUid
            )
          );

        const blockSnap =
          await getDoc(
            doc(
              db,
              'users',
              currentUid,
              'blocked',
              targetUid
            )
          );

        const muteSnap =
          await getDoc(
            doc(
              db,
              'users',
              currentUid,
              'muted',
              targetUid
            )
          );

        setIsFavourited(
          favSnap.exists()
        );

        setIsBlocked(
          blockSnap.exists()
        );

        setIsMuted(
          muteSnap.exists()
        );

      } catch (error) {

        console.error(
          'Error fetching relationship statuses:',
          error
        );
      }
    };


  // ==========================================
  // BLOCK / UNBLOCK
  // ==========================================

  const handleBlockUser =
    async () => {

      if (!auth.currentUser) {
        return;
      }

      setShowMenu(false);

      try {

        const ref =
          doc(
            db,
            'users',
            auth.currentUser.uid,
            'blocked',
            targetUid
          );

        if (isBlocked) {

          await deleteDoc(ref);

          setIsBlocked(false);

          Alert.alert(
            'Unblocked',
            `@${userData?.username} has been unblocked.`
          );

        } else {

          await setDoc(
            ref,
            {
              blockedAt:
                serverTimestamp(),
            }
          );

          setIsBlocked(true);

          Alert.alert(
            'Blocked',
            `@${userData?.username} has been blocked.`
          );
        }

      } catch (error) {

        console.error(
          'Block action error:',
          error
        );

        Alert.alert(
          'Error',
          'Could not complete block action.'
        );
      }
    };


  // ==========================================
  // MUTE / UNMUTE
  // ==========================================

  const handleMuteUser =
    async () => {

      if (!auth.currentUser) {
        return;
      }

      setShowMenu(false);

      try {

        const ref =
          doc(
            db,
            'users',
            auth.currentUser.uid,
            'muted',
            targetUid
          );

        if (isMuted) {

          await deleteDoc(ref);

          setIsMuted(false);

          Alert.alert(
            'Unmuted',
            `@${userData?.username} has been unmuted.`
          );

        } else {

          await setDoc(
            ref,
            {
              mutedAt:
                serverTimestamp(),
            }
          );

          setIsMuted(true);

          Alert.alert(
            'Muted',
            `@${userData?.username} has been muted.`
          );
        }

      } catch (error) {

        console.error(
          'Mute action error:',
          error
        );

        Alert.alert(
          'Error',
          'Could not complete mute action.'
        );
      }
    };


  // ==========================================
  // FAVOURITE / UNFAVOURITE
  // ==========================================

  const handleToggleFavourite =
    async () => {

      if (!auth.currentUser) {
        return;
      }

      setShowMenu(false);

      try {

        const ref =
          doc(
            db,
            'users',
            auth.currentUser.uid,
            'favourites',
            targetUid
          );

        if (isFavourited) {

          await deleteDoc(ref);

          setIsFavourited(false);

          Alert.alert(
            'Removed',
            `@${userData?.username} removed from favourites.`
          );

        } else {

          await setDoc(
            ref,
            {
              addedAt:
                serverTimestamp(),
            }
          );

          setIsFavourited(true);

          Alert.alert(
            'Saved',
            `@${userData?.username} added to favourites.`
          );
        }

      } catch (error) {

        console.error(
          'Favourite action error:',
          error
        );

        Alert.alert(
          'Error',
          'Could not update favourites.'
        );
      }
    };


  // ==========================================
  // PRONOUNS
  // ==========================================

  const getPronouns =
    (gender) => {

      if (gender === 'Male') {
        return 'He/Him';
      }

      if (gender === 'Female') {
        return 'She/Her';
      }

      return null;
    };


  // ==========================================
  // LOADING
  // ==========================================

  if (
    loading ||
    !userData
  ) {

    return (
      <View
        style={[
          styles.container,
          styles.centered,
        ]}
      >

        <ActivityIndicator
          size="large"
          color="#4DA8DA"
        />

      </View>
    );
  }


  // ==========================================
  // MAIN UI
  // ==========================================

  return (
    <View style={styles.container}>

      {/* TOP BAR */}

      <View style={styles.topBar}>

        <TouchableOpacity
          onPress={() =>
            navigation.goBack()
          }
          style={styles.iconBtn}
        >

          <Ionicons
            name="arrow-back"
            size={24}
            color="#FFF"
          />

        </TouchableOpacity>


        <TouchableOpacity
          onPress={() =>
            setShowMenu(true)
          }
          style={styles.iconBtn}
        >

          <Ionicons
            name="ellipsis-vertical"
            size={24}
            color="#FFF"
          />

        </TouchableOpacity>

      </View>


      {/* MODERATION MENU */}

      <Modal
        visible={showMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() =>
          setShowMenu(false)
        }
      >

        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() =>
            setShowMenu(false)
          }
        >

          <View style={styles.dropdownMenu}>

            {/* BLOCK */}

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleBlockUser}
            >

              <Text
                style={[
                  styles.menuText,
                  isBlocked && {
                    color: '#E57373',
                  },
                ]}
              >
                {isBlocked
                  ? 'Unblock user'
                  : 'Block user'}
              </Text>

            </TouchableOpacity>


            <View
              style={styles.divider}
            />


            {/* MUTE */}

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleMuteUser}
            >

              <Text
                style={styles.menuText}
              >
                {isMuted
                  ? 'Unmute user'
                  : 'Mute user'}
              </Text>

            </TouchableOpacity>


            <View
              style={styles.divider}
            />


            {/* FAVOURITE */}

            <TouchableOpacity
              style={styles.menuItem}
              onPress={
                handleToggleFavourite
              }
            >

              <Text
                style={[
                  styles.menuText,
                  isFavourited && {
                    color: '#FFD700',
                  },
                ]}
              >
                {isFavourited
                  ? 'Favourited ★'
                  : 'Favourite'}
              </Text>

            </TouchableOpacity>

          </View>

        </TouchableOpacity>

      </Modal>


      {/* PROFILE */}

      <ScrollView>

        {/* BANNER + AVATAR */}

        <View
          style={styles.headerContainer}
        >

          <View style={styles.banner}>

            {bannerImageUri ? (

              <Image
                source={{
                  uri: bannerImageUri,
                }}
                style={
                  StyleSheet.absoluteFillObject
                }
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

          </View>


          <View
            style={styles.avatarSection}
          >

            <View
              style={
                styles.avatarPlaceholder
              }
            >

              {profileImageUri ? (

                <Image
                  source={{
                    uri: profileImageUri,
                  }}
                  style={styles.avatarImage}
                />

              ) : (

                <Ionicons
                  name="person"
                  size={40}
                  color="#888"
                />

              )}

            </View>


            {userData.bubleText ? (

              <View
                style={styles.buble}
              >

                <Text
                  style={styles.bubleText}
                >
                  {userData.bubleText}
                </Text>

              </View>

            ) : null}

          </View>


          {/* IDENTITY */}

          <View
            style={styles.identityBlock}
          >

            <Text
              style={styles.displayName}
            >
              {userData.displayName}
            </Text>

            <Text
              style={styles.username}
            >
              @{userData.username}
            </Text>


            <View
              style={styles.badgesRow}
            >

              {getPronouns(
                userData.gender
              ) && (

                <Text
                  style={styles.pronoun}
                >
                  {getPronouns(
                    userData.gender
                  )}
                </Text>

              )}


              {userData.gender ===
                'Male' && (

                <MaterialCommunityIcons
                  name="gender-male"
                  size={16}
                  color="#4DA8DA"
                />

              )}


              {userData.gender ===
                'Female' && (

                <MaterialCommunityIcons
                  name="gender-female"
                  size={16}
                  color="#E1306C"
                />

              )}

            </View>

          </View>

        </View>


        {/* TABS */}

        <View
          style={styles.tabContainer}
        >

          <TouchableOpacity
            onPress={() =>
              setActiveTab('Personal')
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
              setActiveTab('Social')
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


        {/* SOCIAL */}

        {activeTab === 'Social' ? (

          <View
            style={styles.tabContent}
          >

            <Text
              style={styles.sectionHeader}
            >
              Network Stats
            </Text>

            <Text
              style={styles.statLine}
            >
              Friends:{' '}
              {
                userData.socialStats
                  ?.friendsCount ?? 0
              }
            </Text>

            <Text
              style={styles.statLine}
            >
              Followers:{' '}
              {
                userData.socialStats
                  ?.followersCount ?? 0
              }
            </Text>

            <Text
              style={styles.statLine}
            >
              Mutual Friends:{' '}
              {
                userData.socialStats
                  ?.mutualFriends ?? 0
              }
            </Text>

            <Text
              style={styles.statLine}
            >
              Mutual Servers:{' '}
              {
                userData.socialStats
                  ?.mutualServers ?? 0
              }
            </Text>

            <Text
              style={styles.statLine}
            >
              Servers Joined:{' '}
              {
                userData.socialStats
                  ?.serversJoined ?? 0
              }
            </Text>

          </View>

        ) : (

          /* PERSONAL */

          <View
            style={styles.tabContent}
          >

            <Text
              style={styles.sectionHeader}
            >
              Bio 📄
            </Text>

            <Text
              style={styles.bioTextBody}
            >
              {userData.bio ||
                'No bio provided.'}
            </Text>


            <Text
              style={styles.sectionHeader}
            >
              Other Platforms
            </Text>


            {userData.otherPlatforms
              ?.length > 0 ? (

              userData.otherPlatforms.map(
                (plat, index) => (

                  <Text
                    key={index}
                    style={
                      styles.platformItem
                    }
                  >

                    <FontAwesome5
                      name={
                        plat.iconName ||
                        'link'
                      }
                      size={14}
                      color="#FFF"
                    />

                    {' '}

                    {plat.handle}

                  </Text>
                )
              )

            ) : (

              <Text
                style={styles.emptyText}
              >
                No platforms connected
              </Text>

            )}

          </View>

        )}

      </ScrollView>

    </View>
  );
}


// ==========================================
// STYLES
// ==========================================

const styles =
  StyleSheet.create({

    container: {
      flex: 1,
      backgroundColor: '#121212',
    },

    centered: {
      justifyContent: 'center',
      alignItems: 'center',
    },

    topBar: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      padding: 20,
      paddingTop: 50,
      backgroundColor: '#1A1A1A',
    },

    iconBtn: {
      padding: 5,
    },

    modalOverlay: {
      flex: 1,
      backgroundColor:
        'rgba(0,0,0,0.4)',
      justifyContent: 'flex-start',
      alignItems: 'flex-end',
    },

    dropdownMenu: {
      backgroundColor: '#2C2C2C',
      borderRadius: 8,
      marginTop: 90,
      marginRight: 20,
      width: 160,
      elevation: 5,
    },

    menuItem: {
      paddingVertical: 14,
      paddingHorizontal: 16,
    },

    menuText: {
      color: '#FFF',
      fontSize: 15,
    },

    divider: {
      height: 1,
      backgroundColor: '#3E3E3E',
    },

    headerContainer: {
      paddingBottom: 20,
    },

    banner: {
      height: 120,
      backgroundColor: '#2C2C2C',
      justifyContent: 'center',
      alignItems: 'center',
    },

    avatarSection: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginTop: -40,
      paddingHorizontal: 20,
    },

    avatarPlaceholder: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: '#444',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 4,
      borderColor: '#121212',
      overflow: 'hidden',
    },

    avatarImage: {
      width: '100%',
      height: '100%',
    },

    buble: {
      backgroundColor: '#333',
      padding: 8,
      borderRadius: 15,
      marginLeft: 10,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: '#555',
    },

    bubleText: {
      color: '#FFF',
      fontSize: 12,
    },

    identityBlock: {
      paddingHorizontal: 20,
      marginTop: 10,
    },

    displayName: {
      color: '#FFF',
      fontSize: 24,
      fontWeight: 'bold',
    },

    username: {
      color: '#AAA',
      fontSize: 14,
      marginBottom: 5,
    },

    badgesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    pronoun: {
      color: '#AAA',
      fontSize: 14,
    },

    tabContainer: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#333',
    },

    tab: {
      flex: 1,
      padding: 15,
      alignItems: 'center',
    },

    activeTab: {
      borderBottomWidth: 2,
      borderBottomColor: '#4DA8DA',
    },

    tabText: {
      color: '#888',
      fontSize: 16,
    },

    activeTabText: {
      color: '#4DA8DA',
      fontWeight: 'bold',
    },

    tabContent: {
      padding: 20,
    },

    sectionHeader: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: 'bold',
      marginTop: 15,
      marginBottom: 10,
    },

    bioTextBody: {
      color: '#DDD',
      fontSize: 14,
      lineHeight: 20,
    },

    platformItem: {
      color: '#DDD',
      fontSize: 14,
      marginBottom: 8,
    },

    emptyText: {
      color: '#666',
      fontStyle: 'italic',
    },

    statLine: {
      color: '#DDD',
      fontSize: 14,
      marginBottom: 12,
    },

  });