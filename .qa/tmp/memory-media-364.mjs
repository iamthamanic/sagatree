// src/domains/session/media/media-plane-contract.ts
function deriveMediaRoomId(sessionId) {
  const trimmed = sessionId.trim();
  if (!trimmed) {
    throw new Error("sessionId required for media room");
  }
  return `sagatree-session-${trimmed}`;
}

// src/infrastructure/session/media/memory-media-plane-bus.ts
var MemoryMediaPlaneBus = class {
  handlers = /* @__PURE__ */ new Set();
  subscribe(identity, handler) {
    const entry = { identity, handler };
    this.handlers.add(entry);
    return () => {
      this.handlers.delete(entry);
    };
  }
  publish(message) {
    for (const entry of this.handlers) {
      if (entry.identity === message.publisherIdentity) continue;
      entry.handler(message);
    }
  }
};
var defaultMemoryMediaPlaneBus = new MemoryMediaPlaneBus();

// src/infrastructure/session/media/memory-media-plane-adapter.ts
var MemoryMediaPlaneAdapter = class {
  constructor(bus = defaultMemoryMediaPlaneBus) {
    this.bus = bus;
  }
  providerId = "memory";
  health = "unavailable";
  roomId = "";
  localIdentity = null;
  published = [];
  role = "viewer";
  unsubData = null;
  localDataHandlers = /* @__PURE__ */ new Set();
  async connect(input) {
    if (!input.token || !input.url) {
      this.health = "unavailable";
      throw new Error("Media token/url missing");
    }
    this.health = "connecting";
    this.roomId = deriveMediaRoomId(input.sessionId);
    this.localIdentity = input.identity;
    this.role = input.access.role;
    this.published = [];
    this.unsubData?.();
    this.unsubData = this.bus.subscribe(input.identity, (message) => {
      for (const handler of this.localDataHandlers) handler(message);
    });
    this.health = "ready";
  }
  async disconnect() {
    this.unsubData?.();
    this.unsubData = null;
    this.localDataHandlers.clear();
    this.health = "unavailable";
    this.localIdentity = null;
    this.published = [];
    this.roomId = "";
  }
  async publish(intents) {
    if (this.health !== "ready" && this.health !== "reconnecting") {
      throw new Error("Media plane not ready");
    }
    for (const intent of intents) {
      if (!intent.enabled) continue;
      if (!this.published.includes(intent.kind)) {
        this.published.push(intent.kind);
      }
    }
  }
  async unpublish(kinds) {
    this.published = this.published.filter((k) => !kinds.includes(k));
  }
  async publishData(topic, payload) {
    if (this.health !== "ready" || !this.localIdentity) {
      throw new Error("Media plane not ready for data");
    }
    if (!this.published.includes("liveact-data") && topic === "liveact-data") {
      this.published.push("liveact-data");
    }
    this.bus.publish({
      topic,
      payload,
      publisherIdentity: this.localIdentity
    });
  }
  subscribeData(handler) {
    this.localDataHandlers.add(handler);
    return () => {
      this.localDataHandlers.delete(handler);
    };
  }
  getPresence() {
    return {
      roomId: this.roomId,
      health: this.health,
      localIdentity: this.localIdentity,
      participants: this.localIdentity === null ? [] : [
        {
          identity: this.localIdentity,
          role: this.role,
          published: [...this.published]
        }
      ]
    };
  }
  getHealth() {
    return this.health;
  }
  /** Test helper: simulate reconnect cycle. */
  async simulateReconnect() {
    this.health = "reconnecting";
    this.health = "ready";
  }
};
export {
  MemoryMediaPlaneAdapter,
  MemoryMediaPlaneBus,
  defaultMemoryMediaPlaneBus
};
