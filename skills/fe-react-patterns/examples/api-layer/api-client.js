import axios from 'axios';

const axiosInstance = axios.create({ baseURL: process.env.API_BASE_URL });

export const didAbort = (error) => axios.isCancel(error);
export const isApiError = (error) => axios.isAxiosError(error);

const withAbort = (fn) => async (...args) => {
  const originalConfig = args[args.length - 1];
  const { abort, ...config } = originalConfig;

  if (typeof abort === 'function') {
    const { cancel, token } = axios.CancelToken.source();
    config.cancelToken = token;
    abort(cancel);
  }

  try {
    return args.length > 2
      ? await fn(args[0], args[1], config)
      : await fn(args[0], config);
  } catch (error) {
    if (didAbort(error)) error.aborted = true;
    throw error;
  }
};

const withLogger = (promise) =>
  promise.catch((error) => {
    if (process.env.DEBUG_API) console.error(error.response ?? error.request ?? error.message);
    throw error;
  });

const api = (client) => ({
  get: (url, config = {}) => withLogger(withAbort(client.get)(url, config)),
  delete: (url, config = {}) => withLogger(withAbort(client.delete)(url, config)),
  post: (url, body, config = {}) => withLogger(withAbort(client.post)(url, body, config)),
  patch: (url, body, config = {}) => withLogger(withAbort(client.patch)(url, body, config)),
  put: (url, body, config = {}) => withLogger(withAbort(client.put)(url, body, config)),
});

export default api(axiosInstance);
