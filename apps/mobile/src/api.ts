import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const configuredBase = process.env.EXPO_PUBLIC_API_BASE_URL ?? Constants.expoConfig?.extra?.apiBaseUrl;
if (typeof configuredBase !== 'string' || !configuredBase.trim()) throw new Error('EXPO_PUBLIC_API_BASE_URL is required');
const base = configuredBase.replace(/\/$/, '');
const TOKEN = 'robot_ops_session';
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await SecureStore.getItemAsync(TOKEN); const response = await fetch(`${base}${path}`, { ...init, headers: { 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}), ...init?.headers } });
  if (!response.ok) throw new Error((await response.json().catch(()=>({message:response.statusText}))).message ?? '请求失败'); return response.json();
}
export async function login(email:string,password:string){const result=await request<{accessToken:string;user:unknown}>('/mobile/sessions',{method:'POST',body:JSON.stringify({email,password})});await SecureStore.setItemAsync(TOKEN,result.accessToken);return result.user;}
export async function logout(){await SecureStore.deleteItemAsync(TOKEN);}
export const platform={robots:()=>request<any>('/robots'),tasks:()=>request<any>('/tasks'),faults:()=>request<any>('/faults'),action:(id:string,action:string)=>request(`/tasks/${id}/${action}`,{method:'POST',headers:{'Idempotency-Key':crypto.randomUUID()}}),ack:(id:string)=>request(`/faults/${id}/acknowledge`,{method:'POST',body:JSON.stringify({note:'移动端确认'})}),registerPush:(token:string)=>request('/mobile/push-tokens',{method:'POST',body:JSON.stringify({token,platform:'EXPO'})})};
