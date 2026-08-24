import { DatabaseOutlined, FileOutlined, FolderOutlined, RobotOutlined, SearchOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Empty, Input, List, Modal, Skeleton, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type SearchItem } from '../services/api';
import { useUnsavedChanges } from './UnsavedChanges';

const recentKey = 'robot-platform-v2-search-recent';
export function CommandPalette({ open, onClose, onCreateDataset }: { open: boolean; onClose: () => void; onCreateDataset: () => void }) {
  const [value, setValue] = useState(''); const [query, setQuery] = useState(''); const navigate = useNavigate(); const { confirmDiscard } = useUnsavedChanges();
  useEffect(() => { const handle = window.setTimeout(() => setQuery(value.trim()), 250); return () => window.clearTimeout(handle); }, [value]);
  useEffect(() => { const keydown = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); if (open) onClose(); else document.querySelector<HTMLButtonElement>('.global-search-button')?.click(); } }; window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown); }, [open, onClose]);
  useEffect(() => { if (!open) { setValue(''); setQuery(''); } }, [open]);
  const result = useQuery({ queryKey: ['search', query], queryFn: () => api.search(query), enabled: open && query.length > 0 });
  const items = useMemo(() => result.data ? Object.values(result.data.groups).flat() : [], [result.data]);
  const commands: SearchItem[] = [{ type: 'file', id: 'command-upload', title: 'Upload files', subtitle: 'Open Upload Center' }, { type: 'dataset', id: 'command-dataset', title: 'Create dataset', subtitle: 'Organize robot files' }, { type: 'robot', id: 'command-robots', title: 'Go to Robots', subtitle: 'Open fleet management' }];
  const select = (item: SearchItem) => {
    if (item.id === 'command-dataset') { onCreateDataset(); return; }
    confirmDiscard(() => {
      const recent = JSON.parse(localStorage.getItem(recentKey) ?? '[]') as SearchItem[];
      localStorage.setItem(recentKey, JSON.stringify([item, ...recent.filter((entry) => entry.id !== item.id)].slice(0, 5)));
      if (item.id === 'command-upload') navigate('/upload'); else if (item.id === 'command-robots') navigate('/robots'); else if (item.type === 'robot') navigate(`/robots?robot=${item.id}`); else if (item.type === 'file') navigate(`/files?file=${item.id}`); else if (item.type === 'dataset') navigate(`/datasets/${item.id}`); else navigate(`/datasets/${item.datasetId}/versions/${item.id}`);
      onClose();
    });
  };
  const displayed = query ? items : commands;
  return <Modal open={open} onCancel={onClose} footer={null} width={680} className="command-modal" title={null} destroyOnHidden><Input autoFocus size="large" variant="borderless" prefix={<SearchOutlined />} placeholder="Search robots, files, datasets, versions, object keys or checksums" value={value} onChange={(event) => setValue(event.target.value)} /><div className="command-results">{result.isFetching ? <Skeleton active paragraph={{ rows: 4 }} /> : displayed.length ? <List dataSource={displayed} renderItem={(item) => <List.Item className="command-result" onClick={() => select(item)}><span className="command-icon">{item.type === 'robot' ? <RobotOutlined /> : item.type === 'file' ? <FileOutlined /> : item.type === 'dataset' ? <FolderOutlined /> : <DatabaseOutlined />}</span><List.Item.Meta title={item.title} description={item.subtitle} /><Typography.Text type="secondary">Enter</Typography.Text></List.Item>} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No matching platform resources" />}</div></Modal>;
}
