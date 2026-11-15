<script lang="ts">
import { onMount } from "svelte";

type MarsPhoto = {
	id: string;
	nasaId: string;
	title: string;
	catalogDate: string;
	previewUrl: string;
	fullImageUrl: string;
	description?: string;
};

type MarsRover = {
	id: "curiosity" | "perseverance";
	name: string;
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
		typeof value.nasaId === "string" &&
		typeof value.title === "string" &&
		typeof value.catalogDate === "string" &&
		typeof value.previewUrl === "string" &&
		typeof value.fullImageUrl === "string" &&
		(value.description === undefined || typeof value.description === "string")
	);
}

function isMarsRover(value: unknown): value is MarsRover {
	return (
		isRecord(value) &&
		(value.id === "curiosity" || value.id === "perseverance") &&
		typeof value.name === "string" &&
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
let loading = $state(true);
let errorMessage = $state("");

const activeRover = $derived(
	gallery?.rovers.find((rover) => rover.id === selectedRover),
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
			<h2 class="text-xl font-bold">Mars images from NASA</h2>
			<p class="mt-1 text-sm text-50">
				Recent NASA catalog images mentioning Curiosity and Perseverance.
				These are not a live feed of the rovers' latest camera captures.
			</p>
		</div>

		<label class="flex flex-col gap-1 text-sm text-50">
			<span>Rover</span>
			<select
				bind:value={selectedRover}
				class="rounded-lg border border-(--line-divider) bg-transparent px-3 py-2 text-(--text-color)"
				disabled={!gallery}
			>
				{#each gallery?.rovers ?? [] as rover (rover.id)}
					<option value={rover.id}>{rover.name}</option>
				{/each}
			</select>
		</label>
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
				{activeRover.name} · {activeRover.photos.length} catalog images
			</p>
			{#if gallery}
				<p class="text-xs text-50">
					Updated {new Date(gallery.generatedAt).toLocaleString()}
				</p>
			{/if}
		</div>

		{#if activeRover.photos.length === 0}
			<p class="py-12 text-center text-50" role="status">
				No NASA catalog images were found for this rover.
			</p>
		{:else}
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
				{#each activeRover.photos as photo (photo.id)}
					<article
						class="overflow-hidden rounded-xl border border-(--line-divider)"
					>
						<a
							href={photo.fullImageUrl}
							target="_blank"
							rel="noreferrer"
							aria-label={`Open full-resolution NASA image: ${photo.title}`}
						>
							<img
								src={photo.previewUrl}
								alt={photo.title}
								class="aspect-[4/3] w-full bg-black object-contain"
								loading="lazy"
								decoding="async"
							/>
						</a>
						<div class="p-4">
							<p class="font-semibold">{photo.title}</p>
							<p class="mt-1 text-sm text-50">
								NASA catalog date: {photo.catalogDate.slice(0, 10)}
							</p>
							{#if photo.description}
								<p class="mt-2 line-clamp-4 text-sm text-75">
									{photo.description}
								</p>
							{/if}
						</div>
					</article>
				{/each}
			</div>
		{/if}
	{/if}
</section>

<p class="text-center text-xs text-50">
	Search results and imagery courtesy of
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
		href="https://images.nasa.gov/"
		target="_blank"
		rel="noreferrer"
	>
		NASA Images
	</a>.
</p>
