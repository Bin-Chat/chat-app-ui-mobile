# Chat App - Mobile

React Native mobile application built with Expo and TypeScript.

## Features

- 📱 Cross-platform (iOS, Android, Web)
- 🔐 Authentication
- 💬 Real-time chat with WebSocket
- 🎨 Modern UI with React Native
- 🚀 Fast navigation with Expo Router
- 📦 State management with Zustand
- 🔄 API integration with Axios
- 🧪 TypeScript for type safety

## Tech Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **Navigation**: Expo Router
- **State Management**: Zustand
- **API Client**: Axios
- **Real-time**: Socket.io-client
- **UI**: React Native built-in components

## Prerequisites

- Node.js 18+
- npm 9+
- Expo CLI
- iOS Simulator (Mac) or Android Emulator

## Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run on specific platform
npm run android  # Android
npm run ios      # iOS
npm run web      # Web browser
```

## Project Structure

```
apps/mobile/
├── app/                # Expo Router pages
│   ├── _layout.tsx    # Root layout
│   ├── index.tsx      # Home screen
│   ├── login.tsx      # Login screen
│   └── chat.tsx       # Chat screen
├── src/
│   ├── services/      # API and Socket services
│   ├── store/         # Zustand stores
│   ├── components/    # Reusable components
│   ├── types/         # TypeScript types
│   └── utils/         # Utility functions
├── assets/            # Images, fonts, etc.
├── app.json          # Expo configuration
├── babel.config.js   # Babel configuration
├── package.json      # Dependencies
└── tsconfig.json     # TypeScript config
```

## Environment Variables

Create a `.env` file in the mobile directory:

```env
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_SOCKET_URL=http://localhost:8080
```

## Development

```bash
# Start with clear cache
npm run dev -- --clear

# Run tests
npm test

# Lint code
npm run lint

# Build for production
npm run build:android
npm run build:ios
```

## Building for Production

### Android

```bash
# Build APK
eas build --platform android --profile preview

# Build AAB for Play Store
eas build --platform android --profile production
```

### iOS

```bash
# Build for simulator
eas build --platform ios --profile preview

# Build for App Store
eas build --platform ios --profile production
```

## API Integration

The app connects to the backend services:

- **Auth Service**: Port 3001 - Authentication
- **User Service**: Port 3002 - User management
- **Chat Service**: Port 8080 - Real-time chat

## Features Roadmap

- [ ] Push notifications
- [ ] Image/file sharing
- [ ] Voice messages
- [ ] Group chats
- [ ] User presence
- [ ] Message reactions
- [ ] Dark mode
- [ ] Offline support

## Learn More

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
