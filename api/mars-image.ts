import { Buffer } from "node:buffer";

type VercelRequest = {
	method?: string;
	query: Record<string, string | string[] | undefined>;
	headers: Record<string, string | undefined>;
};

type VercelResponse = {
	setHeader(name: string, value: string): void;
	status(code: number): VercelResponse;
	send(body: Buffer | string): void;
	end(): void;
};

const DEFAULT_ALLOWED_ORIGIN = "https://izukunguyen9.github.io";
const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
const IMAGE_PATH_PREFIXES = ["/msl-raw-images/", "/mars2020-raw-images/"];

function isAllowedImageUrl(value: string): URL | null {
	try {
		const url = new URL(value);
		const decodedPath = decodeURIComponent(url.pathname);
		const hasAllowedPath = IMAGE_PATH_PREFIXES.some((prefix) =>
			decodedPath.startsWith(prefix),
		);
		if (
			url.protocol !== "https:" ||
			url.hostname !== "mars.nasa.gov" ||
			url.username ||
			url.password ||
			url.search ||
			url.hash ||
			!hasAllowedPath ||
			!/\.(?:jpe?g|png)$/i.test(decodedPath) ||
			decodedPath.split("/").some((part) => part === "..")
		) {
			return null;
		}
		return url;
	} catch {
		return null;
	}
}

function sendError(response: VercelResponse, status: number, message: string) {
	response.setHeader("Content-Type", "application/json; charset=utf-8");
	response.status(status).send(JSON.stringify({ error: message }));
}

export default async function handler(
	request: VercelRequest,
	response: VercelResponse,
): Promise<void> {
	const allowedOrigin =
		process.env.MASTCAM_ALLOWED_ORIGIN ?? DEFAULT_ALLOWED_ORIGIN;
	const origin = request.headers.origin;
	const referer = request.headers.referer;
	const refererOrigin = (() => {
		try {
			return referer ? new URL(referer).origin : "";
		} catch {
			return "";
		}
	})();

	response.setHeader("X-Content-Type-Options", "nosniff");
	response.setHeader("Vary", "Origin");
	if (
		(origin && origin !== allowedOrigin) ||
		(!origin && refererOrigin !== allowedOrigin)
	) {
		return sendError(response, 403, "Origin is not allowed");
	}
	if (origin === allowedOrigin) {
		response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
	}
	if (request.method === "OPTIONS") {
		response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
		response.setHeader("Access-Control-Allow-Headers", "Accept");
		response.setHeader("Access-Control-Max-Age", "86400");
		return response.status(204).end();
	}
	if (request.method !== "GET") {
		response.setHeader("Allow", "GET, OPTIONS");
		return sendError(response, 405, "Method not allowed");
	}

	const source = request.query.url;
	if (typeof source !== "string" || !isAllowedImageUrl(source)) {
		return sendError(response, 400, "A valid NASA Mars image URL is required");
	}

	try {
		const upstream = await fetch(source, {
			redirect: "follow",
			signal: AbortSignal.timeout(20_000),
		});
		const finalUrl = isAllowedImageUrl(upstream.url);
		if (!upstream.ok || !finalUrl || !upstream.body) {
			return sendError(response, 502, "NASA image could not be retrieved");
		}

		const contentType = upstream.headers.get("content-type")?.split(";")[0];
		if (
			contentType !== "image/jpeg" &&
			contentType !== "image/png" &&
			contentType !== "image/jpg"
		) {
			return sendError(
				response,
				415,
				"NASA returned an unsupported image type",
			);
		}

		const contentLength = Number(upstream.headers.get("content-length"));
		if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_SIZE) {
			return sendError(response, 413, "NASA image exceeds the size limit");
		}

		const reader = upstream.body.getReader();
		const chunks: Uint8Array[] = [];
		let totalSize = 0;
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			totalSize += value.byteLength;
			if (totalSize > MAX_IMAGE_SIZE) {
				await reader.cancel();
				return sendError(response, 413, "NASA image exceeds the size limit");
			}
			chunks.push(value);
		}

		const image = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
		response.setHeader("Content-Type", contentType);
		response.setHeader("Content-Length", String(image.byteLength));
		response.setHeader(
			"Cache-Control",
			"public, max-age=3600, stale-while-revalidate=86400",
		);
		if (request.query.download === "1") {
			const filename = decodeURIComponent(
				finalUrl.pathname.split("/").at(-1) ?? "mars-image",
			).replace(/[^a-zA-Z0-9._-]/g, "_");
			response.setHeader(
				"Content-Disposition",
				`attachment; filename="${filename}"`,
			);
		}
		return response.status(200).send(image);
	} catch (error) {
		console.error("[Mars image proxy] NASA request failed:", error);
		return sendError(response, 502, "NASA image request failed");
	}
}
