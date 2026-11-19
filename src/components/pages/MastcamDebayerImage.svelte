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
} = $props<{
	src: string;
	alt: string;
	class?: string;
}>();

let canvas: HTMLCanvasElement;
let worker: Worker | null = null;
let started = false;
let isLoading = $state(true);
let errorMessage = $state("");
let aspectRatio = $state("4 / 3");

function startDebayer() {
	if (started) return;
	started = true;
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
		console.error("[Mars] Mastcam debayer worker error:", event.message);
		errorMessage = "Could not reconstruct this Mastcam image in color.";
		isLoading = false;
	};
	worker.postMessage({ url: src });
}

onMount(() => {
	if (typeof IntersectionObserver === "undefined") {
		startDebayer();
		return () => worker?.terminate();
	}

	const observer = new IntersectionObserver(
		(entries) => {
			if (entries.some((entry) => entry.isIntersecting)) {
				observer.disconnect();
				startDebayer();
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
</div>
