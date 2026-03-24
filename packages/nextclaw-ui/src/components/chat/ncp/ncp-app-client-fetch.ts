type FetchLike = typeof fetch;

export function createNcpAppClientFetch(): FetchLike {
  return (input, init) =>
    fetch(input, {
      credentials: 'include',
      ...init
    });
}
