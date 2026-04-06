import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { useState, useRef } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Send } from 'lucide-react-native';

type Message = {
  id: string;
  text: string;
  sender: 'me' | 'other';
  timestamp: Date;
};

export default function ChatScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name?: string }>();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([
    { id: '1', text: 'Xin chào! Có gì cần nói không?', sender: 'other', timestamp: new Date() },
  ]);
  const [inputText, setInputText] = useState('');

  const sendMessage = () => {
    if (!inputText.trim()) return;
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), text: inputText.trim(), sender: 'me', timestamp: new Date() },
    ]);
    setInputText('');
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View className={`mb-2 max-w-[78%] ${item.sender === 'me' ? 'self-end' : 'self-start'}`}>
      <View
        className={`px-4 py-2.5 rounded-2xl ${
          item.sender === 'me'
            ? 'bg-primary rounded-br-sm'
            : 'bg-white border border-gray-100 rounded-bl-sm'
        }`}
      >
        <Text
          className={`text-sm leading-5 ${item.sender === 'me' ? 'text-white' : 'text-gray-800'}`}
        >
          {item.text}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
          <ArrowLeft size={22} color="#374151" />
        </TouchableOpacity>
        <View className="w-9 h-9 rounded-full bg-primary items-center justify-center mr-3">
          <Text className="text-white text-sm font-semibold">{(name ?? 'U')[0].toUpperCase()}</Text>
        </View>
        <Text className="text-base font-semibold text-gray-900 flex-1" numberOfLines={1}>
          {name ?? 'Chat'}
        </Text>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Input bar */}
        <View className="flex-row items-end px-3 py-2 bg-white border-t border-gray-100 gap-2">
          <TextInput
            className="flex-1 bg-gray-100 rounded-2xl px-4 py-2.5 text-gray-900 text-sm max-h-28"
            placeholder="Nhập tin nhắn..."
            placeholderTextColor="#9ca3af"
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity
            onPress={sendMessage}
            disabled={!inputText.trim()}
            className={`w-10 h-10 rounded-full items-center justify-center ${
              inputText.trim() ? 'bg-primary' : 'bg-gray-200'
            }`}
          >
            <Send size={18} color={inputText.trim() ? '#fff' : '#9ca3af'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
