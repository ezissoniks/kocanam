import { MAP } from "../map.js";
const [MAP_WIDTH, MAP_HEIGHT] = [MAP[0].length, MAP.length];

const resolveYIndex = y => {
	const iy = Math.floor(y);
	if (iy > 0) return iy;
	if (iy === 0) return 1;
	// Mirror rows for negative Y so the "behind" side is traversable and bounded.
	return Math.abs(iy) + 1;
};

export const isWall = (x, y) => {
	const ix = Math.floor(x);
	const iy = resolveYIndex(y);
	return ix < 0 || ix >= MAP_WIDTH || iy < 0 || iy >= MAP_HEIGHT || MAP[iy][ix] === 1;
};
