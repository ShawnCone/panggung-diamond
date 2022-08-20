interface iVideosResponse {
  // There are more, but we only care about these values
  items: Array<{
    snippet: {
      title: string; // There are more, but we only care about the title
    };
  }>;
}

class YoutubeClient {
  private static API_TOKEN = "AIzaSyCbvz_ACeEKcC73h4K7szS5pvTG02nOLkk";
  private static client: YoutubeClient | null = null;

  private constructor() {}

  static getClient() {
    if (YoutubeClient.client === null) {
      YoutubeClient.client = new YoutubeClient();
    }

    return YoutubeClient.client;
  }

  // Parse ID from URL
  static getVideoIDFromURL(inURL: string): { videoID: string; found: boolean } {
    const urlObj = new URL(inURL);

    const videoID = urlObj.searchParams.get("v");

    if (videoID === null) {
      return { videoID: "", found: false };
    }

    return { videoID, found: true };
  }

  // Instance methods
  async getTitleFromURL(
    inURL: string
  ): Promise<{ title: string; error: Error | null }> {
    // Get video ID from URl
    const { videoID, found } = YoutubeClient.getVideoIDFromURL(inURL);

    if (!found) {
      return { title: "", error: new Error("video ID not found in URL") };
    }

    // Call API here
    try {
      const targetURL = new URL(
        "https://www.googleapis.com/youtube/v3/videos?"
      );
      targetURL.searchParams.set("part", "snippet");
      targetURL.searchParams.set("key", YoutubeClient.API_TOKEN);
      targetURL.searchParams.set("id", videoID);

      const response = await fetch(targetURL.href);

      const retJson = (await response.json()) as iVideosResponse;

      if (retJson.items.length === 0) {
        throw "no videos found!";
      }

      console.log({ content: retJson.items[0] });

      return { title: retJson.items[0].snippet.title, error: null };
    } catch (error) {
      return { title: "", error: new Error(`unable to get title from URL`) };
    }
  }
}
