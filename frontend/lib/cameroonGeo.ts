/** Align abstract grid coordinates with the static Cameroon map image. */

export const GRID_EXTENT = {
  minX: 190,
  maxX: 2140,
  minY: -1704,
  maxY: -164
}

export const MAP_IMAGE = {
  path: "/cameroon-map.png",
  width: 948,
  height: 521,
  left: 0.08,
  top: 0.03,
  widthFrac: 0.84,
  heightFrac: 0.94
}

export function mapImagePlacement() {
  const { minX, maxX, minY, maxY } = GRID_EXTENT
  const { width, height, left, top, widthFrac, heightFrac } = MAP_IMAGE
  const imgRect = {
    x: width * left,
    y: height * top,
    w: width * widthFrac,
    h: height * heightFrac
  }
  const scaleX = (maxX - minX) / imgRect.w
  const scaleY = (maxY - minY) / imgRect.h
  return {
    x: minX - imgRect.x * scaleX,
    y: minY - imgRect.y * scaleY,
    w: width * scaleX,
    h: height * scaleY
  }
}
