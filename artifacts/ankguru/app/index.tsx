import { Redirect } from 'expo-router';

export default function Index() {
  // Temporarily redirect to ASR prototype screen for testing
  // @ts-ignore
  return <Redirect href="/standalone-asr" />;
}