export type EditorEventMap = {
  fileOpened: { path: string };
  fileClosed: { path: string };
  fileSaved: { path: string };
  selectionChanged: { path: string; selection: SerializedSelection | null };
  cursorChanged: { path: string; lineNumber: number; column: number };
  contentChanged: { path: string; isDirty: boolean };
};

export interface SerializedSelection {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

type Listener<K extends keyof EditorEventMap> = (payload: EditorEventMap[K]) => void;

class EditorEventBus {
  private listeners: {
    [K in keyof EditorEventMap]?: Set<Listener<K>>;
  } = {};

  emit<K extends keyof EditorEventMap>(event: K, payload: EditorEventMap[K]): void {
    const callbacks = this.listeners[event];
    if (!callbacks) {
      return;
    }
    for (const callback of callbacks) {
      callback(payload);
    }
  }

  subscribe<K extends keyof EditorEventMap>(event: K, listener: Listener<K>): () => void {
    const callbacks = this.listeners[event] as Set<Listener<K>> | undefined;
    if (callbacks) {
      callbacks.add(listener);
    } else {
      this.listeners[event] = new Set([listener]) as Set<Listener<keyof EditorEventMap>>;
    }
    return () => {
      const eventListeners = this.listeners[event] as Set<Listener<K>> | undefined;
      eventListeners?.delete(listener);
      if (eventListeners && eventListeners.size === 0) {
        delete this.listeners[event];
      }
    };
  }
}

export const editorEventBus = new EditorEventBus();
