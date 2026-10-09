import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'src/data/uzbekistan-regions.geojson');
const districtSourcePath = path.join(root, 'src/data/uzbekistan-districts.geojson');
const outputPath = path.join(root, 'src/uzbekistanMapData.js');
const districtOutputPath = path.join(root, 'src/uzbekistanDistrictData.js');
const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const districtSource = JSON.parse(await readFile(districtSourcePath, 'utf8'));

const regionNames = {
  1703: ['andijan', 'Andijon'],
  1706: ['bukhara', 'Buxoro'],
  1708: ['jizzakh', 'Jizzax'],
  1710: ['kashkadarya', 'Qashqadaryo'],
  1712: ['navoiy', 'Navoiy'],
  1714: ['namangan', 'Namangan'],
  1718: ['samarkand', 'Samarqand'],
  1722: ['surkhandarya', 'Surxondaryo'],
  1724: ['syrdarya', 'Sirdaryo'],
  1726: ['tashkent-city', 'Toshkent sh.'],
  1727: ['tashkent-region', 'Toshkent vil.'],
  1730: ['fergana', 'Farg‘ona'],
  1733: ['khorezm', 'Xorazm'],
  1735: ['karakalpakstan', 'Qoraqalpog‘iston'],
};
const labelOffsets = {
  jizzakh: [-18, 9, 'end'], syrdarya: [-3, 15, 'middle'],
  'tashkent-region': [25, -10, 'start'], 'tashkent-city': [0, 25, 'middle'],
  namangan: [-8, -9, 'end'], andijan: [12, -8, 'start'], fergana: [10, 10, 'start'],
};
const uzbekCyrillic = {
  а: 'a', б: 'b', в: 'v', г: 'g', ғ: 'g‘', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z',
  и: 'i', й: 'y', к: 'k', қ: 'q', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ў: 'o‘', ф: 'f', х: 'x', ҳ: 'h', ц: 'ts', ч: 'ch',
  ш: 'sh', щ: 'shch', ъ: '’', ь: '', э: 'e', ю: 'yu', я: 'ya',
};
const toLatinUzbek = (value = '') => [...value].map((letter) => {
  const lower = letter.toLocaleLowerCase('uz-UZ');
  const replacement = uzbekCyrillic[lower];
  if (replacement === undefined) return letter;
  return letter === letter.toLocaleUpperCase('uz-UZ')
    ? replacement.charAt(0).toLocaleUpperCase('uz-UZ') + replacement.slice(1)
    : replacement;
}).join('');

const ringsByFeature = source.features.map((feature) => ({
  feature,
  rings: feature.geometry.coordinates.flatMap((polygon) => polygon),
}));
const regionIdByCode = Object.fromEntries(Object.entries(regionNames).map(([code, [id]]) => [code, id]));
const coordinates = ringsByFeature.flatMap(({ rings }) => rings.flat());
const longitudes = coordinates.map(([longitude]) => longitude);
const latitudes = coordinates.map(([, latitude]) => latitude);
const bounds = {
  minLon: Math.min(...longitudes), maxLon: Math.max(...longitudes),
  minLat: Math.min(...latitudes), maxLat: Math.max(...latitudes),
};
const width = 520;
const height = 350;
const padding = 18;
const longitudeScale = Math.cos(((bounds.minLat + bounds.maxLat) / 2 * Math.PI) / 180);
const project = ([longitude, latitude]) => [longitude * longitudeScale, -latitude];
const projected = coordinates.map(project);
const xValues = projected.map(([x]) => x);
const yValues = projected.map(([, y]) => y);
const minX = Math.min(...xValues);
const maxX = Math.max(...xValues);
const minY = Math.min(...yValues);
const maxY = Math.max(...yValues);
const scale = Math.min(
  (width - padding * 2) / (maxX - minX),
  (height - padding * 2) / (maxY - minY),
);
const offsetX = (width - (maxX - minX) * scale) / 2;
const offsetY = (height - (maxY - minY) * scale) / 2;
const toCanvas = (point) => {
  const [x, y] = project(point);
  return [offsetX + (x - minX) * scale, offsetY + (y - minY) * scale];
};

function simplifyOpen(points, tolerance) {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];

  while (stack.length) {
    const [start, end] = stack.pop();
    const [ax, ay] = points[start];
    const [bx, by] = points[end];
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    let farthest = -1;
    let maxDistance = tolerance;

    for (let index = start + 1; index < end; index += 1) {
      const [px, py] = points[index];
      const ratio = lengthSquared ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared)) : 0;
      const distance = Math.hypot(px - (ax + ratio * dx), py - (ay + ratio * dy));
      if (distance > maxDistance) {
        farthest = index;
        maxDistance = distance;
      }
    }

    if (farthest >= 0) {
      keep[farthest] = 1;
      stack.push([start, farthest], [farthest, end]);
    }
  }

  return points.filter((_, index) => keep[index]);
}

function simplifyRing(ring, tolerance = 0.55) {
  const points = ring.slice(0, -1).map(toCanvas);
  if (points.length <= 4) return points;
  let opposite = 1;
  let farthest = 0;
  for (let index = 1; index < points.length; index += 1) {
    const distance = Math.hypot(points[index][0] - points[0][0], points[index][1] - points[0][1]);
    if (distance > farthest) {
      farthest = distance;
      opposite = index;
    }
  }
  const firstHalf = simplifyOpen(points.slice(0, opposite + 1), tolerance);
  const secondHalf = simplifyOpen([...points.slice(opposite), points[0]], tolerance);
  return [...firstHalf, ...secondHalf.slice(1, -1)];
}

const regions = ringsByFeature.map(({ feature, rings }) => {
  const code = feature.properties.code;
  const [id, short] = regionNames[code] || [];
  if (!id) throw new Error(`Unsupported Uzbekistan region code: ${code}`);
  const allPoints = rings.flat().map(toCanvas);
  const x = allPoints.reduce((sum, [pointX]) => sum + pointX, 0) / allPoints.length;
  const y = allPoints.reduce((sum, [, pointY]) => sum + pointY, 0) / allPoints.length;
  const regionWidth = Math.max(...allPoints.map(([pointX]) => pointX)) - Math.min(...allPoints.map(([pointX]) => pointX));
  const regionHeight = Math.max(...allPoints.map(([, pointY]) => pointY)) - Math.min(...allPoints.map(([, pointY]) => pointY));
  const [labelOffsetX = 0, labelOffsetY = -8, labelAnchor = 'middle'] = labelOffsets[id] || [];
  const path = rings.map((ring) => {
    const points = simplifyRing(ring);
    return `${points.map(([pointX, pointY], index) => `${index ? 'L' : 'M'}${pointX.toFixed(1)},${pointY.toFixed(1)}`).join('')}Z`;
  }).join('');
  return {
    id, code, short, x: Number(x.toFixed(1)), y: Number(y.toFixed(1)),
    width: Number(regionWidth.toFixed(1)), height: Number(regionHeight.toFixed(1)),
    labelX: Number((x + labelOffsetX).toFixed(1)), labelY: Number((y + labelOffsetY).toFixed(1)),
    labelAnchor, path,
  };
}).sort((left, right) => left.id.localeCompare(right.id));

const districts = districtSource.features.map((feature) => {
  const regionId = regionIdByCode[feature.properties.obl_code];
  if (!regionId) return null;
  const rings = feature.geometry.coordinates.flatMap((polygon) => polygon);
  const points = rings.flat().map(toCanvas);
  const allCoordinates = rings.flat();
  const districtBounds = {
    minX: Math.min(...points.map(([x]) => x)), maxX: Math.max(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)), maxY: Math.max(...points.map(([, y]) => y)),
  };
  const bbox = [
    Math.min(...allCoordinates.map(([longitude]) => longitude)),
    Math.min(...allCoordinates.map(([, latitude]) => latitude)),
    Math.max(...allCoordinates.map(([longitude]) => longitude)),
    Math.max(...allCoordinates.map(([, latitude]) => latitude)),
  ].map((value) => Number(value.toFixed(5)));
  const [x, y] = toCanvas([(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]);
  const path = rings.map((ring) => {
    const simplified = simplifyRing(ring, 0.04);
    return `${simplified.map(([pointX, pointY], index) => `${index ? 'L' : 'M'}${pointX.toFixed(2)},${pointY.toFixed(2)}`).join('')}Z`;
  }).join('');
  return {
    id: feature.properties.full_id,
    osmId: feature.properties.osm_id,
    regionId,
    name: toLatinUzbek(feature.properties.name_uz).replace(/\s+/g, ' ').trim(),
    x: Number(x.toFixed(1)), y: Number(y.toFixed(1)),
    width: Number((districtBounds.maxX - districtBounds.minX).toFixed(1)),
    height: Number((districtBounds.maxY - districtBounds.minY).toFixed(1)),
    bbox, path,
  };
}).filter(Boolean);

const projection = { longitudeScale, minX, minY, scale, offsetX, offsetY };
await writeFile(outputPath, `// Generated from the CC BY 4.0 Uzbekistan OSM administrative-boundary dataset.\nconst projection = ${JSON.stringify(projection)};\nexport const projectUzbekistanPoint = (longitude, latitude) => [projection.offsetX + (longitude * projection.longitudeScale - projection.minX) * projection.scale, projection.offsetY + (-latitude - projection.minY) * projection.scale];\nexport const uzbekistanMapRegions = ${JSON.stringify(regions)};\n`);
await writeFile(districtOutputPath, `// Generated from the CC BY 4.0 Uzbekistan OSM administrative-boundary dataset.\nexport const uzbekistanDistricts = ${JSON.stringify(districts)};\n`);
console.log(`Generated ${regions.length} regions and ${districts.length} district shapes.`);
