import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WorklightProvider } from './src/store/WorklightContext';
import RootNavigator from './src/navigation/RootNavigator';

export default function App(): React.ReactElement {
  return (
    <SafeAreaProvider>
      <WorklightProvider>
        <StatusBar style="auto" />
        <RootNavigator />
      </WorklightProvider>
    </SafeAreaProvider>
  );
}
