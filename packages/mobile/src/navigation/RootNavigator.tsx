import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../store/WorklightContext';

import TodayScreen from '../screens/TodayScreen';
import CalendarScreen from '../screens/CalendarScreen';
import TasksScreen from '../screens/TasksScreen';
import ProjectsScreen from '../screens/ProjectsScreen';
import MoreScreen from '../screens/MoreScreen';
import LogScreen from '../screens/LogScreen';
import IdeasScreen from '../screens/IdeasScreen';
import GithubScreen from '../screens/GithubScreen';
import SettingsScreen from '../screens/SettingsScreen';

export type TabParamList = {
  Today: undefined;
  Calendar: undefined;
  Tasks: undefined;
  Projects: undefined;
  More: undefined;
};

export type MoreStackParamList = {
  MoreHome: undefined;
  Log: undefined;
  Ideas: undefined;
  Github: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const MoreStack = createNativeStackNavigator<MoreStackParamList>();

function MoreStackNavigator(): React.ReactElement {
  const theme = useTheme();
  return (
    <MoreStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.ink,
        headerShadowVisible: false,
      }}
    >
      <MoreStack.Screen name="MoreHome" component={MoreScreen} options={{ title: 'More' }} />
      <MoreStack.Screen name="Log" component={LogScreen} options={{ title: 'Progress log' }} />
      <MoreStack.Screen name="Ideas" component={IdeasScreen} options={{ title: 'Creative hub' }} />
      <MoreStack.Screen name="Github" component={GithubScreen} options={{ title: 'GitHub' }} />
      <MoreStack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </MoreStack.Navigator>
  );
}

export default function RootNavigator(): React.ReactElement {
  const theme = useTheme();

  const navTheme = {
    ...(theme.scheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme.scheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: theme.bg,
      card: theme.surface,
      text: theme.ink,
      border: theme.border,
      primary: theme.accent,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.ink,
          headerShadowVisible: false,
          tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: theme.inkFaint,
        }}
      >
        <Tab.Screen name="Today" component={TodayScreen} />
        <Tab.Screen name="Calendar" component={CalendarScreen} />
        <Tab.Screen name="Tasks" component={TasksScreen} />
        <Tab.Screen name="Projects" component={ProjectsScreen} />
        <Tab.Screen name="More" component={MoreStackNavigator} options={{ headerShown: false }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
