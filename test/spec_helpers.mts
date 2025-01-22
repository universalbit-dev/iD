import { beforeEach, afterEach, it } from 'vitest';
import 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import 'happen';
import fetchMock from 'fetch-mock';
import envs from '../config/envs.mjs';

chai.use(sinonChai);

declare var global: typeof globalThis;

global.before = beforeEach;
global.after = afterEach;
global.fetchMock = fetchMock;
global.sinon = sinon;
global.VITEST = true;

// create global variables for this data, to match what the esbuild config does
for (const [key, value] of Object.entries(envs)) {
  Reflect.set(global, key, JSON.parse(value));
}

// the 'happen' library explicitly references `window` when creating an event,
// but we need to use jsdom's window, so we have to patch initEvent.
const { initMouseEvent } = MouseEvent.prototype;
MouseEvent.prototype.initMouseEvent = function (...args) {
  args[3] = jsdom.window;
  return initMouseEvent.apply(this, args);
};
const { initUIEvent } = UIEvent.prototype;
UIEvent.prototype.initUIEvent = function (...args) {
  args[3] = jsdom.window;
  return initUIEvent.apply(this, args);
};

// vitest has deprecated the done() callback, so we overwrite the `it` function
const _it = it;
Reflect.set(
  global,
  'it',
  Object.assign(
    (msg: string, fn: (done?: () => void) => void | Promise<void>) => {
      _it(msg, () => {
        if (fn.length) {
          // there is a done callback -> return a promise instead
          return new Promise<void>((done) => fn(done));
        }

        // no done callback -> normal behaviour
        return fn();
      });
    },
    { todo: _it.todo, skip: _it.skip, only: _it.only, each: _it.each },
  ),
);

// must be imported after global envs are defined
await import('../modules/id.js');
const iD = global.iD;
iD.setDebug(true);

// @ts-expect-error
// Disable things that use the network
for (var k in iD.services) { delete iD.services[k]; }

// Try not to load imagery
window.location.hash = '#background=none';

// Run without data for speed (tests which need data can set it up themselves)
iD.fileFetcher.assetPath('../dist/');
const cached: any = iD.fileFetcher.cache();

// Initializing `coreContext` will try loading the locale data and English locale strings:
cached.locales = { en: { rtl: false, pct: 1 } };
cached.locales_index_general = { en: { rtl: false, pct: 1 } };
cached.locales_index_tagging = { en: { rtl: false, pct: 1 } };

// Use fake data for the 'tagging' scope
cached.locale_tagging_en = {
  en: {
    presets: {
      fields: {
        restrictions: {
          label: 'Turn Restrictions'
        },
        access: {
          label: 'Allowed Access',
          placeholder: 'Not Specified',
          types: {
            access: 'All',
            foot: 'Foot',
            motor_vehicle: 'Motor Vehicles',
            bicycle: 'Bicycles',
            horse: 'Horses'
          },
          options: {
            yes: {
              title: 'Allowed',
              description: 'Access allowed by law; a right of way'
            },
            no: {
              title: 'Prohibited',
              description: 'Access not allowed to the general public'
            },
            permissive: {
              title: 'Permissive',
              description: 'Access allowed until such time as the owner revokes the permission'
            },
            private: {
              title: 'Private',
              description: 'Access allowed only with permission of the owner on an individual basis'
            },
            designated: {
              title: 'Designated',
              description: 'Access allowed according to signs or specific local laws'
            },
            destination: {
              title: 'Destination',
              description: 'Access allowed only to reach a destination'
            },
            dismount: {
              title: 'Dismount',
              description: 'Access allowed but rider must dismount'
            },
            permit: {
              title: 'Permit',
              description: 'Access allowed only with a valid permit or license'
            }
          }
        }
      }
    }
  }
};

// Load the actual data from `dist/locales/` for the 'general' scope
iD.localizer.loadLocale('en', 'general', 'locales');
// Load the fake data seeded above for the 'tagging' scope
iD.localizer.loadLocale('en', 'tagging');


// Initializing `coreContext` initializes `_background`, which tries loading:
cached.imagery = [];
// Initializing `coreContext` initializes `_presets`, which tries loading:
cached.preset_categories = {};
cached.preset_defaults = {};
cached.preset_fields = {};
cached.preset_presets = {};
// Initializing `coreContext` initializes `_validator`, which tries loading:
cached.deprecated = [];
// Initializing `coreContext` initializes `_uploader`, which tries loading:
cached.discarded = {};

// @ts-expect-error
window.d3 = iD.d3; // Remove this if we can avoid exporting all of d3.js

// @ts-expect-error
delete window.PointerEvent;  // force the browser to use mouse events

// some sticky fallbacks
const capabilities = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6" generator="OpenStreetMap server" copyright="OpenStreetMap and contributors" attribution="http://www.openstreetmap.org/copyright" license="http://opendatacommons.org/licenses/odbl/1-0/">
  <api>
    <version minimum="0.6" maximum="0.6"/>
    <area maximum="0.25"/>
    <note_area maximum="25"/>
    <tracepoints per_page="5000"/>
    <waynodes maximum="2000"/>
    <changesets maximum_elements="10000"/>
    <timeout seconds="300"/>
    <status database="online" api="online" gpx="online"/>
  </api>
  <policy>
    <imagery>
      <blacklist regex=".*\.google(apis)?\..*/(vt|kh)[\?/].*([xyz]=.*){3}.*"/>
      <blacklist regex="http://xdworld\.vworld\.kr:8080/.*"/>
      <blacklist regex=".*\.here\.com[/:].*"/>
    </imagery>
  </policy>
</osm>`;

fetchMock.sticky('https://www.openstreetmap.org/api/capabilities', capabilities, {sticky: true});
fetchMock.sticky('http://www.openstreetmap.org/api/capabilities', capabilities, {sticky: true});

const vegbilderOwsCapabilities = `<?xml version="1.0" encoding="UTF-8"?>
<wfs:WFS_Capabilities version="2.0.0"
	xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	xmlns="http://www.opengis.net/wfs/2.0"
	xmlns:wfs="http://www.opengis.net/wfs/2.0"
	xmlns:ows="http://www.opengis.net/ows/1.1"
	xmlns:gml="http://www.opengis.net/gml/3.2"
	xmlns:fes="http://www.opengis.net/fes/2.0"
	xmlns:xlink="http://www.w3.org/1999/xlink"
	xmlns:xs="http://www.w3.org/2001/XMLSchema" xsi:schemaLocation="http://www.opengis.net/wfs/2.0 https://www.vegvesen.no/kart/ogc/schemas/wfs/2.0/wfs.xsd"
	xmlns:xml="http://www.w3.org/XML/1998/namespace"
	xmlns:vegbilder_1_0="http://vegbilder_1_0">
<ows:ServiceIdentification>
	<ows:Title>Mock OGC</ows:Title>
	<ows:ServiceType>WFS</ows:ServiceType>
	<ows:ServiceTypeVersion>2.0.0</ows:ServiceTypeVersion>
</ows:ServiceIdentification>
<FeatureTypeList>
	<FeatureType xmlns:vegbilder_1_0="http://vegbilder_1_0">
		<Name>vegbilder_1_0:Vegbilder_2020</Name>
		<Title>Vegbilder_2020</Title>
		<Abstract>Testlayer</Abstract>
		<DefaultCRS>urn:ogc:def:crs:EPSG::4326</DefaultCRS>
		<OtherCRS>urn:ogc:def:crs:EPSG::3857</OtherCRS>
	</FeatureType>
	<FeatureType xmlns:vegbilder_1_0="http://vegbilder_1_0">
		<Name>not_matched_layer:Vegbilder_2020</Name>
		<Title>Vegbilder_2020_4</Title>
		<Abstract>Not matched layer</Abstract>
		<DefaultCRS>urn:ogc:def:crs:EPSG::4326</DefaultCRS>
		<OtherCRS>urn:ogc:def:crs:EPSG::3857</OtherCRS>
	</FeatureType>
</FeatureTypeList>
<fes:Filter_Capabilities/>
</wfs:WFS_Capabilities>`;

fetchMock.sticky({
          url: 'https://www.vegvesen.no/kart/ogc/vegbilder_1_0/ows',
            query: {
              service: 'WFS',
              request: 'GetCapabilities'
            }
          }, vegbilderOwsCapabilities, {sticky: true});
fetchMock.config.fallbackToNetwork = true;
fetchMock.config.overwriteRoutes = false;

beforeAll(async () => {
  await iD.coreLocalizer().ensureLoaded();
});
