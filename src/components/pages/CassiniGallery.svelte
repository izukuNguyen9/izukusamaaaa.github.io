<script lang="ts">
import { onMount } from "svelte";

type OpusImage = {
	opusId: string;
	url: string;
	fullUrl: string;
	width: number;
	height: number;
	sizeBytes: number;
};

type OpusImageRecord = {
	opus_id?: unknown;
	url?: unknown;
	width?: unknown;
	height?: unknown;
	size_bytes?: unknown;
};

const API_BASE_URL = "https://opus.pds-rings.seti.org/opus/api";
const PAGE_SIZE = 24;
const FILTER = "CLEAR";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function opusImageUrl(value: unknown): string | null {
	if (typeof value !== "string") return null;

	try {
		const url = new URL(value);
		return url.protocol === "https:" &&
			url.hostname === "opus.pds-rings.seti.org"
			? url.toString()
			: null;
	} catch {
		return null;
	}
}

function parseImages(value: unknown): OpusImageRecord[] {
	if (
		!isRecord(value) ||
		!Array.isArray(value.data) ||
		!value.data.every(isRecord)
	) {
		throw new Error("OPUS returned an invalid image response");
	}
	return value.data;
}

function parseImage(
	preview: OpusImageRecord,
	fullById: Map<string, string>,
): OpusImage {
	if (
		typeof preview.opus_id !== "string" ||
		typeof preview.width !== "number" ||
		typeof preview.height !== "number" ||
		typeof preview.size_bytes !== "number"
	) {
		throw new Error("OPUS returned incomplete image metadata");
	}
	const url = opusImageUrl(preview.url);
	const fullUrl = fullById.get(preview.opus_id);
	if (!url || !fullUrl) {
		throw new Error(
			`OPUS did not return both image sizes for ${preview.opus_id}`,
		);
	}

	return {
		opusId: preview.opus_id,
		url,
		fullUrl,
		width: preview.width,
		height: preview.height,
		sizeBytes: preview.size_bytes,
	};
}

function getCameraName(opusId: string): string {
	if (/^co-iss-n/i.test(opusId)) return "Narrow Angle";
	if (/^co-iss-w/i.test(opusId)) return "Wide Angle";
	return "Cassini ISS";
}

function getNextDate(date: string): string {
	const nextDate = new Date(`${date}T00:00:00Z`);
	nextDate.setUTCDate(nextDate.getUTCDate() + 1);
	return nextDate.toISOString().slice(0, 10);
}

function getDatePart(value: unknown): string {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(value)) {
		throw new Error("OPUS returned an invalid date range");
	}
	return value.slice(0, 10);
}

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
	const response = await fetch(url, {
		headers: { Accept: "application/json" },
		signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
	});
	if (!response.ok) {
		throw new Error(`OPUS returned HTTP ${response.status}`);
	}
	return response.json();
}

function getCommonParams(date: string): URLSearchParams {
	return new URLSearchParams({
		instrument: "Cassini ISS",
		COISSfilter: FILTER,
		time1: date,
		time2: getNextDate(date),
	});
}

async function fetchImagePage(
	date: string,
	startObservation: number,
	signal: AbortSignal,
): Promise<OpusImage[]> {
	const pageParams = {
		order: "time1",
		limit: String(PAGE_SIZE),
		startobs: String(startObservation),
	};
	const [previewData, fullData] = await Promise.all(
		(["med", "full"] as const).map(async (size) => {
			const params = getCommonParams(date);
			for (const [key, value] of Object.entries(pageParams)) {
				params.set(key, value);
			}
			return fetchJson(
				`${API_BASE_URL}/images/${size}.json?${params.toString()}`,
				signal,
			);
		}),
	);
	const previewRecords = parseImages(previewData);
	const fullById = new Map<string, string>();
	for (const image of parseImages(fullData)) {
		if (typeof image.opus_id !== "string") continue;
		const fullUrl = opusImageUrl(image.url);
		if (fullUrl) fullById.set(image.opus_id, fullUrl);
	}

	return previewRecords.map((image) => parseImage(image, fullById));
}

async function fetchImageCount(date: string, signal: AbortSignal) {
	const params = getCommonParams(date);
	const result = await fetchJson(
		`${API_BASE_URL}/meta/result_count.json?${params.toString()}`,
		signal,
	);
	if (
		!isRecord(result) ||
		!Array.isArray(result.data) ||
		!isRecord(result.data[0]) ||
		typeof result.data[0].result_count !== "number" ||
		!Number.isInteger(result.data[0].result_count)
	) {
		throw new Error("OPUS returned an invalid image count");
	}
	return result.data[0].result_count;
}

let minDate = $state("");
let maxDate = $state("");
let selectedDate = $state("");
let loadedDate = $state("");
let imageCount = $state<number | null>(null);
let images = $state<OpusImage[]>([]);
let nextStartObservation = $state(1);
let loadingRange = $state(true);
let loadingDay = $state(false);
let loadingMore = $state(false);
let errorMessage = $state("");
let loadMoreError = $state("");
let requestController: AbortController | null = null;
let requestId = 0;

const hasMore = $derived(imageCount !== null && images.length < imageCount);

async function loadDay(date: string) {
	requestController?.abort();
	const controller = new AbortController();
	requestController = controller;
	const currentRequest = ++requestId;

	loadingDay = true;
	errorMessage = "";
	loadMoreError = "";
	imageCount = null;
	images = [];
	loadedDate = "";
	nextStartObservation = 1;

	try {
		const count = await fetchImageCount(date, controller.signal);
		if (currentRequest !== requestId) return;
		imageCount = count;
		loadedDate = date;
		if (count > 0) {
			images = await fetchImagePage(date, 1, controller.signal);
			if (currentRequest !== requestId) return;
			if (images.length === 0) {
				throw new Error("OPUS returned no images for a non-empty date");
			}
			nextStartObservation = 1 + PAGE_SIZE;
		}
	} catch (error) {
		if (currentRequest !== requestId || controller.signal.aborted) return;
		console.error(`[Cassini] Failed to load images for ${date}:`, error);
		errorMessage = "Could not load Cassini images. Please try again.";
	} finally {
		if (currentRequest === requestId) loadingDay = false;
	}
}

async function initialize() {
	loadingRange = true;
	errorMessage = "";
	const controller = new AbortController();

	try {
		const data = await fetchJson(
			`${API_BASE_URL}/meta/range/endpoints/time1.json?${new URLSearchParams({ instrument: "Cassini ISS" })}`,
			controller.signal,
		);
		if (!isRecord(data)) {
			throw new Error("OPUS returned an invalid date range");
		}
		minDate = getDatePart(data.min);
		maxDate = getDatePart(data.max);
		selectedDate = maxDate;
		await loadDay(maxDate);
	} catch (error) {
		console.error("[Cassini] Failed to load OPUS date range:", error);
		errorMessage = "Could not load the Cassini image date range. Please retry.";
	} finally {
		loadingRange = false;
	}
}

function handleDateSubmit(event: SubmitEvent) {
	event.preventDefault();
	if (!selectedDate || selectedDate < minDate || selectedDate > maxDate) {
		errorMessage = `Choose a date between ${minDate} and ${maxDate}.`;
		return;
	}
	void loadDay(selectedDate);
}

async function loadMore() {
	if (!loadedDate || !hasMore || loadingMore || !requestController) return;
	const controller = requestController;
	const date = loadedDate;
	loadingMore = true;
	loadMoreError = "";

	try {
		const page = await fetchImagePage(
			date,
			nextStartObservation,
			controller.signal,
		);
		if (controller !== requestController || controller.signal.aborted) return;
		if (page.length === 0) {
			throw new Error(
				"OPUS returned an empty page before the image count ended",
			);
		}
		const existingIds = new Set(images.map((image) => image.opusId));
		images = [
			...images,
			...page.filter((image) => !existingIds.has(image.opusId)),
		];
		nextStartObservation += PAGE_SIZE;
	} catch (error) {
		if (controller.signal.aborted) return;
		console.error(`[Cassini] Failed to load more images for ${date}:`, error);
		loadMoreError = "Could not load more images. Please try again.";
	} finally {
		if (controller === requestController) loadingMore = false;
	}
}

onMount(() => {
	void initialize();
	return () => requestController?.abort();
});
</script>

<section class="card-base mb-4 p-5 md:p-8">
	<div class="mb-5">
		<h2 class="text-xl font-bold">Cassini ISS image archive</h2>
		<p class="mt-1 text-sm text-50">
			Browse Cassini Imaging Science Subsystem preview images by UTC date.
			Images are browse previews, not scientific data products.
		</p>
	</div>

	<form
		class="mb-5 flex flex-wrap items-end gap-3"
		onsubmit={handleDateSubmit}
	>
		<label class="flex flex-col gap-1 text-sm text-50" for="cassini-date">
			<span>Observation date (UTC)</span>
			<input
				id="cassini-date"
				bind:value={selectedDate}
				type="date"
				min={minDate}
				max={maxDate}
				class="rounded-lg border border-(--line-divider) bg-transparent px-3 py-2 text-(--text-color)"
				disabled={loadingRange}
			/>
		</label>
		<button
			class="btn-regular rounded-lg px-4 py-2"
			type="submit"
			disabled={loadingRange || loadingDay || !selectedDate}
		>
			{loadingDay ? "Loading…" : "Show date"}
		</button>
		{#if loadingDay}
			<span class="pb-2 text-sm text-50" role="status">Checking image count…</span>
		{:else if imageCount !== null && loadedDate === selectedDate}
			<span class="pb-2 text-sm text-50" role="status">
				{imageCount} {imageCount === 1 ? "image" : "images"}
			</span>
		{/if}
	</form>

	{#if loadingRange}
		<p class="py-12 text-center text-50" role="status">
			Loading Cassini image date range…
		</p>
	{:else if errorMessage}
		<div class="py-12 text-center" role="status">
			<p class="text-75">{errorMessage}</p>
			<button
				class="btn-regular mt-4 rounded-lg px-4 py-2"
				type="button"
				onclick={() => initialize()}
			>
				Try again
			</button>
		</div>
	{:else if imageCount === 0}
		<p class="py-12 text-center text-50" role="status">
			No Cassini ISS images with the CLEAR filter were found for {loadedDate}
			(UTC). Choose another date.
		</p>
	{:else if loadingDay}
		<p class="py-12 text-center text-50" role="status">
			Loading Cassini preview images…
		</p>
	{:else if imageCount !== null}
		<p class="mb-4 text-sm text-50">
			Showing {images.length} of {imageCount} images for {loadedDate} UTC.
			Time window: [{loadedDate}, {getNextDate(loadedDate)}) UTC. Filter:
			Cassini ISS · CLEAR.
		</p>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
			{#each images as image (image.opusId)}
				<article
					class="overflow-hidden rounded-xl border border-(--line-divider)"
				>
					<a
						href={image.fullUrl}
						target="_blank"
						rel="noreferrer"
						aria-label={`Open full-size Cassini image ${image.opusId}`}
					>
						<img
							src={image.url}
							alt={`Cassini ${getCameraName(image.opusId)} preview, ${image.opusId}`}
							class="aspect-square w-full bg-black object-contain"
							loading="lazy"
							decoding="async"
						/>
					</a>
					<div class="p-4">
						<p class="font-semibold">{getCameraName(image.opusId)}</p>
						<p class="mt-1 break-all text-xs text-50">{image.opusId}</p>
						<p class="mt-1 text-xs text-50">
							{image.width} × {image.height} px · {(image.sizeBytes / 1024).toFixed(1)} KB
						</p>
						<a
							class="mt-2 inline-block text-sm underline hover:text-(--primary)"
							href={image.fullUrl}
							target="_blank"
							rel="noreferrer"
						>
							Open full-size preview
						</a>
					</div>
				</article>
			{/each}
		</div>

		{#if loadMoreError}
			<p class="mt-4 text-center text-sm text-75" role="alert">
				{loadMoreError}
			</p>
		{/if}
		{#if hasMore}
			<div class="mt-6 text-center">
				<button
					class="btn-regular rounded-lg px-4 py-2"
					type="button"
					disabled={loadingMore}
					onclick={() => loadMore()}
				>
					{loadingMore ? "Loading…" : `Load ${PAGE_SIZE} more`}
				</button>
			</div>
		{/if}
	{/if}
</section>

<p class="text-center text-xs text-50">
	Image previews and metadata from
	<a
		class="underline hover:text-(--primary)"
		href="https://opus.pds-rings.seti.org/"
		target="_blank"
		rel="noreferrer"
	>
		PDS Rings OPUS
	</a>.
</p>
