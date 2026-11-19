<script lang="ts">
import { onMount, tick } from "svelte";
import MastcamDebayerImage from "./MastcamDebayerImage.svelte";

type RoverId = "curiosity" | "perseverance";

type MarsPhoto = {
	id: string;
	sol: number;
	camera: string;
	dateTaken: string;
	title: string;
	previewUrl: string;
	fullImageUrl: string;
	isThumbnail: boolean;
	isMastcamBayer: boolean;
};

type MslPage = {
	photos: MarsPhoto[];
	more: boolean;
};

const DISPLAY_BATCH_SIZE = 50;
const MSL_PAGE_SIZE = 200;

const ROVERS: { id: RoverId; name: string }[] = [
	{ id: "curiosity", name: "Curiosity" },
	{ id: "perseverance", name: "Perseverance" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isSol(value: unknown): value is number {
	return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function nasaImageUrl(value: unknown): string | null {
	if (typeof value !== "string") return null;

	try {
		const url = new URL(value);
		return url.protocol === "https:" && url.hostname === "mars.nasa.gov"
			? url.toString()
			: null;
	} catch {
		return null;
	}
}

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
	const response = await fetch(url, {
		headers: { Accept: "application/json" },
		signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
	});
	if (!response.ok) {
		throw new Error(`NASA Mars API returned HTTP ${response.status}`);
	}
	return response.json();
}

async function fetchLatestSol(
	rover: RoverId,
	signal: AbortSignal,
): Promise<number> {
	const url =
		rover === "curiosity"
			? "https://mars.nasa.gov/api/v1/raw_image_items/msl/latest/"
			: "https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020%2Cingenuity&feedtype=json&ver=1.2&latest=true";
	const data = await fetchJson(url, signal);
	const latestSol =
		rover === "curiosity" && isRecord(data) && isRecord(data.latest_data)
			? data.latest_data.latest_sol
			: isRecord(data)
				? data.latest_sol
				: undefined;

	if (!isSol(latestSol)) {
		throw new Error(
			`NASA Mars API returned an invalid latest sol for ${rover}`,
		);
	}
	return latestSol;
}

function getMslPhoto(value: unknown): MarsPhoto | null {
	if (!isRecord(value) || !isSol(value.sol)) return null;

	const camera =
		typeof value.instrument === "string" ? value.instrument.trim() : "";
	const imageUrl = nasaImageUrl(value.https_url ?? value.url);
	if (!camera || !imageUrl) return null;
	const detailUrl =
		typeof value.link === "string" && value.link.startsWith("/raw_images/")
			? `https://mars.nasa.gov${value.link}`
			: imageUrl;

	return {
		id:
			typeof value.imageid === "string"
				? value.imageid
				: String(value.id ?? imageUrl),
		sol: value.sol,
		camera,
		dateTaken: typeof value.date_taken === "string" ? value.date_taken : "",
		title:
			typeof value.title === "string"
				? value.title
				: `Sol ${value.sol}: ${camera}`,
		previewUrl: imageUrl,
		fullImageUrl: value.is_thumbnail === true ? detailUrl : imageUrl,
		isThumbnail: value.is_thumbnail === true,
		isMastcamBayer:
			camera.startsWith("MAST_") &&
			typeof value.imageid === "string" &&
			/C00_DXXX$/i.test(value.imageid),
	};
}

function getPerseverancePhotos(value: unknown, sol: number): MarsPhoto[] {
	if (!isRecord(value) || !Array.isArray(value.images)) {
		throw new Error("NASA returned an invalid Perseverance image response");
	}

	return value.images.flatMap((image): MarsPhoto[] => {
		if (!isRecord(image) || image.sol !== sol || !isRecord(image.camera)) {
			return [];
		}

		const camera =
			typeof image.camera.instrument === "string"
				? image.camera.instrument.trim()
				: "";
		if (!camera || !isRecord(image.image_files)) return [];

		const fullImageUrl =
			nasaImageUrl(image.image_files.full_res) ??
			nasaImageUrl(image.image_files.large) ??
			nasaImageUrl(image.image_files.medium) ??
			nasaImageUrl(image.image_files.small);
		const previewUrl = camera.startsWith("MCZ_")
			? (nasaImageUrl(image.image_files.full_res) ?? fullImageUrl)
			: (nasaImageUrl(image.image_files.large) ??
				nasaImageUrl(image.image_files.medium) ??
				nasaImageUrl(image.image_files.small) ??
				fullImageUrl);
		if (!previewUrl || !fullImageUrl) return [];

		return [
			{
				id:
					typeof image.imageid === "string"
						? image.imageid
						: `${sol}-${camera}-${previewUrl}`,
				sol,
				camera,
				dateTaken:
					typeof image.date_taken_utc === "string" ? image.date_taken_utc : "",
				title:
					typeof image.title === "string"
						? image.title
						: `Sol ${sol}: ${camera}`,
				previewUrl,
				fullImageUrl,
				isThumbnail: false,
				isMastcamBayer: false,
			},
		];
	});
}

async function fetchMslPage(
	sol: number,
	page: number,
	signal: AbortSignal,
): Promise<MslPage> {
	const params = new URLSearchParams({
		order: "sample_type_sort asc,sol desc",
		condition_1: "msl:mission",
		condition_2: `${sol}:sol:gte`,
		condition_3: `${sol}:sol:lte`,
		per_page: String(MSL_PAGE_SIZE),
		page: String(page),
	});
	const data = await fetchJson(
		`https://mars.nasa.gov/api/v1/raw_image_items/?${params}`,
		signal,
	);
	if (
		!isRecord(data) ||
		!Array.isArray(data.items) ||
		typeof data.more !== "boolean"
	) {
		throw new Error("NASA returned an invalid Curiosity image response");
	}
	if (typeof data.error_message === "string" && data.error_message.length > 0) {
		throw new Error(`Curiosity image search failed: ${data.error_message}`);
	}

	const matchingPhotos = data.items
		.map(getMslPhoto)
		.filter((photo): photo is MarsPhoto => photo !== null)
		.filter((photo) => photo.sol === sol && !photo.isThumbnail);
	return {
		photos: matchingPhotos,
		more: data.more,
	};
}

let selectedRover = $state<RoverId>("curiosity");
let latestSols = $state<Record<RoverId, number> | null>(null);
let selectedSol = $state(0);
let solInput = $state(0);
let selectedCamera = $state("all");
let photos = $state<MarsPhoto[]>([]);
let visibleCount = $state(DISPLAY_BATCH_SIZE);
let currentPage = $state(0);
let hasMore = $state(false);
let loadingLatest = $state(true);
let loadingPhotos = $state(false);
let loadingMore = $state(false);
let errorMessage = $state("");
let loadMoreError = $state("");
let selectedPhoto = $state<MarsPhoto | null>(null);
let imageDialog: HTMLDialogElement;
let photoController: AbortController | null = null;
let requestId = 0;

const activeRover = $derived(
	ROVERS.find((rover) => rover.id === selectedRover),
);
const maxSol = $derived(latestSols?.[selectedRover] ?? 0);
const cameraOptions = $derived(
	[...new Set(photos.map((photo) => photo.camera))].sort(),
);
const filteredPhotos = $derived(
	selectedCamera === "all"
		? photos
		: photos.filter((photo) => photo.camera === selectedCamera),
);
const visiblePhotos = $derived(filteredPhotos.slice(0, visibleCount));
const canLoadMore = $derived(
	filteredPhotos.length > visibleCount ||
		(selectedRover === "curiosity" && hasMore),
);

async function loadPhotos(sol: number) {
	photoController?.abort();
	const controller = new AbortController();
	photoController = controller;
	const currentRequest = ++requestId;

	loadingPhotos = true;
	errorMessage = "";
	loadMoreError = "";
	photos = [];
	selectedCamera = "all";
	visibleCount = DISPLAY_BATCH_SIZE;
	currentPage = 0;
	hasMore = false;

	try {
		if (selectedRover === "curiosity") {
			const page = await fetchMslPage(sol, 0, controller.signal);
			if (currentRequest !== requestId) return;
			photos = page.photos;
			hasMore = page.more;
		} else {
			const params = new URLSearchParams({
				feed: "raw_images",
				category: "mars2020",
				feedtype: "json",
				order: "sol desc",
				sol: String(sol),
			});
			const data = await fetchJson(
				`https://mars.nasa.gov/rss/api/?${params}`,
				controller.signal,
			);
			if (currentRequest !== requestId) return;
			photos = getPerseverancePhotos(data, sol);
		}

		selectedSol = sol;
		solInput = sol;
	} catch (error) {
		if (currentRequest !== requestId || controller.signal.aborted) return;
		console.error(`[Mars] Failed to load ${selectedRover} sol ${sol}:`, error);
		errorMessage = `Could not load ${activeRover?.name ?? "rover"} images for sol ${sol}. Please try again.`;
	} finally {
		if (currentRequest === requestId) loadingPhotos = false;
	}
}

async function initialize() {
	loadingLatest = true;
	errorMessage = "";
	const controller = new AbortController();

	try {
		const [curiosity, perseverance] = await Promise.all([
			fetchLatestSol("curiosity", controller.signal),
			fetchLatestSol("perseverance", controller.signal),
		]);
		latestSols = { curiosity, perseverance };
		const latestSol = latestSols[selectedRover];
		await loadPhotos(latestSol);
	} catch (error) {
		console.error("[Mars] Failed to load the latest sols:", error);
		errorMessage =
			"Could not load the latest Mars rover data. Please try again.";
	} finally {
		loadingLatest = false;
	}
}

function handleRoverChange() {
	if (!latestSols) return;
	const latestSol = latestSols[selectedRover];
	void loadPhotos(latestSol);
}

function handleSolSubmit(event: SubmitEvent) {
	event.preventDefault();
	const sol = Number(solInput);
	if (!Number.isInteger(sol) || sol < 0 || sol > maxSol) {
		errorMessage = `Enter a sol between 0 and ${maxSol}.`;
		return;
	}
	void loadPhotos(sol);
}

function handleCameraChange() {
	visibleCount = DISPLAY_BATCH_SIZE;
}

async function openImage(photo: MarsPhoto) {
	selectedPhoto = photo;
	await tick();
	if (!imageDialog.open) imageDialog.showModal();
}

function handleDialogClick(event: MouseEvent) {
	if (event.target === imageDialog) imageDialog.close();
}

async function loadMore() {
	if (filteredPhotos.length > visibleCount) {
		visibleCount += DISPLAY_BATCH_SIZE;
		return;
	}
	if (selectedRover !== "curiosity" || !hasMore || loadingMore) return;

	const controller = photoController;
	if (!controller) return;
	loadingMore = true;
	loadMoreError = "";

	try {
		let nextPage = currentPage + 1;
		let page: MslPage;
		do {
			page = await fetchMslPage(selectedSol, nextPage, controller.signal);
			if (controller !== photoController || controller.signal.aborted) return;
			currentPage = nextPage;
			nextPage += 1;
		} while (page.photos.length === 0 && page.more);

		const ids = new Set(photos.map((photo) => photo.id));
		photos = [...photos, ...page.photos.filter((photo) => !ids.has(photo.id))];
		hasMore = page.more;
		if (page.photos.length > 0) visibleCount += DISPLAY_BATCH_SIZE;
	} catch (error) {
		if (controller.signal.aborted) return;
		console.error(
			`[Mars] Failed to load more images for sol ${selectedSol}:`,
			error,
		);
		loadMoreError = "Could not load more images. Please try again.";
	} finally {
		if (controller === photoController) loadingMore = false;
	}
}

onMount(() => {
	void initialize();
	return () => photoController?.abort();
});
</script>

<section class="card-base mb-4 p-5 md:p-8">
	<div class="mb-6">
		<h2 class="text-xl font-bold">Latest Mars rover images</h2>
		<p class="mt-1 text-sm text-50">
			Browse camera images by rover and sol. The latest available sol is
			updated directly from NASA. Full-resolution Curiosity Mastcam color
			frames are reconstructed from their Bayer data in your browser; color
			is approximate, not a NASA-calibrated product.
		</p>
	</div>

	<div class="mb-6 grid gap-4 sm:grid-cols-3">
		<label class="flex flex-col gap-1 text-sm text-50">
			<span>Rover</span>
			<select
				bind:value={selectedRover}
				class="rounded-lg border border-(--line-divider) bg-transparent px-3 py-2 text-(--text-color)"
				disabled={!latestSols || loadingLatest}
				onchange={handleRoverChange}
			>
				{#each ROVERS as rover (rover.id)}
					<option value={rover.id}>{rover.name}</option>
				{/each}
			</select>
		</label>

		<form class="flex flex-col gap-1 text-sm text-50" onsubmit={handleSolSubmit}>
			<label for="mars-sol">Sol (0–{maxSol})</label>
			<div class="flex gap-2">
				<input
					id="mars-sol"
					bind:value={solInput}
					class="min-w-0 flex-1 rounded-lg border border-(--line-divider) bg-transparent px-3 py-2 text-(--text-color)"
					type="number"
					min="0"
					max={maxSol}
					step="1"
					disabled={!latestSols || loadingLatest}
				/>
				<button
					class="btn-regular rounded-lg px-4 py-2"
					type="submit"
					disabled={!latestSols || loadingLatest}
				>
					Go
				</button>
			</div>
		</form>

		<label class="flex flex-col gap-1 text-sm text-50">
			<span>Camera</span>
			<select
				bind:value={selectedCamera}
				class="rounded-lg border border-(--line-divider) bg-transparent px-3 py-2 text-(--text-color)"
				disabled={cameraOptions.length === 0 || loadingPhotos}
				onchange={handleCameraChange}
			>
				<option value="all">All cameras</option>
				{#each cameraOptions as camera (camera)}
					<option value={camera}>{camera}</option>
				{/each}
			</select>
		</label>
	</div>

	{#if loadingLatest || loadingPhotos}
		<p class="py-12 text-center text-50" role="status">
			Loading the latest {activeRover?.name ?? "Mars rover"} images…
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
	{:else}
		<div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
			<p class="text-sm text-50">
				{activeRover?.name} · Sol {selectedSol} · Latest sol {maxSol}
			</p>
			<a
				class="text-xs underline hover:text-(--primary)"
				href={selectedRover === "curiosity"
					? "https://mars.nasa.gov/msl/multimedia/raw-images/"
					: "https://mars.nasa.gov/mars2020/multimedia/raw-images/"}
				target="_blank"
				rel="noreferrer"
			>
				View NASA raw image archive
			</a>
		</div>
		<p class="mb-4 text-sm text-50" role="status">
			Showing {visiblePhotos.length} of {filteredPhotos.length} loaded
			{selectedCamera === "all" ? "images" : `${selectedCamera} images`}.
			{#if selectedRover === "curiosity" && hasMore}
				More results are available from NASA.
			{/if}
		</p>

		{#if filteredPhotos.length === 0}
			<p class="py-12 text-center text-50" role="status">
				No images were found for {activeRover?.name} on sol {selectedSol}. Try
				another sol or camera.
			</p>
		{:else}
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
				{#each visiblePhotos as photo (photo.id)}
					<article
						class="overflow-hidden rounded-xl border border-(--line-divider)"
					>
						<button
							class="block w-full cursor-zoom-in bg-black"
							type="button"
							aria-label={`View larger image: ${photo.title}`}
							onclick={() => openImage(photo)}
						>
							{#if photo.isMastcamBayer}
								<MastcamDebayerImage
									src={photo.fullImageUrl}
									alt={photo.title}
									class="aspect-[4/3] object-contain"
								/>
							{:else}
								<img
									src={photo.previewUrl}
									alt={photo.title}
									class="aspect-[4/3] w-full object-contain"
									loading="lazy"
									decoding="async"
								/>
							{/if}
						</button>
						<div class="p-4">
							<p class="font-semibold">{photo.title}</p>
							<p class="mt-1 text-sm text-50">
								Sol {photo.sol} · {photo.camera}
							</p>
							{#if photo.dateTaken}
								<p class="mt-1 text-xs text-50">
									{photo.dateTaken.slice(0, 10)}
								</p>
							{/if}
							<a
								class="mt-2 inline-block text-sm underline hover:text-(--primary)"
								href={photo.fullImageUrl}
								target="_blank"
								rel="noreferrer"
							>
								{photo.isThumbnail
									? photo.camera.startsWith("MAST_")
										? "NASA thumbnail (full Mastcam image not available)"
										: "NASA image details (thumbnail only)"
									: "Open original image"}
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
			{#if canLoadMore}
				<div class="mt-6 text-center">
					<button
						class="btn-regular rounded-lg px-4 py-2"
						type="button"
						disabled={loadingMore}
						onclick={() => loadMore()}
					>
						{loadingMore
							? "Loading…"
							: filteredPhotos.length > visibleCount
								? `Show next ${DISPLAY_BATCH_SIZE}`
								: `Load next NASA page`}
					</button>
				</div>
			{/if}
		{/if}
	{/if}

	<dialog
		bind:this={imageDialog}
		class="m-auto max-h-[95vh] max-w-[95vw] overflow-auto rounded-xl bg-black p-3 text-white shadow-2xl backdrop:bg-black/80"
		onclick={handleDialogClick}
		onclose={() => (selectedPhoto = null)}
	>
		{#if selectedPhoto}
			<div class="mb-2 flex items-center justify-between gap-4">
				<p class="text-sm">{selectedPhoto.title}</p>
				<button
					class="rounded-lg border border-white/40 px-3 py-1 text-sm hover:bg-white/10"
					type="button"
					onclick={() => imageDialog.close()}
				>
					Close
				</button>
			</div>
			{#if selectedPhoto.isMastcamBayer}
				<MastcamDebayerImage
					src={selectedPhoto.fullImageUrl}
					alt={selectedPhoto.title}
					class="mx-auto max-h-[82vh] max-w-[92vw] object-contain"
				/>
			{:else}
				<img
					src={selectedPhoto.isThumbnail
						? selectedPhoto.previewUrl
						: selectedPhoto.fullImageUrl}
					alt={selectedPhoto.title}
					class="mx-auto max-h-[82vh] max-w-[92vw] object-contain"
					decoding="async"
				/>
			{/if}
			<a
				class="mt-2 inline-block text-sm underline hover:text-white/80"
				href={selectedPhoto.fullImageUrl}
				target="_blank"
				rel="noreferrer"
			>
				{selectedPhoto.isMastcamBayer
					? "Open original NASA raw image in new tab"
					: selectedPhoto.isThumbnail
					? selectedPhoto.camera.startsWith("MAST_")
						? "Full Mastcam image is not available from NASA yet"
						: "Open NASA image details"
					: "Open original image in new tab"}
			</a>
		{/if}
	</dialog>
</section>

<p class="text-center text-xs text-50">
	Images courtesy of
	<a
		class="underline hover:text-(--primary)"
		href="https://mars.nasa.gov/"
		target="_blank"
		rel="noreferrer"
	>
		NASA/JPL-Caltech
	</a>.
</p>
