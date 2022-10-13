declare const L: any;
import { PMTiles, Source } from "./index";

export const leafletRasterLayer = (source: PMTiles, options: any) => {
  const cls = L.GridLayer.extend({
    createTile: function (coord: any, done: any) {
      const tile: any = document.createElement("img");
      const controller = new AbortController();
      const signal = controller.signal;
      tile.cancel = () => {
        controller.abort();
      };
      source.getZxy(coord.z, coord.x, coord.y).then((arr) => {
        if (arr) {
          const blob = new Blob([arr.data], { type: "image/png" });
          const imageUrl = window.URL.createObjectURL(blob);
          tile.src = imageUrl;
          tile.cancel = null;
          done(null, tile);
        } else {
          // return an empty image
        }
      });
      return tile;
    },

    _removeTile: function (key: string) {
      const tile = this._tiles[key];
      if (!tile) {
        return;
      }

      if (tile.el.cancel) tile.el.cancel();

      tile.el.width = 0;
      tile.el.height = 0;
      tile.el.deleted = true;
      L.DomUtil.remove(tile.el);
      delete this._tiles[key];
      this.fire("tileunload", {
        tile: tile.el,
        coords: this._keyToTileCoords(key),
      });
    },
  });
  return new cls(options);
};

export class Protocol {
  tiles: Map<string, PMTiles>;

  constructor() {
    this.tiles = new Map<string, PMTiles>();
  }

  add(p: PMTiles) {
    this.tiles.set(p.source.getKey(), p);
  }

  get(url: string) {
    return this.tiles.get(url);
  }

  tile = (params: any, callback: any) => {
    const re = new RegExp(/pmtiles:\/\/(.+)\/(\d+)\/(\d+)\/(\d+)/);
    const result = params.url.match(re);
    const pmtiles_url = result[1];

    let instance = this.tiles.get(pmtiles_url);
    if (!instance) {
      instance = new PMTiles(pmtiles_url);
      this.tiles.set(pmtiles_url, instance);
    }
    const z = result[2];
    const x = result[3];
    const y = result[4];

    const controller = new AbortController();
    const signal = controller.signal;
    let cancel = () => {
      controller.abort();
    };

    instance.getZxy(+z, +x, +y, signal).then((resp) => {
      if (resp) {
        callback(null, new Uint8Array(resp.data), resp.cacheControl, resp.expires);
      } else {
        callback(null, new Uint8Array(), null, null);
      }
    }).catch((e) => {
      if (e.name !== "AbortError") {
        throw e;
      }
    });
    return {
      cancel: cancel
    };
  };
}