import { useEffect, useRef, useState } from 'react';
import LazyLoader from './lazy-loader';
import { useApi } from './use-api';
import { searchMeals } from './endpoint-module';
import { didAbort } from './api-client';

// useApi + delayed loader: status flags come from one enum, not four booleans.
const Users = ({ fetchUsers }) => {
  const { data: users, exec, isPending } = useApi(fetchUsers);

  useEffect(() => {
    exec();
  }, []);

  return (
    <>
      <button onClick={exec}>
        <LazyLoader show={isPending} delay={500} fallback="Fetch users">
          Loading...
        </LazyLoader>
      </button>
      {users?.map((user) => <p key={user.id}>{user.name}</p>)}
    </>
  );
};

// Search-as-you-type: each keystroke aborts the previous request, so a slow
// early response can never overwrite a fast later one.
const useSearchMeals = () => {
  const [meals, setMeals] = useState([]);
  const abortRef = useRef({});

  const search = async (query) => {
    abortRef.current.abort?.();
    try {
      setMeals(await searchMeals(query, { abort: (cancel) => (abortRef.current.abort = cancel) }));
    } catch (error) {
      if (!didAbort(error)) throw error;
    }
  };

  return { meals, search };
};

export { Users, useSearchMeals };
