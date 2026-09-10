import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, 
  SafeAreaView, FlatList, ScrollView, TextInput 
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, Feather, FontAwesome5, FontAwesome } from '@expo/vector-icons';

export default function ChatScreen() {
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Real system state: Starts completely blank.
  const [chats, setChats] = useState([]);

  // This is where Firebase Firestore will connect to fetch REAL friends
  useEffect(() => {
    // TODO: Add Firebase onSnapshot listener here to sync live chats
    // setChats(realDataFromFirebase);
  }, []);

  // Sorting Engine: Urgent (1) > Favorite (2) > Normal HTL (3)
  const sortChats = (chatList) => {
    return chatList.sort((a, b) => {
      const rank = { urgent: 1, favorite: 2, normal: 3 };
      return rank[a.type] - rank[b.type]; 
    });
  };

  const getFilteredChats = () => {
    let filtered = chats;
    if (activeTab === 'Recent') filtered = chats.filter(c => c.type === 'normal' || c.type === 'urgent' || c.type === 'favorite'); 
    if (activeTab === 'Urgent') filtered = chats.filter(c => c.type === 'urgent');
    if (activeTab === 'Favorite') filtered = chats.filter(c => c.type === 'favorite');
    
    return sortChats(filtered);
  };

  // Rendering the specific •, !, and ♡ indicators
  const renderStatusIcon = (type) => {
    if (type === 'urgent') return <FontAwesome5 name="exclamation" size={14} color="#FF3366" />;
    if (type === 'favorite') return <Ionicons name="heart" size={14} color="#00D2FF" />;
    return <FontAwesome name="circle" size={8} color="#8E8EA0" />; 
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Top Action Bar */}
      <View style={styles.topBar}>
        <Text style={styles.headerTitle}>CHATS</Text>
        <View style={styles.topIcons}>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="options-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <Feather name="mail" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <Feather name="user-plus" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Friends Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#8E8EA0" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by username"
          placeholderTextColor="#8E8EA0"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
      </View>

      {/* Horizontal Tabs */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['All', 'Recent', 'Urgent', 'Favorite', 'Groups'].map((tab) => (
            <TouchableOpacity 
              key={tab} 
              style={[styles.tabButton, activeTab === tab && styles.activeTabButton]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
              {tab === 'Groups' && <Feather name="plus" size={14} color="#8E8EA0" style={{ marginLeft: 4 }} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Chat List (Empty State Ready) */}
      <FlatList
        data={getFilteredChats()}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No chats yet. Search for a username to start!</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.chatCard}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={24} color="#8E8EA0" />
            </View>
            <View style={styles.chatInfo}>
              <Text style={styles.chatName}>{item.name}</Text>
              <Text style={styles.chatMessage} numberOfLines={1}>{item.message}</Text>
            </View>
            <View style={styles.chatMeta}>
              <Text style={styles.timeText}>{item.time}</Text>
              <View style={styles.statusIconContainer}>
                {renderStatusIcon(item.type)}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="sparkles" size={22} color="#8E8EA0" />
          <Text style={styles.navText}>AI</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="layers-outline" size={24} color="#8E8EA0" />
          <Text style={styles.navText}>Servers</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="chatbubble-ellipses" size={24} color="#00D2FF" />
          <Text style={[styles.navText, { color: '#00D2FF' }]}>Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="search" size={24} color="#8E8EA0" />
          <Text style={styles.navText}>Search</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Feather name="user" size={24} color="#8E8EA0" />
          <Text style={styles.navText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15 },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold', letterSpacing: 1 },
  topIcons: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { marginLeft: 22 },

  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0D0D12', marginHorizontal: 20, borderRadius: 12, paddingHorizontal: 16, marginBottom: 20, borderWidth: 1, borderColor: '#22222E' },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, color: '#FFFFFF', paddingVertical: 14, fontSize: 15 },

  tabContainer: { borderBottomWidth: 1, borderBottomColor: '#22222E', paddingBottom: 15, paddingHorizontal: 10 },
  tabButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10, marginHorizontal: 6, borderRadius: 24, backgroundColor: '#0D0D12', borderWidth: 1, borderColor: '#22222E' },
  activeTabButton: { backgroundColor: '#22222E', borderColor: '#333344' },
  tabText: { color: '#8E8EA0', fontSize: 14, fontWeight: '700' },
  activeTabText: { color: '#FFFFFF' },

  listContainer: { padding: 16, paddingBottom: 40 },
  emptyText: { color: '#8E8EA0', textAlign: 'center', marginTop: 40, fontSize: 15 },
  chatCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0D0D12', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#22222E' },
  avatarCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#14141C', borderWidth: 1, borderColor: '#22222E', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  chatInfo: { flex: 1 },
  chatName: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  chatMessage: { color: '#8E8EA0', fontSize: 14 },
  
  chatMeta: { alignItems: 'flex-end', justifyContent: 'center', paddingLeft: 10 },
  timeText: { color: '#8E8EA0', fontSize: 12, marginBottom: 8, fontWeight: '600' },
  statusIconContainer: { height: 16, justifyContent: 'center' },

  bottomNav: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: '#0D0D12', paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#22222E', paddingBottom: 25 },
  navItem: { alignItems: 'center', justifyContent: 'center' },
  navText: { color: '#8E8EA0', fontSize: 11, marginTop: 6, fontWeight: '700' }
});

