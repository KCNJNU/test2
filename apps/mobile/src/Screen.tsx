import NetInfo from '@react-native-community/netinfo';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, FlatList, RefreshControl, SafeAreaView, Text, View } from 'react-native';
import { platform } from './api';
import { allowedTaskActions, type TaskAction } from './safety';

type ResourceKind = 'robots' | 'tasks' | 'faults';
type ResourceItem = { id: string; robotName?: string; name?: string; safeCode?: string; onlineStatus?: string; status?: string; severity?: string; lastTelemetryAt?: string; lastStatusAt?: string; startAt?: string; handlingStatus?: string };

export function ResourceScreen({ kind }: { kind: ResourceKind }) {
  const [online, setOnline] = useState(true);
  const [pendingId, setPendingId] = useState<string>();
  useEffect(() => NetInfo.addEventListener((state) => setOnline(Boolean(state.isConnected))), []);
  const query = useQuery<{ items: ResourceItem[] }>({ queryKey: [kind], queryFn: platform[kind], refetchInterval: online ? 10_000 : false });

  const runTaskAction = async (id: string, action: TaskAction) => {
    setPendingId(id);
    try {
      await platform.action(id, action);
      await query.refetch();
    } catch (error) {
      Alert.alert('操作失败', error instanceof Error ? error.message : '任务命令未受理');
    } finally { setPendingId(undefined); }
  };
  const acknowledge = async (id: string) => {
    setPendingId(id);
    try {
      await platform.ack(id);
      await query.refetch();
    } catch (error) {
      Alert.alert('确认失败', error instanceof Error ? error.message : '告警确认未受理');
    } finally { setPendingId(undefined); }
  };

  if (query.isLoading) return <ActivityIndicator accessibilityLabel="正在加载事实数据" />;
  return <SafeAreaView style={{ flex: 1, padding: 16 }}>
    {!online && <Text style={{ backgroundColor: '#fff3cd', padding: 10 }}>离线：显示最近成功快照，不会排队执行控制命令 · {query.dataUpdatedAt ? new Date(query.dataUpdatedAt).toLocaleString() : '尚无快照'}</Text>}
    {query.isError && <Text accessibilityRole="alert" style={{ backgroundColor: '#fdecea', color: '#b71c1c', padding: 10 }}>加载失败：{query.error instanceof Error ? query.error.message : '未知错误'}</Text>}
    <FlatList
      data={query.data?.items ?? []}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={query.isFetching} onRefresh={() => void query.refetch()} />}
      renderItem={({ item }) => <View style={{ padding: 16, marginVertical: 6, borderWidth: 1, borderColor: '#ddd', borderRadius: 10 }}>
        <Text style={{ fontWeight: '700', fontSize: 17 }}>{item.robotName ?? item.name ?? item.safeCode}</Text>
        <Text>{item.onlineStatus ?? item.status ?? item.severity}</Text>
        <Text style={{ color: '#666' }}>{item.lastTelemetryAt ?? item.lastStatusAt ?? item.startAt ?? '暂无设备时间戳'}</Text>
        {kind === 'tasks' && allowedTaskActions(item.status ?? '', online).map((action) => <Button key={action} title={taskActionLabel(action)} disabled={pendingId === item.id} onPress={() => void runTaskAction(item.id, action)} />)}
        {kind === 'faults' && online && item.handlingStatus === 'OPEN' && <Button title="确认告警（不解除 SAFE）" disabled={pendingId === item.id} onPress={() => void acknowledge(item.id)} />}
      </View>}
      ListEmptyComponent={<Text>暂无事实数据</Text>}
    />
  </SafeAreaView>;
}

function taskActionLabel(action: TaskAction) {
  return ({ start: '开始', pause: '暂停', resume: '继续', cancel: '取消' } satisfies Record<TaskAction, string>)[action];
}
