import { mkdir, writeFile } from "node:fs/promises";

const API_BASE_URL = "https://api.marsvista.dev/api/v2";
const ROVER_IDS = ["curiosity", "perseverance"] as const;
const MAX_PAGES_PER_ROVER = 100;
const OUTPUT_PATH = "public/data/mars-photos.json";

type RoverId = (typeof ROVER_IDS)[number];

type MarsPhoto = {
	id: string;
	cameraId: string;
	cameraName: string;
	sol: number;
	earthDate: string;
	takenAt: string;
	imageUrl: string;
	fullImageUrl: string;
	title?: string;
};

type MarsRover = {
	id: RoverId;
	name: string;
	latestSol: number;
	earthDate: string;
	photos: MarsPhoto[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function requiredString(value: unknown, field: string): string {
	if (typeof value !== "string" || value.length === 0) {
		throw new Error(`Mars Vista API returned an invalid ${field}`);
	}
	return value;
}

function requiredNumber(value: unknown, field: string): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		throw new Error(`Mars Vista API returned an invalid ${field}`);
	}
	return value;
}

function imageUrl(value: unknown, field: string): string {
	const url = requiredString(value, field);
	if (new URL(url).protocol !== "https:") {
		throw new Error(`Mars Vista API returned a non-HTTPS ${field}`);
	}
	return url;
}

async function fetchJson(url: string, apiKey: string): Promise<unknown> {
	const response = await fetch(url, {
		headers: {
			"X-API-Key": apiKey,
			Accept: "application/json",
		},
		signal: AbortSignal.timeout(30_000),
	});
	if (!response.ok) {
		throw new Error(`Mars Vista API returned HTTP ${response.status}`);
	}
	return response.json();
}

function getRoverEntries(data: unknown): unknown[] {
	if (!isRecord(data) || !Array.isArray(data.data)) {
		throw new Error("Mars Vista API returned an invalid rover list");
	}
	return data.data;
}

function getLatestSol(entry: unknown, roverId: RoverId) {
	if (!isRecord(entry) || entry.id !== roverId || !isRecord(entry.attributes)) {
		throw new Error(`Mars Vista API omitted ${roverId} rover metadata`);
	}
	return {
		name: requiredString(entry.attributes.name, `${roverId} name`),
		maxSol: requiredNumber(entry.attributes.max_sol, `${roverId} latest sol`),
		maxDate: requiredString(
			entry.attributes.max_date,
			`${roverId} latest date`,
		),
	};
}

function parsePhoto(value: unknown, roverId: RoverId): MarsPhoto {
	if (
		!isRecord(value) ||
		!isRecord(value.attributes) ||
		!isRecord(value.relationships) ||
		!isRecord(value.relationships.camera)
	) {
		throw new Error(`Mars Vista API returned an invalid ${roverId} photo`);
	}

	const attributes = value.attributes;
	const images = attributes.images;
	const camera = value.relationships.camera;
	const photoId = value.id;
	if (!isRecord(images)) {
		throw new Error(`Mars Vista API returned invalid ${roverId} image URLs`);
	}
	if (typeof photoId !== "number" && typeof photoId !== "string") {
		throw new Error(`Mars Vista API returned an invalid ${roverId} photo id`);
	}
	const cameraId = requiredString(camera.id, `${roverId} camera id`);
	const cameraAttributes = isRecord(camera.attributes) ? camera.attributes : {};
	const fullImageUrl = imageUrl(
		images.full ?? images.large ?? images.medium ?? images.small,
		`${roverId} full image URL`,
	);

	return {
		id: String(photoId),
		cameraId,
		cameraName:
			typeof cameraAttributes.full_name === "string"
				? cameraAttributes.full_name
				: cameraId,
		sol: requiredNumber(attributes.sol, `${roverId} photo sol`),
		earthDate: requiredString(attributes.earth_date, `${roverId} photo date`),
		takenAt: requiredString(
			attributes.date_taken_utc,
			`${roverId} photo timestamp`,
		),
		imageUrl: imageUrl(
			images.medium ?? images.small ?? images.large ?? images.full,
			`${roverId} preview image URL`,
		),
		fullImageUrl,
		...(typeof attributes.title === "string"
			? { title: attributes.title }
			: {}),
	};
}

async function getPhotosForRover(
	roverId: RoverId,
	latestSol: number,
	apiKey: string,
): Promise<MarsPhoto[]> {
	const photos: MarsPhoto[] = [];
	let totalPages = 1;

	for (let page = 1; page <= totalPages; page++) {
		if (page > MAX_PAGES_PER_ROVER) {
			throw new Error(
				`Mars Vista API returned too many pages for ${roverId}'s latest sol`,
			);
		}

		const params = new URLSearchParams({
			rovers: roverId,
			sol_min: String(latestSol),
			sol_max: String(latestSol),
			per_page: "100",
			sort: "-date_taken_utc",
			include: "rover,camera",
			image_sizes: "small,medium,large,full",
			page: String(page),
		});
		const data = await fetchJson(
			`${API_BASE_URL}/photos?${params.toString()}`,
			apiKey,
		);
		if (!isRecord(data) || !Array.isArray(data.data)) {
			throw new Error(`Mars Vista API returned invalid ${roverId} photos`);
		}

		for (const item of data.data) {
			const photo = parsePhoto(item, roverId);
			if (photo.sol === latestSol) photos.push(photo);
		}

		if (page === 1 && isRecord(data.pagination)) {
			const responsePages = data.pagination.total_pages;
			if (
				typeof responsePages === "number" &&
				Number.isInteger(responsePages) &&
				responsePages > 0
			) {
				totalPages = responsePages;
			}
		}
	}

	if (photos.length === 0) {
		throw new Error(
			`Mars Vista API has no ${roverId} photos for Sol ${latestSol}`,
		);
	}

	return photos.sort((a, b) => b.takenAt.localeCompare(a.takenAt));
}

async function main() {
	const apiKey = process.env.MARS_VISTA_API_KEY;
	if (!apiKey) {
		throw new Error("Set MARS_VISTA_API_KEY in GitHub Actions Secrets");
	}

	const roverData = await fetchJson(`${API_BASE_URL}/rovers`, apiKey);
	const roverEntries = getRoverEntries(roverData);
	const rovers: MarsRover[] = [];

	for (const roverId of ROVER_IDS) {
		const metadata = getLatestSol(
			roverEntries.find((entry) => isRecord(entry) && entry.id === roverId),
			roverId,
		);
		const photos = await getPhotosForRover(roverId, metadata.maxSol, apiKey);
		rovers.push({
			id: roverId,
			name: metadata.name,
			latestSol: metadata.maxSol,
			earthDate: metadata.maxDate,
			photos,
		});
	}

	await mkdir("public/data", { recursive: true });
	await writeFile(
		OUTPUT_PATH,
		`${JSON.stringify({ generatedAt: new Date().toISOString(), rovers }, null, 2)}\n`,
	);
	console.log(
		`Generated Mars gallery data: ${rovers.map((rover) => `${rover.name} Sol ${rover.latestSol} (${rover.photos.length} photos)`).join(", ")}`,
	);
}

main().catch((error: unknown) => {
	console.error("[Mars gallery] Failed to fetch latest rover images:", error);
	process.exitCode = 1;
});
