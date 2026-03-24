import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Drawer,
  Empty,
  Input,
  Layout,
  List,
  Pagination,
  Progress,
  Segmented,
  Space,
  Spin,
  Tabs,
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
const QUICK_KEYWORDS = ['Fantasy', 'Anime', 'Villain', 'Romance', 'Comedy', 'SciFi'];

const I18N = {
  siteTitle: '\u4e2d\u6587\u7ad9',
  workspaceTag: 'Tech Index',
  heroChip: 'texta.studio \u98ce\u683c \u00b7 \u5de5\u4f5c\u53f0',
  heroTitle: '\u4e2d\u6587\u955c\u50cf\u68c0\u7d22\u4e2d\u67a2',
  heroDesc:
    '\u684c\u9762\u7aef\u53cc\u680f\u9ad8\u6548\u6d4f\u89c8\uff0c\u79fb\u52a8\u7aef\u5e95\u90e8\u62bd\u5c49\u67e5\u770b\u8be6\u60c5\uff0c\u4e00\u5c4f\u5b8c\u6210\u68c0\u7d22\u4e0e\u5bf9\u7167\u3002',
  searchPlaceholder: '\u641c\u7d22\u4e2d\u6587 / \u82f1\u6587 trope',
  search: '\u641c\u7d22',
  refresh: '\u5237\u65b0',
  currentPage: '\u5f53\u524d\u9875\u6761\u76ee',
  translatedCount: '\u4e2d\u6587\u8986\u76d6',
  translatedRate: '\u8986\u76d6\u7387',
  totalCount: '\u68c0\u7d22\u603b\u91cf',
  quickKeywords: '\u5feb\u901f\u5173\u952e\u8bcd',
  shortcutHint: '\u5feb\u6377\u952e "/" \u53ef\u805a\u7126\u641c\u7d22',
  filterAll: '\u5168\u90e8',
  filterTranslated: '\u5df2\u7ffb\u8bd1',
  filterUntranslated: '\u5f85\u7ffb\u8bd1',
  sortUpdated: '\u6309\u66f4\u65b0',
  sortTranslatedFirst: '\u4f18\u5148\u4e2d\u6587',
  sortTitle: '\u6309\u6807\u9898',
  showing: '\u663e\u793a',
  items: '\u6761',
  listTitle: '\u7ed3\u679c\u5217\u8868',
  detailTitle: '\u8be6\u60c5',
  noMatch: '\u6682\u65e0\u5339\u914d\u6570\u636e',
  selectOne: '\u8bf7\u9009\u62e9\u4e00\u4e2a\u6761\u76ee\u67e5\u770b\u8be6\u60c5',
  zhContent: '\u4e2d\u6587\u5185\u5bb9',
  enContent: '\u82f1\u6587\u539f\u6587',
  zhSummary: '\u4e2d\u6587\u6458\u8981',
  zhBody: '\u4e2d\u6587\u6b63\u6587',
  enSummary: '\u82f1\u6587\u6458\u8981',
  enBody: '\u82f1\u6587\u6b63\u6587',
  statusMachine: '\u673a\u5668\u7ffb\u8bd1',
  statusReviewed: '\u4eba\u5de5\u5ba1\u6838',
  statusStale: '\u5f85\u66f4\u65b0',
  zhGenerated: '\u4e2d\u6587\u5df2\u751f\u6210',
  enOnly: '\u4ec5\u82f1\u6587',
  updatedAt: '\u66f4\u65b0\u65f6\u95f4'
};

function extractError(error) {
  if (typeof error?.response?.data?.detail === 'string') {
    return error.response.data.detail;
  }
  return error?.message || 'Unknown error';
}

function filterItems(items, filterType) {
  if (filterType === 'translated') {
    return items.filter((item) => item.has_translation);
  }
  if (filterType === 'untranslated') {
    return items.filter((item) => !item.has_translation);
  }
  return items;
}

function sortItems(items, sortType) {
  if (sortType === 'translated-first') {
    return [...items].sort((a, b) => Number(b.has_translation) - Number(a.has_translation));
  }
  if (sortType === 'title') {
    return [...items].sort((a, b) => a.title.localeCompare(b.title));
  }
  return items;
}

function isInputLike(target) {
  if (!target) return false;
  const tag = (target.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || target.isContentEditable;
}

function getStatusLabel(status) {
  if (status === 'reviewed') return I18N.statusReviewed;
  if (status === 'stale') return I18N.statusStale;
  return I18N.statusMachine;
}

export default function PublicApp() {
  const [messageApi, contextHolder] = message.useMessage();
  const api = useMemo(() => createApiClient(), []);
  const searchInputRef = useRef(null);

  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterType, setFilterType] = useState('all');
  const [sortType, setSortType] = useState('updated');

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
      if (!mobile) setMobileDetailOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== '/') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isInputLike(event.target)) return;
      event.preventDefault();
      searchInputRef.current?.focus?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const pageSize = isMobile ? 12 : 24;
  const translatedCount = useMemo(() => items.filter((item) => item.has_translation).length, [items]);
  const coverageRate = useMemo(
    () => (items.length ? Math.round((translatedCount / items.length) * 100) : 0),
    [items.length, translatedCount]
  );

  const visibleItems = useMemo(() => {
    const filtered = filterItems(items, filterType);
    return sortItems(filtered, sortType);
  }, [filterType, items, sortType]);

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
        messageApi.error(`\u8be6\u60c5\u52a0\u8f7d\u5931\u8d25: ${extractError(error)}`);
        return null;
      } finally {
        setDetailLoading(false);
      }
    },
    [api, messageApi]
  );

  const openDetail = useCallback(
    async (id) => {
      const data = await fetchDetail(id);
      if (isMobile && data) setMobileDetailOpen(true);
    },
    [fetchDetail, isMobile]
  );

  const fetchList = useCallback(
    async (nextPage = 1, forcedKeyword) => {
      setLoading(true);
      try {
        const queryKeyword = forcedKeyword === undefined ? keyword : forcedKeyword;
        const { data } = await api.get('/api/v1/public/tropes', {
          params: {
            page: nextPage,
            page_size: pageSize,
            keyword: queryKeyword || undefined
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
          const exists = nextItems.some((item) => item.id === activeId);
          const targetId = exists ? activeId : nextItems[0].id;
          if (targetId) await fetchDetail(targetId);
        }
      } catch (error) {
        messageApi.error(`\u5217\u8868\u52a0\u8f7d\u5931\u8d25: ${extractError(error)}`);
      } finally {
        setLoading(false);
      }
    },
    [activeId, api, fetchDetail, isMobile, keyword, messageApi, pageSize]
  );

  useEffect(() => {
    fetchList(1);
  }, [fetchList]);

  const applyQuickKeyword = (value) => {
    setKeyword(value);
    fetchList(1, value);
  };

  const detailPane = detail ? (
    <div className="detail-pane">
      <Space className="detail-meta" wrap size={8}>
        <Tag color="blue">{getStatusLabel(detail.translation_status)}</Tag>
        <Tag>{`${I18N.updatedAt} ${dayjs(detail.updated_at).format('YYYY-MM-DD HH:mm')}`}</Tag>
      </Space>

      <Tabs
        defaultActiveKey="zh"
        items={[
          {
            key: 'zh',
            label: I18N.zhContent,
            children: (
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <Card size="small" title={I18N.zhSummary} className="detail-block">
                  <Text>{detail.summary_zh || '-'}</Text>
                </Card>
                <Card size="small" title={I18N.zhBody} className="detail-block">
                  <div className="source-content">{detail.content_zh || '-'}</div>
                </Card>
              </Space>
            )
          },
          {
            key: 'en',
            label: I18N.enContent,
            children: (
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <Card size="small" title={I18N.enSummary} className="detail-block">
                  <Text>{detail.summary_en || '-'}</Text>
                </Card>
                <Card size="small" title={I18N.enBody} className="detail-block">
                  <div className="source-content">{detail.content_en || '-'}</div>
                </Card>
              </Space>
            )
          }
        ]}
      />
    </div>
  ) : null;

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
              {`TVTropes ${I18N.siteTitle}`}
            </Title>
            <Tag color="cyan" className="public-status-pill">
              {I18N.workspaceTag}
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
              {I18N.heroChip}
            </Tag>
            <Title className="hero-title">{I18N.heroTitle}</Title>
            <Paragraph className="hero-desc">{I18N.heroDesc}</Paragraph>
            <Space wrap className="hero-actions">
              <Input
                ref={searchInputRef}
                size="large"
                className="hero-search"
                placeholder={I18N.searchPlaceholder}
                prefix={<SearchOutlined />}
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                onPressEnter={() => fetchList(1)}
              />
              <Button type="primary" size="large" onClick={() => fetchList(1)}>
                {I18N.search}
              </Button>
              <Button size="large" icon={<ReloadOutlined />} onClick={() => fetchList(1)}>
                {I18N.refresh}
              </Button>
            </Space>
          </div>

          <div className="hero-metrics">
            <div className="metric-card">
              <Text type="secondary">{I18N.currentPage}</Text>
              <Title level={2}>{items.length}</Title>
            </div>
            <div className="metric-card">
              <Text type="secondary">{I18N.translatedCount}</Text>
              <Title level={2}>{translatedCount}</Title>
            </div>
            <div className="metric-card metric-progress">
              <Text type="secondary">{I18N.translatedRate}</Text>
              <Progress
                percent={coverageRate}
                size="small"
                showInfo={false}
                strokeColor={{ from: '#38bdf8', to: '#22d3ee' }}
              />
              <Title level={2}>{`${coverageRate}%`}</Title>
            </div>
            <div className="metric-card">
              <Text type="secondary">{I18N.totalCount}</Text>
              <Title level={2}>{total}</Title>
            </div>
          </div>
        </section>

        <section className="quick-strip">
          <Space wrap size={8}>
            <Tag color="default" className="quick-label">
              {I18N.quickKeywords}
            </Tag>
            {QUICK_KEYWORDS.map((item) => (
              <Tag key={item} className="keyword-chip" onClick={() => applyQuickKeyword(item)}>
                {item}
              </Tag>
            ))}
          </Space>
          <Text type="secondary" className="search-shortcut">
            {I18N.shortcutHint}
          </Text>
        </section>

        <section className="public-controls">
          <div className="control-group">
            <Segmented
              value={filterType}
              onChange={setFilterType}
              options={[
                { label: I18N.filterAll, value: 'all' },
                { label: I18N.filterTranslated, value: 'translated' },
                { label: I18N.filterUntranslated, value: 'untranslated' }
              ]}
            />
            <Segmented
              value={sortType}
              onChange={setSortType}
              options={[
                { label: I18N.sortUpdated, value: 'updated' },
                { label: I18N.sortTranslatedFirst, value: 'translated-first' },
                { label: I18N.sortTitle, value: 'title' }
              ]}
            />
          </div>
          <Tag color="blue">{`${I18N.showing} ${visibleItems.length} ${I18N.items}`}</Tag>
        </section>

        <section className="public-workbench">
          <Card className="workbench-list" title={`${I18N.listTitle} (${total})`}>
            {loading ? (
              <div className="loading-wrap">
                <Spin />
              </div>
            ) : visibleItems.length === 0 ? (
              <Empty description={I18N.noMatch} />
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
                            {item.has_translation ? I18N.zhGenerated : I18N.enOnly}
                          </Tag>
                        </Space>
                        <Paragraph ellipsis={{ rows: isMobile ? 2 : 3 }} style={{ marginBottom: 0 }}>
                          {item.summary}
                        </Paragraph>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {`${I18N.updatedAt} ${dayjs(item.updated_at).format('YYYY-MM-DD HH:mm')}`}
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
            <Card className="workbench-detail" title={detail?.title_zh || detail?.title_en || I18N.detailTitle}>
              {detailLoading ? (
                <div className="loading-wrap">
                  <Spin />
                </div>
              ) : !detail ? (
                <Empty description={I18N.selectOne} />
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
          height="80vh"
          title={detail?.title_zh || detail?.title_en || I18N.detailTitle}
          open={mobileDetailOpen}
          onClose={() => setMobileDetailOpen(false)}
          className="mobile-detail-drawer"
        >
          {detailLoading ? (
            <div className="loading-wrap">
              <Spin />
            </div>
          ) : !detail ? (
            <Empty description={I18N.selectOne} />
          ) : (
            detailPane
          )}
        </Drawer>
      )}
    </Layout>
  );
}
