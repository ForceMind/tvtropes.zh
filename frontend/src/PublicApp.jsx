import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Drawer,
  Empty,
  Input,
  Layout,
  List,
  Pagination,
  Segmented,
  Space,
  Spin,
  Tag,
  Typography,
  message
} from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import { createApiClient } from './api';

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

const MOBILE_BREAKPOINT = 992;

function extractError(error) {
  if (typeof error?.response?.data?.detail === 'string') {
    return error.response.data.detail;
  }
  return error?.message || 'Unknown error';
}

function filterItems(items, filter) {
  if (filter === 'translated') {
    return items.filter((item) => item.has_translation);
  }
  if (filter === 'untranslated') {
    return items.filter((item) => !item.has_translation);
  }
  return items;
}

export default function PublicApp() {
  const [messageApi, contextHolder] = message.useMessage();
  const api = useMemo(() => createApiClient(), []);

  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterType, setFilterType] = useState('all');

  const [activeId, setActiveId] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  );

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileDetailOpen(false);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const pageSize = isMobile ? 12 : 24;

  const translatedCount = useMemo(
    () => items.filter((item) => item.has_translation).length,
    [items]
  );

  const visibleItems = useMemo(
    () => filterItems(items, filterType),
    [filterType, items]
  );

  const fetchDetail = useCallback(
    async (id) => {
      if (!id) return null;
      setDetailLoading(true);
      try {
        const { data } = await api.get(`/api/v1/public/tropes/${id}`);
        setDetail(data);
        setActiveId(id);
        return data;
      } catch (error) {
        messageApi.error(`详情加载失败: ${extractError(error)}`);
        return null;
      } finally {
        setDetailLoading(false);
      }
    },
    [api, messageApi]
  );

  const openDetail = useCallback(
    async (id) => {
      const loaded = await fetchDetail(id);
      if (isMobile && loaded) {
        setMobileDetailOpen(true);
      }
    },
    [fetchDetail, isMobile]
  );

  const fetchList = useCallback(
    async (nextPage = 1) => {
      setLoading(true);
      try {
        const { data } = await api.get('/api/v1/public/tropes', {
          params: {
            page: nextPage,
            page_size: pageSize,
            keyword: keyword || undefined
          }
        });

        const nextItems = data.items || [];
        setItems(nextItems);
        setTotal(data.total || 0);
        setPage(nextPage);

        if (nextItems.length === 0) {
          setActiveId(null);
          setDetail(null);
          return;
        }

        if (!isMobile) {
          const stillExists = nextItems.some((item) => item.id === activeId);
          const targetId = stillExists ? activeId : nextItems[0].id;
          if (targetId) {
            await fetchDetail(targetId);
          }
        }
      } catch (error) {
        messageApi.error(`加载失败: ${extractError(error)}`);
      } finally {
        setLoading(false);
      }
    },
    [activeId, api, fetchDetail, isMobile, keyword, messageApi, pageSize]
  );

  useEffect(() => {
    fetchList(1);
  }, [fetchList]);

  const detailPane = (
    <Space direction="vertical" style={{ width: '100%' }} size={14}>
      <Card size="small" title="中文摘要" className="detail-block">
        <Text>{detail?.summary_zh || '暂无中文摘要'}</Text>
      </Card>
      <Card size="small" title="中文正文" className="detail-block">
        <div className="source-content">{detail?.content_zh || '暂无中文正文'}</div>
      </Card>
      <Card size="small" title="英文原文（参考）" className="detail-block">
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Text strong>{detail?.title_en || '-'}</Text>
          <Text>{detail?.summary_en || '-'}</Text>
          <div className="source-content">{detail?.content_en || '-'}</div>
        </Space>
      </Card>
    </Space>
  );

  return (
    <Layout className="public-wrap">
      {contextHolder}
      <div className="public-grid-overlay" aria-hidden />
      <div className="cube-scene" aria-hidden>
        <div className="cube cube-one" />
        <div className="cube cube-two" />
        <div className="cube cube-three" />
      </div>

      <Header className="public-header">
        <div className="public-header-inner">
          <Space size={10}>
            <Title level={3} style={{ margin: 0 }}>
              TVTropes 中文站
            </Title>
            <Tag color="cyan" className="public-status-pill">
              Tech Index
            </Tag>
          </Space>
          <Text type="secondary" className="public-clock">
            {dayjs().format('YYYY-MM-DD HH:mm')}
          </Text>
        </div>
      </Header>

      <Content className="public-content">
        <section className="hero-panel">
          <div className="hero-main">
            <Tag color="geekblue" className="hero-chip">
              texta.studio 风格 · 工作台检索
            </Tag>
            <Title className="hero-title">中文镜像检索中枢</Title>
            <Paragraph className="hero-desc">
              针对移动端和桌面端分别优化：桌面双栏并行浏览，移动端使用底部抽屉查看详情，减少来回跳转。
            </Paragraph>
            <Space wrap className="hero-actions">
              <Input
                size="large"
                className="hero-search"
                placeholder="搜索中文/英文 trope"
                prefix={<SearchOutlined />}
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                onPressEnter={() => fetchList(1)}
              />
              <Button type="primary" size="large" onClick={() => fetchList(1)}>
                搜索
              </Button>
              <Button size="large" icon={<ReloadOutlined />} onClick={() => fetchList(1)}>
                刷新
              </Button>
            </Space>
          </div>
          <div className="hero-metrics">
            <div className="metric-card">
              <Text type="secondary">当前页条目</Text>
              <Title level={2}>{items.length}</Title>
            </div>
            <div className="metric-card">
              <Text type="secondary">中文覆盖</Text>
              <Title level={2}>{translatedCount}</Title>
            </div>
            <div className="metric-card">
              <Text type="secondary">检索总量</Text>
              <Title level={2}>{total}</Title>
            </div>
          </div>
        </section>

        <section className="public-controls">
          <Segmented
            value={filterType}
            onChange={setFilterType}
            options={[
              { label: '全部', value: 'all' },
              { label: '已翻译', value: 'translated' },
              { label: '待翻译', value: 'untranslated' }
            ]}
          />
          <Tag color="blue">显示 {visibleItems.length} 条</Tag>
        </section>

        <section className="public-workbench">
          <Card className="workbench-list" title={`结果列表 (${total})`}>
            {loading ? (
              <div className="loading-wrap">
                <Spin />
              </div>
            ) : visibleItems.length === 0 ? (
              <Empty description="暂无匹配数据" />
            ) : (
              <>
                <List
                  itemLayout="vertical"
                  dataSource={visibleItems}
                  renderItem={(item) => (
                    <List.Item
                      className={item.id === activeId ? 'result-item result-item-active' : 'result-item'}
                      onClick={() => openDetail(item.id)}
                    >
                      <Space direction="vertical" size={6} style={{ width: '100%' }}>
                        <Space>
                          <Text strong className="result-title">
                            {item.title}
                          </Text>
                          <Tag color={item.has_translation ? 'green' : 'orange'}>
                            {item.has_translation ? '中文已生成' : '仅英文'}
                          </Tag>
                        </Space>
                        <Paragraph ellipsis={{ rows: isMobile ? 2 : 3 }} style={{ marginBottom: 0 }}>
                          {item.summary}
                        </Paragraph>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          更新时间 {dayjs(item.updated_at).format('YYYY-MM-DD HH:mm')}
                        </Text>
                      </Space>
                    </List.Item>
                  )}
                />
                <div className="pager-wrap">
                  <Pagination
                    current={page}
                    total={total}
                    pageSize={pageSize}
                    showSizeChanger={false}
                    onChange={(nextPage) => fetchList(nextPage)}
                  />
                </div>
              </>
            )}
          </Card>

          {!isMobile && (
            <Card className="workbench-detail" title={detail?.title_zh || detail?.title_en || '详情'}>
              {detailLoading ? (
                <div className="loading-wrap">
                  <Spin />
                </div>
              ) : !detail ? (
                <Empty description="请选择一个条目查看详情" />
              ) : (
                detailPane
              )}
            </Card>
          )}
        </section>
      </Content>

      {isMobile && (
        <Drawer
          placement="bottom"
          height="78vh"
          title={detail?.title_zh || detail?.title_en || '详情'}
          open={mobileDetailOpen}
          onClose={() => setMobileDetailOpen(false)}
          className="mobile-detail-drawer"
        >
          {detailLoading ? (
            <div className="loading-wrap">
              <Spin />
            </div>
          ) : !detail ? (
            <Empty description="请选择一个条目查看详情" />
          ) : (
            detailPane
          )}
        </Drawer>
      )}
    </Layout>
  );
}
