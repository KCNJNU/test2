import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
const client=new QueryClient({defaultOptions:{queries:{retry:1,staleTime:10_000}}});
export default function Root(){return <QueryClientProvider client={client}><Stack screenOptions={{headerShown:false}} /></QueryClientProvider>}
