<script lang="ts">
import { onMount } from "svelte";

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
	id: "curiosity" | "perseverance";
	name: string;
	latestSol: number;
	earthDate: string;
	photos: MarsPhoto[];
};

type MarsGalleryData = {
	generatedAt: string;
	rovers: MarsRover[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isMarsPhoto(value: unknown): value is MarsPhoto {
	return (
		isRecord(value) &&
		typeof value.id === "string" &&
		typeof value.cameraId === "string" &&
		typeof value.cameraName === "string" &&
		typeof value.sol === "number" &&
		typeof value.earthDate === "string" &&
		typeof value.takenAt === "string" &&
		typeof value.imageUrl === "string" &&
		typeof value.fullImageUrl === "string" &&
		(value.title === undefined || typeof value.title === "string")
	);
}

function isMarsRover(value: unknown): value is MarsRover {
	return (
		isRecord(value) &&
		(value.id === "curiosity" || value.id === "perseverance") &&
		typeof value.name === "string" &&
		typeof value.latestSol === "number" &&
		typeof value.earthDate === "string" &&
		Array.isArray(value.photos) &&
		value.photos.every(isMarsPhoto)
	);
}

function isMarsGalleryData(value: unknown): value is MarsGalleryData {
	return (
		isRecord(value) &&
		typeof value.generatedAt === "string" &&
		Array.isArray(value.rovers) &&
		value.rovers.every(isMarsRover)
	);
}

let gallery = $state<MarsGalleryData | null>(null);
let selectedRover = $state<"curiosity" | "perseverance">("perseverance");
let selectedCamera = $state("all");
let loading = $state(true);
let errorMessage = $state("");

const activeRover = $derived(
	gallery?.rovers.find((rover) => rover.id === selectedRover),
);
const cameras = $derived(
	activeRover
		? [...new Set(activeRover.photos.map((photo) => photo.cameraId))].sort()
		: [],
);
const visiblePhotos = $derived(
	activeRover?.photos.filter(
		(photo) => selectedCamera === "all" || photo.cameraId === selectedCamera,
	) ?? [],
);

async function loadPhotos() {
	loading = true;
	errorMessage = "";

	try {
		const response = await fetch(
			`${import.meta.env.BASE_URL}data/mars-photos.json`,
			{ cache: "no-store" },
		);
		if (!response.ok) {
			throw new Error(`Mars gallery data returned HTTP ${response.status}`);
		}

		const data: unknown = await response.json();
		if (!isMarsGalleryData(data) || data.rovers.length === 0) {
			throw new Error("Mars gallery data has an unexpected format");
		}

		gallery = data;
		if (!data.rovers.some((rover) => rover.id === selectedRover)) {
			selectedRover = data.rovers[0].id;
		}
	} catch (error) {
		console.error("[Mars] Failed to load rover photos:", error);
		errorMessage = "Could not load Mars rover images. Please try again later.";
	} finally {
		loading = false;
	}
}

onMount(() => {
	void loadPhotos();
});
</script>

<section class="card-base mb-4 p-5 md:p-8">
	<div
		class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
	>
		<div>
			<h2 class="text-xl font-bold">Latest images from Mars</h2>
			<p class="mt-1 text-sm text-50">
				Photos from the latest available sols of NASA's Curiosity and
				Perseverance rovers, across all cameras.
			</p>
		</div>

		<div class="flex flex-wrap items-end gap-2">
			<label class="flex flex-col gap-1 text-sm text-50">
				<span>Rover</span>
				<select
					bind:value={selectedRover}
					onchange={() => (selectedCamera = "all")}
					class="rounded-lg border border-(--line-divider) bg-transparent px-3 py-2 text-(--text-color)"
					disabled={!gallery}
				>
					{#each gallery?.rovers ?? [] as rover (rover.id)}
						<option value={rover.id}>{rover.name}</option>
					{/each}
				</select>
			</label>

			<label class="flex flex-col gap-1 text-sm text-50">
				<span>Camera</span>
				<select
					bind:value={selectedCamera}
					class="rounded-lg border border-(--line-divider) bg-transparent px-3 py-2 text-(--text-color)"
					disabled={cameras.length === 0}
				>
					<option value="all">All cameras</option>
					{#each cameras as camera (camera)}
						<option value={camera}>{camera}</option>
					{/each}
				</select>
			</label>
		</div>
	</div>

	{#if loading}
		<p class="py-12 text-center text-50" role="status">
			Loading the latest Mars rover images…
		</p>
	{:else if errorMessage}
		<div class="py-12 text-center" role="status">
			<p class="text-75">{errorMessage}</p>
			<button
				class="btn-regular mt-4 rounded-lg px-4 py-2"
				type="button"
				onclick={() => loadPhotos()}
			>
				Try again
			</button>
		</div>
	{:else if activeRover}
		<div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
			<p class="text-sm text-50">
				{activeRover.name} · Sol {activeRover.latestSol} ·
				{activeRover.earthDate} · {visiblePhotos.length} photos
			</p>
			{#if gallery}
				<p class="text-xs text-50">
					Updated {new Date(gallery.generatedAt).toLocaleString()}
				</p>
			{/if}
		</div>

		{#if visiblePhotos.length === 0}
			<p class="py-12 text-center text-50" role="status">
				No photos were found for this camera on the latest sol.
			</p>
		{:else}
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
				{#each visiblePhotos as photo (photo.id)}
					<article
						class="overflow-hidden rounded-xl border border-(--line-divider)"
					>
						<a
							href={photo.fullImageUrl}
							target="_blank"
							rel="noreferrer"
							aria-label={`Open full-resolution ${photo.cameraName} photo from Sol ${photo.sol}`}
						>
							<img
								src={photo.imageUrl}
								alt={`${activeRover.name} ${photo.cameraName} photo, Sol ${photo.sol}, ${photo.earthDate}`}
								class="aspect-[4/3] w-full bg-black object-contain"
								loading="lazy"
								decoding="async"
							/>
						</a>
						<div class="p-4">
							<p class="font-semibold">{photo.cameraName}</p>
							<p class="mt-1 text-sm text-50">
								Sol {photo.sol} · {photo.earthDate}
							</p>
							{#if photo.title}
								<p class="mt-2 text-sm text-75">{photo.title}</p>
							{/if}
						</div>
					</article>
				{/each}
			</div>
		{/if}
	{/if}
</section>

<p class="text-center text-xs text-50">
	Imagery courtesy of
	<a
		class="underline hover:text-(--primary)"
		href="https://mars.nasa.gov/"
		target="_blank"
		rel="noreferrer"
	>
		NASA/JPL-Caltech
	</a>
	via
	<a
		class="underline hover:text-(--primary)"
		href="https://marsvista.dev/docs"
		target="_blank"
		rel="noreferrer"
	>
		Mars Vista API
	</a>.
</p>
