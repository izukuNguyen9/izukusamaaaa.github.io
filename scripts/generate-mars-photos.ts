import { mkdir, writeFile } from "node:fs/promises";

const API_BASE_URL = "https://images-api.nasa.gov";
const ROVERS = [
	{ id: "curiosity", name: "Curiosity", startYear: 2012 },
	{ id: "perseverance", name: "Perseverance", startYear: 2021 },
] as const;
const PAGE_SIZE = 100;
const MAX_SEARCH_PAGES = 30;
const PHOTOS_PER_ROVER = 18;
const OUTPUT_PATH = "public/data/mars-photos.json";

type RoverId = (typeof ROVERS)[number]["id"];

type MarsPhoto = {
	id: string;
	nasaId: string;
	title: string;
	catalogDate: string;
	previewUrl: string;
	imageUrl: string;
	description?: string;
};

type MarsRover = {
	id: RoverId;
	name: string;
	photos: MarsPhoto[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function getHttpsUrl(value: unknown, field: string): string {
	if (typeof value !== "string" || value.length === 0) {
		throw new Error(`NASA Images API returned an invalid ${field}`);
	}

	const url = new URL(value);
	if (url.protocol === "http:") url.protocol = "https:";
	if (url.protocol !== "https:") {
		throw new Error(`NASA Images API returned a non-HTTPS ${field}`);
	}
	return url.toString();
}

async function fetchJson(url: string): Promise<unknown> {
	const response = await fetch(url, {
		headers: { Accept: "application/json" },
		signal: AbortSignal.timeout(30_000),
	});
	if (!response.ok) {
		throw new Error(`NASA Images API returned HTTP ${response.status}`);
	}
	return response.json();
}

function getSearchCollection(data: unknown) {
	if (
		!isRecord(data) ||
		!isRecord(data.collection) ||
		!Array.isArray(data.collection.items) ||
		!isRecord(data.collection.metadata) ||
		typeof data.collection.metadata.total_hits !== "number"
	) {
		throw new Error("NASA Images API returned an invalid search response");
	}

	return {
		items: data.collection.items,
		totalHits: data.collection.metadata.total_hits,
	};
}

function getPhotoMetadata(value: unknown, roverName: string) {
	if (
		!isRecord(value) ||
		!Array.isArray(value.data) ||
		!Array.isArray(value.links)
	) {
		return null;
	}

	const metadata = value.data[0];
	if (
		!isRecord(metadata) ||
		typeof metadata.nasa_id !== "string" ||
		typeof metadata.title !== "string" ||
		!metadata.title.toLowerCase().includes(roverName.toLowerCase()) ||
		typeof metadata.date_created !== "string"
	) {
		return null;
	}

	const preview = value.links.find(
		(link) => isRecord(link) && link.rel === "preview",
	);
	if (!isRecord(preview)) return null;

	return {
		nasaId: metadata.nasa_id,
		title: metadata.title.trim(),
		catalogDate: metadata.date_created,
		previewUrl: getHttpsUrl(preview.href, "preview URL"),
		...(typeof metadata.description === "string"
			? { description: metadata.description }
			: {}),
	};
}

async function getSearchResults(
	rover: (typeof ROVERS)[number],
): Promise<MarsPhoto[]> {
	const results: ReturnType<typeof getPhotoMetadata>[] = [];
	const params = new URLSearchParams({
		q: `${rover.name} Mars rover`,
		media_type: "image",
		year_start: String(rover.startYear),
		year_end: String(new Date().getUTCFullYear()),
		page_size: String(PAGE_SIZE),
		page: "1",
	});
	const firstPage = getSearchCollection(
		await fetchJson(`${API_BASE_URL}/search?${params.toString()}`),
	);
	const totalPages = Math.ceil(firstPage.totalHits / PAGE_SIZE);
	if (totalPages > MAX_SEARCH_PAGES) {
		throw new Error(
			`NASA Images API returned too many search results for ${rover.name}`,
		);
	}

	const items = [...firstPage.items];
	for (let page = 2; page <= totalPages; page++) {
		params.set("page", String(page));
		const result = getSearchCollection(
			await fetchJson(`${API_BASE_URL}/search?${params.toString()}`),
		);
		items.push(...result.items);
	}

	for (const item of items) {
		const metadata = getPhotoMetadata(item, rover.name);
		if (metadata) results.push(metadata);
	}

	results.sort((a, b) =>
		(b?.catalogDate ?? "").localeCompare(a?.catalogDate ?? ""),
	);
	const selected = results
		.filter((photo): photo is NonNullable<typeof photo> => photo !== null)
		.slice(0, PHOTOS_PER_ROVER);
	if (selected.length === 0) {
		throw new Error(`NASA Images API returned no ${rover.name} image results`);
	}

	const photos: MarsPhoto[] = [];
	for (const photo of selected) {
		photos.push({
			id: photo.nasaId,
			nasaId: photo.nasaId,
			title: photo.title,
			catalogDate: photo.catalogDate,
			previewUrl: photo.previewUrl,
			imageUrl: await getFullImageUrl(photo.nasaId),
			...(photo.description ? { description: photo.description } : {}),
		});
	}

	return photos;
}

async function getFullImageUrl(nasaId: string): Promise<string> {
	const data = await fetchJson(
		`${API_BASE_URL}/asset/${encodeURIComponent(nasaId)}`,
	);
	if (
		!isRecord(data) ||
		!isRecord(data.collection) ||
		!Array.isArray(data.collection.items)
	) {
		throw new Error(`NASA Images API returned invalid assets for ${nasaId}`);
	}

	const urls = data.collection.items
		.filter(
			(item): item is { href: string } =>
				isRecord(item) && typeof item.href === "string",
		)
		.map((item) => item.href);
	const imageUrl =
		urls.find((url) => /~orig\.(jpe?g|png)$/i.test(url)) ??
		urls.find((url) => /~large\.(jpe?g|png)$/i.test(url)) ??
		urls.find((url) => /\.(jpe?g|png)$/i.test(url));
	return getHttpsUrl(imageUrl, `${nasaId} image URL`);
}

async function main() {
	const rovers: MarsRover[] = [];
	for (const rover of ROVERS) {
		rovers.push({
			id: rover.id,
			name: rover.name,
			photos: await getSearchResults(rover),
		});
	}

	await mkdir("public/data", { recursive: true });
	await writeFile(
		OUTPUT_PATH,
		`${JSON.stringify({ generatedAt: new Date().toISOString(), rovers }, null, 2)}\n`,
	);
	console.log(
		`Generated NASA Mars image search data: ${rovers.map((rover) => `${rover.name} (${rover.photos.length} images)`).join(", ")}`,
	);
}

main().catch((error: unknown) => {
	console.error("[Mars gallery] Failed to fetch NASA rover imagery:", error);
	process.exitCode = 1;
});
