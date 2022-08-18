import youtubeDlExec from "youtube-dl-exec";

interface iGetYoutubeAudioURL {
  audioURL: string;
  error: Error | null;
}
export async function getYoutubeAudioURL(
  youtubeURL: string
): Promise<iGetYoutubeAudioURL> {
  try {
    // Get youtube download asset links
    const response = await youtubeDlExec(youtubeURL, {
      dumpSingleJson: true,
      noCheckCertificate: true,
      noWarnings: true,
      preferFreeFormats: true,
    });

    // Get best audio format
    const audioOnlyFormatInfo = response.formats.filter((cFormat) =>
      cFormat.format.includes("audio only")
    );

    if (audioOnlyFormatInfo.length === 0) {
      throw "no audio found for youtube URL";
    }
    const bestAudioFormatURL =
      audioOnlyFormatInfo[audioOnlyFormatInfo.length - 1].url;

    return { audioURL: bestAudioFormatURL, error: null };
  } catch (error) {
    return { audioURL: "", error: Error(`${error}`) };
  }
}
