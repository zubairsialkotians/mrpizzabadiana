import React from 'react';
import { Keyboard, Platform, View } from 'react-native';

// Shared by posappmobile and Online Shop (keep both copies in sync).
// Tapping empty space anywhere in the app hides the keyboard. Buttons, inputs
// and lists still receive their own touches first; only unhandled taps reach here.
// onResponderGrant returns false so the native ScrollView can still take over
// the gesture (a Pressable here blocks scrolling on Android).
// Skipped on web, where it would steal focus from text fields.
export default function DismissKeyboard({ children }) {
  if (Platform.OS === 'web') return children;
  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponder={() => Keyboard.isVisible()}
      onResponderGrant={() => false}
      onResponderTerminationRequest={() => true}
      onResponderRelease={() => Keyboard.dismiss()}
    >
      {children}
    </View>
  );
}
