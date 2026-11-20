export function debayerMastcamRggb(
	source: Uint8ClampedArray,
	width: number,
	height: number,
	weights: [number, number, number] = [1, 1, 1],
): Uint8ClampedArray {
	if (
		!Number.isInteger(width) ||
		!Number.isInteger(height) ||
		width < 2 ||
		height < 2 ||
		source.length !== width * height * 4 ||
		weights.length !== 3 ||
		weights.some(
			(weight) => !Number.isFinite(weight) || weight < 0 || weight > 4,
		)
	) {
		throw new Error("Invalid Mastcam Bayer image data");
	}

	const output = new Uint8ClampedArray(source.length);
	const sample = (x: number, y: number) => {
		const safeX = Math.max(0, Math.min(width - 1, x));
		const safeY = Math.max(0, Math.min(height - 1, y));
		return source[(safeY * width + safeX) * 4];
	};

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const index = (y * width + x) * 4;
			const isRed = (y & 1) === 0 && (x & 1) === 0;
			const isBlue = (y & 1) === 1 && (x & 1) === 1;
			const isGreenOnRedRow = (y & 1) === 0;
			const center = sample(x, y);
			const left = sample(x - 1, y);
			const right = sample(x + 1, y);
			const up = sample(x, y - 1);
			const down = sample(x, y + 1);
			const left2 = sample(x - 2, y);
			const right2 = sample(x + 2, y);
			const up2 = sample(x, y - 2);
			const down2 = sample(x, y + 2);
			const diagonals =
				sample(x - 1, y - 1) +
				sample(x + 1, y - 1) +
				sample(x - 1, y + 1) +
				sample(x + 1, y + 1);
			const axial2 = left2 + right2 + up2 + down2;

			let red: number;
			let green: number;
			let blue: number;

			if (isRed) {
				red = center;
				green =
					0.5 * center + 0.25 * (left + right + up + down) - 0.125 * axial2;
				blue = 0.75 * center + 0.25 * diagonals - 0.1875 * axial2;
			} else if (isBlue) {
				red = 0.75 * center + 0.25 * diagonals - 0.1875 * axial2;
				green =
					0.5 * center + 0.25 * (left + right + up + down) - 0.125 * axial2;
				blue = center;
			} else {
				green = center;
				if (isGreenOnRedRow) {
					red =
						0.625 * center +
						0.5 * (left + right) -
						0.125 * (left2 + right2 + diagonals) +
						0.0625 * (up2 + down2);
					blue =
						0.625 * center +
						0.5 * (up + down) -
						0.125 * (up2 + down2 + diagonals) +
						0.0625 * (left2 + right2);
				} else {
					red =
						0.625 * center +
						0.5 * (up + down) -
						0.125 * (up2 + down2 + diagonals) +
						0.0625 * (left2 + right2);
					blue =
						0.625 * center +
						0.5 * (left + right) -
						0.125 * (left2 + right2 + diagonals) +
						0.0625 * (up2 + down2);
				}
			}

			output[index] = red * weights[0];
			output[index + 1] = green * weights[1];
			output[index + 2] = blue * weights[2];
			output[index + 3] = 255;
		}
	}

	return output;
}
