import { useState, useEffect, useCallback } from "react";
import { AxiosError, AxiosResponse } from "axios";
import api from "@/modules/core/api/client";

interface FetchOptions {
  manual?: boolean;
  params?: any;
}

interface FetchResult<T> {
  data: T | null;
  loading: boolean;
  error: AxiosError | null;
  refetch: () => void;
  get: (url?: string, params?: any) => Promise<T | null>;
  post: <B = any, R = T>(url: string, body: B) => Promise<R | null>;
  put: <B = any, R = T>(url: string, body: B) => Promise<R | null>;
  del: <R = T>(url: string) => Promise<R | null>;
}

export function useFetchData<T = any>(
  endpoint: string,
  options: FetchOptions = {},
): FetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(!options.manual);
  const [error, setError] = useState<AxiosError | null>(null);

  const fetchData = useCallback(
    async (urlOverride?: string, paramsOverride?: any) => {
      setLoading(true);
      setError(null);
      try {
        const urlToUse = urlOverride || endpoint;
        const response: AxiosResponse<T> = await api.get(urlToUse, {
          params: paramsOverride || options.params,
        });
        // console.log(`[useFetch] GET ${urlToUse} Response:`, response.data);
        setData(response.data);
        return response.data;
      } catch (err) {
        if (err instanceof AxiosError) {
          setError(err);
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    [endpoint, options.params],
  );

  useEffect(() => {
    if (!options.manual) {
      fetchData();
    }
  }, [fetchData, options.manual]);

  const post = async <B = any, R = T>(
    url: string,
    body: B,
  ): Promise<R | null> => {
    setLoading(true);
    setError(null);
    try {
      const response: AxiosResponse<R> = await api.post(url, body);
      return response.data;
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err);
      }
      return null;
    } finally {
      setLoading(false);
    }
  };

  const put = async <B = any, R = T>(
    url: string,
    body: B,
  ): Promise<R | null> => {
    setLoading(true);
    setError(null);
    try {
      const response: AxiosResponse<R> = await api.put(url, body);
      return response.data;
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err);
      }
      return null;
    } finally {
      setLoading(false);
    }
  };

  const del = async <R = T>(url: string): Promise<R | null> => {
    setLoading(true);
    setError(null);
    try {
      const response: AxiosResponse<R> = await api.delete(url);
      return response.data;
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err);
      }
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    data,
    loading,
    error,
    refetch: () => fetchData(),
    get: fetchData,
    post,
    put,
    del,
  };
}
