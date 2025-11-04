

import { queryClient } from '../config/react-query'

export async function clearOnLogout(): Promise<void> {
  // Clear all react data query
  queryClient.removeQueries()



}
