<script lang="ts">
import { onMount } from "svelte";

type EpicImage = {
	image: string;
	date: string;
	centroid_coordinates?: {
		lat: number;
		lon: number;
	};
};

function isEpicImage(value: unknown): value is EpicImage {
	if (
		typeof value !== "object" ||
		value === null ||
		!("image" in value) ||
		typeof value.image !== "string" ||
		!("date" in value) ||
		typeof value.date !== "string"
	) {
		return false;
	}

	if (
		!("centroid_coordinates" in value) ||
		value.centroid_coordinates == null
	) {
		return true;
	}

	return (
		typeof value.centroid_coordinates === "object" &&
		"lat" in value.centroid_coordinates &&
		typeof value.centroid_coordinates.lat === "number" &&
		"lon" in value.centroid_coordinates &&
		typeof value.centroid_coordinates.lon === "number"
	);
}

const API_URL = "https://epic.gsfc.nasa.gov/api/natural";
const ARCHIVE_URL = "https://epic.gsfc.nasa.gov/archive/natural";

let images = $state<EpicImage[]>([]);
let selectedDate = $state("");
let loading = $state(true);
let errorMessage = $state("");

async function loadImages(date?: string) {
	loading = true;
	errorMessage = "";
	images = [];

	try {
		const endpoint = date
			? `${API_URL}/date/${encodeURIComponent(date)}`
			: API_URL;
		const response = await fetch(endpoint);
		if (!response.ok) {
			throw new Error(`EPIC API returned HTTP ${response.status}`);
		}

		const data: unknown = await response.json();
		if (!Array.isArray(data)) {
			throw new Error("EPIC API returned an unexpected response");
		}

		images = data
			.filter(isEpicImage)
			.sort((a, b) => b.date.localeCompare(a.date));

		if (images.length === 0) {
			errorMessage = "No EPIC images are available for this date.";
		} else {
			selectedDate = images[0].date.slice(0, 10);
		}
	} catch (error) {
		console.error("[Earth] Failed to load NASA EPIC imagery:", error);
		errorMessage =
			"Could not load Earth images from NASA EPIC. Please try again later.";
	} finally {
		loading = false;
	}
}

function getImageUrl(image: EpicImage, size: "thumbs" | "png") {
	const [year, month, day] = image.date.slice(0, 10).split("-");
	const extension = size === "png" ? "png" : "jpg";
	return `${ARCHIVE_URL}/${year}/${month}/${day}/${size}/${image.image}.${extension}`;
}

function handleDateSubmit(event: SubmitEvent) {
	event.preventDefault();
	if (!selectedDate) return;
	void loadImages(selectedDate);
}

onMount(() => {
	void loadImages();
});
</script>

<section class="card-base mb-4 p-5 md:p-8">
	<div
		class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
	>
		<div>
			<h2 class="text-xl font-bold">Earth from space</h2>
			<p class="mt-1 text-sm text-50">
				Near-real-time natural-color images from NASA's EPIC camera aboard DSCOVR.
			</p>
		</div>

		<form class="flex items-end gap-2" onsubmit={handleDateSubmit}>
			<label class="flex flex-col gap-1 text-sm text-50">
				<span>Choose a date</span>
				<input
					type="date"
					bind:value={selectedDate}
					max={new Date().toISOString().slice(0, 10)}
					class="rounded-lg border border-(--line-divider) bg-transparent px-3 py-2 text-(--text-color)"
				/>
			</label>
			<button class="btn-regular rounded-lg px-4 py-2" type="submit">
				Load
			</button>
		</form>
	</div>

	{#if loading}
		<p class="py-12 text-center text-50" role="status">Loading NASA EPIC images…</p>
	{:else if errorMessage}
		<div class="py-12 text-center" role="status">
			<p class="text-75">{errorMessage}</p>
			<button
				class="btn-regular mt-4 rounded-lg px-4 py-2"
				type="button"
				onclick={() => loadImages(selectedDate || undefined)}
			>
				Try again
			</button>
		</div>
	{:else}
		<p class="mb-4 text-sm text-50">
			{images.length} images for {selectedDate}. Select an image to open its
			full-resolution PNG.
		</p>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
			{#each images as image (image.image)}
				<article class="overflow-hidden rounded-xl border border-(--line-divider)">
					<a
						href={getImageUrl(image, "png")}
						target="_blank"
						rel="noreferrer"
						aria-label={`Open full-resolution Earth image from ${image.date}`}
					>
						<img
							src={getImageUrl(image, "thumbs")}
							alt={`Natural-color image of Earth captured ${image.date} UTC`}
							class="aspect-square w-full bg-black object-contain"
							loading="lazy"
							decoding="async"
						/>
					</a>
					<div class="p-4">
						<p class="font-semibold">
							{image.date.slice(0, 16)} UTC
						</p>
						{#if image.centroid_coordinates}
							<p class="mt-1 text-sm text-50">
								View center: {image.centroid_coordinates.lat.toFixed(2)}°,
								{image.centroid_coordinates.lon.toFixed(2)}°
							</p>
						{/if}
					</div>
				</article>
			{/each}
		</div>
	{/if}
</section>

<p class="text-center text-xs text-50">
	Imagery and metadata:
	<a
		class="underline hover:text-(--primary)"
		href="https://epic.gsfc.nasa.gov/about/api"
		target="_blank"
		rel="noreferrer"
	>
		NASA EPIC / NOAA DSCOVR
	</a>
</p>
