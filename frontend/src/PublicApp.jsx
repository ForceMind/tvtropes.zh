import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Tooltip,
  Button,
  Card,
  Drawer,
  Empty,
  Input,
  Layout,
  List,
  Modal,
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
import {
  AppstoreOutlined,
  ColumnWidthOutlined,
  CopyOutlined,
  HistoryOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
  StarFilled,
  StarOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { createApiClient } from './api';

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

const MOBILE_BREAKPOINT = 992;
const QUICK_KEYWORDS = ['Fantasy', 'Anime', 'Villain', 'Romance', 'Comedy', 'SciFi'];
const FAVORITES_STORAGE_KEY = 'tvtropes_zh_favorites';
const RECENT_STORAGE_KEY = 'tvtropes_zh_recents';
const SEARCH_PRESETS_STORAGE_KEY = 'tvtropes_zh_search_presets';
const MAX_FAVORITES = 60;
const MAX_RECENTS = 18;
const MAX_PRESETS = 10;

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
  viewSplit: '\u5206\u680f',
  viewGrid: '\u5361\u7247\u5899',
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
  updatedAt: '\u66f4\u65b0\u65f6\u95f4',
  copyLink: '\u590d\u5236\u6e90\u94fe\u63a5',
  copied: '\u5df2\u590d\u5236',
  commandOpen: '\u6253\u5f00\u547d\u4ee4\u9762\u677f',
  commandTitle: '\u5feb\u6377\u547d\u4ee4',
  commandPlaceholder: '\u8f93\u5165\u5173\u952e\u5b57\uff0c\u4f8b\u5982\uff1a\u4e2d\u6587 / split / anime',
  commandEmpty: '\u6ca1\u6709\u5339\u914d\u547d\u4ee4',
  commandHint: '\u2191/\u2193 \u9009\u62e9 \u00b7 Enter \u6267\u884c \u00b7 Esc \u5173\u95ed \u00b7 Ctrl+K \u5524\u8d77',
  cmdFocusSearch: '\u805a\u7126\u641c\u7d22\u6846',
  cmdRefresh: '\u5237\u65b0\u5217\u8868',
  cmdSplit: '\u5207\u6362\u4e3a\u5206\u680f\u89c6\u56fe',
  cmdGrid: '\u5207\u6362\u4e3a\u5361\u7247\u5899\u89c6\u56fe',
  cmdFilterAll: '\u7b5b\u9009\u5168\u90e8',
  cmdFilterTranslated: '\u7b5b\u9009\u5df2\u7ffb\u8bd1',
  cmdFilterUntranslated: '\u7b5b\u9009\u5f85\u7ffb\u8bd1',
  storyTitle: '\u7ad9\u70b9\u4fe1\u53f7\u9762\u677f',
  storyDesc: '\u901a\u8fc7\u6293\u53d6\u3001\u7ffb\u8bd1\u3001\u68c0\u7d22\u4e09\u6761\u94fe\u8def\u5feb\u901f\u5224\u65ad\u7cfb\u7edf\u72b6\u6001\u3002',
  storyCapture: '\u6293\u53d6\u901f\u5ea6',
  storyCaptureDesc: '\u672c\u9875\u8f7d\u5165\u6761\u76ee',
  storyTranslate: '\u7ffb\u8bd1\u8fdb\u5ea6',
  storyTranslateDesc: '\u5f53\u524d\u9875\u9762\u4e2d\u6587\u6761\u76ee',
  storySearch: '\u68c0\u7d22\u5feb\u6377',
  storySearchDesc: '\u547d\u4ee4\u9762\u677f\u53ef\u8c03\u7528',
  pulseTitle: '\u66f4\u65b0\u8109\u51b2',
  pulseEmpty: '\u6682\u65e0\u6700\u65b0\u811a\u5370',
  favoritesTitle: '\u6536\u85cf\u770b\u677f',
  favoritesEmpty: '\u5c1a\u672a\u6536\u85cf\u6761\u76ee',
  recentsTitle: '\u6700\u8fd1\u67e5\u770b',
  recentsEmpty: '\u6682\u65e0\u6d4f\u89c8\u8bb0\u5f55',
  shortcutsMore: '\u952e\u76d8: J/K \u5207\u6362, Enter \u6253\u5f00, [ ] \u8c03\u5b57\u53f7',
  pinned: '\u5df2\u6536\u85cf',
  pinThis: '\u6536\u85cf\u6b64\u9879',
  unpinThis: '\u53d6\u6d88\u6536\u85cf',
  detailMode: '\u9605\u8bfb\u6a21\u5f0f',
  detailModeTabs: '\u6807\u7b7e',
  detailModeCompare: '\u5bf9\u7167',
  textScale: '\u5b57\u53f7',
  textSmall: '\u5c0f',
  textLarge: '\u5927',
  cmdDetailTabs: '\u9605\u8bfb\u6a21\u5f0f: \u6807\u7b7e',
  cmdDetailCompare: '\u9605\u8bfb\u6a21\u5f0f: \u5bf9\u7167',
  cmdFontUp: '\u5b57\u53f7\u653e\u5927',
  cmdFontDown: '\u5b57\u53f7\u7f29\u5c0f',
  presetsTitle: '\u641c\u7d22\u9884\u8bbe',
  presetSave: '\u4fdd\u5b58\u9884\u8bbe',
  presetEmpty: '\u6682\u65e0\u9884\u8bbe',
  presetSaved: '\u9884\u8bbe\u5df2\u4fdd\u5b58',
  presetRemoved: '\u9884\u8bbe\u5df2\u5220\u9664',
  hotkeyOpen: '\u5feb\u6377\u952e',
  hotkeyTitle: '\u5feb\u6377\u952e\u8bf4\u660e',
  hotkeySearch: '/ \u805a\u7126\u641c\u7d22',
  hotkeyCommand: 'Ctrl+K \u6253\u5f00\u547d\u4ee4\u9762\u677f',
  hotkeyNavigate: 'J/K \u4e0a\u4e0b\u6d4f\u89c8',
  hotkeyOpenItem: 'Enter \u6253\u5f00\u5f53\u524d\u6761\u76ee',
  hotkeyScale: '[ / ] \u7f29\u653e\u5b57\u53f7',
  cmdHotkeyHelp: '\u6253\u5f00\u5feb\u6377\u952e\u8bf4\u660e',
  sitePulseTitle: '\u5168\u7ad9\u8fdb\u5ea6\u96f7\u8fbe',
  sitePulseDesc: '\u76d1\u63a7\u6574\u4e2a\u7ad9\u70b9\u6293\u53d6\u3001\u7ffb\u8bd1\u3001\u5ba1\u6838\u7684\u5b9e\u65f6\u72b6\u6001\uff0c\u4e0d\u53d7\u5f53\u524d\u5206\u9875\u9650\u5236\u3002',
  totalTropes: '\u5168\u7ad9\u6761\u76ee',
  coverageGlobal: '\u5168\u7ad9\u8986\u76d6\u7387',
  reviewedGlobal: '\u8bd1\u6587\u5ba1\u6838\u7387',
  queueDoneRate: '\u961f\u5217\u5b8c\u6210\u7387',
  jobsActive: '\u6d3b\u8dc3\u4efb\u52a1',
  jobsRunning: '\u8fd0\u884c\u4e2d',
  queuePending: '\u5f85\u5904\u7406',
  queueProcessing: '\u5904\u7406\u4e2d',
  queueDone: '\u5df2\u5b8c\u6210',
  queueFailed: '\u5931\u8d25',
  queueTotal: '\u603b\u961f\u5217',
  translatedGlobal: '\u4e2d\u6587\u6761\u76ee',
  reviewedGlobalCount: '\u5ba1\u6838\u901a\u8fc7',
  staleGlobalCount: '\u5f85\u66f4\u65b0',
  machineGlobalCount: '\u673a\u5668\u8bd1\u6587',
  lastRun: '\u6700\u8fd1\u8fd0\u884c'
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

function readStoredItems(key) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && Number.isInteger(item.id) && typeof item.title === 'string')
      .map((item) => ({ id: item.id, title: item.title }));
  } catch {
    return [];
  }
}

function readStoredPresets() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SEARCH_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, MAX_PRESETS);
  } catch {
    return [];
  }
}

function renderHighlighted(value, keyword) {
  const text = String(value || '');
  const query = (keyword || '').trim();
  if (!query) return text;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'ig'));
  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={`${part}-${index}`}>{part}</mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

export default function PublicApp() {
  const [messageApi, contextHolder] = message.useMessage();
  const api = useMemo(() => createApiClient(), []);
  const searchInputRef = useRef(null);
  const commandInputRef = useRef(null);
  const openDetailRef = useRef(null);
  const adjustTextScaleRef = useRef(null);

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
  const [overlayDetailOpen, setOverlayDetailOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  );
  const [viewMode, setViewMode] = useState('split');
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [commandActiveIndex, setCommandActiveIndex] = useState(0);
  const [detailMode, setDetailMode] = useState('tabs');
  const [textScale, setTextScale] = useState(100);
  const [favorites, setFavorites] = useState(() => readStoredItems(FAVORITES_STORAGE_KEY));
  const [recentViews, setRecentViews] = useState(() => readStoredItems(RECENT_STORAGE_KEY));
  const [searchPresets, setSearchPresets] = useState(() => readStoredPresets());
  const [hotkeyHelpOpen, setHotkeyHelpOpen] = useState(false);
  const [siteStats, setSiteStats] = useState(null);
  const [siteStatsLoading, setSiteStatsLoading] = useState(false);

  const adjustTextScale = useCallback((delta) => {
    setTextScale((prev) => Math.max(85, Math.min(130, prev + delta)));
  }, []);

  const addRecentView = useCallback((id, title) => {
    if (!id || !title) return;
    setRecentViews((prev) => {
      const next = [{ id, title }, ...prev.filter((item) => item.id !== id)];
      return next.slice(0, MAX_RECENTS);
    });
  }, []);

  const toggleFavorite = useCallback((id, title) => {
    if (!id || !title) return;
    setFavorites((prev) => {
      const exists = prev.some((item) => item.id === id);
      if (exists) {
        return prev.filter((item) => item.id !== id);
      }
      const next = [{ id, title }, ...prev.filter((item) => item.id !== id)];
      return next.slice(0, MAX_FAVORITES);
    });
  }, []);

  const updateFavoriteTitle = useCallback((id, title) => {
    if (!id || !title) return;
    setFavorites((prev) => prev.map((item) => (item.id === id ? { ...item, title } : item)));
  }, []);

  const saveSearchPreset = useCallback(() => {
    const normalized = keyword.trim();
    if (!normalized) return;
    setSearchPresets((prev) => {
      const next = [normalized, ...prev.filter((item) => item.toLowerCase() !== normalized.toLowerCase())];
      return next.slice(0, MAX_PRESETS);
    });
    messageApi.success(I18N.presetSaved);
  }, [keyword, messageApi]);

  const removeSearchPreset = useCallback(
    (value) => {
      const normalized = value.trim().toLowerCase();
      if (!normalized) return;
      setSearchPresets((prev) => prev.filter((item) => item.toLowerCase() !== normalized));
      messageApi.success(I18N.presetRemoved);
    },
    [messageApi]
  );

  const pageSize = isMobile ? 12 : 24;
  const translatedCount = useMemo(() => items.filter((item) => item.has_translation).length, [items]);
  const coverageRate = useMemo(
    () => (items.length ? Math.round((translatedCount / items.length) * 100) : 0),
    [items.length, translatedCount]
  );
  const showSplitPane = !isMobile && viewMode === 'split';
  const pulseItems = useMemo(() => items.slice(0, 10), [items]);
  const storyCards = useMemo(
    () => [
      {
        key: 'capture',
        title: I18N.storyCapture,
        value: String(items.length),
        desc: I18N.storyCaptureDesc
      },
      {
        key: 'translate',
        title: I18N.storyTranslate,
        value: `${translatedCount}/${items.length || 0}`,
        desc: I18N.storyTranslateDesc
      },
      {
        key: 'search',
        title: I18N.storySearch,
        value: 'Ctrl+K',
        desc: I18N.storySearchDesc
      }
    ],
    [items.length, translatedCount]
  );
  const favoriteSet = useMemo(() => new Set(favorites.map((item) => item.id)), [favorites]);
  const favoriteCards = useMemo(() => favorites.slice(0, 14), [favorites]);
  const recentCards = useMemo(() => recentViews.slice(0, 14), [recentViews]);

  const visibleItems = useMemo(() => {
    const filtered = filterItems(items, filterType);
    return sortItems(filtered, sortType);
  }, [filterType, items, sortType]);
  const queueTotal = siteStats?.queue_total || 0;
  const queueDoneRate = useMemo(() => {
    if (!queueTotal) return 0;
    return Math.round(((siteStats?.queue_done || 0) / queueTotal) * 100);
  }, [queueTotal, siteStats?.queue_done]);
  const getQueuePercent = useCallback(
    (value) => {
      if (!queueTotal) return 0;
      return Math.min(100, Math.round((value / queueTotal) * 100));
    },
    [queueTotal]
  );

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      if (!mobile) setOverlayDetailOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setViewMode('grid');
    }
  }, [isMobile]);

  useEffect(() => {
    if (!commandOpen) {
      setCommandQuery('');
      return;
    }
    const timer = setTimeout(() => {
      commandInputRef.current?.focus?.();
    }, 30);
    return () => clearTimeout(timer);
  }, [commandOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recentViews));
  }, [recentViews]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SEARCH_PRESETS_STORAGE_KEY, JSON.stringify(searchPresets));
  }, [searchPresets]);

  const fetchSiteStats = useCallback(
    async (silent = false) => {
      if (!silent) setSiteStatsLoading(true);
      try {
        const { data } = await api.get('/api/v1/public/stats');
        setSiteStats(data);
      } catch (error) {
        if (!silent) {
          messageApi.error(`\u7ad9\u70b9\u7edf\u8ba1\u52a0\u8f7d\u5931\u8d25: ${extractError(error)}`);
        }
      } finally {
        if (!silent) setSiteStatsLoading(false);
      }
    },
    [api, messageApi]
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
        messageApi.error(`\u8be6\u60c5\u52a0\u8f7d\u5931\u8d25: ${extractError(error)}`);
        return null;
      } finally {
        setDetailLoading(false);
      }
    },
    [api, messageApi]
  );

  const openDetail = useCallback(
    async (id, titleHint = '') => {
      const data = await fetchDetail(id);
      if (!data) return;
      const normalizedTitle = (data.title_zh || data.title_en || titleHint || '').trim();
      if (normalizedTitle) {
        addRecentView(data.id, normalizedTitle);
        updateFavoriteTitle(data.id, normalizedTitle);
      }
      if (isMobile || viewMode === 'grid') setOverlayDetailOpen(true);
    },
    [addRecentView, fetchDetail, isMobile, updateFavoriteTitle, viewMode]
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

        if (showSplitPane) {
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
    [activeId, api, fetchDetail, keyword, messageApi, pageSize, showSplitPane]
  );

  useEffect(() => {
    fetchList(1);
    fetchSiteStats();
  }, [fetchList, fetchSiteStats]);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchSiteStats(true);
    }, 30000);
    return () => clearInterval(timer);
  }, [fetchSiteStats]);

  const applyQuickKeyword = useCallback(
    (value) => {
      setKeyword(value);
      fetchList(1, value);
    },
    [fetchList]
  );

  const applySearchPreset = useCallback(
    (value) => {
      const normalized = value.trim();
      if (!normalized) return;
      setKeyword(normalized);
      fetchList(1, normalized);
    },
    [fetchList]
  );

  const switchViewMode = useCallback((value) => {
    setViewMode(value);
    if (value === 'split') {
      setOverlayDetailOpen(false);
    }
  }, []);

  const copySourceLink = async () => {
    if (!detail?.tvtropes_url || !navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(detail.tvtropes_url);
      messageApi.success(I18N.copied);
    } catch {
      // noop
    }
  };

  const commandItems = useMemo(() => {
    const items = [
      {
        id: 'focus-search',
        label: I18N.cmdFocusSearch,
        keywords: 'search focus /',
        run: () => {
          setCommandOpen(false);
          setTimeout(() => searchInputRef.current?.focus?.(), 40);
        }
      },
      {
        id: 'refresh',
        label: I18N.cmdRefresh,
        keywords: 'refresh reload',
        run: () => {
          setCommandOpen(false);
          fetchList(1);
          fetchSiteStats(true);
        }
      },
      {
        id: 'detail-tabs',
        label: I18N.cmdDetailTabs,
        keywords: 'detail tabs mode',
        run: () => {
          setCommandOpen(false);
          setDetailMode('tabs');
        }
      },
      {
        id: 'detail-compare',
        label: I18N.cmdDetailCompare,
        keywords: 'detail compare mode',
        run: () => {
          setCommandOpen(false);
          setDetailMode('compare');
        }
      },
      {
        id: 'font-up',
        label: I18N.cmdFontUp,
        keywords: 'font larger',
        run: () => {
          setCommandOpen(false);
          adjustTextScale(5);
        }
      },
      {
        id: 'font-down',
        label: I18N.cmdFontDown,
        keywords: 'font smaller',
        run: () => {
          setCommandOpen(false);
          adjustTextScale(-5);
        }
      },
      {
        id: 'hotkey-help',
        label: I18N.cmdHotkeyHelp,
        keywords: 'hotkey keyboard help shortcut',
        run: () => {
          setCommandOpen(false);
          setHotkeyHelpOpen(true);
        }
      },
      {
        id: 'save-preset',
        label: I18N.presetSave,
        keywords: 'preset save query search',
        run: () => {
          setCommandOpen(false);
          saveSearchPreset();
        }
      },
      {
        id: 'filter-all',
        label: I18N.cmdFilterAll,
        keywords: 'filter all',
        run: () => {
          setCommandOpen(false);
          setFilterType('all');
        }
      },
      {
        id: 'filter-translated',
        label: I18N.cmdFilterTranslated,
        keywords: 'filter translated zh',
        run: () => {
          setCommandOpen(false);
          setFilterType('translated');
        }
      },
      {
        id: 'filter-untranslated',
        label: I18N.cmdFilterUntranslated,
        keywords: 'filter untranslated en',
        run: () => {
          setCommandOpen(false);
          setFilterType('untranslated');
        }
      }
    ];

    if (!isMobile) {
      items.push(
        {
          id: 'view-split',
          label: I18N.cmdSplit,
          keywords: 'view split columns',
          run: () => {
            setCommandOpen(false);
            switchViewMode('split');
          }
        },
        {
          id: 'view-grid',
          label: I18N.cmdGrid,
          keywords: 'view grid cards',
          run: () => {
            setCommandOpen(false);
            switchViewMode('grid');
          }
        }
      );
    }

    for (const keywordItem of QUICK_KEYWORDS) {
      items.push({
        id: `kw-${keywordItem}`,
        label: `\u68c0\u7d22: ${keywordItem}`,
        keywords: `keyword ${keywordItem.toLowerCase()}`,
        run: () => {
          setCommandOpen(false);
          applyQuickKeyword(keywordItem);
        }
      });
    }

    searchPresets.forEach((preset, index) => {
      items.push({
        id: `preset-${index}-${preset.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32)}`,
        label: `\u9884\u8bbe: ${preset}`,
        keywords: `preset saved ${preset.toLowerCase()}`,
        run: () => {
          setCommandOpen(false);
          applySearchPreset(preset);
        }
      });
    });

    return items;
  }, [
    adjustTextScale,
    applyQuickKeyword,
    applySearchPreset,
    fetchList,
    fetchSiteStats,
    isMobile,
    saveSearchPreset,
    searchPresets,
    switchViewMode
  ]);

  const filteredCommands = useMemo(() => {
    const q = commandQuery.trim().toLowerCase();
    if (!q) return commandItems;
    return commandItems.filter((item) => {
      const target = `${item.label} ${item.keywords}`.toLowerCase();
      return target.includes(q);
    });
  }, [commandItems, commandQuery]);

  useEffect(() => {
    setCommandActiveIndex(0);
  }, [commandQuery, commandOpen]);

  useEffect(() => {
    setCommandActiveIndex((prev) => {
      const maxIndex = Math.max(filteredCommands.length - 1, 0);
      return Math.min(prev, maxIndex);
    });
  }, [filteredCommands.length]);

  const executeCommandAt = useCallback(
    (index) => {
      const target = filteredCommands[index];
      if (!target) return;
      target.run();
    },
    [filteredCommands]
  );

  useEffect(() => {
    openDetailRef.current = openDetail;
  }, [openDetail]);

  useEffect(() => {
    adjustTextScaleRef.current = adjustTextScale;
  }, [adjustTextScale]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const lowered = event.key.toLowerCase();
      const openDetailHandler = openDetailRef.current;
      const adjustScaleHandler = adjustTextScaleRef.current;

      if ((event.ctrlKey || event.metaKey) && lowered === 'k') {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }

      if (event.key === 'Escape' && commandOpen) {
        setCommandOpen(false);
        return;
      }

      if (event.key === 'Escape' && hotkeyHelpOpen) {
        setHotkeyHelpOpen(false);
        return;
      }

      if (commandOpen || hotkeyHelpOpen) return;
      if (isInputLike(event.target)) return;

      if ((event.key === '?' || (event.shiftKey && event.key === '/')) && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setHotkeyHelpOpen(true);
        return;
      }

      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        searchInputRef.current?.focus?.();
        return;
      }

      if ((lowered === 'j' || lowered === 'k') && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (!visibleItems.length) return;
        event.preventDefault();
        const currentIndex = visibleItems.findIndex((item) => item.id === activeId);
        const baseIndex = currentIndex === -1 ? 0 : currentIndex;
        const nextIndex =
          lowered === 'j'
            ? Math.min(baseIndex + 1, visibleItems.length - 1)
            : Math.max(baseIndex - 1, 0);
        const target = visibleItems[nextIndex];
        if (target && openDetailHandler) openDetailHandler(target.id, target.title);
        return;
      }

      if ((event.key === '[' || event.key === ']') && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        if (adjustScaleHandler) adjustScaleHandler(event.key === ']' ? 5 : -5);
        return;
      }

      if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (!visibleItems.length) return;
        event.preventDefault();
        const target = visibleItems.find((item) => item.id === activeId) || visibleItems[0];
        if (target && openDetailHandler) openDetailHandler(target.id, target.title);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeId, commandOpen, hotkeyHelpOpen, visibleItems]);

  const detailTextStyle = useMemo(
    () => ({
      fontSize: `${Math.round((13 * textScale) / 100)}px`
    }),
    [textScale]
  );

  const hotkeyRows = useMemo(
    () => [
      { key: '/', desc: I18N.hotkeySearch },
      { key: 'Ctrl+K', desc: I18N.hotkeyCommand },
      { key: '?', desc: I18N.cmdHotkeyHelp },
      { key: 'J / K', desc: I18N.hotkeyNavigate },
      { key: 'Enter', desc: I18N.hotkeyOpenItem },
      { key: '[ / ]', desc: I18N.hotkeyScale }
    ],
    []
  );

  const detailPane = detail ? (
    <div className="detail-pane">
      <Space className="detail-meta" wrap size={8}>
        <Tag color="blue">{getStatusLabel(detail.translation_status)}</Tag>
        <Tag>{`${I18N.updatedAt} ${dayjs(detail.updated_at).format('YYYY-MM-DD HH:mm')}`}</Tag>
        {favoriteSet.has(detail.id) && <Tag color="gold">{I18N.pinned}</Tag>}
        <Tooltip title={favoriteSet.has(detail.id) ? I18N.unpinThis : I18N.pinThis}>
          <Button
            size="small"
            icon={favoriteSet.has(detail.id) ? <StarFilled /> : <StarOutlined />}
            className={favoriteSet.has(detail.id) ? 'star-btn-active' : ''}
            onClick={() =>
              toggleFavorite(detail.id, (detail.title_zh || detail.title_en || `#${detail.id}`).trim())
            }
          />
        </Tooltip>
        <Tooltip title={I18N.copyLink}>
          <Button size="small" icon={<CopyOutlined />} onClick={copySourceLink} />
        </Tooltip>
      </Space>

      <div className="detail-toolbar">
        <Space size={8} wrap>
          <Text type="secondary">{I18N.detailMode}</Text>
          <Segmented
            size="small"
            value={detailMode}
            onChange={setDetailMode}
            options={[
              { label: I18N.detailModeTabs, value: 'tabs' },
              { label: I18N.detailModeCompare, value: 'compare' }
            ]}
          />
        </Space>
        <Space size={6}>
          <Text type="secondary">{`${I18N.textScale} ${textScale}%`}</Text>
          <Button size="small" onClick={() => adjustTextScale(-5)}>
            {I18N.textSmall}
          </Button>
          <Button size="small" onClick={() => adjustTextScale(5)}>
            {I18N.textLarge}
          </Button>
        </Space>
      </div>

      {detailMode === 'compare' ? (
        <div className="compare-grid">
          <Card size="small" title={I18N.zhContent} className="detail-block">
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <Card size="small" title={I18N.zhSummary} className="detail-sub-block">
                <Text style={detailTextStyle}>{detail.summary_zh || '-'}</Text>
              </Card>
              <Card size="small" title={I18N.zhBody} className="detail-sub-block">
                <div className="source-content" style={detailTextStyle}>
                  {detail.content_zh || '-'}
                </div>
              </Card>
            </Space>
          </Card>
          <Card size="small" title={I18N.enContent} className="detail-block">
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <Card size="small" title={I18N.enSummary} className="detail-sub-block">
                <Text style={detailTextStyle}>{detail.summary_en || '-'}</Text>
              </Card>
              <Card size="small" title={I18N.enBody} className="detail-sub-block">
                <div className="source-content" style={detailTextStyle}>
                  {detail.content_en || '-'}
                </div>
              </Card>
            </Space>
          </Card>
        </div>
      ) : (
        <Tabs
          defaultActiveKey="zh"
          items={[
            {
              key: 'zh',
              label: I18N.zhContent,
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                  <Card size="small" title={I18N.zhSummary} className="detail-block">
                    <Text style={detailTextStyle}>{detail.summary_zh || '-'}</Text>
                  </Card>
                  <Card size="small" title={I18N.zhBody} className="detail-block">
                    <div className="source-content" style={detailTextStyle}>
                      {detail.content_zh || '-'}
                    </div>
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
                    <Text style={detailTextStyle}>{detail.summary_en || '-'}</Text>
                  </Card>
                  <Card size="small" title={I18N.enBody} className="detail-block">
                    <div className="source-content" style={detailTextStyle}>
                      {detail.content_en || '-'}
                    </div>
                  </Card>
                </Space>
              )
            }
          ]}
        />
      )}
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
          <Space>
            <Text type="secondary" className="public-clock">
              {dayjs().format('YYYY-MM-DD HH:mm')}
            </Text>
            <Tooltip title={I18N.hotkeyOpen}>
              <Button
                className="hotkey-open-btn"
                icon={<QuestionCircleOutlined />}
                onClick={() => setHotkeyHelpOpen(true)}
              />
            </Tooltip>
            <Button className="command-open-btn" onClick={() => setCommandOpen(true)}>
              Ctrl+K
            </Button>
          </Space>
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
              <Button
                size="large"
                icon={<ReloadOutlined />}
                onClick={() => {
                  fetchList(1);
                  fetchSiteStats(true);
                }}
              >
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

        <section className="global-pulse-board">
          <div className="global-pulse-head">
            <div>
              <Title level={4}>{I18N.sitePulseTitle}</Title>
              <Paragraph>{I18N.sitePulseDesc}</Paragraph>
            </div>
            <Space wrap size={8}>
              <Tag color="cyan">{`${I18N.jobsActive} ${siteStats?.active_jobs || 0}`}</Tag>
              <Tag color={siteStats?.running_jobs ? 'gold' : 'default'}>
                {`${I18N.jobsRunning} ${siteStats?.running_jobs || 0}`}
              </Tag>
              <Tag color={siteStats?.last_run_status === 'failed' ? 'red' : 'blue'}>
                {`${I18N.lastRun}: ${siteStats?.last_run_status || '-'}`}
              </Tag>
            </Space>
          </div>

          <div className="global-pulse-grid">
            <article className="global-ring-panel">
              {siteStatsLoading && !siteStats ? (
                <div className="loading-wrap">
                  <Spin />
                </div>
              ) : (
                <>
                  <div className="global-total-tropes">
                    <Text type="secondary">{I18N.totalTropes}</Text>
                    <Title level={2}>{siteStats?.tropes_total || 0}</Title>
                  </div>
                  <div className="global-ring-row">
                    <div className="global-ring-card">
                      <Text type="secondary">{I18N.coverageGlobal}</Text>
                      <Progress
                        type="circle"
                        percent={Number(siteStats?.coverage_rate || 0)}
                        size={108}
                        strokeColor={{ '0%': '#38bdf8', '100%': '#22d3ee' }}
                        trailColor="rgba(148,163,184,0.25)"
                        format={(value) => `${Math.round(Number(value || 0))}%`}
                      />
                    </div>
                    <div className="global-ring-card">
                      <Text type="secondary">{I18N.reviewedGlobal}</Text>
                      <Progress
                        type="circle"
                        percent={Number(siteStats?.reviewed_rate || 0)}
                        size={108}
                        strokeColor={{ '0%': '#34d399', '100%': '#10b981' }}
                        trailColor="rgba(148,163,184,0.25)"
                        format={(value) => `${Math.round(Number(value || 0))}%`}
                      />
                    </div>
                    <div className="global-ring-card">
                      <Text type="secondary">{I18N.queueDoneRate}</Text>
                      <Progress
                        type="circle"
                        percent={queueDoneRate}
                        size={108}
                        strokeColor={{ '0%': '#f59e0b', '100%': '#f97316' }}
                        trailColor="rgba(148,163,184,0.25)"
                        format={(value) => `${Math.round(Number(value || 0))}%`}
                      />
                    </div>
                  </div>
                </>
              )}
            </article>

            <article className="global-queue-panel">
              <div className="queue-status-grid">
                <div className="queue-stat">
                  <Text type="secondary">{I18N.translatedGlobal}</Text>
                  <Title level={4}>{siteStats?.translated_total || 0}</Title>
                </div>
                <div className="queue-stat">
                  <Text type="secondary">{I18N.reviewedGlobalCount}</Text>
                  <Title level={4}>{siteStats?.reviewed_total || 0}</Title>
                </div>
                <div className="queue-stat">
                  <Text type="secondary">{I18N.staleGlobalCount}</Text>
                  <Title level={4}>{siteStats?.stale_total || 0}</Title>
                </div>
                <div className="queue-stat">
                  <Text type="secondary">{I18N.machineGlobalCount}</Text>
                  <Title level={4}>{siteStats?.machine_total || 0}</Title>
                </div>
              </div>

              <div className="queue-progress-list">
                <div className="queue-progress-row">
                  <Text>{`${I18N.queuePending} ${siteStats?.queue_pending || 0}`}</Text>
                  <Progress
                    percent={getQueuePercent(siteStats?.queue_pending || 0)}
                    showInfo={false}
                    strokeColor="#38bdf8"
                  />
                </div>
                <div className="queue-progress-row">
                  <Text>{`${I18N.queueProcessing} ${siteStats?.queue_processing || 0}`}</Text>
                  <Progress
                    percent={getQueuePercent(siteStats?.queue_processing || 0)}
                    showInfo={false}
                    strokeColor="#0ea5e9"
                  />
                </div>
                <div className="queue-progress-row">
                  <Text>{`${I18N.queueDone} ${siteStats?.queue_done || 0}`}</Text>
                  <Progress
                    percent={getQueuePercent(siteStats?.queue_done || 0)}
                    showInfo={false}
                    strokeColor="#22c55e"
                  />
                </div>
                <div className="queue-progress-row">
                  <Text>{`${I18N.queueFailed} ${siteStats?.queue_failed || 0}`}</Text>
                  <Progress
                    percent={getQueuePercent(siteStats?.queue_failed || 0)}
                    showInfo={false}
                    strokeColor="#f43f5e"
                  />
                </div>
              </div>

              <Tag color="blue">{`${I18N.queueTotal} ${queueTotal}`}</Tag>
              <Text type="secondary">
                {siteStats?.last_run_started_at
                  ? dayjs(siteStats.last_run_started_at).format('YYYY-MM-DD HH:mm:ss')
                  : '-'}
              </Text>
            </article>
          </div>
        </section>

        <section className="story-board">
          <div className="story-intro">
            <Title level={4}>{I18N.storyTitle}</Title>
            <Paragraph>{I18N.storyDesc}</Paragraph>
          </div>
          <div className="story-cards">
            {storyCards.map((card) => (
              <article key={card.key} className="story-card">
                <Text type="secondary">{card.title}</Text>
                <Title level={3}>{card.value}</Title>
                <Text type="secondary">{card.desc}</Text>
              </article>
            ))}
          </div>
        </section>

        <section className="pulse-lane">
          <Text strong>{I18N.pulseTitle}</Text>
          {pulseItems.length ? (
            <div className="pulse-track">
              {pulseItems.map((item) => (
                <button
                  key={`pulse-${item.id}`}
                  className="pulse-chip"
                  onClick={() => openDetail(item.id, item.title)}
                >
                  <span>{item.title}</span>
                </button>
              ))}
            </div>
          ) : (
            <Text type="secondary">{I18N.pulseEmpty}</Text>
          )}
        </section>

        <section className="activity-board">
          <article className="activity-panel">
            <Space className="activity-head" size={8}>
              <StarOutlined />
              <Text strong>{I18N.favoritesTitle}</Text>
            </Space>
            {favoriteCards.length ? (
              <div className="activity-chip-wrap">
                {favoriteCards.map((item) => (
                  <button
                    key={`fav-${item.id}`}
                    className="activity-chip"
                    onClick={() => openDetail(item.id, item.title)}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            ) : (
              <Text type="secondary">{I18N.favoritesEmpty}</Text>
            )}
          </article>

          <article className="activity-panel">
            <Space className="activity-head" size={8}>
              <HistoryOutlined />
              <Text strong>{I18N.recentsTitle}</Text>
            </Space>
            {recentCards.length ? (
              <div className="activity-chip-wrap">
                {recentCards.map((item) => (
                  <button
                    key={`recent-${item.id}`}
                    className="activity-chip"
                    onClick={() => openDetail(item.id, item.title)}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            ) : (
              <Text type="secondary">{I18N.recentsEmpty}</Text>
            )}
          </article>
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
          <Tag className="search-shortcut-tag">{I18N.shortcutsMore}</Tag>
        </section>

        <section className="preset-strip">
          <div className="preset-strip-head">
            <Space size={8}>
              <SaveOutlined />
              <Text strong>{I18N.presetsTitle}</Text>
            </Space>
            <Button
              type="default"
              icon={<SaveOutlined />}
              className="preset-save-btn"
              onClick={saveSearchPreset}
              disabled={!keyword.trim()}
            >
              {I18N.presetSave}
            </Button>
          </div>
          {searchPresets.length ? (
            <div className="preset-list">
              {searchPresets.map((preset) => (
                <div key={preset} className="preset-chip-wrap">
                  <button className="preset-chip" onClick={() => applySearchPreset(preset)}>
                    {preset}
                  </button>
                  <button
                    className="preset-chip-close"
                    onClick={() => removeSearchPreset(preset)}
                    aria-label={`${I18N.presetRemoved}: ${preset}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <Text type="secondary">{I18N.presetEmpty}</Text>
          )}
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
            {!isMobile && (
              <Segmented
                className="view-toggle"
                value={viewMode}
                onChange={(value) => {
                  switchViewMode(value);
                }}
                options={[
                  {
                    label: (
                      <Space size={6}>
                        <ColumnWidthOutlined />
                        <span>{I18N.viewSplit}</span>
                      </Space>
                    ),
                    value: 'split'
                  },
                  {
                    label: (
                      <Space size={6}>
                        <AppstoreOutlined />
                        <span>{I18N.viewGrid}</span>
                      </Space>
                    ),
                    value: 'grid'
                  }
                ]}
              />
            )}
          </div>
          <Tag color="blue">{`${I18N.showing} ${visibleItems.length} ${I18N.items}`}</Tag>
        </section>

        <section className={showSplitPane ? 'public-workbench' : 'public-workbench grid-only'}>
          <Card className="workbench-list" title={`${I18N.listTitle} (${total})`}>
            {loading ? (
              <div className="loading-wrap">
                <Spin />
              </div>
            ) : visibleItems.length === 0 ? (
              <Empty description={I18N.noMatch} />
            ) : (
              <>
                {showSplitPane ? (
                  <List
                    itemLayout="vertical"
                    dataSource={visibleItems}
                    renderItem={(item) => (
                      <List.Item
                        className={item.id === activeId ? 'result-item result-item-active' : 'result-item'}
                        onClick={() => openDetail(item.id, item.title)}
                      >
                        <Space direction="vertical" size={6} style={{ width: '100%' }}>
                          <Space>
                            <Text strong className="result-title">
                              {renderHighlighted(item.title, keyword)}
                            </Text>
                            <Tag color={item.has_translation ? 'green' : 'orange'}>
                              {item.has_translation ? I18N.zhGenerated : I18N.enOnly}
                            </Tag>
                            <Tooltip title={favoriteSet.has(item.id) ? I18N.unpinThis : I18N.pinThis}>
                              <Button
                                type="text"
                                size="small"
                                className="result-star-btn"
                                icon={favoriteSet.has(item.id) ? <StarFilled /> : <StarOutlined />}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleFavorite(item.id, item.title);
                                }}
                              />
                            </Tooltip>
                          </Space>
                          <Paragraph ellipsis={{ rows: isMobile ? 2 : 3 }} style={{ marginBottom: 0 }}>
                            {renderHighlighted(item.summary, keyword)}
                          </Paragraph>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {`${I18N.updatedAt} ${dayjs(item.updated_at).format('YYYY-MM-DD HH:mm')}`}
                          </Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                ) : (
                  <div className="result-grid">
                    {visibleItems.map((item) => (
                      <article
                        key={item.id}
                        className={item.id === activeId ? 'result-card result-card-active' : 'result-card'}
                        onClick={() => openDetail(item.id, item.title)}
                      >
                        <Space direction="vertical" size={8} style={{ width: '100%' }}>
                          <Space wrap>
                            <Text strong className="result-title">
                              {renderHighlighted(item.title, keyword)}
                            </Text>
                            <Tag color={item.has_translation ? 'green' : 'orange'}>
                              {item.has_translation ? I18N.zhGenerated : I18N.enOnly}
                            </Tag>
                            <Tooltip title={favoriteSet.has(item.id) ? I18N.unpinThis : I18N.pinThis}>
                              <Button
                                type="text"
                                size="small"
                                className="result-star-btn"
                                icon={favoriteSet.has(item.id) ? <StarFilled /> : <StarOutlined />}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleFavorite(item.id, item.title);
                                }}
                              />
                            </Tooltip>
                          </Space>
                          <Paragraph ellipsis={{ rows: 3 }} style={{ marginBottom: 0 }}>
                            {renderHighlighted(item.summary, keyword)}
                          </Paragraph>
                          <div className="grid-actions">
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {`${I18N.updatedAt} ${dayjs(item.updated_at).format('YYYY-MM-DD HH:mm')}`}
                            </Text>
                            <Button
                              size="small"
                              type="link"
                              onClick={(event) => {
                                event.stopPropagation();
                                openDetail(item.id, item.title);
                              }}
                            >
                              {I18N.detailTitle}
                            </Button>
                          </div>
                        </Space>
                      </article>
                    ))}
                  </div>
                )}
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

          {showSplitPane && (
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

      <Modal
        open={commandOpen}
        title={I18N.commandTitle}
        footer={null}
        onCancel={() => setCommandOpen(false)}
        destroyOnClose
        centered
        className="command-modal"
      >
        <Input
          ref={commandInputRef}
          size="large"
          value={commandQuery}
          onChange={(event) => setCommandQuery(event.target.value)}
          placeholder={I18N.commandPlaceholder}
          prefix={<SearchOutlined />}
          onKeyDown={(event) => {
            if (!filteredCommands.length) return;
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setCommandActiveIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
              return;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setCommandActiveIndex((prev) => Math.max(prev - 1, 0));
            }
          }}
          onPressEnter={() => {
            if (!filteredCommands.length) return;
            executeCommandAt(commandActiveIndex);
          }}
        />
        <div className="command-list-wrap">
          {filteredCommands.length ? (
            <List
              size="small"
              dataSource={filteredCommands}
              renderItem={(item, index) => (
                <List.Item
                  className={index === commandActiveIndex ? 'command-item command-item-active' : 'command-item'}
                  onMouseEnter={() => setCommandActiveIndex(index)}
                  onClick={() => executeCommandAt(index)}
                >
                  <span>{item.label}</span>
                </List.Item>
              )}
            />
          ) : (
            <Empty description={I18N.commandEmpty} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </div>
        <Text type="secondary" className="command-hint">
          {I18N.commandHint}
        </Text>
      </Modal>

      <Modal
        open={hotkeyHelpOpen}
        title={I18N.hotkeyTitle}
        footer={null}
        onCancel={() => setHotkeyHelpOpen(false)}
        destroyOnClose
        centered
        className="hotkey-modal"
      >
        <div className="hotkey-grid">
          {hotkeyRows.map((item) => (
            <div key={item.key} className="hotkey-row">
              <Tag className="hotkey-key">{item.key}</Tag>
              <Text>{item.desc}</Text>
            </div>
          ))}
        </div>
      </Modal>

      {isMobile && (
        <Button type="primary" className="command-fab" onClick={() => setCommandOpen(true)}>
          Cmd
        </Button>
      )}

      {!showSplitPane && (
        <Drawer
          placement={isMobile ? 'bottom' : 'right'}
          width={isMobile ? undefined : 680}
          height={isMobile ? '80vh' : undefined}
          title={detail?.title_zh || detail?.title_en || I18N.detailTitle}
          open={overlayDetailOpen}
          onClose={() => setOverlayDetailOpen(false)}
          className={isMobile ? 'mobile-detail-drawer' : 'desktop-detail-drawer'}
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
