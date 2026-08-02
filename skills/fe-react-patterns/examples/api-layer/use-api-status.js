import { useMemo, useState } from 'react';

export const IDLE = 'IDLE';
export const PENDING = 'PENDING';
export const SUCCESS = 'SUCCESS';
export const ERROR = 'ERROR';

const ALL_STATUSES = [IDLE, PENDING, SUCCESS, ERROR];

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const deriveFlags = (currentStatus) =>
  Object.fromEntries(
    ALL_STATUSES.map((status) => [
      `is${capitalize(status.toLowerCase())}`,
      status === currentStatus,
    ])
  );

export const useApiStatus = (initialStatus = IDLE) => {
  const [status, setStatus] = useState(initialStatus);
  const flags = useMemo(() => deriveFlags(status), [status]);

  return { status, setStatus, ...flags };
};
