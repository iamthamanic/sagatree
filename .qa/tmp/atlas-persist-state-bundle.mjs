// src/domains/world/atlas/atlas-persist-state.ts
var CONFLICT_RE = /revision conflict|inzwischen geändert/i;
function isAtlasRevisionConflictMessage(message) {
  return CONFLICT_RE.test(message);
}
function reduceAtlasPersistStatus(current, event) {
  switch (event.type) {
    case "edit":
      return current === "saving" ? "saving" : "dirty";
    case "save_start":
      if (current === "conflict") return "saving";
      if (current === "clean" || current === "saved") return current;
      return "saving";
    case "save_ok":
      return "saved";
    case "save_fail":
      return event.conflict ? "conflict" : "dirty";
    case "reload":
      return "clean";
    case "ack_saved":
      return current === "saved" ? "clean" : current;
    default:
      return current;
  }
}
function atlasPersistStatusLabelDe(status) {
  if (status === "dirty") return "Ungespeicherte \xC4nderungen";
  if (status === "saving") return "Speichern\u2026";
  if (status === "saved") return "Gespeichert";
  if (status === "conflict") return "Konflikt \u2014 neu laden oder erneut speichern";
  return "Weltkarte \xB7 zoomen f\xFCr Orte";
}
export {
  atlasPersistStatusLabelDe,
  isAtlasRevisionConflictMessage,
  reduceAtlasPersistStatus
};
