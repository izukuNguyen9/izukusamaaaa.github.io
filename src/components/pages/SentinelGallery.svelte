<script lang="ts">
import { onMount, tick } from "svelte";

type SentinelScene = {
	id: string;
	datetime: string;
	cloudCover: number;
	self: string;
	previewUrl: string;
	fullPreviewUrl: string;
	bounds?: [number, number, number, number];
};

type SentinelData = {
	generatedAt: string;
	searchDays: number;
	resultCount: number;
	scenes: SentinelScene[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isScene(value: unknown): value is SentinelScene {
	return (
		isRecord(value) &&
		typeof value.id === "string" &&
		typeof value.datetime === "string" &&
		typeof value.cloudCover === "number" &&
		typeof value.self === "string" &&
		typeof value.previewUrl === "string" &&
		typeof value.fullPreviewUrl === "string" &&
		(value.bounds === undefined ||
			(Array.isArray(value.bounds) &&
				value.bounds.length === 4 &&
				value.bounds.every((coordinate) => typeof coordinate === "number")))
	);
}

function isSentinelData(value: unknown): value is SentinelData {
	return (
		isRecord(value) &&
		typeof value.generatedAt === "string" &&
		typeof value.searchDays === "number" &&
		typeof value.resultCount === "number" &&
		Array.isArray(value.scenes) &&
		value.scenes.length > 0 &&
		value.scenes.length <= 15 &&
		value.scenes.every(isScene)
	);
}

let gallery = $state<SentinelData | null>(null);
let failedPreviewIds = $state<string[]>([]);
let selectedScene = $state<SentinelScene | null>(null);
let loading = $state(true);
let errorMessage = $state("");
let imageDialog: HTMLDialogElement;

async function loadScenes() {
	loading = true;
	errorMessage = "";

	try {
		const response = await fetch(
			`${import.meta.env.BASE_URL}data/sentinel-scenes.json`,
			{ cache: "no-store" },
		);
		if (!response.ok) {
			throw new Error(`Sentinel scene data returned HTTP ${response.status}`);
		}

		const data: unknown = await response.json();
		if (!isSentinelData(data)) {
			throw new Error("Sentinel scene data has an unexpected format");
		}

		gallery = data;
		failedPreviewIds = [];
	} catch (error) {
		console.error("[Earth] Failed to load Sentinel-2 scenes:", error);
		errorMessage = "Could not load Sentinel-2 imagery. Please try again later.";
	} finally {
		loading = false;
	}
}

function markPreviewFailed(sceneId: string) {
	if (!failedPreviewIds.includes(sceneId)) {
		failedPreviewIds = [...failedPreviewIds, sceneId];
	}
}

async function openScene(scene: SentinelScene) {
	selectedScene = scene;
	await tick();
	if (!imageDialog.open) imageDialog.showModal();
}

function handleDialogClick(event: MouseEvent) {
	if (event.target === imageDialog) imageDialog.close();
}

onMount(() => {
	void loadScenes();
});
</script>

<section class="card-base mb-4 p-5 md:p-8">
	<div
		class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
	>
		<div>
			<h2 class="text-xl font-bold">Latest Sentinel-2 images worldwide</h2>
			<p class="mt-1 text-sm text-50">
				The 15 newest scenes from the last 90 days, ordered by capture time.
				Cloud cover is shown for every scene; cloudy images are included.
			</p>
		</div>
		{#if gallery}
			<p class="text-xs text-50">
				Updated {new Date(gallery.generatedAt).toLocaleString()}
			</p>
		{/if}
	</div>

	{#if loading}
		<p class="py-12 text-center text-50" role="status">
			Finding the latest Sentinel-2 images worldwide…
		</p>
	{:else if errorMessage}
		<div class="py-12 text-center" role="status">
			<p class="text-75">{errorMessage}</p>
			<button
				class="btn-regular mt-4 rounded-lg px-4 py-2"
				type="button"
				onclick={() => loadScenes()}
			>
				Try again
			</button>
		</div>
	{:else if gallery}
		<p class="mb-4 text-sm text-50">
			Showing {gallery.scenes.length} newest scenes
			{#if gallery.resultCount > gallery.scenes.length}
				from {gallery.resultCount} recent search results
			{/if}
			within the last {gallery.searchDays} days.
		</p>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
			{#each gallery.scenes as scene, index (scene.id)}
				<article
					class="overflow-hidden rounded-xl border border-(--line-divider)"
				>
					{#if failedPreviewIds.includes(scene.id)}
						<div
							class="flex aspect-[4/3] items-center justify-center bg-black/10 p-4 text-center text-sm text-50"
							role="status"
						>
							Preview unavailable for this scene.
						</div>
					{:else}
						<a
							href={scene.previewUrl}
							aria-label={`View larger Sentinel-2 scene ${scene.id}`}
							onclick={(event) => {
								event.preventDefault();
								void openScene(scene);
							}}
						>
							<img
								src={scene.previewUrl}
								alt={`Sentinel-2 natural-color satellite scene captured ${scene.datetime}`}
								class="aspect-[4/3] w-full bg-black object-contain"
								loading={index < 3 ? "eager" : "lazy"}
								decoding="async"
								onerror={() => markPreviewFailed(scene.id)}
							/>
						</a>
					{/if}
					<div class="p-4">
						<div class="flex items-start justify-between gap-3">
							<p class="font-semibold">
								{new Date(scene.datetime).toLocaleString()}
							</p>
							<span
								class="shrink-0 rounded-full bg-(--btn-regular-bg) px-2.5 py-1 text-xs"
							>
								{scene.cloudCover.toFixed(1)}% clouds
							</span>
						</div>
						<p class="mt-2 break-all text-xs text-50">{scene.id}</p>
						{#if scene.bounds}
							<p class="mt-1 text-xs text-50">
								Bounds: {scene.bounds[0].toFixed(2)}°,
								{scene.bounds[1].toFixed(2)}° to
								{scene.bounds[2].toFixed(2)}°, {scene.bounds[3].toFixed(2)}°
							</p>
						{/if}
					</div>
				</article>
			{/each}
		</div>
	{/if}

	<dialog
		bind:this={imageDialog}
		class="m-auto max-h-[95vh] max-w-[95vw] overflow-auto rounded-xl bg-black p-3 text-white shadow-2xl backdrop:bg-black/80"
		onclick={handleDialogClick}
		onclose={() => (selectedScene = null)}
	>
		{#if selectedScene}
			<div class="mb-2 flex items-center justify-between gap-4">
				<p class="text-sm">
					Sentinel-2 · {new Date(selectedScene.datetime).toLocaleString()}
				</p>
				<button
					class="rounded-lg border border-white/40 px-3 py-1 text-sm hover:bg-white/10"
					type="button"
					onclick={() => imageDialog.close()}
				>
					Close
				</button>
			</div>
			<img
				src={selectedScene.fullPreviewUrl}
				alt={`Higher-resolution Sentinel-2 scene captured ${selectedScene.datetime}`}
				class="mx-auto max-h-[82vh] max-w-[92vw] object-contain"
				decoding="async"
			/>
			<a
				class="mt-2 inline-block text-sm underline hover:text-white/80"
				href={selectedScene.fullPreviewUrl}
				target="_blank"
				rel="noreferrer"
			>
				Open larger Sentinel-2 preview in new tab
			</a>
		{/if}
	</dialog>
</section>

<p class="text-center text-xs text-50">
	Sentinel-2 Level-2A imagery via
	<a
		class="underline hover:text-(--primary)"
		href="https://earth-search.aws.element84.com/"
		target="_blank"
		rel="noreferrer"
	>
		Earth Search
	</a>
	and
	<a
		class="underline hover:text-(--primary)"
		href="https://titiler.xyz/"
		target="_blank"
		rel="noreferrer"
	>
		TiTiler
	</a>
	(Copernicus Sentinel data).
</p>
