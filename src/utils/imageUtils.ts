import sharp from 'sharp';

export async function mergeCardImages(imageUrls: string[]): Promise<Buffer> {
  try {
    const imageBuffers = await Promise.all(
      imageUrls.map(async (url) => {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            console.warn(`Failed to fetch image: ${url}`);
            return null;
          }
          const arrayBuffer = await response.arrayBuffer();
          return Buffer.from(arrayBuffer);
        } catch (error) {
          console.warn(`Error fetching image ${url}:`, error);
          return null;
        }
      })
    );

    const validBuffers = imageBuffers.filter(buffer => buffer !== null) as Buffer[];

    if (validBuffers.length === 0) {
      throw new Error('No valid images to merge');
    }

    const CARD_WIDTH = 300;
    const CARD_HEIGHT = 400;
    const SPACING = 10;

    const resizedImages = await Promise.all(
      validBuffers.map(buffer =>
        sharp(buffer)
          .resize(CARD_WIDTH, CARD_HEIGHT, { fit: 'cover' })
          .toBuffer()
      )
    );

    const totalWidth = (CARD_WIDTH * resizedImages.length) + (SPACING * (resizedImages.length - 1));
    const canvas = sharp({
      create: {
        width: totalWidth,
        height: CARD_HEIGHT,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    });

    const compositeImages = resizedImages.map((buffer, index) => ({
      input: buffer,
      left: index * (CARD_WIDTH + SPACING),
      top: 0
    }));

    return await canvas.composite(compositeImages).png().toBuffer();
  } catch (error) {
    console.error('Error merging images:', error);
    throw error;
  }
}
