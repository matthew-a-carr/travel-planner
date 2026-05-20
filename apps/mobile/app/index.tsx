import { SafeAreaView, Text, View } from 'react-native';

export default function HelloScreen() {
  return (
    <SafeAreaView
      style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      testID="hello-screen-root"
    >
      <View
        style={{
          padding: 24,
          borderRadius: 12,
          backgroundColor: '#f4f4f5',
        }}
      >
        <Text style={{ fontSize: 24, fontWeight: '600' }} testID="hello-screen-greeting">
          Hello, Travel Planner
        </Text>
      </View>
    </SafeAreaView>
  );
}
