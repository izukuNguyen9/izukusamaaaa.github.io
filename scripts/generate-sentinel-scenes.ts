import { mkdir, writeFile } from "node:fs/promises";

const SEARCH_URL = "https://earth-search.aws.element84.com/v1/search";
const TILEJSON_URL = "https://titiler.xyz/stac/WebMercatorQuad/tilejson.json";
const OUTPUT_PATH = "public/data/sentinel-scenes.json";
const COLLECTION = "sentinel-2-c1-l2a";
const CLOUD_THRESHOLD = 25;
const SEARCH_LIMIT = 100;
const SEARCH_DAYS = 90;
const VIETNAM_BBOX = [102.14, 8.18, 109.46, 23.39];

type TileJson = {
	tiles: string[];
	bounds: [number, number, number, number];
	center: [number, number, number];
	minzoom: number;
	maxzoom: number;
};

type Scene = {
	id: string;
	datetime: string;
	cloudCover: number;
	self: string;
	tileJson: TileJson;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isNumberArray(value: unknown, length: number): value is number[] {
	return (
		Array.isArray(value) &&
		value.length === length &&
		value.every((coordinate) => typeof coordinate === "number")
	);
}

function requiredHttpsUrl(value: unknown, field: string): string {
	if (typeof value !== "string") {
		throw new Error(`Sentinel-2 response is missing ${field}`);
	}
	const url = new URL(value);
	if (url.protocol !== "https:") {
		throw new Error(`Sentinel-2 response returned a non-HTTPS ${field}`);
	}
	return value;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
	const response = await fetch(url, {
		...init,
		headers: {
			Accept: "application/geo+json, application/json",
			...init?.headers,
		},
		signal: AbortSignal.timeout(60_000),
	});
	if (!response.ok) {
		throw new Error(
			`Sentinel imagery service returned HTTP ${response.status}`,
		);
	}
	return response.json();
}

function getScenes(data: unknown): Scene[] {
	if (!isRecord(data) || !Array.isArray(data.features)) {
		throw new Error("Earth Search returned an invalid STAC response");
	}

	const scenes: Scene[] = [];
	for (const feature of data.features) {
		if (
			!isRecord(feature) ||
			typeof feature.id !== "string" ||
			!isRecord(feature.properties) ||
			!Array.isArray(feature.links)
		) {
			continue;
		}

		const datetime = feature.properties.datetime;
		const cloudCover = feature.properties["eo:cloud_cover"];
		const selfLink = feature.links.find(
			(link) => isRecord(link) && link.rel === "self",
		);
		if (
			typeof datetime !== "string" ||
			typeof cloudCover !== "number" ||
			!Number.isFinite(cloudCover) ||
			!isRecord(selfLink)
		) {
			continue;
		}

		scenes.push({
			id: feature.id,
			datetime,
			cloudCover,
			self: requiredHttpsUrl(selfLink.href, "STAC item self link"),
			tileJson: {
				tiles: [],
				bounds: [0, 0, 0, 0],
				center: [0, 0, 0],
				minzoom: 0,
				maxzoom: 0,
			},
		});
	}
	return scenes.sort((a, b) => b.datetime.localeCompare(a.datetime));
}

async function getTileJson(scene: Scene): Promise<TileJson> {
	const params = new URLSearchParams({
		url: scene.self,
		assets: "visual",
	});
	const data = await fetchJson(`${TILEJSON_URL}?${params.toString()}`);
	if (
		!isRecord(data) ||
		!isNumberArray(data.bounds, 4) ||
		!isNumberArray(data.center, 3) ||
		typeof data.minzoom !== "number" ||
		typeof data.maxzoom !== "number"
	) {
		throw new Error(`TiTiler returned an invalid TileJSON for ${scene.id}`);
	}

	const tiles = data.tiles;
	if (
		!Array.isArray(tiles) ||
		typeof tiles[0] !== "string" ||
		!["{z}", "{x}", "{y}"].every((placeholder) =>
			tiles[0].includes(placeholder),
		)
	) {
		throw new Error(
			`TiTiler returned an invalid tile template for ${scene.id}`,
		);
	}

	return {
		tiles: [requiredHttpsUrl(tiles[0], "TileJSON tile URL")],
		bounds: [data.bounds[0], data.bounds[1], data.bounds[2], data.bounds[3]],
		center: [data.center[0], data.center[1], data.center[2]],
		minzoom: data.minzoom,
		maxzoom: data.maxzoom,
	};
}

async function addTileJson(scene: Scene): Promise<Scene> {
	return { ...scene, tileJson: await getTileJson(scene) };
}

async function main() {
	const start = new Date(Date.now() - SEARCH_DAYS * 24 * 60 * 60 * 1000)
		.toISOString()
		.replace(/\.\d{3}Z$/, "Z");
	const searchBody = {
		collections: [COLLECTION],
		bbox: VIETNAM_BBOX,
		datetime: `${start}/..`,
		limit: SEARCH_LIMIT,
		sortby: [{ field: "properties.datetime", direction: "desc" }],
	};
	const scenes = getScenes(
		await fetchJson(SEARCH_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(searchBody),
		}),
	);
	if (scenes.length === 0) {
		throw new Error("Earth Search returned no usable Vietnam scenes");
	}

	const latest = scenes[0];
	const lowCloudScene = scenes.find(
		(scene) => scene.cloudCover <= CLOUD_THRESHOLD,
	);
	const selected =
		lowCloudScene ??
		[...scenes].sort(
			(a, b) =>
				a.cloudCover - b.cloudCover || b.datetime.localeCompare(a.datetime),
		)[0];
	const [selectedWithTiles, latestWithTiles] = await Promise.all([
		addTileJson(selected),
		latest.id === selected.id ? Promise.resolve(null) : addTileJson(latest),
	]);

	await mkdir("public/data", { recursive: true });
	await writeFile(
		OUTPUT_PATH,
		`${JSON.stringify(
			{
				generatedAt: new Date().toISOString(),
				region: "Vietnam",
				searchDays: SEARCH_DAYS,
				cloudThreshold: CLOUD_THRESHOLD,
				selectedByCloudFallback: !lowCloudScene,
				selected: selectedWithTiles,
				latest: latestWithTiles ?? selectedWithTiles,
				resultCount: scenes.length,
			},
			null,
			2,
		)}\n`,
	);
	console.log(
		`Generated Sentinel-2 scene ${selected.id} (${selected.cloudCover.toFixed(1)}% cloud); latest is ${latest.id} (${latest.cloudCover.toFixed(1)}% cloud) from ${scenes.length} results`,
	);
}

main().catch((error: unknown) => {
	console.error("[Sentinel-2] Failed to fetch satellite scenes:", error);
	process.exitCode = 1;
});
