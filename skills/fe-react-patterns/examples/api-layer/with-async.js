export async function withAsync(fn) {
  try {
    const response = await fn();
    return { response, error: null };
  } catch (error) {
    return { response: null, error };
  }
}

// Call sites branch on a value instead of nesting try/catch:
//
//   const { response, error } = await withAsync(() => fetchUsers());
//   if (error) return handle(error);
//   render(response);
