<script lang="ts">
import { onMount } from "svelte";

type DebayerResponse =
	| {
			type: "result";
			width: number;
			height: number;
			pixels: ArrayBuffer;
	  }
	| {
			type: "error";
			message: string;
	  };

let {
	src,
	alt,
	class: className = "",
	proxyUrl = "",
	weights = [1, 1, 1],
	downloadFileName = "",
	downloadDisabled = false,
} = $props<{
	src: string;
	alt: string;
	class?: string;
	proxyUrl?: string;
	weights?: [number, number, number];
	downloadFileName?: string;
	downloadDisabled?: boolean;
}>();

let canvas: HTMLCanvasElement;
let worker: Worker | null = null;
let started = false;
let requestId = 0;
let isLoading = $state(true);
let errorMessage = $state("");
let downloadError = $state("");
let isDownloading = $state(false);
let aspectRatio = $state("4 / 3");

function startDebayer(currentWeights: [number, number, number]) {
	started = true;
	const currentRequest = ++requestId;
	worker?.terminate();
	worker = null;
	isLoading = true;
	errorMessage = "";
	if (!proxyUrl) {
		errorMessage = "Color reconstruction needs the Vercel image proxy.";
		isLoading = false;
		return;
	}

	try {
		worker = new Worker(
			new URL("../../workers/mastcam-debayer.worker.ts", import.meta.url),
			{ type: "module" },
		);
	} catch (error) {
		console.error("[Mars] Could not start Mastcam debayer worker:", error);
		errorMessage =
			"Could not start color reconstruction for this Mastcam image.";
		isLoading = false;
		return;
	}
	worker.onmessage = (event: MessageEvent<DebayerResponse>) => {
		if (currentRequest !== requestId) return;
		const result = event.data;
		if (result.type === "error") {
			errorMessage = result.message;
			console.error("[Mars] Mastcam debayer failed:", result.message);
			isLoading = false;
			return;
		}

		const context = canvas.getContext("2d");
		if (!context) {
			errorMessage = "Could not display the reconstructed Mastcam image.";
			isLoading = false;
			return;
		}

		canvas.width = result.width;
		canvas.height = result.height;
		aspectRatio = `${result.width} / ${result.height}`;
		context.putImageData(
			new ImageData(
				new Uint8ClampedArray(result.pixels),
				result.width,
				result.height,
			),
			0,
			0,
		);
		isLoading = false;
	};
	worker.onerror = (event) => {
		if (currentRequest !== requestId) return;
		console.error("[Mars] Mastcam debayer worker error:", event.message);
		errorMessage = "Could not reconstruct this Mastcam image in color.";
		isLoading = false;
	};
	worker.postMessage({ url: src, proxyUrl, weights: currentWeights });
}

function downloadPng() {
	if (!canvas || isLoading || errorMessage || !downloadFileName) return;
	isDownloading = true;
	downloadError = "";
	canvas.toBlob((blob) => {
		isDownloading = false;
		if (!blob) {
			downloadError = "Could not create the color PNG.";
			return;
		}

		const objectUrl = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = objectUrl;
		link.download = downloadFileName;
		link.click();
		window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
	}, "image/png");
}

onMount(() => {
	if (typeof IntersectionObserver === "undefined") {
		startDebayer(weights);
		return () => worker?.terminate();
	}

	const observer = new IntersectionObserver(
		(entries) => {
			if (entries.some((entry) => entry.isIntersecting)) {
				observer.disconnect();
				startDebayer(weights);
			}
		},
		{ rootMargin: "200px" },
	);
	observer.observe(canvas);

	return () => {
		observer.disconnect();
		worker?.terminate();
	};
});

$effect(() => {
	const currentWeights = weights;
	if (started) startDebayer(currentWeights);
});
</script>

<div class="relative w-full bg-black">
	<canvas
		bind:this={canvas}
		class={`block w-full ${className}`}
		style:aspect-ratio={aspectRatio}
		role="img"
		aria-label={alt}
	></canvas>
	{#if isLoading}
		<p
			class="absolute inset-0 flex items-center justify-center bg-black/70 p-3 text-center text-sm text-white"
			role="status"
		>
			Reconstructing Mastcam color…
		</p>
	{:else if errorMessage}
		<img
			src={src}
			alt={alt}
			class={`absolute inset-0 h-full w-full object-contain ${className}`}
			decoding="async"
		/>
		<p
			class="absolute inset-x-0 bottom-0 bg-black/80 p-2 text-center text-xs text-white"
			role="alert"
		>
			{errorMessage}. Showing the original NASA image.
		</p>
	{/if}
	{#if downloadFileName && proxyUrl}
		<button
			class="btn-regular mt-2 w-full rounded-lg px-4 py-2 text-sm"
			type="button"
			disabled={isLoading ||
				isDownloading ||
				Boolean(errorMessage) ||
				downloadDisabled}
			onclick={downloadPng}
		>
			{isDownloading ? "Preparing PNG…" : "Download debayered color PNG"}
		</button>
	{/if}
	{#if downloadError}
		<p class="mt-1 text-center text-xs text-red-300" role="alert">
			{downloadError}
		</p>
	{/if}
</div>
