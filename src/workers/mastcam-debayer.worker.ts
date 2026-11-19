/// <reference lib="webworker" />

import { debayerMastcamRggb } from "@/utils/mastcam-debayer";

type DebayerRequest = {
	url: string;
};

self.onmessage = async (event: MessageEvent<DebayerRequest>) => {
	let image: ImageBitmap | null = null;

	try {
		const response = await fetch(event.data.url, { mode: "cors" });
		if (!response.ok) {
			throw new Error(`NASA image returned HTTP ${response.status}`);
		}

		image = await createImageBitmap(await response.blob());
		const canvas = new OffscreenCanvas(image.width, image.height);
		const context = canvas.getContext("2d", { willReadFrequently: true });
		if (!context)
			throw new Error("Could not create an image processing canvas");

		context.drawImage(image, 0, 0);
		const source = context.getImageData(0, 0, image.width, image.height);
		const pixels = debayerMastcamRggb(source.data, source.width, source.height);

		self.postMessage(
			{
				type: "result",
				width: source.width,
				height: source.height,
				pixels: pixels.buffer,
			},
			[pixels.buffer],
		);
	} catch (error) {
		self.postMessage({
			type: "error",
			message: error instanceof Error ? error.message : String(error),
		});
	} finally {
		image?.close();
	}
};
