import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { AuthError } from '../services/api';

/*
  useLoad(fetcher, deps)
    Runs fetcher() when deps change and whenever the screen regains focus, so
    lists are fresh after coming back from a form. Returns { data, loading,
    refreshing, error, reload, refresh }.
*/
export function useLoad(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const seq = useRef(0);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;

  const run = useCallback(async (mode) => {
    const id = ++seq.current;
    if (mode === 'refresh') setRefreshing(true);
    else if (mode === 'initial') setLoading(true);
    try {
      const res = await fetchRef.current();
      if (id === seq.current) { setData(res); setError(null); }
    } catch (e) {
      if (id === seq.current && !(e instanceof AuthError)) setError(e.message);
    } finally {
      if (id === seq.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run('initial'); }, deps);

  const first = useRef(true);
  useFocusEffect(useCallback(() => {
    if (first.current) { first.current = false; return; }
    run('silent');
  }, [run]));

  return {
    data, loading, refreshing, error, setData,
    reload: () => run('initial'),
    refresh: () => run('refresh'),
    silentReload: () => run('silent'),
  };
}

/*
  usePaged(fetchPage, listKey, deps)
    fetchPage(page) → server response with `has_more` and an array at `listKey`.
    Keeps the first page's other fields (totals etc.) in `meta`.
*/
export function usePaged(fetchPage, listKey, deps = []) {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const seq = useRef(0);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const loadFirst = useCallback(async (mode = 'initial') => {
    const id = ++seq.current;
    if (mode === 'refresh') setRefreshing(true);
    else if (mode === 'initial') setLoading(true);
    try {
      const res = await fetchRef.current(1);
      if (id !== seq.current) return;
      setItems(res[listKey] || []);
      setMeta(res);
      setHasMore(!!res.has_more);
      setPage(1);
      setError(null);
    } catch (e) {
      if (id === seq.current && !(e instanceof AuthError)) setError(e.message);
    } finally {
      if (id === seq.current) { setLoading(false); setRefreshing(false); }
    }
  }, [listKey]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    const id = seq.current;
    setLoadingMore(true);
    try {
      const res = await fetchRef.current(page + 1);
      if (id !== seq.current) return;
      setItems((prev) => [...prev, ...(res[listKey] || [])]);
      setHasMore(!!res.has_more);
      setPage(page + 1);
    } catch (_) {
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, page, listKey]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadFirst('initial'); }, deps);

  const first = useRef(true);
  useFocusEffect(useCallback(() => {
    if (first.current) { first.current = false; return; }
    loadFirst('silent');
  }, [loadFirst]));

  return {
    items, meta, hasMore, loading, loadingMore, refreshing, error, loadMore,
    reload: () => loadFirst('initial'),
    refresh: () => loadFirst('refresh'),
    silentReload: () => loadFirst('silent'),
  };
}
