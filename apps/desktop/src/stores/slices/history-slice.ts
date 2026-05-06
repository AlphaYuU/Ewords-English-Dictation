import type { AppState, GetAppState, SetAppState } from "../store-types";
import { persistDatabaseMutation } from "../store-persistence";

export function createHistorySlice(set: SetAppState, get: GetAppState): Pick<AppState, "deleteHistory"> {
  return {
    deleteHistory: (sessionId) => {
      set((state) => ({
        dialog: null,
        history: state.history.filter((item) => item.sessionId !== sessionId),
        sessions: state.sessions.filter((item) => item.id !== sessionId),
        results: state.results.filter((item) => item.sessionId !== sessionId),
      }));
      if (get().dataSource === "database") persistDatabaseMutation(set, get, { resource: "delete-history", sessionId });
    },
  };
}
