import { useEffect, useState } from 'react';

// Renders `children` only once `show` has stayed true for `delay` ms, so a fast
// response never produces a spinner flash. Falls back to `fallback` until then.
const LazyLoader = ({ show = false, delay = 0, fallback = null, children }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show) {
      setVisible(false);
      return;
    }
    if (delay === 0) {
      setVisible(true);
      return;
    }
    const timeout = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timeout);
  }, [show, delay]);

  return visible ? children : fallback;
};

export default LazyLoader;
