import type { Actor, ApplicationPort, MapUpdate, ViewContext } from '../domain/contracts.js';

/** App layer receives only the domain port; database capabilities stay in the composition root. */
export function applicationCommands(port: ApplicationPort) {
  return Object.freeze({
    listMaps: (context: ViewContext) => port.listMaps(context),
    getMap: (mapId: string, context: ViewContext) => port.getMap(mapId, context),
    updateMapTitle: (request: MapUpdate, actor: Actor) => port.updateMapTitle(request, actor),
    setSessionStatus: (id: string, status: string, context: ViewContext) => port.setSessionStatus(id, status, context),
  });
}
