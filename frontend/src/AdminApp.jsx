import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Drawer,
  Form,
  Input,
  InputNumber,
  Layout,
  Menu,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
  message
} from 'antd';
import {
  DashboardOutlined,
  EditOutlined,
  FileSearchOutlined,
  LogoutOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  ScheduleOutlined,
  SearchOutlined,
  SettingOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { createApiClient } from './api';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;
const TROPE_PAGE_SIZE = 24;

const STATUS_COLORS = {
  machine: 'geekblue',
  reviewed: 'green',
  stale: 'orange'
};

function extractError(error) {
  if (typeof error?.response?.data?.detail === 'string') {
    return error.response.data.detail;
  }
  return error?.message || 'Unknown error';
}

export default function AdminApp() {
  const [messageApi, contextHolder] = message.useMessage();

  const [token, setToken] = useState(localStorage.getItem('auth_token') || '');
  const [selectedMenu, setSelectedMenu] = useState('dashboard');

  const [loginLoading, setLoginLoading] = useState(false);

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [tropes, setTropes] = useState([]);
  const [tropesLoading, setTropesLoading] = useState(false);
  const [tropeTotal, setTropeTotal] = useState(0);
  const [tropePage, setTropePage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [runs, setRuns] = useState([]);
  const [runsLoading, setRunsLoading] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [selectedTrope, setSelectedTrope] = useState(null);
  const [translationForm, setTranslationForm] = useState({
    translated_title: '',
    translated_summary: '',
    translated_content: '',
    status: 'reviewed'
  });

  const [createJobOpen, setCreateJobOpen] = useState(false);
  const [newJob, setNewJob] = useState({
    name: '',
    seed_url: 'https://tvtropes.org/pmwiki/pmwiki.php/Main/HomePage',
    interval_minutes: 30,
    max_pages_per_run: 200,
    crawl_scope: 'site',
    max_depth: 50,
    is_active: true
  });

  const [editJobOpen, setEditJobOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem('auth_token');
    setToken('');
  }, []);

  const api = useMemo(() => createApiClient(token, handleUnauthorized), [token, handleUnauthorized]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const { data } = await api.get('/api/v1/admin/stats');
      setStats(data);
    } catch (error) {
      messageApi.error(`加载统计失败: ${extractError(error)}`);
    } finally {
      setStatsLoading(false);
    }
  }, [api, messageApi]);

  const fetchTropes = useCallback(
    async (page = 1) => {
      setTropesLoading(true);
      try {
        const { data } = await api.get('/api/v1/tropes', {
          params: {
            page,
            page_size: TROPE_PAGE_SIZE,
            keyword: keyword || undefined,
            status: statusFilter || undefined
          }
        });
        setTropePage(page);
        setTropes(data.items || []);
        setTropeTotal(data.total || 0);
      } catch (error) {
        messageApi.error(`加载条目失败: ${extractError(error)}`);
      } finally {
        setTropesLoading(false);
      }
    },
    [api, keyword, messageApi, statusFilter]
  );

  const fetchJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const { data } = await api.get('/api/v1/jobs');
      setJobs(data || []);
    } catch (error) {
      messageApi.error(`加载任务失败: ${extractError(error)}`);
    } finally {
      setJobsLoading(false);
    }
  }, [api, messageApi]);

  const fetchRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const { data } = await api.get('/api/v1/jobs/runs');
      setRuns(data || []);
    } catch (error) {
      messageApi.error(`加载运行记录失败: ${extractError(error)}`);
    } finally {
      setRunsLoading(false);
    }
  }, [api, messageApi]);

  const loadAll = useCallback(async () => {
    await Promise.all([fetchStats(), fetchTropes(1), fetchJobs(), fetchRuns()]);
  }, [fetchJobs, fetchRuns, fetchStats, fetchTropes]);

  useEffect(() => {
    if (token) {
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleLogin = async (values) => {
    setLoginLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', values.username);
      formData.append('password', values.password);

      const tempClient = createApiClient();
      const { data } = await tempClient.post('/api/v1/auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      localStorage.setItem('auth_token', data.access_token);
      setToken(data.access_token);
      messageApi.success('登录成功');
    } catch (error) {
      messageApi.error(`登录失败: ${extractError(error)}`);
    } finally {
      setLoginLoading(false);
    }
  };

  const openEditor = async (tropeId) => {
    try {
      const { data } = await api.get(`/api/v1/tropes/${tropeId}`);
      setSelectedTrope(data);
      setTranslationForm({
        translated_title: data.translation?.translated_title || '',
        translated_summary: data.translation?.translated_summary || '',
        translated_content: data.translation?.translated_content || '',
        status: data.translation?.status || 'reviewed'
      });
      setEditorOpen(true);
    } catch (error) {
      messageApi.error(`加载详情失败: ${extractError(error)}`);
    }
  };

  const saveTranslation = async () => {
    if (!selectedTrope) return;

    setEditorSaving(true);
    try {
      await api.put(`/api/v1/tropes/${selectedTrope.id}/translation`, translationForm);
      messageApi.success('翻译已保存');
      setEditorOpen(false);
      await Promise.all([fetchTropes(tropePage), fetchStats()]);
    } catch (error) {
      messageApi.error(`保存失败: ${extractError(error)}`);
    } finally {
      setEditorSaving(false);
    }
  };

  const triggerJob = async (jobId) => {
    try {
      await api.post(`/api/v1/jobs/${jobId}/run`);
      messageApi.success('已触发执行');
      setTimeout(() => {
        fetchRuns();
        fetchStats();
      }, 1500);
    } catch (error) {
      messageApi.error(`触发失败: ${extractError(error)}`);
    }
  };

  const toggleJob = async (job) => {
    try {
      await api.patch(`/api/v1/jobs/${job.id}`, { is_active: !job.is_active });
      messageApi.success('任务状态已更新');
      await fetchJobs();
    } catch (error) {
      messageApi.error(`更新失败: ${extractError(error)}`);
    }
  };

  const createJob = async () => {
    try {
      await api.post('/api/v1/jobs', newJob);
      messageApi.success('任务已创建');
      setCreateJobOpen(false);
      setNewJob({
        name: '',
        seed_url: 'https://tvtropes.org/pmwiki/pmwiki.php/Main/HomePage',
        interval_minutes: 30,
        max_pages_per_run: 200,
        crawl_scope: 'site',
        max_depth: 50,
        is_active: true
      });
      await fetchJobs();
    } catch (error) {
      messageApi.error(`创建失败: ${extractError(error)}`);
    }
  };

  const openEditJob = (job) => {
    setEditingJob({ ...job });
    setEditJobOpen(true);
  };

  const saveEditJob = async () => {
    if (!editingJob) return;

    try {
      await api.patch(`/api/v1/jobs/${editingJob.id}`, {
        name: editingJob.name,
        seed_url: editingJob.seed_url,
        interval_minutes: Number(editingJob.interval_minutes),
        max_pages_per_run: Number(editingJob.max_pages_per_run),
        crawl_scope: editingJob.crawl_scope,
        max_depth: Number(editingJob.max_depth),
        is_active: editingJob.is_active
      });
      messageApi.success('任务已更新');
      setEditJobOpen(false);
      await fetchJobs();
    } catch (error) {
      messageApi.error(`保存任务失败: ${extractError(error)}`);
    }
  };

  const menuItems = [
    { key: 'dashboard', icon: <DashboardOutlined />, label: '总览' },
    { key: 'tropes', icon: <FileSearchOutlined />, label: '条目检索' },
    { key: 'jobs', icon: <ScheduleOutlined />, label: '抓取任务' },
    { key: 'runs', icon: <SettingOutlined />, label: '运行记录' }
  ];

  const tropeColumns = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    {
      title: '英文标题',
      dataIndex: 'title',
      render: (value, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.tvtropes_url}
          </Text>
        </Space>
      )
    },
    { title: '摘要', dataIndex: 'summary', ellipsis: true },
    {
      title: '翻译状态',
      dataIndex: 'translation_status',
      width: 120,
      render: (status) => {
        if (!status) return <Tag>none</Tag>;
        return <Tag color={STATUS_COLORS[status] || 'default'}>{status}</Tag>;
      }
    },
    {
      title: '抓取时间',
      dataIndex: 'fetched_at',
      width: 180,
      render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      width: 120,
      render: (_, record) => (
        <Button type="link" onClick={() => openEditor(record.id)}>
          编辑译文
        </Button>
      )
    }
  ];

  const jobColumns = [
    { title: '名称', dataIndex: 'name' },
    { title: '入口 URL', dataIndex: 'seed_url', ellipsis: true },
    {
      title: '范围',
      dataIndex: 'crawl_scope',
      width: 110,
      render: (value) => <Tag color={value === 'site' ? 'cyan' : 'blue'}>{value === 'site' ? '全站' : '种子'}</Tag>
    },
    { title: '间隔(分钟)', dataIndex: 'interval_minutes', width: 120 },
    { title: '每次页数', dataIndex: 'max_pages_per_run', width: 120 },
    { title: '最大深度', dataIndex: 'max_depth', width: 100 },
    {
      title: '队列进度',
      width: 260,
      render: (_, record) => (
        <Space size={4} wrap>
          <Tag color="default">待处理 {record.pending_urls ?? 0}</Tag>
          <Tag color="green">完成 {record.done_urls ?? 0}</Tag>
          <Tag color="red">失败 {record.failed_urls ?? 0}</Tag>
        </Space>
      )
    },
    {
      title: '启用',
      dataIndex: 'is_active',
      width: 100,
      render: (value, record) => <Switch checked={value} onChange={() => toggleJob(record)} />
    },
    {
      title: '下次执行',
      dataIndex: 'next_run_at',
      width: 180,
      render: (value) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-')
    },
    {
      title: '操作',
      width: 220,
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openEditJob(record)}>
            编辑
          </Button>
          <Button icon={<PlayCircleOutlined />} onClick={() => triggerJob(record.id)}>
            立即执行
          </Button>
        </Space>
      )
    }
  ];

  const runColumns = [
    { title: 'Run ID', dataIndex: 'id', width: 90 },
    { title: 'Job ID', dataIndex: 'job_id', width: 90 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (value) => <Tag color={value === 'success' ? 'green' : value === 'failed' ? 'red' : 'blue'}>{value}</Tag>
    },
    { title: '发现/保存', render: (_, record) => `${record.items_found} / ${record.items_saved}` },
    {
      title: '开始时间',
      dataIndex: 'started_at',
      width: 180,
      render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '结束时间',
      dataIndex: 'finished_at',
      width: 180,
      render: (value) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-')
    },
    { title: '错误', dataIndex: 'error_message', ellipsis: true }
  ];

  if (!token) {
    return (
      <div className="login-wrap">
        {contextHolder}
        <Card className="login-card" bordered={false}>
          <Title level={3}>TVTropes 中文站后台</Title>
          <Text type="secondary">登录后可管理抓取、翻译、审核和数据检索。</Text>
          <Form layout="vertical" onFinish={handleLogin} style={{ marginTop: 20 }}>
            <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input size="large" />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password size="large" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loginLoading} block size="large">
              登录后台
            </Button>
          </Form>
          <Alert
            style={{ marginTop: 16 }}
            type="info"
            showIcon
            message="默认账号"
            description="admin / admin123（请在部署后立即修改）"
          />
        </Card>
      </div>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {contextHolder}
      <Sider width={220} className="app-sider">
        <div className="brand">TVTropes Admin</div>
        <Menu
          mode="inline"
          selectedKeys={[selectedMenu]}
          items={menuItems}
          onClick={(event) => setSelectedMenu(event.key)}
          className="app-menu"
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <Title level={4} style={{ margin: 0 }}>
            中文站管理台
          </Title>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadAll}>
              刷新
            </Button>
            <Button
              danger
              icon={<LogoutOutlined />}
              onClick={() => {
                localStorage.removeItem('auth_token');
                setToken('');
              }}
            >
              退出
            </Button>
          </Space>
        </Header>
        <Content className="app-content">
          {selectedMenu === 'dashboard' && (
            <div>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={6}>
                  <Card loading={statsLoading}>
                    <Statistic title="原文条目" value={stats?.tropes_total || 0} />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Card loading={statsLoading}>
                    <Statistic title="译文总数" value={stats?.translations_total || 0} />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Card loading={statsLoading}>
                    <Statistic title="人工审核" value={stats?.reviewed_total || 0} />
                  </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Card loading={statsLoading}>
                    <Statistic title="活跃任务" value={stats?.jobs_active || 0} />
                  </Card>
                </Col>
              </Row>
              <Card style={{ marginTop: 16 }} loading={statsLoading}>
                <Space>
                  <Text>最近一次执行:</Text>
                  <Tag>{stats?.last_run_status || '-'}</Tag>
                  <Text type="secondary">
                    {stats?.last_run_at ? dayjs(stats.last_run_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
                  </Text>
                </Space>
              </Card>
            </div>
          )}

          {selectedMenu === 'tropes' && (
            <Card>
              <Space wrap style={{ marginBottom: 16 }}>
                <Input
                  style={{ width: 260 }}
                  placeholder="按标题/摘要检索"
                  prefix={<SearchOutlined />}
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  onPressEnter={() => fetchTropes(1)}
                />
                <Select
                  allowClear
                  placeholder="翻译状态"
                  style={{ width: 180 }}
                  value={statusFilter || undefined}
                  onChange={(value) => setStatusFilter(value || '')}
                  options={[
                    { label: 'machine', value: 'machine' },
                    { label: 'reviewed', value: 'reviewed' },
                    { label: 'stale', value: 'stale' }
                  ]}
                />
                <Button type="primary" onClick={() => fetchTropes(1)}>
                  搜索
                </Button>
                <Tag color="blue">总条目 {tropeTotal}</Tag>
              </Space>
              <Table
                rowKey="id"
                columns={tropeColumns}
                dataSource={tropes}
                loading={tropesLoading}
                pagination={{
                  current: tropePage,
                  pageSize: TROPE_PAGE_SIZE,
                  total: tropeTotal,
                  onChange: (page) => fetchTropes(page)
                }}
                scroll={{ x: 1200 }}
              />
            </Card>
          )}

          {selectedMenu === 'jobs' && (
            <Card
              extra={
                <Button type="primary" onClick={() => setCreateJobOpen(true)}>
                  新建任务
                </Button>
              }
            >
              <Table
                rowKey="id"
                columns={jobColumns}
                dataSource={jobs}
                loading={jobsLoading}
                pagination={false}
                scroll={{ x: 1200 }}
              />
            </Card>
          )}

          {selectedMenu === 'runs' && (
            <Card>
              <Table
                rowKey="id"
                columns={runColumns}
                dataSource={runs}
                loading={runsLoading}
                pagination={{ pageSize: 12 }}
                scroll={{ x: 1200 }}
              />
            </Card>
          )}
        </Content>
      </Layout>

      <Drawer
        title={selectedTrope?.title || '编辑译文'}
        width={900}
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        extra={
          <Button type="primary" onClick={saveTranslation} loading={editorSaving}>
            保存
          </Button>
        }
      >
        {selectedTrope && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Alert type="info" showIcon message={selectedTrope.tvtropes_url} />

            <Card size="small" title="原文摘要">
              <Text>{selectedTrope.summary}</Text>
            </Card>

            <Card size="small" title="原文正文">
              <div className="source-content">{selectedTrope.content_text}</div>
            </Card>

            <Card size="small" title="中文译文">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Input
                  placeholder="中文标题"
                  value={translationForm.translated_title}
                  onChange={(event) =>
                    setTranslationForm((prev) => ({ ...prev, translated_title: event.target.value }))
                  }
                />
                <Input.TextArea
                  rows={4}
                  placeholder="中文摘要"
                  value={translationForm.translated_summary}
                  onChange={(event) =>
                    setTranslationForm((prev) => ({ ...prev, translated_summary: event.target.value }))
                  }
                />
                <Input.TextArea
                  rows={12}
                  placeholder="中文正文"
                  value={translationForm.translated_content}
                  onChange={(event) =>
                    setTranslationForm((prev) => ({ ...prev, translated_content: event.target.value }))
                  }
                />
                <Select
                  value={translationForm.status}
                  onChange={(value) => setTranslationForm((prev) => ({ ...prev, status: value }))}
                  options={[
                    { label: 'machine', value: 'machine' },
                    { label: 'reviewed', value: 'reviewed' },
                    { label: 'stale', value: 'stale' }
                  ]}
                />
              </Space>
            </Card>
          </Space>
        )}
      </Drawer>

      <Modal
        title="新建抓取任务"
        open={createJobOpen}
        onCancel={() => setCreateJobOpen(false)}
        onOk={createJob}
        okText="创建"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input
            placeholder="任务名"
            value={newJob.name}
            onChange={(event) => setNewJob((prev) => ({ ...prev, name: event.target.value }))}
          />
          <Input
            placeholder="入口 URL"
            value={newJob.seed_url}
            onChange={(event) => setNewJob((prev) => ({ ...prev, seed_url: event.target.value }))}
          />
          <Space>
            <div>
              <Text type="secondary">间隔(分钟)</Text>
              <InputNumber
                min={5}
                value={newJob.interval_minutes}
                onChange={(value) =>
                  setNewJob((prev) => ({ ...prev, interval_minutes: Number(value || 30) }))
                }
              />
            </div>
            <div>
              <Text type="secondary">每次页数</Text>
              <InputNumber
                min={1}
                max={2000}
                value={newJob.max_pages_per_run}
                onChange={(value) =>
                  setNewJob((prev) => ({ ...prev, max_pages_per_run: Number(value || 200) }))
                }
              />
            </div>
          </Space>
          <Space>
            <div>
              <Text type="secondary">抓取范围</Text>
              <Select
                style={{ width: 140 }}
                value={newJob.crawl_scope}
                options={[
                  { label: '全站 (site)', value: 'site' },
                  { label: '种子 (seed)', value: 'seed' }
                ]}
                onChange={(value) => setNewJob((prev) => ({ ...prev, crawl_scope: value }))}
              />
            </div>
            <div>
              <Text type="secondary">最大深度</Text>
              <InputNumber
                min={1}
                max={500}
                value={newJob.max_depth}
                onChange={(value) => setNewJob((prev) => ({ ...prev, max_depth: Number(value || 50) }))}
              />
            </div>
          </Space>
          <Space>
            <Text>是否启用</Text>
            <Switch
              checked={newJob.is_active}
              onChange={(checked) => setNewJob((prev) => ({ ...prev, is_active: checked }))}
            />
          </Space>
        </Space>
      </Modal>

      <Modal
        title="编辑抓取任务"
        open={editJobOpen}
        onCancel={() => setEditJobOpen(false)}
        onOk={saveEditJob}
        okText="保存"
      >
        {editingJob && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Input
              placeholder="任务名"
              value={editingJob.name}
              onChange={(event) => setEditingJob((prev) => ({ ...prev, name: event.target.value }))}
            />
            <Input
              placeholder="入口 URL"
              value={editingJob.seed_url}
              onChange={(event) => setEditingJob((prev) => ({ ...prev, seed_url: event.target.value }))}
            />
            <Space>
              <div>
                <Text type="secondary">间隔(分钟)</Text>
                <InputNumber
                min={5}
                value={editingJob.interval_minutes}
                onChange={(value) =>
                    setEditingJob((prev) => ({ ...prev, interval_minutes: Number(value || 30) }))
                }
              />
              </div>
              <div>
                <Text type="secondary">每次页数</Text>
                <InputNumber
                  min={1}
                  max={2000}
                  value={editingJob.max_pages_per_run}
                  onChange={(value) =>
                    setEditingJob((prev) => ({ ...prev, max_pages_per_run: Number(value || 200) }))
                  }
                />
              </div>
            </Space>
            <Space>
              <div>
                <Text type="secondary">抓取范围</Text>
                <Select
                  style={{ width: 140 }}
                  value={editingJob.crawl_scope}
                  options={[
                    { label: '全站 (site)', value: 'site' },
                    { label: '种子 (seed)', value: 'seed' }
                  ]}
                  onChange={(value) => setEditingJob((prev) => ({ ...prev, crawl_scope: value }))}
                />
              </div>
              <div>
                <Text type="secondary">最大深度</Text>
                <InputNumber
                  min={1}
                  max={500}
                  value={editingJob.max_depth}
                  onChange={(value) =>
                    setEditingJob((prev) => ({ ...prev, max_depth: Number(value || 50) }))
                  }
                />
              </div>
            </Space>
            <Space>
              <Text>是否启用</Text>
              <Switch
                checked={editingJob.is_active}
                onChange={(checked) => setEditingJob((prev) => ({ ...prev, is_active: checked }))}
              />
            </Space>
          </Space>
        )}
      </Modal>
    </Layout>
  );
}
