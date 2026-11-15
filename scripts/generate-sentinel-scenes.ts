import { mkdir, writeFile } from "node:fs/promises";

const SEARCH_URL = "https://earth-search.aws.element84.com/v1/search";
const PREVIEW_URL = "https://titiler.xyz/stac/preview/640x400.jpg";
const OUTPUT_PATH = "public/data/sentinel-scenes.json";
const COLLECTION = "sentinel-2-c1-l2a";
const SEARCH_LIMIT = 100;
const DISPLAY_LIMIT = 15;
const SEARCH_DAYS = 90;

type Scene = {
	id: string;
	datetime: string;
	cloudCover: number;
	self: string;
	previewUrl: string;
	bounds?: [number, number, number, number];
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
		throw new Error(`Earth Search returned HTTP ${response.status}`);
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

		const self = requiredHttpsUrl(selfLink.href, "STAC item self link");
		const previewParams = new URLSearchParams({
			url: self,
			assets: "visual",
		});
		scenes.push({
			id: feature.id,
			datetime,
			cloudCover,
			self,
			previewUrl: `${PREVIEW_URL}?${previewParams.toString()}`,
			...(isNumberArray(feature.bbox, 4)
				? {
						bounds: [
							feature.bbox[0],
							feature.bbox[1],
							feature.bbox[2],
							feature.bbox[3],
						],
					}
				: {}),
		});
	}
	return scenes.sort((a, b) => b.datetime.localeCompare(a.datetime));
}

async function main() {
	const start = new Date(Date.now() - SEARCH_DAYS * 24 * 60 * 60 * 1000)
		.toISOString()
		.replace(/\.\d{3}Z$/, "Z");
	const searchBody = {
		collections: [COLLECTION],
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
		throw new Error("Earth Search returned no usable Sentinel-2 scenes");
	}

	const latestScenes = scenes.slice(0, DISPLAY_LIMIT);
	await mkdir("public/data", { recursive: true });
	await writeFile(
		OUTPUT_PATH,
		`${JSON.stringify(
			{
				generatedAt: new Date().toISOString(),
				searchDays: SEARCH_DAYS,
				resultCount: scenes.length,
				scenes: latestScenes,
			},
			null,
			2,
		)}\n`,
	);
	console.log(
		`Generated ${latestScenes.length} latest global Sentinel-2 scenes from ${scenes.length} results`,
	);
}

main().catch((error: unknown) => {
	console.error("[Sentinel-2] Failed to fetch satellite scenes:", error);
	process.exitCode = 1;
});
