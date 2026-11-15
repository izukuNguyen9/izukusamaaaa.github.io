<script lang="ts">
import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { onMount, tick } from "svelte";

type SentinelScene = {
	id: string;
	datetime: string;
	cloudCover: number;
	self: string;
	tileJson: {
		tiles: string[];
		bounds: [number, number, number, number];
		center: [number, number, number];
		minzoom: number;
		maxzoom: number;
	};
};

type SentinelData = {
	generatedAt: string;
	region: string;
	searchDays: number;
	cloudThreshold: number;
	selectedByCloudFallback: boolean;
	selected: SentinelScene;
	latest: SentinelScene;
	resultCount: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isScene(value: unknown): value is SentinelScene {
	if (
		!isRecord(value) ||
		typeof value.id !== "string" ||
		typeof value.datetime !== "string" ||
		typeof value.cloudCover !== "number" ||
		typeof value.self !== "string" ||
		!isRecord(value.tileJson) ||
		!Array.isArray(value.tileJson.tiles) ||
		typeof value.tileJson.tiles[0] !== "string" ||
		!Array.isArray(value.tileJson.bounds) ||
		value.tileJson.bounds.length !== 4 ||
		!value.tileJson.bounds.every(
			(coordinate) => typeof coordinate === "number",
		) ||
		!Array.isArray(value.tileJson.center) ||
		value.tileJson.center.length !== 3 ||
		!value.tileJson.center.every(
			(coordinate) => typeof coordinate === "number",
		) ||
		typeof value.tileJson.minzoom !== "number" ||
		typeof value.tileJson.maxzoom !== "number"
	) {
		return false;
	}
	return true;
}

function isSentinelData(value: unknown): value is SentinelData {
	return (
		isRecord(value) &&
		typeof value.generatedAt === "string" &&
		value.region === "Vietnam" &&
		typeof value.searchDays === "number" &&
		typeof value.cloudThreshold === "number" &&
		typeof value.selectedByCloudFallback === "boolean" &&
		isScene(value.selected) &&
		isScene(value.latest) &&
		typeof value.resultCount === "number"
	);
}

let mapElement: HTMLDivElement;
let gallery = $state<SentinelData | null>(null);
let showLatest = $state(false);
let loading = $state(true);
let errorMessage = $state("");
let leaflet: typeof import("leaflet") | undefined;
let map: Leaflet.Map | undefined;
let sceneLayer: Leaflet.TileLayer | undefined;

const activeScene = $derived(
	gallery ? (showLatest ? gallery.latest : gallery.selected) : undefined,
);

function updateMapScene(scene: SentinelScene) {
	if (!leaflet || !map) return;
	sceneLayer?.remove();

	const [west, south, east, north] = scene.tileJson.bounds;
	const bounds: Leaflet.LatLngBoundsExpression = [
		[south, west],
		[north, east],
	];
	sceneLayer = leaflet
		.tileLayer(scene.tileJson.tiles[0], {
			minZoom: scene.tileJson.minzoom,
			maxZoom: scene.tileJson.maxzoom,
			bounds,
			attribution: "Sentinel-2 © Copernicus / TiTiler",
		})
		.addTo(map);
	map.fitBounds(bounds, { padding: [12, 12], maxZoom: scene.tileJson.maxzoom });
}

$effect(() => {
	const scene = activeScene;
	if (scene) updateMapScene(scene);
});

onMount(() => {
	let disposed = false;

	void (async () => {
		try {
			const [leafletModule, response] = await Promise.all([
				import("leaflet"),
				fetch(`${import.meta.env.BASE_URL}data/sentinel-scenes.json`, {
					cache: "no-store",
				}),
			]);
			if (!response.ok) {
				throw new Error(`Sentinel scene data returned HTTP ${response.status}`);
			}
			const data: unknown = await response.json();
			if (!isSentinelData(data)) {
				throw new Error("Sentinel scene data has an unexpected format");
			}
			if (disposed) return;

			leaflet = leafletModule;
			gallery = data;
			await tick();
			if (disposed) return;

			map = leafletModule.map(mapElement, {
				scrollWheelZoom: false,
				attributionControl: true,
			});
			leafletModule
				.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
					maxZoom: 19,
					attribution:
						'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
				})
				.addTo(map);
			updateMapScene(showLatest ? data.latest : data.selected);
		} catch (error) {
			console.error("[Earth] Failed to load Sentinel-2 scenes:", error);
			errorMessage =
				"Could not load Sentinel-2 imagery. Please try again later.";
		} finally {
			loading = false;
		}
	})();

	return () => {
		disposed = true;
		map?.remove();
		map = undefined;
	};
});
</script>

<section class="card-base mb-4 p-5 md:p-8">
	<div
		class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
	>
		<div>
			<h2 class="text-xl font-bold">Sentinel-2 over Vietnam</h2>
			<p class="mt-1 text-sm text-50">
				Latest available scene from the last 90 days with up to
				{gallery?.cloudThreshold ?? 25}% cloud cover. If none matches, the
				least-cloudy scene is shown.
			</p>
		</div>

		{#if gallery && gallery.latest.id !== gallery.selected.id}
			<button
				class="btn-regular rounded-lg px-4 py-2"
				type="button"
				onclick={() => (showLatest = !showLatest)}
			>
				{showLatest
					? "Use low-cloud scene"
					: `Show newest anyway (${gallery.latest.cloudCover.toFixed(1)}% clouds)`}
			</button>
		{/if}
	</div>

	{#if loading}
		<p class="py-12 text-center text-50" role="status">
			Finding Sentinel-2 scenes over Vietnam…
		</p>
	{:else if errorMessage}
		<div class="py-12 text-center" role="status">
			<p class="text-75">{errorMessage}</p>
		</div>
	{:else if gallery && activeScene}
		<div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
			<div>
				<p class="font-semibold">
					{showLatest ? "Newest available scene" : "Selected scene"}
				</p>
				<p class="text-sm text-50">
					{new Date(activeScene.datetime).toLocaleString()} ·
					{activeScene.cloudCover.toFixed(1)}% cloud cover
				</p>
			</div>
			<p class="text-xs text-50">
				{gallery.resultCount} scenes searched · updated
				{new Date(gallery.generatedAt).toLocaleString()}
			</p>
		</div>
		{#if gallery.selectedByCloudFallback && !showLatest}
			<p class="mb-3 text-sm text-50" role="status">
				No scene was below the cloud threshold; showing the least-cloudy
				result in the search window.
			</p>
		{/if}
		<div
			bind:this={mapElement}
			class="h-[55vh] min-h-[360px] max-h-[680px] overflow-hidden rounded-xl border border-(--line-divider)"
			role="application"
			aria-label="Interactive Sentinel-2 satellite map over Vietnam"
		></div>
		<p class="mt-3 text-xs text-50">
			Scene {activeScene.id}. Imagery: Sentinel-2 Level-2A via
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
			</a>.
		</p>
	{/if}
</section>
