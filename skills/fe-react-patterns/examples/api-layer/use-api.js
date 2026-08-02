import { useState } from 'react';
import { useApiStatus, PENDING, SUCCESS, ERROR } from './use-api-status';

export function useApi(fn) {
  const [data, setData] = useState();
  const [error, setError] = useState();
  const { status, setStatus, ...flags } = useApiStatus();

  const exec = async (...args) => {
    try {
      setStatus(PENDING);
      const result = await fn(...args);
      setData(result);
      setStatus(SUCCESS);
      return { data: result, error: null };
    } catch (e) {
      setError(e);
      setStatus(ERROR);
      return { data: null, error: e };
    }
  };

  return { data, error, status, exec, ...flags };
}
