import { MAP } from "../map.js";
const [MAP_WIDTH, MAP_HEIGHT] = [MAP[0].length, MAP.length];
export const isWall = (x, y) => x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT || MAP[Math.floor(y)][Math.floor(x)] === 1;
export const getMapDimensions = () => ({ width: MAP_WIDTH, height: MAP_HEIGHT });