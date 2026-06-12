import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/client";

export function useApiQuery<T>(
  key: any[],
  endpoint: string,
  options: {
    method?: "GET" | "POST";
    body?: any;
    params?: any;
    [key: string]: any;
  } = {},
) {
  const { method = "GET", body, params, ...queryOptions } = options;
  const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === "true";

  return useQuery<T>({
    queryKey: [...key, method, body, params],
    queryFn: async () => {
      // Retornar Mock si estamos en Modo Test
      if (isTestMode) {
        const { getMockData } = require("@/docs/mocks");
        const mock = getMockData(endpoint);
        if (mock) {
          console.log(`[Mock] Sirviendo datos para: ${endpoint}`);
          return mock as T;
        }
      }

      try {
        const response = method === "POST" ? await api.post(endpoint, body) : await api.get(endpoint, { params });

        const finalData = response.data?.result || response.data?.data || response.data;

        return finalData;
      } catch (error: any) {
        throw error;
      }
    },
    ...queryOptions,
  });
}

/**
 * Hook generico para mutaciones (POST, PUT, DELETE)
 */
export function useApiMutation<T, B = any>(
  method: "post" | "put" | "delete" | "patch",
  endpoint?: string,
  options: {
    invalidateQuery?: boolean | { queryKey: any[] };
    onSuccess?: (data: T, variables: any, context: any) => void;
    onError?: (error: any) => void;
    [key: string]: any;
  } = {},
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ url, body }: { url?: string; body?: B }) => {
      const targetUrl = url || endpoint;
      if (!targetUrl) throw new Error("No endpoint provided for mutation");

      const response = method === "delete" ? await api.delete(targetUrl) : await api[method](targetUrl, body);

      return response.data;
    },
    ...options,
    onSuccess: (data: any, variables: any, context: any) => {
      if (options.invalidateQuery === true) {
        queryClient.invalidateQueries();
      } else if (typeof options.invalidateQuery === "object" && options.invalidateQuery.queryKey) {
        queryClient.invalidateQueries({
          queryKey: options.invalidateQuery.queryKey,
        });
      }

      if (options.onSuccess) options.onSuccess(data, variables, context);
    },
  });
}
