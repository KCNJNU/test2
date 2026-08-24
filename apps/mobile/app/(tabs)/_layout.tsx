import { Tabs } from 'expo-router';
export default function TabsLayout(){return <Tabs><Tabs.Screen name="devices" options={{title:'设备'}}/><Tabs.Screen name="tasks" options={{title:'任务'}}/><Tabs.Screen name="faults" options={{title:'告警'}}/><Tabs.Screen name="profile" options={{title:'我的'}}/></Tabs>}
