import { decorateImageFrames, type ParentLike } from './image-frame'

export const rehypeImageFramePreviewRenderer = () => {
  return (tree: ParentLike) => {
    decorateImageFrames(tree)
  }
}
